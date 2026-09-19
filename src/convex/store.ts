import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { audit, getAccessContext, requireTenantMember, requireTenantOwner, resolveTenantId, sanitizeText } from "./lib/auth";
import { DEFAULT_THEMES, isHexColor, slugify, TemplateKey } from "./lib/shared";

// ---------------------------------------------------------------------------
// Tenant settings (WhatsApp, payments, SEO)
// ---------------------------------------------------------------------------
export const getSettings = query({
  args: {},
  handler: async (ctx) => {
    const access = await getAccessContext(ctx);
    if (!access?.tenantId) return null;
    const tenant = await ctx.db.get(access.tenantId);
    if (!tenant) return null;
    const settings = await ctx.db.query("tenantSettings").withIndex("by_tenant", (q) => q.eq("tenantId", access.tenantId!)).collect();
    const map: Record<string, unknown> = {};
    for (const s of settings) map[s.key] = s.value;
    return { tenant, settings: map };
  },
});

export const updateTenantInfo = mutation({
  args: {
    name: v.optional(v.string()),
    whatsappPhone: v.optional(v.string()),
    whatsappEnabled: v.optional(v.boolean()),
    couponsEnabled: v.optional(v.boolean()),
    deliveryEnabled: v.optional(v.boolean()),
    paymentProvider: v.optional(v.union(v.literal("manual"), v.literal("culqi"))),
    logoUrl: v.optional(v.string()),
    currency: v.optional(v.string()),
    seoTitle: v.optional(v.string()),
    seoDescription: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const access = await requireTenantMember(ctx);
    if (!access.tenantId) throw new Error("TENANT_REQUIRED");
    const tenantId = access.tenantId;
    const tenant = await ctx.db.get(tenantId);
    if (!tenant) throw new Error("Tienda no encontrada");
    const patch: Record<string, unknown> = {};
    if (args.name !== undefined) patch.name = sanitizeText(args.name, 120);
    if (args.whatsappPhone !== undefined) patch.whatsappPhone = args.whatsappPhone.replace(/[^0-9+]/g, "");
    if (args.whatsappEnabled !== undefined) patch.whatsappEnabled = args.whatsappEnabled;
    if (args.couponsEnabled !== undefined) patch.couponsEnabled = args.couponsEnabled;
    if (args.deliveryEnabled !== undefined) patch.deliveryEnabled = args.deliveryEnabled;
    if (args.paymentProvider !== undefined) patch.paymentProvider = args.paymentProvider;
    if (args.logoUrl !== undefined) patch.logoUrl = args.logoUrl;
    if (args.currency !== undefined) patch.currency = args.currency;
    if (args.seoTitle !== undefined || args.seoDescription !== undefined) {
      const seo = { ...(tenant.seo ?? {}) };
      if (args.seoTitle !== undefined) seo.title = sanitizeText(args.seoTitle, 120);
      if (args.seoDescription !== undefined) seo.description = sanitizeText(args.seoDescription, 300);
      patch.seo = seo;
    }
    await ctx.db.patch(tenantId, patch);
    await audit(ctx, { actorId: access.userId, actorLabel: access.user.email ?? "admin", tenantId, action: "STORE_SETTINGS_CHANGED", resource: "tenant", resourceId: tenantId, newData: patch });
  },
});

// ---------------------------------------------------------------------------
// Theme engine: draft / published with versioning
// ---------------------------------------------------------------------------
export const getThemeDraft = query({
  args: {},
  handler: async (ctx) => {
    const access = await getAccessContext(ctx);
    if (!access?.tenantId) return null;
    const draft = await ctx.db.query("tenantThemes").withIndex("by_tenant_status", (q) => q.eq("tenantId", access.tenantId!).eq("status", "draft")).first();
    return draft;
  },
});

