import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { getAccessContext, requireTenantMember, resolveTenantId } from "./lib/auth";
import { ORDER_STATUS_LABELS, generateOrderNumber } from "./lib/shared";

// ---------------------------------------------------------------------------
// Staff/admin queries
// ---------------------------------------------------------------------------
export const listOrders = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, { status }) => {
    const access = await getAccessContext(ctx);
    if (!access) throw new Error("UNAUTHENTICATED");
    const tenantId = access.tenantId;
    if (!tenantId) return [];
    let orders = await ctx.db.query("orders").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).collect();
    orders.sort((a, b) => b.createdAt - a.createdAt);
    if (status) orders = orders.filter((o) => o.status === status);
    return orders.slice(0, 200);
  },
});

export const getOrder = query({
  args: { id: v.id("orders") },
  handler: async (ctx, { id }) => {
    const access = await getAccessContext(ctx);
    if (!access) throw new Error("UNAUTHENTICATED");
    const order = await ctx.db.get(id);
    if (!order) return null;
    resolveTenantId(access, order.tenantId);
    const items = await ctx.db.query("orderItems").withIndex("by_order", (q) => q.eq("orderId", id)).collect();
    const history = await ctx.db.query("orderStatusHistory").withIndex("by_order", (q) => q.eq("orderId", id)).collect();
    const payments = await ctx.db.query("payments").withIndex("by_order", (q) => q.eq("orderId", id)).collect();
    const links = await ctx.db.query("paymentLinks").withIndex("by_order", (q) => q.eq("orderId", id)).collect();
    return {
      ...order,
      items,
      history: history.sort((a, b) => a.createdAt - b.createdAt),
      payments,
      paymentLinks: links,
    };
  },
});

export const setOrderStatus = mutation({
  args: { orderId: v.id("orders"), status: v.string(), note: v.optional(v.string()) },
  handler: async (ctx, { orderId, status, note }) => {
    const access = await requireTenantMember(ctx);
    const order = await ctx.db.get(orderId);
    if (!order) throw new Error("Pedido no encontrado");
    const tenantId = resolveTenantId(access, order.tenantId);
    if (!Object.keys(ORDER_STATUS_LABELS).includes(status)) throw new Error("Estado inválido");
    await ctx.db.patch(orderId, { status, updatedAt: Date.now() });
    await ctx.db.insert("orderStatusHistory", {
      tenantId,
      orderId,
      fromStatus: order.status,
      toStatus: status,
      note,
      actor: access.user.name ?? access.user.email ?? "staff",
      createdAt: Date.now(),
    });
    return true;
  },
});

