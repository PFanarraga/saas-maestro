import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { audit, getAccessContext, requireTenantMember, resolveTenantId, sanitizeText } from "./lib/auth";
import { slugify } from "./lib/shared";

export async function getPlanLimits(ctx: any, tenantId: Id<"tenants">) {
  const tenant = await ctx.db.get(tenantId);
  const plan = tenant ? await ctx.db.query("plans").withIndex("by_code", (q: any) => q.eq("code", tenant.planCode)).first() : null;
  return plan?.limits ?? null;
}

// ---------------------------------------------------------------------------
// Categories (hierarchical)
// ---------------------------------------------------------------------------
export const listCategories = query({
  args: { tenantId: v.optional(v.id("tenants")) },
  handler: async (ctx, { tenantId }) => {
    const access = await getAccessContext(ctx);
    if (!access) throw new Error("UNAUTHENTICATED");
    const effective = access.isSuperAdmin ? tenantId : access.tenantId;
    if (!effective) return [];
    return await ctx.db.query("categories").withIndex("by_tenant", (q) => q.eq("tenantId", effective)).collect();
  },
});

export const listPublicCategories = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const tenant = await ctx.db.query("tenants").withIndex("by_slug", (q) => q.eq("slug", slug)).first();
    if (!tenant || tenant.status === "suspended") return [];
    const cats = await ctx.db.query("categories").withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id)).collect();
    return cats.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  },
});

export const saveCategory = mutation({
  args: {
    id: v.optional(v.id("categories")),
    tenantId: v.optional(v.id("tenants")),
    name: v.string(),
    parentId: v.optional(v.id("categories")),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    position: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const access = await requireTenantMember(ctx, args.tenantId);
    const tenantId = resolveTenantId(access, args.tenantId);
    const now = Date.now();
    if (args.id) {
      const existing = await ctx.db.get(args.id);
      if (!existing || existing.tenantId !== tenantId) throw new Error("Categoría no encontrada");
      await ctx.db.patch(args.id, {
        name: sanitizeText(args.name, 120),
        parentId: args.parentId,
        description: args.description ? sanitizeText(args.description, 1000) : undefined,
        imageUrl: args.imageUrl,
        position: args.position,
      });
      await audit(ctx, { actorId: access.userId, actorLabel: access.user.email ?? "admin", tenantId, action: "CATEGORY_UPDATED", resource: "category", resourceId: args.id });
      return args.id;
    }
    let slug = slugify(args.name);
    const dup = await ctx.db.query("categories").withIndex("by_tenant_slug", (q) => q.eq("tenantId", tenantId).eq("slug", slug)).first();
    if (dup) slug = `${slug}-${now.toString(36).slice(-4)}`;
    const id = await ctx.db.insert("categories", {
      tenantId,
      name: sanitizeText(args.name, 120),
      slug,
      parentId: args.parentId,
      description: args.description ? sanitizeText(args.description, 1000) : undefined,
      imageUrl: args.imageUrl,
      position: args.position ?? 0,
    });
    await audit(ctx, { actorId: access.userId, actorLabel: access.user.email ?? "admin", tenantId, action: "CATEGORY_CREATED", resource: "category", resourceId: id });
    return id;
  },
});

export const deleteCategory = mutation({
  args: { id: v.id("categories") },
  handler: async (ctx, { id }) => {
    const access = await requireTenantMember(ctx);
    const cat = await ctx.db.get(id);
    if (!cat) throw new Error("Categoría no encontrada");
    const tenantId = resolveTenantId(access, cat.tenantId);
    // Detach children and products
    const children = await ctx.db.query("categories").withIndex("by_tenant_parent", (q) => q.eq("tenantId", tenantId).eq("parentId", id)).collect();
    for (const c of children) await ctx.db.patch(c._id, { parentId: undefined });
    const products = await ctx.db.query("products").withIndex("by_tenant_category", (q) => q.eq("tenantId", tenantId).eq("categoryId", id)).collect();
    for (const p of products) await ctx.db.patch(p._id, { categoryId: undefined });
    await ctx.db.delete(id);
    await audit(ctx, { actorId: access.userId, actorLabel: access.user.email ?? "admin", tenantId, action: "CATEGORY_DELETED", resource: "category", resourceId: id });
  },
});

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------
export type ProductWithExtras = Doc<"products"> & {
  categoryName?: string | null;
};