export const getPublishedTheme = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const tenant = await ctx.db.query("tenants").withIndex("by_slug", (q) => q.eq("slug", slug)).first();
    if (!tenant || tenant.status === "suspended") return null;
    const theme = await ctx.db.query("tenantThemes").withIndex("by_tenant_status", (q) => q.eq("tenantId", tenant._id).eq("status", "published")).first();
    return theme ? { theme: theme.theme, version: theme.version, tenant: { name: tenant.name, slug: tenant.slug, whatsappPhone: tenant.whatsappPhone, whatsappEnabled: tenant.whatsappEnabled, currency: tenant.currency, seo: tenant.seo, logoUrl: tenant.logoUrl } } : null;
  },
});

export const saveThemeDraft = mutation({
  args: { theme: v.any() },
  handler: async (ctx, { theme }) => {
    const access = await requireTenantMember(ctx);
    if (!access.tenantId) throw new Error("TENANT_REQUIRED");
    const tenantId = access.tenantId;
    // Validate colors
    for (const [k, val] of Object.entries(theme.colors ?? {})) {
      if (typeof val === "string" && k !== "radius" && !isHexColor(val)) throw new Error(`Color inválido en ${k}`);
    }
    const draft = await ctx.db.query("tenantThemes").withIndex("by_tenant_status", (q) => q.eq("tenantId", tenantId).eq("status", "draft")).first();
    if (draft) {
      await ctx.db.patch(draft._id, { theme, updatedAt: Date.now() });
      return draft._id;
    }
    const published = await ctx.db.query("tenantThemes").withIndex("by_tenant_status", (q) => q.eq("tenantId", tenantId).eq("status", "published")).first();
    return await ctx.db.insert("tenantThemes", { tenantId, status: "draft", version: published?.version ?? 1, theme, updatedAt: Date.now() });
  },
});

export const applyTemplate = mutation({
  args: { template: v.string() },
  handler: async (ctx, { template }) => {
    const access = await requireTenantMember(ctx);
    if (!access.tenantId) throw new Error("TENANT_REQUIRED");
    const tenantId = access.tenantId;
    const key = (template in DEFAULT_THEMES ? template : "minimal") as TemplateKey;
    const tenant = await ctx.db.get(tenantId);
    const theme = { ...DEFAULT_THEMES[key], brand: { ...DEFAULT_THEMES[key].brand, name: tenant?.name } };
    const draft = await ctx.db.query("tenantThemes").withIndex("by_tenant_status", (q) => q.eq("tenantId", tenantId).eq("status", "draft")).first();
    if (draft) await ctx.db.patch(draft._id, { theme, updatedAt: Date.now() });
    else await ctx.db.insert("tenantThemes", { tenantId, status: "draft", version: 1, theme, updatedAt: Date.now() });
  },
});

export const publishTheme = mutation({
  args: {},
  handler: async (ctx) => {
    const access = await requireTenantMember(ctx);
    if (!access.tenantId) throw new Error("TENANT_REQUIRED");
    const tenantId = access.tenantId;
    const draft = await ctx.db.query("tenantThemes").withIndex("by_tenant_status", (q) => q.eq("tenantId", tenantId).eq("status", "draft")).first();
    if (!draft) throw new Error("No hay borrador para publicar");
    const published = await ctx.db.query("tenantThemes").withIndex("by_tenant_status", (q) => q.eq("tenantId", tenantId).eq("status", "published")).first();
    const newVersion = (published?.version ?? 0) + 1;
    if (published) await ctx.db.delete(published._id);
    await ctx.db.patch(draft._id, { status: "published", version: newVersion, publishedAt: Date.now(), updatedAt: Date.now() });
    // Keep a fresh draft copy for future edits
    await ctx.db.insert("tenantThemes", { tenantId, status: "draft", version: newVersion, theme: draft.theme, updatedAt: Date.now() });
    await audit(ctx, { actorId: access.userId, actorLabel: access.user.email ?? "admin", tenantId, action: "THEME_PUBLISHED", resource: "theme", resourceId: draft._id, newData: { version: newVersion } });
    return newVersion;
  },
});