// ---------------------------------------------------------------------------
// Checkout (public, guest allowed)
// ---------------------------------------------------------------------------
export const checkout = mutation({
  args: {
    slug: v.string(),
    sessionKey: v.string(),
    customerName: v.string(),
    customerPhone: v.string(),
    customerEmail: v.optional(v.string()),
    deliveryRateId: v.optional(v.id("deliveryRates")),
    addressLine1: v.optional(v.string()),
    addressCity: v.optional(v.string()),
    addressRegion: v.optional(v.string()),
    addressReference: v.optional(v.string()),
    notes: v.optional(v.string()),
    couponCode: v.optional(v.string()),
    idempotencyKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Idempotency (§35)
    if (args.idempotencyKey) {
      const existing = await ctx.db
        .query("orders")
        .withIndex("by_idempotency_key", (q) => q.eq("idempotencyKey", args.idempotencyKey!))
        .first();
      if (existing) return { orderId: existing._id, orderNumber: existing.number, alreadyCreated: true };
    }

    const tenant = await ctx.db.query("tenants").withIndex("by_slug", (q) => q.eq("slug", args.slug)).first();
    if (!tenant) throw new Error("Tienda no encontrada");
    if (tenant.status === "suspended") throw new Error("Tienda suspendida");
    const tenantId = tenant._id;
    const currency = tenant.currency ?? "PEN";
    const now = Date.now();

    // Cart
    const cart = await ctx.db.query("carts").withIndex("by_tenant_session", (q) => q.eq("tenantId", tenantId).eq("sessionKey", args.sessionKey)).first();
    if (!cart) throw new Error("El carrito está vacío");
    const cartItems = await ctx.db.query("cartItems").withIndex("by_cart", (q) => q.eq("cartId", cart._id)).collect();
    if (cartItems.length === 0) throw new Error("El carrito está vacío");

    // Validate stock and compute totals (server-authoritative prices)
    const itemsTotal = cartItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);

    // Coupon
    let discountTotal = 0;
    let appliedCoupon: Doc<"coupons"> | null = null;
    if (args.couponCode && tenant.couponsEnabled) {
      const code = args.couponCode.toUpperCase().trim();
      const coupon = await ctx.db.query("coupons").withIndex("by_tenant_code", (q) => q.eq("tenantId", tenantId).eq("code", code)).first();
      if (!coupon || !coupon.isActive) throw new Error("Cupón no válido");
      if (coupon.endsAt && coupon.endsAt < now) throw new Error("El cupón ha expirado");
      if (coupon.maxUses !== undefined && coupon.usageCount >= coupon.maxUses) throw new Error("El cupón alcanzó su límite de usos");
      if (coupon.minAmount && itemsTotal < coupon.minAmount) throw new Error(`Monto mínimo para el cupón: ${coupon.minAmount}`);
      discountTotal = coupon.type === "percentage" ? Math.round(itemsTotal * (coupon.value / 100) * 100) / 100 : coupon.type === "fixed_amount" ? Math.min(coupon.value, itemsTotal) : 0;
      appliedCoupon = coupon;
    }

    // Delivery
    let deliveryTotal = 0;
    let deliveryRate: Doc<"deliveryRates"> | null = null;
    if (args.deliveryRateId) {
      const rate = await ctx.db.get(args.deliveryRateId);
      if (!rate || rate.tenantId !== tenantId || !rate.isActive) throw new Error("Método de entrega no válido");
      if (rate.minOrder && itemsTotal < rate.minOrder) throw new Error(`Pedido mínimo para ${rate.name}: ${rate.minOrder}`);
      deliveryTotal = rate.freeOver && itemsTotal - discountTotal >= rate.freeOver ? 0 : rate.price;
      if (rate.method !== "pickup" && !args.addressLine1) throw new Error("La dirección es requerida para delivery/envío");
      deliveryRate = rate;
    }

    const total = Math.max(0, Math.round((itemsTotal - discountTotal + deliveryTotal) * 100) / 100);

    // Customer upsert (scoped to tenant)
    let customerId: Id<"customers"> | undefined = undefined;
    if (args.customerEmail || args.customerPhone) {
      const email = args.customerEmail?.toLowerCase().trim();
      let existing: Doc<"customers"> | null = null;
      if (email) existing = await ctx.db.query("customers").withIndex("by_tenant_email", (q) => q.eq("tenantId", tenantId).eq("email", email)).first();
      if (!existing && args.customerPhone) existing = await ctx.db.query("customers").withIndex("by_tenant_phone", (q) => q.eq("tenantId", tenantId).eq("phone", args.customerPhone!)).first();
      if (existing) {
        customerId = existing._id;
        await ctx.db.patch(existing._id, { name: args.customerName, totalOrders: existing.totalOrders + 1, totalSpent: existing.totalSpent + total });
      } else {
        customerId = await ctx.db.insert("customers", {
          tenantId,
          name: args.customerName,
          email: email,
          phone: args.customerPhone,
          totalOrders: 1,
          totalSpent: total,
          createdAt: now,
        });
      }
    }

    // Create order + items
    const number = generateOrderNumber();
    const orderId = await ctx.db.insert("orders", {
      tenantId,
      number,
      customerId,
      customerName: args.customerName.slice(0, 120),
      customerEmail: args.customerEmail?.toLowerCase().trim(),
      customerPhone: args.customerPhone,
      status: "payment_pending",
      itemsTotal,
      discountTotal,
      deliveryTotal,
      total,
      currency,
      couponCode: appliedCoupon?.code,
      deliveryMethod: deliveryRate?.method,
      deliveryRateId: deliveryRate?._id,
      address: args.addressLine1 ? { line1: args.addressLine1.slice(0, 300), city: args.addressCity, region: args.addressRegion, reference: args.addressReference } : undefined,
      notes: args.notes?.slice(0, 1000),
      idempotencyKey: args.idempotencyKey,
      createdAt: now,
      updatedAt: now,
    });
    for (const item of cartItems) {
      await ctx.db.insert("orderItems", {
        tenantId,
        orderId,
        productId: item.productId,
        variantId: item.variantId,
        name: item.name,
        variantLabel: item.variantLabel,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        total: item.unitPrice * item.quantity,
        imageUrl: item.imageUrl,
      });
      // Decrement stock
      if (item.variantId) {
        const variant = await ctx.db.get(item.variantId);
        if (variant) await ctx.db.patch(variant._id, { stock: Math.max(0, variant.stock - item.quantity) });
      } else {
        const product = await ctx.db.get(item.productId);
        if (product) await ctx.db.patch(product._id, { stock: Math.max(0, product.stock - item.quantity), updatedAt: now });
      }
      await ctx.db.insert("inventoryMovements", { tenantId, productId: item.productId, variantId: item.variantId, delta: -item.quantity, reason: `Pedido #${number}`, orderId, createdAt: now });
    }

    // Coupon usage
    if (appliedCoupon) {
      await ctx.db.patch(appliedCoupon._id, { usageCount: appliedCoupon.usageCount + 1 });
      await ctx.db.insert("couponUsages", { tenantId, couponId: appliedCoupon._id, orderId, customerEmail: args.customerEmail?.toLowerCase(), amount: discountTotal, createdAt: now });
    }

    // History + analytics
    await ctx.db.insert("orderStatusHistory", { tenantId, orderId, toStatus: "payment_pending", actor: "checkout", createdAt: now });
    await ctx.db.insert("analyticsEvents", { tenantId, type: "order_created", value: total, createdAt: now });

    // Clear cart
    for (const item of cartItems) await ctx.db.delete(item._id);

    return { orderId, orderNumber: number, alreadyCreated: false };
  },
});

