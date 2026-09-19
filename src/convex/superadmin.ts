import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { audit, requireSuperAdmin } from "./lib/auth";

// ---------------------------------------------------------------------------
// Super Admin API — all functions require the platform super_admin role.
// ---------------------------------------------------------------------------

export const listTenants = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    const tenants = await ctx.db.query("tenants").collect();
    return tenants.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const getTenant = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, { tenantId }) => {
    await requireSuperAdmin(ctx);
    const tenant = await ctx.db.get(tenantId);
    if (!tenant) return null;
    const members = await ctx.db.query("tenantMembers").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).collect();
    const sub = await ctx.db.query("subscriptions").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).first();
    const domains = await ctx.db.query("tenantDomains").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).collect();
    const products = await ctx.db.query("products").withIndex("by_tenant_status", (q) => q.eq("tenantId", tenantId).eq("status", "active")).collect();
    const orders = await ctx.db.query("orders").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).collect();
    return {
      tenant,
      members,
      subscription: sub,
      domains,
      productCount: products.length,
      orderCount: orders.length,
      revenue: orders.filter((o) => ["paid", "processing", "ready", "shipped", "delivered"].includes(o.status)).reduce((s, o) => s + o.total, 0),
    };
  },
});

export const createTenant = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    template: v.string(),
    planCode: v.string(),
    adminEmail: v.string(),
    adminName: v.optional(v.string()),
    whatsappPhone: v.optional(v.string()),
    currency: v.optional(v.string()),
    isDemo: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const access = await requireSuperAdmin(ctx);
    const slug = args.slug.toLowerCase().trim();
    const exists = await ctx.db.query("tenants").withIndex("by_slug", (q) => q.eq("slug", slug)).first();
    if (exists) throw new Error("El slug ya está en uso");

    const now = Date.now();
    const tenantId: Id<"tenants"> = await ctx.db.insert("tenants", {
      name: args.name.trim().slice(0, 120),
      slug,
      status: "active",
      template: args.template,
      planCode: args.planCode,
      whatsappPhone: args.whatsappPhone,
      currency: args.currency ?? "PEN",
      whatsappEnabled: true,
      couponsEnabled: true,
      deliveryEnabled: true,
      paymentProvider: "manual",
      isDemo: args.isDemo,
      createdAt: now,
      seo: { title: `${args.name} — Tienda oficial`, description: `Compra en ${args.name} con delivery y pago por WhatsApp.` },
    });

    // Theme draft + published v1 (template preset)
    const { DEFAULT_THEMES, slugify: _s, ..._rest } = await import("./lib/shared");
    void _s; void _rest;
    const templateKey = (args.template in DEFAULT_THEMES ? args.template : "minimal") as keyof typeof DEFAULT_THEMES;
    const theme = { ...DEFAULT_THEMES[templateKey], brand: { ...DEFAULT_THEMES[templateKey].brand, name: args.name } };
    await ctx.db.insert("tenantThemes", { tenantId, status: "published", version: 1, theme, updatedAt: now, publishedAt: now });
    await ctx.db.insert("tenantThemes", { tenantId, status: "draft", version: 1, theme, updatedAt: now });

    // Homepage blocks draft + published
    const { DEFAULT_HOMEPAGE_BLOCKS } = await import("./lib/shared");
    const blocks = DEFAULT_HOMEPAGE_BLOCKS.map((b) => ({ ...b, settings: { ...b.settings } }));
    await ctx.db.insert("pages", { tenantId, slug: "home", title: "Inicio", isHome: true, status: "published", version: 1, blocks, updatedAt: now });
    await ctx.db.insert("pages", { tenantId, slug: "home", title: "Inicio", isHome: true, status: "draft", version: 1, blocks: blocks.map((b) => ({ ...b })), updatedAt: now });

    // Subdomain + subscription
    await ctx.db.insert("tenantDomains", { tenantId, domain: `${slug}.shoply.app`, type: "subdomain", status: "active", verifiedAt: now, sslStatus: "active" });
    await ctx.db.insert("subscriptions", { tenantId, planCode: args.planCode, status: "active", startedAt: now });

    // Owner membership (claimed by email at sign-in)
    await ctx.db.insert("tenantMembers", {
      tenantId,
      userEmail: args.adminEmail.toLowerCase().trim(),
      userName: args.adminName,
      role: "owner",
      invitedAt: now,
    });

    // Starter delivery zone + rates
    const zoneId = await ctx.db.insert("deliveryZones", { tenantId, name: "Zona A — Centro", isActive: true });
    await ctx.db.insert("deliveryRates", { tenantId, zoneId, name: "Delivery Zona A", method: "delivery", price: 5, eta: "24-48h", isActive: true });
    await ctx.db.insert("deliveryRates", { tenantId, zoneId, name: "Recojo en tienda", method: "pickup", price: 0, eta: "Hoy", isActive: true });

    await audit(ctx, {
      actorId: access.userId,
      actorLabel: access.user.email ?? "super_admin",
      tenantId,
      action: "TENANT_CREATED",
      resource: "tenant",
      resourceId: tenantId,
      newData: { name: args.name, slug, planCode: args.planCode, adminEmail: args.adminEmail },
    });
    return tenantId;
  },
});