export const themeVersions = query({
  args: {},
  handler: async (ctx) => {
    const access = await getAccessContext(ctx);
    if (!access?.tenantId) return [];
    const all = await ctx.db.query("tenantThemes").withIndex("by_tenant", (q) => q.eq("tenantId", access.tenantId!)).collect();
    // Return version history summary (published versions)
    return all.filter((t) => t.status === "published").map((t) => ({ version: t.version, publishedAt: t.publishedAt, _id: t._id })).sort((a, b) => b.version - a.version);
  },
});

// ---------------------------------------------------------------------------
// Page builder (blocks with draft/publish)
// ---------------------------------------------------------------------------
export const getPageDraft = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const access = await getAccessContext(ctx);
    if (!access?.tenantId) return null;
    return await ctx.db.query("pages").withIndex("by_tenant_slug", (q) => q.eq("tenantId", access.tenantId!).eq("slug", slug)).filter((q) => q.eq(q.field("status"), "draft")).first();
  },
});

export const savePageDraft = mutation({
  args: { slug: v.string(), title: v.string(), blocks: v.array(v.object({ id: v.string(), type: v.string(), position: v.number(), hidden: v.optional(v.boolean()), settings: v.any() })) },
  handler: async (ctx, { slug, title, blocks }) => {
    const access = await requireTenantMember(ctx);
    if (!access.tenantId) throw new Error("TENANT_REQUIRED");
    const tenantId = access.tenantId;
    if (blocks.length > 40) throw new Error("Demasiados bloques (máx 40)");
    const draft = await ctx.db.query("pages").withIndex("by_tenant_slug", (q) => q.eq("tenantId", tenantId).eq("slug", slug)).filter((q) => q.eq(q.field("status"), "draft")).first();
    if (draft) {
      await ctx.db.patch(draft._id, { title: sanitizeText(title, 120), blocks, updatedAt: Date.now() });
      return draft._id;
    }
    return await ctx.db.insert("pages", { tenantId, slug, title: sanitizeText(title, 120), isHome: slug === "home", status: "draft", version: 1, blocks, updatedAt: Date.now() });
  },
});

export const publishPage = mutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const access = await requireTenantMember(ctx);
    if (!access.tenantId) throw new Error("TENANT_REQUIRED");
    const tenantId = access.tenantId;
    const draft = await ctx.db.query("pages").withIndex("by_tenant_slug", (q) => q.eq("tenantId", tenantId).eq("slug", slug)).filter((q) => q.eq(q.field("status"), "draft")).first();
    if (!draft) throw new Error("No hay borrador para publicar");
    const published = await ctx.db.query("pages").withIndex("by_tenant_slug", (q) => q.eq("tenantId", tenantId).eq("slug", slug)).filter((q) => q.eq(q.field("status"), "published")).first();
    const newVersion = (published?.version ?? 0) + 1;
    if (published) await ctx.db.delete(published._id);
    await ctx.db.patch(draft._id, { status: "published", version: newVersion, updatedAt: Date.now() });
    await audit(ctx, { actorId: access.userId, actorLabel: access.user.email ?? "admin", tenantId, action: "PAGE_PUBLISHED", resource: "page", resourceId: draft._id, newData: { slug, version: newVersion } });
    return newVersion;
  },
});

export const getPublishedPage = query({
  args: { slug: v.string(), tenantSlug: v.string() },
  handler: async (ctx, { slug, tenantSlug }) => {
    const tenant = await ctx.db.query("tenants").withIndex("by_slug", (q) => q.eq("slug", tenantSlug)).first();
    if (!tenant || tenant.status === "suspended") return null;
    const page = await ctx.db.query("pages").withIndex("by_tenant_slug", (q) => q.eq("tenantId", tenant._id).eq("slug", slug)).filter((q) => q.eq(q.field("status"), "published")).first();
    return page ? { title: page.title, blocks: page.blocks, version: page.version } : null;
  },
});