export const listProducts = query({
  args: {
    tenantId: v.optional(v.id("tenants")),
    status: v.optional(v.union(v.literal("active"), v.literal("draft"), v.literal("archived"))),
    search: v.optional(v.string()),
    categoryId: v.optional(v.id("categories")),
    paginationOpts: v.optional(v.object({ numItems: v.number(), cursor: v.union(v.string(), v.null()) })),
  },
  handler: async (ctx, { tenantId, status, search, categoryId, paginationOpts }) => {
    const access = await getAccessContext(ctx);
    if (!access) throw new Error("UNAUTHENTICATED");
    const effective = access.isSuperAdmin ? tenantId : access.tenantId;
    if (!effective) return { page: [], isDone: true, continueCursor: "" };
    let q = ctx.db.query("products").withIndex("by_tenant_status", (qb) => qb.eq("tenantId", effective).eq("status", status ?? "active"));
    const page = await (paginationOpts ? q.paginate(paginationOpts) : q.take(500));
    let items = "page" in page ? page.page : page;
    if (search) {
      const s = search.toLowerCase();
      items = items.filter((p) => p.name.toLowerCase().includes(s) || (p.sku ?? "").toLowerCase().includes(s));
    }
    if (categoryId) items = items.filter((p) => p.categoryId === categoryId);
    const catMap = new Map((await ctx.db.query("categories").withIndex("by_tenant", (x) => x.eq("tenantId", effective)).collect()).map((c) => [c._id, c.name]));
    const withExtras: ProductWithExtras[] = items.map((p) => ({ ...p, categoryName: p.categoryId ? catMap.get(p.categoryId) ?? null : null }));
    if ("page" in page) return { page: withExtras, isDone: page.isDone, continueCursor: page.continueCursor };
    return { page: withExtras, isDone: true, continueCursor: "" };
  },
});

export const getProduct = query({
  args: { id: v.id("products") },
  handler: async (ctx, { id }) => {
    const access = await getAccessContext(ctx);
    if (!access) throw new Error("UNAUTHENTICATED");
    const product = await ctx.db.get(id);
    if (!product) return null;
    resolveTenantId(access, product.tenantId); // isolation check
    const variants = await ctx.db.query("productVariants").withIndex("by_product", (q) => q.eq("productId", id)).collect();
    return { ...product, variants };
  },
});

async function uniqueProductSlug(ctx: any, tenantId: Id<"tenants">, base: string): Promise<string> {
  let slug = slugify(base) || "producto";
  const dup = await ctx.db.query("products").withIndex("by_tenant_slug", (q: any) => q.eq("tenantId", tenantId).eq("slug", slug)).first();
  if (dup) slug = `${slug}-${Date.now().toString(36).slice(-5)}`;
  return slug;
}