export const setTenantStatus = mutation({
  args: { tenantId: v.id("tenants"), status: v.union(v.literal("active"), v.literal("suspended")), reason: v.optional(v.string()) },
  handler: async (ctx, { tenantId, status, reason }) => {
    const access = await requireSuperAdmin(ctx);
    const tenant = await ctx.db.get(tenantId);
    if (!tenant) throw new Error("Tenant not found");
    await ctx.db.patch(tenantId, { status, suspendedReason: status === "suspended" ? reason : undefined });
    await audit(ctx, {
      actorId: access.userId,
      actorLabel: access.user.email ?? "super_admin",
      tenantId,
      action: status === "suspended" ? "STORE_SUSPENDED" : "STORE_REACTIVATED",
      resource: "tenant",
      resourceId: tenantId,
      oldData: { status: tenant.status },
      newData: { status, reason },
    });
  },
});

export const changeTenantPlan = mutation({
  args: { tenantId: v.id("tenants"), planCode: v.string() },
  handler: async (ctx, { tenantId, planCode }) => {
    const access = await requireSuperAdmin(ctx);
    const tenant = await ctx.db.get(tenantId);
    if (!tenant) throw new Error("Tenant not found");
    await ctx.db.patch(tenantId, { planCode });
    const sub = await ctx.db.query("subscriptions").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).first();
    if (sub) await ctx.db.patch(sub._id, { planCode, status: "active" });
    else await ctx.db.insert("subscriptions", { tenantId, planCode, status: "active", startedAt: Date.now() });
    await audit(ctx, {
      actorId: access.userId,
      actorLabel: access.user.email ?? "super_admin",
      tenantId,
      action: "PLAN_CHANGED",
      resource: "tenant",
      resourceId: tenantId,
      oldData: { planCode: tenant.planCode },
      newData: { planCode },
    });
  },
});

/** Removes tenant-scoped data. Super admin only. */
export const deleteTenant = mutation({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, { tenantId }) => {
    const access = await requireSuperAdmin(ctx);
    const tenant = await ctx.db.get(tenantId);
    if (!tenant) throw new Error("Tenant not found");
    // Cascade delete of tenant-owned data (bounded tables only)
    const tables = ["tenantMembers", "tenantSettings", "tenantDomains", "tenantThemes", "pages", "brands", "categories", "productVariants", "cartItems", "carts", "orderItems", "orderStatusHistory", "payments", "paymentLinks", "coupons", "couponUsages", "deliveryZones", "deliveryRates", "customers", "customerAddresses", "inventoryMovements", "media", "analyticsEvents", "notificationTemplates"] as const;
    for (const table of tables) {
      const rows = await ctx.db.query(table).filter((q) => q.eq(q.field("tenantId"), tenantId)).collect();
      for (const row of rows) await ctx.db.delete(row._id);
    }
    const products = await ctx.db.query("products").filter((q) => q.eq(q.field("tenantId"), tenantId)).collect();
    for (const p of products) await ctx.db.delete(p._id);
    const orders = await ctx.db.query("orders").filter((q) => q.eq(q.field("tenantId"), tenantId)).collect();
    for (const o of orders) await ctx.db.delete(o._id);
    await ctx.db.delete(tenantId);
    await audit(ctx, {
      actorId: access.userId,
      actorLabel: access.user.email ?? "super_admin",
      action: "TENANT_DELETED",
      resource: "tenant",
      resourceId: tenantId,
      oldData: { name: tenant.name, slug: tenant.slug },
    });
  },
});