// ---------------------------------------------------------------------------
// Delivery zones & rates
// ---------------------------------------------------------------------------
export const listDelivery = query({
  args: {},
  handler: async (ctx) => {
    const access = await getAccessContext(ctx);
    if (!access?.tenantId) return { zones: [], rates: [] };
    const zones = await ctx.db.query("deliveryZones").withIndex("by_tenant", (q) => q.eq("tenantId", access.tenantId!)).collect();
    const rates = await ctx.db.query("deliveryRates").withIndex("by_tenant", (q) => q.eq("tenantId", access.tenantId!)).collect();
    return { zones, rates };
  },
});

export const saveDeliveryZone = mutation({
  args: { id: v.optional(v.id("deliveryZones")), name: v.string(), description: v.optional(v.string()), isActive: v.boolean() },
  handler: async (ctx, args) => {
    const access = await requireTenantMember(ctx);
    if (!access.tenantId) throw new Error("TENANT_REQUIRED");
    if (args.id) {
      await ctx.db.patch(args.id, { name: sanitizeText(args.name, 120), description: args.description, isActive: args.isActive });
      return args.id;
    }
    return await ctx.db.insert("deliveryZones", { tenantId: access.tenantId, name: sanitizeText(args.name, 120), description: args.description, isActive: args.isActive });
  },
});

export const deleteDeliveryZone = mutation({
  args: { id: v.id("deliveryZones") },
  handler: async (ctx, { id }) => {
    const access = await requireTenantMember(ctx);
    const zone = await ctx.db.get(id);
    if (!zone) return;
    resolveTenantId(access, zone.tenantId);
    const rates = await ctx.db.query("deliveryRates").withIndex("by_zone", (q) => q.eq("zoneId", id)).collect();
    for (const r of rates) await ctx.db.delete(r._id);
    await ctx.db.delete(id);
  },
});

export const saveDeliveryRate = mutation({
  args: {
    id: v.optional(v.id("deliveryRates")),
    zoneId: v.id("deliveryZones"),
    name: v.string(),
    method: v.union(v.literal("pickup"), v.literal("delivery"), v.literal("shipping")),
    price: v.number(),
    freeOver: v.optional(v.number()),
    minOrder: v.optional(v.number()),
    eta: v.optional(v.string()),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const access = await requireTenantMember(ctx);
    const zone = await ctx.db.get(args.zoneId);
    if (!zone) throw new Error("Zona no encontrada");
    const tenantId = resolveTenantId(access, zone.tenantId);
    if (args.price < 0) throw new Error("El precio no puede ser negativo");
    const data = {
      tenantId,
      zoneId: args.zoneId,
      name: sanitizeText(args.name, 120),
      method: args.method,
      price: args.price,
      freeOver: args.freeOver,
      minOrder: args.minOrder,
      eta: args.eta,
      isActive: args.isActive,
    };
    if (args.id) {
      const existing = await ctx.db.get(args.id);
      if (!existing || existing.tenantId !== tenantId) throw new Error("Tarifa no encontrada");
      await ctx.db.patch(args.id, data);
      return args.id;
    }
    return await ctx.db.insert("deliveryRates", data);
  },
});

export const deleteDeliveryRate = mutation({
  args: { id: v.id("deliveryRates") },
  handler: async (ctx, { id }) => {
    const access = await requireTenantMember(ctx);
    const rate = await ctx.db.get(id);
    if (!rate) return;
    resolveTenantId(access, rate.tenantId);
    await ctx.db.delete(id);
  },
});

