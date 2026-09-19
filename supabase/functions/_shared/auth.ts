// Port of src/convex/lib/auth.ts — authorization guards + audit logging.
import { sql, ApiError, UNAUTHENTICATED, FORBIDDEN, now, camelize, sanitizeText, type Row } from "./db.ts";

export type TenantRole = "owner" | "staff";

export type AccessContext = {
  userId: string;
  user: Row;
  isSuperAdmin: boolean;
  membership: Row | null;
  tenantRole: TenantRole | null;
  tenantId: string | null;
};

/**
 * Resolves the caller from the Supabase Auth JWT and their tenant membership.
 * All tenant-scoped handlers must derive authorization from this context
 * (never from client-sent arguments).
 */
export async function getAccessContext(req: Request): Promise<AccessContext | null> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return null;

  // Validate the user JWT via Supabase Auth and fetch our mirrored app_users row.
  const { data, error } = await supabaseAuthUser(token);
  if (!data) return null;

  const userRows = await sql`
    select * from public.app_users where id = ${data.id} limit 1
  `;
  let user = userRows[0];
  if (!user) {
    // Trigger may not have run (user pre-dates migration): self-heal.
    const inserted = await sql`
      insert into public.app_users (id, email, email_verified_at, is_anonymous)
      values (${data.id}, ${data.email ?? null}, ${data.email_confirmed_at ? Date.parse(data.email_confirmed_at) : null}, ${data.is_anonymous ?? false})
      on conflict (id) do update set email = excluded.email
      returning *
    `;
    user = inserted[0];
  }
  // Refresh name/anonymous state opportunistically.
  if (user && (user.name == null) && (data.user_metadata?.full_name || data.user_metadata?.name)) {
    const name = data.user_metadata.full_name ?? data.user_metadata.name;
    await sql`update public.app_users set name = ${name} where id = ${data.id}`;
    user = { ...user, name };
  }

  const memberships = await sql`
    select * from public.tenant_members where user_id = ${data.id} order by role = 'owner' desc, invited_at asc
  `;
  const membership = memberships[0] ?? null;

  return {
    userId: data.id,
    user,
    isSuperAdmin: user?.platform_role === "super_admin",
    membership,
    tenantRole: membership ? (membership.role as TenantRole) : null,
    tenantId: membership ? membership.tenant_id : null,
  };
}

/** Validates a Supabase access token and returns the auth user payload. */
async function supabaseAuthUser(token: string): Promise<{ data: Row | null; error?: string }> {
  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey =
    (() => {
      try {
        return JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}")["default"];
      } catch {
        return undefined;
      }
    })() ??
    Deno.env.get("SUPABASE_ANON_KEY") ??
    "";
  try {
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
    });
    if (!res.ok) return { data: null, error: `auth ${res.status}` };
    const body = await res.json();
    if (!body?.id) return { data: null, error: "no user id" };
    return { data: body };
  } catch (e) {
    return { data: null, error: String(e) };
  }
}

export async function requireUser(req: Request): Promise<AccessContext> {
  const access = await getAccessContext(req);
  if (!access) throw UNAUTHENTICATED();
  return access;
}

export async function requireSuperAdmin(req: Request): Promise<AccessContext> {
  const access = await requireUser(req);
  if (!access.isSuperAdmin) throw FORBIDDEN("super admin required");
  return access;
}

/** Tenant member (owner or staff) guard. Super admin may act on any tenant. */
export async function requireTenantMember(req: Request, tenantId?: string): Promise<AccessContext> {
  const access = await requireUser(req);
  if (access.isSuperAdmin) return access;
  if (!access.membership) throw FORBIDDEN("no tenant membership");
  if (tenantId && access.membership.tenant_id !== tenantId) {
    throw FORBIDDEN("tenant isolation violation");
  }
  return access;
}

/** Resolves the effective tenant id for staff/owner callers (super admin must pass one). */
export function resolveTenantId(access: AccessContext, requested?: string | null): string {
  if (access.isSuperAdmin) {
    if (!requested) throw new ApiError(400, "Tenant id required for super admin");
    return requested;
  }
  if (!access.tenantId) throw FORBIDDEN("no tenant membership");
  if (requested && requested !== access.tenantId) {
    throw FORBIDDEN("tenant isolation violation");
  }
  return access.tenantId;
}

/** Writes an audit log entry. Never throws — auditing must not break the operation. */
export async function audit(
  entry: {
    actorId?: string;
    actorLabel: string;
    tenantId?: string | null;
    action: string;
    resource: string;
    resourceId?: string | null;
    oldData?: unknown;
    newData?: unknown;
    ip?: string;
    userAgent?: string;
  },
) {
  try {
    await sql`
      insert into public.audit_logs
        (actor_id, actor_label, tenant_id, action, resource, resource_id, old_data, new_data, ip, user_agent, created_at)
      values
        (${entry.actorId ?? null}, ${entry.actorLabel}, ${entry.tenantId ?? null}, ${entry.action},
         ${entry.resource}, ${entry.resourceId ?? null},
         ${entry.oldData === undefined ? null : JSON.stringify(entry.oldData)}::jsonb,
         ${entry.newData === undefined ? null : JSON.stringify(entry.newData)}::jsonb,
         ${entry.ip ?? null}, ${entry.userAgent ?? null}, ${now()})
    `;
  } catch (e) {
    console.error("[audit] failed to write entry", e);
  }
}

export { sanitizeText, camelize, now };