// ---------------------------------------------------------------------------
// Public order lookup (by number + phone)
// ---------------------------------------------------------------------------
export const lookupPublicOrder = query({
  args: { slug: v.string(), number: v.string(), phone: v.string() },
  handler: async (ctx, { slug, number, phone }) => {
    const tenant = await ctx.db.query("tenants").withIndex("by_slug", (q) => q.eq("slug", slug)).first();
    if (!tenant) return null;
    const order = await ctx.db
      .query("orders")
      .withIndex("by_tenant_number", (q) => q.eq("tenantId", tenant._id).eq("number", number.toUpperCase().trim()))
      .first();
    if (!order) return null;
    // Only reveal to the phone that placed the order
    if (order.customerPhone.replace(/[^0-9]/g, "") !== phone.replace(/[^0-9]/g, "")) return null;
    const items = await ctx.db.query("orderItems").withIndex("by_order", (q) => q.eq("orderId", order._id)).collect();
    const link = await ctx.db.query("paymentLinks").withIndex("by_order", (q) => q.eq("orderId", order._id)).filter((q) => q.eq(q.field("status"), "pending")).first();
    return {
      number: order.number,
      status: order.status,
      statusLabel: ORDER_STATUS_LABELS[order.status] ?? order.status,
      total: order.total,
      currency: order.currency,
      items: items.map((i) => ({ name: i.name, variantLabel: i.variantLabel, quantity: i.quantity, total: i.total })),
      paymentUrl: link?.url ?? null,
      createdAt: order.createdAt,
    };
  },
});