/** Public: active delivery rates for a tenant's storefront checkout. */
export const listPublicDeliveryRates = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const tenant = await ctx.db.query("tenants").withIndex("by_slug", (q) => q.eq("slug", slug)).first();
    if (!tenant || tenant.status === "suspended" || !tenant.deliveryEnabled) return [];
    const rates = await ctx.db.query("deliveryRates").withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id)).filter((q) => q.eq(q.field("isActive"), true)).collect();
    const zones = await ctx.db.query("deliveryZones").withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id)).collect();
    const zoneMap = new Map(zones.map((z) => [z._id, z]));
    return rates.map((r) => ({ ...r, zoneName: zoneMap.get(r.zoneId)?.name ?? "" }));
  },
});

// ---------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------
export const listCoupons = query({
  args: {},
  handler: async (ctx) => {
    const access = await getAccessContext(ctx);
    if (!access?.tenantId) return [];
    return await ctx.db.query("coupons").withIndex("by_tenant_code", (q) => q.eq("tenantId", access.tenantId!)).collect();
  },
});

export const saveCoupon = mutation({
  args: {
    id: v.optional(v.id("coupons")),
    code: v.string(),
    type: v.union(v.literal("percentage"), v.literal("fixed_amount"), v.literal("free_shipping")),
    value: v.number(),
    minAmount: v.optional(v.number()),
    maxUses: v.optional(v.number()),
    endsAt: v.optional(v.number()),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const access = await requireTenantMember(ctx);
    if (!access.tenantId) throw new Error("TENANT_REQUIRED");
    const tenantId = access.tenantId;
    const code = args.code.toUpperCase().trim().replace(/\s+/g, "");
    if (args.type === "percentage" && (args.value <= 0 || args.value > 100)) throw new Error("El porcentaje debe estar entre 1 y 100");
    const data = {
      tenantId,
      code,
      type: args.type,
      value: args.value,
      minAmount: args.minAmount,
      maxUses: args.maxUses,
      endsAt: args.endsAt,
      isActive: args.isActive,
      usageCount: 0,
    };
    if (args.id) {
      const existing = await ctx.db.get(args.id);
      if (!existing || existing.tenantId !== tenantId) throw new Error("Cupón no encontrado");
      await ctx.db.patch(args.id, data);
      return args.id;
    }
    const dup = await ctx.db.query("coupons").withIndex("by_tenant_code", (q) => q.eq("tenantId", tenantId).eq("code", code)).first();
    if (dup) throw new Error("Ya existe un cupón con ese código");
    return await ctx.db.insert("coupons", data);
  },
});

export const deleteCoupon = mutation({
  args: { id: v.id("coupons") },
  handler: async (ctx, { id }) => {
    const access = await requireTenantMember(ctx);
    const coupon = await ctx.db.get(id);
    if (!coupon) return;
    resolveTenantId(access, coupon.tenantId);
    await ctx.db.delete(id);
  },
});

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------
export const listCustomers = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, { search }) => {
    const access = await getAccessContext(ctx);
    if (!access?.tenantId) return [];
    let customers = await ctx.db.query("customers").withIndex("by_tenant", (q) => q.eq("tenantId", access.tenantId!)).collect();
    if (search) {
      const s = search.toLowerCase();
      customers = customers.filter((c) => c.name.toLowerCase().includes(s) || (c.email ?? "").toLowerCase().includes(s) || (c.phone ?? "").includes(s));
    }
    return customers.sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 200);
  },
});

export const getCustomer = query({
  args: { id: v.id("customers") },
  handler: async (ctx, { id }) => {
    const access = await getAccessContext(ctx);
    if (!access) throw new Error("UNAUTHENTICATED");
    const customer = await ctx.db.get(id);
    if (!customer) return null;
    resolveTenantId(access, customer.tenantId);
    const orders = await ctx.db.query("orders").withIndex("by_tenant", (q) => q.eq("tenantId", customer.tenantId)).collect();
    return { ...customer, orders: orders.filter((o) => o.customerId === id).sort((a, b) => b.createdAt - a.createdAt).slice(0, 50) };
  },
});