export const saveProduct = mutation({
  args: {
    id: v.optional(v.id("products")),
    tenantId: v.optional(v.id("tenants")),
    name: v.string(),
    description: v.optional(v.string()),
    shortDescription: v.optional(v.string()),
    sku: v.optional(v.string()),
    price: v.number(),
    comparePrice: v.optional(v.number()),
    cost: v.optional(v.number()),
    stock: v.number(),
    status: v.union(v.literal("active"), v.literal("draft"), v.literal("archived")),
    featured: v.boolean(),
    categoryId: v.optional(v.id("categories")),
    brandId: v.optional(v.id("brands")),
    images: v.optional(v.array(v.string())),
    hasVariants: v.optional(v.boolean()),
    options: v.optional(v.array(v.object({ name: v.string(), values: v.array(v.string()) }))),
  },
  handler: async (ctx, args) => {
    const access = await requireTenantMember(ctx, args.tenantId);
    const tenantId = resolveTenantId(access, args.tenantId);
    if (args.price < 0) throw new Error("El precio no puede ser negativo");
    const limits = await getPlanLimits(ctx, tenantId);
    const now = Date.now();

    if (args.id) {
      const existing = await ctx.db.get(args.id);
      if (!existing || existing.tenantId !== tenantId) throw new Error("Producto no encontrado");
      await ctx.db.patch(args.id, {
        name: sanitizeText(args.name, 200),
        description: args.description ? sanitizeText(args.description, 20000) : undefined,
        shortDescription: args.shortDescription ? sanitizeText(args.shortDescription, 500) : undefined,
        sku: args.sku,
        price: args.price,
        comparePrice: args.comparePrice,
        cost: args.cost,
        stock: args.stock,
        status: args.status,
        featured: args.featured,
        categoryId: args.categoryId,
        brandId: args.brandId,
        images: args.images,
        hasVariants: args.hasVariants,
        options: args.options,
        updatedAt: now,
      });
      await audit(ctx, { actorId: access.userId, actorLabel: access.user.email ?? "admin", tenantId, action: "PRODUCT_UPDATED", resource: "product", resourceId: args.id, oldData: { name: existing.name, price: existing.price, stock: existing.stock }, newData: { name: args.name, price: args.price, stock: args.stock } });
      return args.id;
    }

    if (limits) {
      const count = await ctx.db.query("products").withIndex("by_tenant_status", (q) => q.eq("tenantId", tenantId).eq("status", "active")).collect();
      if (count.length >= limits.maxProducts) throw new Error(`Límite del plan alcanzado (${limits.maxProducts} productos). Mejora tu plan para agregar más.`);
    }
    const slug = await uniqueProductSlug(ctx, tenantId, args.name);
    const id = await ctx.db.insert("products", {
      tenantId,
      name: sanitizeText(args.name, 200),
      slug,
      description: args.description ? sanitizeText(args.description, 20000) : undefined,
      shortDescription: args.shortDescription ? sanitizeText(args.shortDescription, 500) : undefined,
      sku: args.sku,
      price: args.price,
      comparePrice: args.comparePrice,
      cost: args.cost,
      stock: args.stock,
      status: args.status,
      featured: args.featured,
      categoryId: args.categoryId,
      brandId: args.brandId,
      images: args.images,
      hasVariants: args.hasVariants,
      options: args.options,
      createdAt: now,
      updatedAt: now,
    });
    await audit(ctx, { actorId: access.userId, actorLabel: access.user.email ?? "admin", tenantId, action: "PRODUCT_CREATED", resource: "product", resourceId: id, newData: { name: args.name, price: args.price } });
    return id;
  },
});

export const deleteProduct = mutation({
  args: { id: v.id("products") },
  handler: async (ctx, { id }) => {
    const access = await requireTenantMember(ctx);
    const product = await ctx.db.get(id);
    if (!product) throw new Error("Producto no encontrado");
    const tenantId = resolveTenantId(access, product.tenantId);
    const variants = await ctx.db.query("productVariants").withIndex("by_product", (q) => q.eq("productId", id)).collect();
    for (const v of variants) await ctx.db.delete(v._id);
    await ctx.db.delete(id);
    await audit(ctx, { actorId: access.userId, actorLabel: access.user.email ?? "admin", tenantId, action: "PRODUCT_DELETED", resource: "product", resourceId: id });
  },
});

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------
export const saveVariant = mutation({
  args: {
    id: v.optional(v.id("productVariants")),
    productId: v.id("products"),
    sku: v.optional(v.string()),
    options: v.array(v.object({ name: v.string(), value: v.string() })),
    price: v.optional(v.number()),
    stock: v.number(),
    imageUrl: v.optional(v.string()),
    weight: v.optional(v.number()),
    dimensions: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireTenantMember(ctx);
    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Producto no encontrado");
    const tenantId = resolveTenantId(access, product.tenantId);
    const data = {
      tenantId,
      productId: args.productId,
      sku: args.sku,
      options: args.options,
      price: args.price,
      stock: args.stock,
      imageUrl: args.imageUrl,
      weight: args.weight,
      dimensions: args.dimensions,
    };
    if (args.id) {
      const existing = await ctx.db.get(args.id);
      if (!existing || existing.tenantId !== tenantId) throw new Error("Variante no encontrada");
      await ctx.db.patch(args.id, data);
      return args.id;
    }
    const id = await ctx.db.insert("productVariants", data);
    await ctx.db.patch(args.productId, { hasVariants: true, updatedAt: Date.now() });
    return id;
  },
});

