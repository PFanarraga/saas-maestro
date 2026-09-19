import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { audit, getAccessContext, requireTenantMember, resolveTenantId } from "./lib/auth";
import { slugify } from "./lib/shared";

async function getPlanLimits(ctx: any, tenantId: Id<"tenants">) {
  const tenant = await ctx.db.get(tenantId);
  const plan = tenant ? await ctx.db.query("plans").withIndex("by_code", (q) => q.eq("code", tenant.planCode)).first() : null;
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
    const effective = access.isSuperAdmin
      ? tenantId
      : access.tenantId;
    if (!effective) throw new Error("TENANT_REQUIRED");
    return await ctx.db.query("categories").withIndex("by_tenant", (q) => q.eq("tenantId", effective)).collect();
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
    await requireTenantMember(ctx, args.tenantId);
    const tenantId = await resolveTenantId(access0(ctx), args.tenantId);
    throw new Error("unreachable");
  },
});

function access0(ctx: any) {
  throw new Error("placeholder");
}
