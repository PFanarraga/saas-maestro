import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";

export type PlatformRole = "super_admin";
export type TenantRole = "owner" | "staff";

export type AccessContext = {
  userId: Id<"users">;
  user: Doc<"users">;
  isSuperAdmin: boolean;
  membership: Doc<"tenantMembers"> | null;
  tenantRole: TenantRole | null;
  tenantId: Id<"tenants"> | null;
};

/**
 * Loads the current user and resolves their platform role + tenant membership.
 * All tenant-scoped functions must go through getAccessContext and derive
 * authorization from ctx.membership / ctx.isSuperAdmin (never from the client).
 */
export async function getAccessContext(
  ctx: QueryCtx | MutationCtx,
): Promise<AccessContext | null> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;
  const user = await ctx.db.get(userId);
  if (!user) return null;

  const isSuperAdmin = user.platformRole === "super_admin";

  let membership: Doc<"tenantMembers"> | null = null;
  const memberships = await ctx.db
    .query("tenantMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  // Prefer owner memberships; otherwise take the first joined.
  membership =
    memberships.find((m) => m.role === "owner") ?? memberships[0] ?? null;

  return {
    userId,
    user,
    isSuperAdmin,
    membership,
    tenantRole: membership ? (membership.role as TenantRole) : null,
    tenantId: membership ? membership.tenantId : null,
  };
}

export async function requireUser(ctx: QueryCtx | MutationCtx): Promise<AccessContext> {
  const access = await getAccessContext(ctx);
  if (!access) throw new Error("UNAUTHENTICATED");
  return access;
}

export async function requireSuperAdmin(
  ctx: QueryCtx | MutationCtx,
): Promise<AccessContext> {
  const access = await requireUser(ctx);
  if (!access.isSuperAdmin) throw new Error("FORBIDDEN: super admin required");
  return access;
}

/** Tenant member (owner or staff) guard. Returns the resolved access context. */
export async function requireTenantMember(
  ctx: QueryCtx | MutationCtx,
  tenantId?: Id<"tenants">,
): Promise<AccessContext> {
  const access = await requireUser(ctx);
  if (access.isSuperAdmin) {
    // Super admin may act on any tenant; attach the requested tenant for convenience.
    return access;
  }
  if (!access.membership) throw new Error("FORBIDDEN: no tenant membership");
  if (tenantId && access.membership.tenantId !== tenantId) {
    throw new Error("FORBIDDEN: tenant isolation violation");
  }
  return access;
}

export async function requireTenantOwner(
  ctx: QueryCtx | MutationCtx,
  tenantId?: Id<"tenants">,
): Promise<AccessContext> {
  const access = await requireTenantMember(ctx, tenantId);
  if (access.isSuperAdmin) return access;
  if (access.tenantRole !== "owner") throw new Error("FORBIDDEN: owner role required");
  return access;
}

/** Resolves the effective tenant id for staff/owner callers (super admin must pass one). */
export function resolveTenantId(
  access: AccessContext,
  requested?: Id<"tenants">,
): Id<"tenants"> {
  if (access.isSuperAdmin) {
    if (!requested) throw new Error("Tenant id required for super admin");
    return requested;
  }
  if (!access.tenantId) throw new Error("FORBIDDEN: no tenant membership");
  if (requested && requested !== access.tenantId) {
    throw new Error("FORBIDDEN: tenant isolation violation");
  }
  return access.tenantId;
}

/** Verifies a tenant exists and is not suspended (storefront/admin operations). */
export async function getActiveTenant(ctx: QueryCtx | MutationCtx, tenantId: Id<"tenants">) {
  const tenant = await ctx.db.get(tenantId);
  if (!tenant) throw new Error("Tenant not found");
  return tenant;
}

/** Writes an audit log entry. Never throws — auditing must not break the operation. */
export async function audit(
  ctx: MutationCtx,
  entry: {
    actorId?: Id<"users">;
    actorLabel: string;
    tenantId?: Id<"tenants">;
    action: string;
    resource: string;
    resourceId?: string;
    oldData?: unknown;
    newData?: unknown;
    ip?: string;
    userAgent?: string;
  },
) {
  try {
    await ctx.db.insert("auditLogs", {
      actorId: entry.actorId,
      actorLabel: entry.actorLabel,
      tenantId: entry.tenantId,
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId,
      oldData: entry.oldData as any,
      newData: entry.newData as any,
      ip: entry.ip,
      userAgent: entry.userAgent,
      createdAt: Date.now(),
    });
  } catch (e) {
    console.error("[audit] failed to write entry", e);
  }
}

/** Basic input sanitization helper: trims and caps string length. */
export function sanitizeText(value: string, maxLen = 5000): string {
  return value.trim().slice(0, maxLen);
}