export const deleteVariant = mutation({
  args: { id: v.id("productVariants") },
  handler: async (ctx, { id }) => {
    const access = await requireTenantMember(ctx);
    const variant = await ctx.db.get(id);
    if (!variant) throw new Error("Variante no encontrada");
    resolveTenantId(access, variant.tenantId);
    await ctx.db.delete(id);
  },
});

/** Generates the variant matrix from product options (e.g. Color×Talla). */
export const generateVariants = mutation({
  args: { productId: v.id("products") },
  handler: async (ctx, { productId }) => {
    const access = await requireTenantMember(ctx);
    const product = await ctx.db.get(productId);
    if (!product) throw new Error("Producto no encontrado");
    const tenantId = resolveTenantId(access, product.tenantId);
    const options = product.options ?? [];
    if (options.length === 0) throw new Error("El producto no tiene opciones definidas");
    const existing = await ctx.db.query("productVariants").withIndex("by_product", (q) => q.eq("productId", productId)).collect();
    const existingKey = new Set(existing.map((v) => v.options.map((o) => `${o.name}:${o.value}`).sort().join("|")));
    let created = 0;
    let combos: Array<Array<{ name: string; value: string }>> = [[]];
    for (const opt of options) {
      const next: Array<Array<{ name: string; value: string }>> = [];
      for (const combo of combos) {
        for (const value of opt.values) next.push([...combo, { name: opt.name, value }]);
      }
      combos = next;
    }
    for (const combo of combos) {
      const key = combo.map((o) => `${o.name}:${o.value}`).sort().join("|");
      if (existingKey.has(key)) continue;
      await ctx.db.insert("productVariants", {
        tenantId,
        productId,
        options: combo,
        stock: 0,
        price: undefined,
      });
      created++;
    }
    await ctx.db.patch(productId, { hasVariants: true, updatedAt: Date.now() });
    return created;
  },
});

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------
export const adjustStock = mutation({
  args: {
    productId: v.id("products"),
    variantId: v.optional(v.id("productVariants")),
    delta: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, { productId, variantId, delta, reason }) => {
    const access = await requireTenantMember(ctx);
    const product = await ctx.db.get(productId);
    if (!product) throw new Error("Producto no encontrado");
    const tenantId = resolveTenantId(access, product.tenantId);
    if (variantId) {
      const variant = await ctx.db.get(variantId);
      if (!variant || variant.tenantId !== tenantId) throw new Error("Variante no encontrada");
      await ctx.db.patch(variantId, { stock: Math.max(0, variant.stock + delta) });
    } else {
      await ctx.db.patch(productId, { stock: Math.max(0, product.stock + delta), updatedAt: Date.now() });
    }
    await ctx.db.insert("inventoryMovements", { tenantId, productId, variantId, delta, reason, createdAt: Date.now() });
    await audit(ctx, { actorId: access.userId, actorLabel: access.user.email ?? "admin", tenantId, action: "STOCK_ADJUSTED", resource: "product", resourceId: productId, newData: { delta, reason } });
  },
});

export const listInventoryMovements = query({
  args: { productId: v.id("products") },
  handler: async (ctx, { productId }) => {
    const access = await getAccessContext(ctx);
    if (!access) throw new Error("UNAUTHENTICATED");
    const product = await ctx.db.get(productId);
    if (!product) return [];
    resolveTenantId(access, product.tenantId);
    return await ctx.db.query("inventoryMovements").withIndex("by_product", (q) => q.eq("productId", productId)).order("desc").take(50);
  },
});

// ---------------------------------------------------------------------------
// Brands
// ---------------------------------------------------------------------------
export const listBrands = query({
  args: {},
  handler: async (ctx) => {
    const access = await getAccessContext(ctx);
    if (!access?.tenantId) return [];
    return await ctx.db.query("brands").withIndex("by_tenant", (q) => q.eq("tenantId", access.tenantId!)).collect();
  },
});

export const saveBrand = mutation({
  args: { id: v.optional(v.id("brands")), name: v.string() },
  handler: async (ctx, { id, name }) => {
    const access = await requireTenantMember(ctx);
    if (!access.tenantId) throw new Error("TENANT_REQUIRED");
    if (id) {
      await ctx.db.patch(id, { name: sanitizeText(name, 120) });
      return id;
    }
    return await ctx.db.insert("brands", { tenantId: access.tenantId, name: sanitizeText(name, 120), slug: slugify(name) });
  },
});
