import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { audit, getAccessContext, requireSuperAdmin } from "./lib/auth";
import { PLAN_PRESETS } from "./lib/shared";

export const PLATFORM_ROLES = { SUPER_ADMIN: "super_admin" } as const;

/** Ensures plans and feature flags exist (run once at first bootstrap). */
async function seedPlatformDefaults(ctx: { db: any }) {
  const existingPlan = await ctx.db.query("plans").withIndex("by_code", (q: any) => q.eq("code", "FREE")).first();
  if (existingPlan) return;
  for (const [code, limits] of Object.entries(PLAN_PRESETS)) {
    await ctx.db.insert("plans", {
      code,
      name: code.charAt(0) + code.slice(1).toLowerCase(),
      priceMonthly: code === "FREE" ? 0 : code === "BASIC" ? 19 : code === "PRO" ? 49 : code === "BUSINESS" ? 99 : 249,
      currency: "USD",
      limits,
      isActive: true,
    });
  }
  const flags: Array<[string, boolean, string]> = [
    ["whatsapp_enabled", true, "Botones y mensajería de WhatsApp"],
    ["coupons_enabled", true, "Cupones de descuento"],
    ["custom_domains", true, "Dominios personalizados por tienda"],
    ["advanced_analytics", true, "Analítica avanzada y embudo"],
    ["api_access", false, "API pública por tienda"],
  ];
  for (const [key, enabled, description] of flags) {
    await ctx.db.insert("featureFlags", { key, enabled, description });
  }
}

/**
 * Bootstrap: the FIRST user to sign in becomes the platform Super Admin.
 * Subsequent users are regular users (invited to tenants by admins).
 */
export const bootstrap = mutation({
  args: { name: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("UNAUTHENTICATED");
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("UNAUTHENTICATED");
    if (user.isAnonymous) throw new Error("Anonymous users cannot bootstrap the platform");

    await seedPlatformDefaults(ctx);

    if (!user.platformRole) {
      const anySuperAdmin = await ctx.db
        .query("users")
        .filter((q) => q.eq(q.field("platformRole"), "super_admin"))
        .first();
      if (!anySuperAdmin) {
        await ctx.db.patch(userId, {
          platformRole: "super_admin",
          role: "admin",
          name: args.name ?? user.name ?? user.email ?? "Super Admin",
        });
        await audit(ctx, {
          actorId: userId,
          actorLabel: user.email ?? userId,
          action: "ADMIN_LOGIN",
          resource: "platform",
          newData: { bootstrap: true },
        });
      }
    }
    return await ctx.db.get(userId);
  },
});

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db.get(userId);
  },
});

/** Returns the caller's access context summary for UI gating. */
export const myAccess = query({
  args: {},
  handler: async (ctx) => {
    const access = await getAccessContext(ctx);
    if (!access) return null;
    let tenant: Doc<"tenants"> | null = null;
    if (access.membership) {
      tenant = await ctx.db.get(access.membership.tenantId);
    }
    return {
      userId: access.userId,
      isSuperAdmin: access.isSuperAdmin,
      tenantRole: access.tenantRole,
      tenantId: access.tenantId,
      tenantName: tenant?.name ?? null,
      tenantSlug: tenant?.slug ?? null,
      tenantStatus: tenant?.status ?? null,
    };
  },
});

// ---------------------------------------------------------------------------
// Plans & feature flags (super admin)
// ---------------------------------------------------------------------------
export const listPlans = query({
  args: {},
  handler: async (ctx) => {
    const plans = await ctx.db.query("plans").collect();
    return plans.sort((a, b) => a.priceMonthly - b.priceMonthly);
  },
});

export const listFeatureFlags = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("featureFlags").collect();
  },
});

export const setFeatureFlag = mutation({
  args: { key: v.string(), enabled: v.boolean() },
  handler: async (ctx, { key, enabled }) => {
    const access = await requireSuperAdmin(ctx);
    const flag = await ctx.db.query("featureFlags").withIndex("by_key", (q) => q.eq("key", key)).first();
    if (flag) {
      await ctx.db.patch(flag._id, { enabled });
      await audit(ctx, {
        actorId: access.userId,
        actorLabel: access.user.email ?? "super_admin",
        action: "FEATURE_FLAG_CHANGED",
        resource: "feature_flag",
        resourceId: key,
        newData: { enabled },
      });
    }
  },
});

/** Links a signed-in user to a tenant membership by email (owner invite claim). */
export const claimMembership = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("UNAUTHENTICATED");
    const user = await ctx.db.get(userId);
    if (!user?.email) return null;
    const email = user.email.toLowerCase();
    const invites = await ctx.db
      .query("tenantMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    if (invites.length > 0) return invites[0].tenantId;
    const pending = await ctx.db
      .query("tenantMembers")
      .filter((q) => q.eq(q.field("userEmail"), email))
      .collect();
    const unclaimed = pending.find((m) => !m.userId);
    if (unclaimed) {
      await ctx.db.patch(unclaimed._id, { userId, joinedAt: Date.now() });
      if (!user.name && unclaimed.userName) await ctx.db.patch(userId, { name: unclaimed.userName });
      return unclaimed.tenantId;
    }
    return null;
  },
});

// ---------------------------------------------------------------------------
// Global stats (super admin)
// ---------------------------------------------------------------------------
export const globalStats = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    const tenants = await ctx.db.query("tenants").collect();
    const orders = await ctx.db.query("orders").collect();
    const users = await ctx.db.query("users").collect();
    const revenue = orders
      .filter((o) => ["paid", "processing", "ready", "shipped", "delivered"].includes(o.status))
      .reduce((s, o) => s + o.total, 0);
    return {
      tenants: tenants.length,
      activeTenants: tenants.filter((t) => t.status === "active").length,
      suspendedTenants: tenants.filter((t) => t.status === "suspended").length,
      orders: orders.length,
      revenue,
      users: users.length,
    };
  },
});

export const globalOrders = query({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    const orders = await ctx.db.query("orders").order("desc").take(100);
    const tenants = await ctx.db.query("tenants").collect();
    const tenantMap = new Map(tenants.map((t) => [t._id, t.name]));
    return orders.map((o) => ({ ...o, tenantName: tenantMap.get(o.tenantId) ?? "—" }));
  },
});

export const auditLogs = query({
  args: { tenantId: v.optional(v.id("tenants")) },
  handler: async (ctx, { tenantId }) => {
    await requireSuperAdmin(ctx);
    const logs = tenantId
      ? await ctx.db.query("auditLogs").withIndex("by_tenant_time", (q) => q.eq("tenantId", tenantId)).order("desc").take(100)
      : await ctx.db.query("auditLogs").order("desc").take(100);
    return logs;
  },
});
