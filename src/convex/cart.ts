import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { buildCartMessage, formatMoney, whatsappLink } from "./lib/shared";

/**
 * Public, guest-friendly cart stored server-side per (tenant, sessionKey).
 * The sessionKey is a random id kept in the browser's localStorage.
 */

async function resolveTenant(ctx: any, slug: string) {
  const tenant = await ctx.db.query("tenants").withIndex("by_slug", (q: any) => q.eq("slug", slug)).first();
  if (!tenant) throw new Error("Tienda no encontrada");
  if (tenant.status === "suspended") throw new Error("Tienda suspendida");
  return tenant;
}

async function getOrCreateCart(ctx: any, tenantId: Id<"tenants">, sessionKey: string) {
  let cart = await ctx.db.query("carts").withIndex("by_tenant_session", (q: any) => q.eq("tenantId", tenantId).eq("sessionKey", sessionKey)).first();
  if (!cart) {
    const now = Date.now();
    const id = await ctx.db.insert("carts", { tenantId, sessionKey, createdAt: now, updatedAt: now });
    cart = await ctx.db.get(id);
  }
  return cart;
}

export const getCart = query({
  args: { slug: v.string(), sessionKey: v.string() },
  handler: async (ctx, { slug, sessionKey }) => {
    const tenant = await ctx.db.query("tenants").withIndex("by_slug", (q) => q.eq("slug", slug)).first();
    if (!tenant || tenant.status === "suspended") return { items: [], subtotal: 0, itemCount: 0, currency: "PEN", whatsappUrl: null };
    const cart = await ctx.db.query("carts").withIndex("by_tenant_session", (q) => q.eq("tenantId", tenant._id).eq("sessionKey", sessionKey)).first();
    const items = cart ? await ctx.db.query("cartItems").withIndex("by_cart", (q) => q.eq("cartId", cart._id)).collect() : [];
    const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const whatsappUrl =
      tenant.whatsappEnabled && tenant.whatsappPhone && items.length > 0
        ? whatsappLink(tenant.whatsappPhone, buildCartMessage(items.map((i) => ({ name: i.name, quantity: i.quantity, variantLabel: i.variantLabel })), subtotal, tenant.currency ?? "PEN"))
        : null;
    return {
      items: items.sort((a, b) => a._creationTime - b._creationTime),
      subtotal,
      itemCount: items.reduce((s, i) => s + i.quantity, 0),
      currency: tenant.currency ?? "PEN",
      whatsappUrl,
    };
  },
});

export const addToCart = mutation({
  args: {
    slug: v.string(),
    sessionKey: v.string(),
    productId: v.id("products"),
    variantId: v.optional(v.id("productVariants")),
    quantity: v.number(),
  },
  handler: async (ctx, { slug, sessionKey, productId, variantId, quantity }) => {
    const tenant = await resolveTenant(ctx, slug);
    if (quantity < 1 || quantity > 99) throw new Error("Cantidad inválida");
    const product = await ctx.db.get(productId);
    if (!product || product.tenantId !== tenant._id || product.status !== "active") throw new Error("Producto no disponible");
    let unitPrice = product.price;
    let name = product.name;
    let variantLabel: string | undefined;
    let imageUrl = product.images?.[0];
    if (variantId) {
      const variant = await ctx.db.get(variantId);
      if (!variant || variant.tenantId !== tenant._id || variant.productId !== productId) throw new Error("Variante no válida");
      if (variant.price !== undefined) unitPrice = variant.price;
      unitPrice = variant.price ?? unitPrice;
      variantLabel = variant.options.map((o) => o.value).join(" / ");
      if (variant.imageUrl) imageUrl = variant.imageUrl;
    }
    const stock = variantId ? (await ctx.db.get(variantId))!.stock : product.stock;
    const cart = await getOrCreateCart(ctx, tenant._id, sessionKey);
    const existing = (await ctx.db.query("cartItems").withIndex("by_cart", (q) => q.eq("cartId", cart._id)).collect()).find(
      (i) => i.productId === productId && (i.variantId ?? undefined) === (variantId ?? undefined),
    );
    const newQty = Math.min((existing?.quantity ?? 0) + quantity, Math.max(stock, 1), 99);
    if (stock <= 0) throw new Error("Producto agotado");
    if (existing) await ctx.db.patch(existing._id, { quantity: newQty });
    else await ctx.db.insert("cartItems", { cartId: cart._id, tenantId: tenant._id, productId, variantId: variantId ?? undefined, name, variantLabel, unitPrice, quantity: newQty, imageUrl });
    await ctx.db.patch(cart._id, { updatedAt: Date.now() });
  },
});

export const updateCartItem = mutation({
  args: { slug: v.string(), sessionKey: v.string(), itemId: v.id("cartItems"), quantity: v.number() },
  handler: async (ctx, { slug, sessionKey, itemId, quantity }) => {
    const tenant = await resolveTenant(ctx, slug);
    const cart = await ctx.db.query("carts").withIndex("by_tenant_session", (q) => q.eq("tenantId", tenant._id).eq("sessionKey", sessionKey)).first();
    if (!cart) throw new Error("Carrito no encontrado");
    const item = await ctx.db.get(itemId);
    if (!item || item.cartId !== cart._id) throw new Error("Ítem no encontrado");
    if (quantity <= 0) {
      await ctx.db.delete(itemId);
      return;
    }
    await ctx.db.patch(itemId, { quantity: Math.min(quantity, 99) });
    await ctx.db.patch(cart._id, { updatedAt: Date.now() });
  },
});

export const removeCartItem = mutation({
  args: { slug: v.string(), sessionKey: v.string(), itemId: v.id("cartItems") },
  handler: async (ctx, { slug, sessionKey, itemId }) => {
    const tenant = await resolveTenant(ctx, slug);
    const cart = await ctx.db.query("carts").withIndex("by_tenant_session", (q) => q.eq("tenantId", tenant._id).eq("sessionKey", sessionKey)).first();
    if (!cart) return;
    const item = await ctx.db.get(itemId);
    if (item && item.cartId === cart._id) await ctx.db.delete(itemId);
  },
});

export const clearCart = mutation({
  args: { slug: v.string(), sessionKey: v.string() },
  handler: async (ctx, { slug, sessionKey }) => {
    const tenant = await resolveTenant(ctx, slug);
    const cart = await ctx.db.query("carts").withIndex("by_tenant_session", (q) => q.eq("tenantId", tenant._id).eq("sessionKey", sessionKey)).first();
    if (!cart) return;
    const items = await ctx.db.query("cartItems").withIndex("by_cart", (q) => q.eq("cartId", cart._id)).collect();
    for (const i of items) await ctx.db.delete(i._id);
  },
});
