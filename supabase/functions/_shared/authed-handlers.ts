// Port of src/convex/platform.ts, superadmin.ts, users.ts (authed endpoints).
import { sql, now, camelize, camelizeAll, sanitizeText, BAD_REQUEST, type Row } from "./db.ts";
import { audit, getAccessContext, requireSuperAdmin, requireUser, type AccessContext } from "./auth.ts";
import { DEFAULT_HOMEPAGE_BLOCKS, DEFAULT_THEMES, PLAN_PRESETS } from "./constants.ts";

// ---------------------------------------------------------------------------
// Bootstrap: the FIRST user to sign in becomes the platform Super Admin.
// ---------------------------------------------------------------------------
const SUPERUSER_EMAIL = "pedrofanarraga@gmail.com";

export async function bootstrap(req: Request, args: { name?: string; tosAccepted?: boolean; marketingAccepted?: boolean }) {
  const access = await requireUser(req);
  if (access.user.is_anonymous) throw BAD_REQUEST("Anonymous users cannot bootstrap the platform");

  // Update TOS/Marketing preferences if provided
  if (args.tosAccepted !== undefined || args.marketingAccepted !== undefined) {
    await sql`
      update public.app_users
      set tos_accepted = coalesce(${args.tosAccepted ?? null}, tos_accepted),
          marketing_accepted = coalesce(${args.marketingAccepted ?? null}, marketing_accepted)
      where id = ${access.userId}
    `;
  }

  // Seed platform defaults (plans + feature flags) once.
  const existingPlan = await sql`select 1 from public.plans where code = 'FREE' limit 1`;
  if (!existingPlan[0]) {
    for (const [code, limits] of Object.entries(PLAN_PRESETS)) {
      await sql`
        insert into public.plans (code, name, price_monthly, currency, limits, is_active)
        values (${code}, ${code.charAt(0) + code.slice(1).toLowerCase()},
                ${code === "FREE" ? 0 : code === "BASIC" ? 19 : code === "PRO" ? 49 : code === "BUSINESS" ? 99 : 249},
                'USD', ${JSON.stringify(limits)}::jsonb, true)
        on conflict (code) do nothing
      `;
    }
    const flags: Array<[string, boolean, string]> = [
      ["whatsapp_enabled", true, "Botones y mensajería de WhatsApp"],
      ["coupons_enabled", true, "Cupones de descuento"],
      ["custom_domains", true, "Dominios personalizados por tienda"],
      ["advanced_analytics", true, "Analítica avanzada y embudo"],
      ["api_access", false, "API pública por tienda"],
    ];
    for (const [key, enabled, description] of flags) {
      await sql`insert into public.feature_flags (key, enabled, description) values (${key}, ${enabled}, ${description}) on conflict (key) do nothing`;
    }
  }

  // Authorize Super Admin based on exact email.
  if (access.user.email?.toLowerCase() === SUPERUSER_EMAIL.toLowerCase()) {
    if (!access.user.platform_role) {
      const name = args.name ?? access.user.name ?? access.user.email ?? "Super Admin";
      await sql`update public.app_users set platform_role = 'super_admin', role = 'admin', name = ${name} where id = ${access.userId}`;
      await audit({
        actorId: access.userId,
        actorLabel: access.user.email ?? access.userId,
        action: "ADMIN_BOOTSTRAP",
        resource: "platform",
        newData: { bootstrap: true },
      });
      const refreshed = await sql`select * from public.app_users where id = ${access.userId} limit 1`;
      return { user: shapeUser(refreshed[0]) };
    }
  } else {
    // If not the authorized email, ensure they ARE NOT super admin (self-healing if logic changed)
    if (access.user.platform_role === 'super_admin') {
      await sql`update public.app_users set platform_role = null where id = ${access.userId}`;
      const refreshed = await sql`select * from public.app_users where id = ${access.userId} limit 1`;
      return { user: shapeUser(refreshed[0]) };
    }
  }

  // Mark as verified on successful bootstrap/access if they are not anonymous
  if (!access.user.is_verified) {
    await sql`update public.app_users set is_verified = true where id = ${access.userId}`;
  }

  return { user: shapeUser(access.user) };
}

function shapeUser(u: Row | null | undefined) {
  if (!u) return null;
  return {
    id: u.id,
    name: u.name ?? null,
    email: u.email ?? null,
    image: u.image ?? null,
    isAnonymous: u.is_anonymous ?? false,
    role: u.role ?? null,
    platformRole: u.platform_role ?? null,
    isVerified: u.is_verified ?? false,
    tosAccepted: u.tos_accepted ?? false,
    marketingAccepted: u.marketing_accepted ?? false,
  };
}

export async function currentUser(req: Request) {
  const access = await getAccessContext(req);
  if (!access) return null;
  return shapeUser(access.user);
}

export async function myAccess(req: Request) {
  const access = await getAccessContext(req);
  if (!access) return null;
  let tenant: Row | null = null;
  if (access.membership) {
    const rows = await sql`select * from public.tenants where id = ${access.membership.tenant_id} limit 1`;
    tenant = rows[0] ?? null;
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
}

export async function listPlans() {
  const rows = await sql`select * from public.plans order by price_monthly asc`;
  return camelizeAll(rows);
}

export async function listFeatureFlags(req: Request) {
  await requireSuperAdmin(req);
  const rows = await sql`select * from public.feature_flags order by key asc`;
  return camelizeAll(rows);
}

export async function setFeatureFlag(req: Request, args: { key: string; enabled: boolean }) {
  const access = await requireSuperAdmin(req);
  const rows = await sql`update public.feature_flags set enabled = ${args.enabled} where key = ${args.key} returning *`;
  if (rows[0]) {
    await audit({
      actorId: access.userId,
      actorLabel: access.user.email ?? "super_admin",
      action: "FEATURE_FLAG_CHANGED",
      resource: "feature_flag",
      resourceId: args.key,
      newData: { enabled: args.enabled },
    });
  }
  return { ok: true };
}

/** Links a signed-in user to a tenant membership by email (owner invite claim). */
export async function claimMembership(req: Request) {
  const access = await requireUser(req);
  if (!access.user.email) return null;
  const email = access.user.email.toLowerCase();
  const invites = await sql`select * from public.tenant_members where user_id = ${access.userId} limit 1`;
  if (invites[0]) return { tenantId: invites[0].tenant_id };
  const pending = await sql`
    select * from public.tenant_members where user_id is null and lower(user_email) = ${email} order by invited_at asc limit 1
  `;
  const unclaimed = pending[0];
  if (unclaimed) {
    await sql`update public.tenant_members set user_id = ${access.userId}, joined_at = ${now()} where id = ${unclaimed.id}`;
    if (!access.user.name && unclaimed.user_name) {
      await sql`update public.app_users set name = ${unclaimed.user_name} where id = ${access.userId}`;
    }
    return { tenantId: unclaimed.tenant_id };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Global stats (super admin)
// ---------------------------------------------------------------------------
export async function globalStats(req: Request) {
  await requireSuperAdmin(req);
  const tenants = await sql`select status, count(*)::int as n from public.tenants group by status`;
  const orders = await sql`select status, count(*)::int as n, coalesce(sum(total), 0) as total from public.orders group by status`;
  const users = await sql`select count(*)::int as n from public.app_users`;
  const tenantMap = Object.fromEntries(tenants.map((t: any) => [t.status, t.n]));
  const revenue = orders
    .filter((o: any) => ["paid", "processing", "ready", "shipped", "delivered"].includes(o.status))
    .reduce((s: number, o: any) => s + Number(o.total), 0);
  const orderCount = orders.reduce((s: number, o: any) => s + o.n, 0);
  return {
    tenants: Object.values(tenantMap).reduce((s: number, n: any) => s + n, 0),
    activeTenants: tenantMap["active"] ?? 0,
    suspendedTenants: tenantMap["suspended"] ?? 0,
    orders: orderCount,
    revenue,
    users: users[0]?.n ?? 0,
  };
}

export async function globalOrders(req: Request) {
  await requireSuperAdmin(req);
  const rows = await sql`
    select o.*, t.name as tenant_name from public.orders o
    left join public.tenants t on t.id = o.tenant_id
    order by o.created_at desc limit 100
  `;
  return camelizeAll(rows).map((o: any) => ({ ...o, tenantName: o.tenantName ?? "—" }));
}

export async function auditLogs(req: Request, args: { tenantId?: string }) {
  await requireSuperAdmin(req);
  const rows = args.tenantId
    ? await sql`select * from public.audit_logs where tenant_id = ${args.tenantId} order by created_at desc limit 100`
    : await sql`select * from public.audit_logs order by created_at desc limit 100`;
  return camelizeAll(rows);
}

// ---------------------------------------------------------------------------
// Super admin tenant management
// ---------------------------------------------------------------------------
export async function listTenants(req: Request) {
  await requireSuperAdmin(req);
  const rows = await sql`select * from public.tenants order by created_at desc`;
  return camelizeAll(rows);
}

export async function getTenantDetail(req: Request, tenantId: string) {
  await requireSuperAdmin(req);
  const rows = await sql`select * from public.tenants where id = ${tenantId} limit 1`;
  const tenant = rows[0];
  if (!tenant) return null;
  const members = await sql`select * from public.tenant_members where tenant_id = ${tenantId}`;
  const sub = await sql`select * from public.subscriptions where tenant_id = ${tenantId} order by started_at desc limit 1`;
  const domains = await sql`select * from public.tenant_domains where tenant_id = ${tenantId}`;
  const prodCount = await sql`select count(*)::int as n from public.products where tenant_id = ${tenantId} and status = 'active'`;
  const orderAgg = await sql`select count(*)::int as n, coalesce(sum(total), 0) as revenue from public.orders where tenant_id = ${tenantId} and status in ('paid','processing','ready','shipped','delivered')`;
  const orderCount = await sql`select count(*)::int as n from public.orders where tenant_id = ${tenantId}`;
  return {
    tenant: camelize(tenant),
    members: camelizeAll(members),
    subscription: camelize(sub[0]),
    domains: camelizeAll(domains),
    productCount: prodCount[0]?.n ?? 0,
    orderCount: orderCount[0]?.n ?? 0,
    revenue: Number(orderAgg[0]?.revenue ?? 0),
  };
}

export async function createTenant(req: Request, args: {
  name: string; slug: string; template: string; planCode: string; adminEmail: string;
  adminName?: string; whatsappPhone?: string; currency?: string; isDemo?: boolean;
}) {
  const access = await requireSuperAdmin(req);
  const slug = args.slug.toLowerCase().trim();
  const exists = await sql`select 1 from public.tenants where slug = ${slug} limit 1`;
  if (exists[0]) throw BAD_REQUEST("El slug ya está en uso");

  const t = now();
  const tenantRows = await sql`
    insert into public.tenants
      (name, slug, status, template, plan_code, whatsapp_phone, currency, whatsapp_enabled, coupons_enabled, delivery_enabled, payment_provider, is_demo, created_at, seo)
    values
      (${args.name.trim().slice(0, 120)}, ${slug}, 'active', ${args.template}, ${args.planCode}, ${args.whatsappPhone ?? null},
       ${args.currency ?? "PEN"}, true, true, true, 'manual', ${args.isDemo ?? false}, ${t},
       ${JSON.stringify({ title: `${args.name} — Tienda oficial`, description: `Compra en ${args.name} con delivery y pago por WhatsApp.` })}::jsonb)
    returning id
  `;
  const tenantId = tenantRows[0].id;

  const templateKey = args.template in DEFAULT_THEMES ? args.template : "minimal";
  const theme = { ...DEFAULT_THEMES[templateKey], brand: { ...DEFAULT_THEMES[templateKey].brand, name: args.name } };
  await sql`insert into public.tenant_themes (tenant_id, status, version, theme, updated_at, published_at)
    values (${tenantId}, 'published', 1, ${JSON.stringify(theme)}::jsonb, ${t}, ${t})`;
  await sql`insert into public.tenant_themes (tenant_id, status, version, theme, updated_at)
    values (${tenantId}, 'draft', 1, ${JSON.stringify(theme)}::jsonb, ${t})`;

  const blocks = DEFAULT_HOMEPAGE_BLOCKS.map((b) => ({ ...b, settings: { ...b.settings } }));
  await sql`insert into public.pages (tenant_id, slug, title, is_home, status, version, blocks, updated_at)
    values (${tenantId}, 'home', 'Inicio', true, 'published', 1, ${JSON.stringify(blocks)}::jsonb, ${t})`;
  await sql`insert into public.pages (tenant_id, slug, title, is_home, status, version, blocks, updated_at)
    values (${tenantId}, 'home', 'Inicio', true, 'draft', 1, ${JSON.stringify(blocks)}::jsonb, ${t})`;

  await sql`insert into public.tenant_domains (tenant_id, domain, type, status, verified_at, ssl_status)
    values (${tenantId}, ${`${slug}.shoply.app`}, 'subdomain', 'active', ${t}, 'active')`;
  await sql`insert into public.subscriptions (tenant_id, plan_code, status, started_at)
    values (${tenantId}, ${args.planCode}, 'active', ${t})`;

  await sql`
    insert into public.tenant_members (tenant_id, user_email, user_name, role, invited_at)
    values (${tenantId}, ${args.adminEmail.toLowerCase().trim()}, ${args.adminName ?? null}, 'owner', ${t})
  `;

  const zone = await sql`insert into public.delivery_zones (tenant_id, name, is_active) values (${tenantId}, 'Zona A — Centro', true) returning id`;
  await sql`insert into public.delivery_rates (tenant_id, zone_id, name, method, price, eta, is_active)
    values (${tenantId}, ${zone[0].id}, 'Delivery Zona A', 'delivery', 5, '24-48h', true)`;
  await sql`insert into public.delivery_rates (tenant_id, zone_id, name, method, price, eta, is_active)
    values (${tenantId}, ${zone[0].id}, 'Recojo en tienda', 'pickup', 0, 'Hoy', true)`;

  await audit({
    actorId: access.userId,
    actorLabel: access.user.email ?? "super_admin",
    tenantId,
    action: "TENANT_CREATED",
    resource: "tenant",
    resourceId: tenantId,
    newData: { name: args.name, slug, planCode: args.planCode, adminEmail: args.adminEmail },
  });
  return { tenantId };
}

export async function setTenantStatus(req: Request, args: { tenantId: string; status: "active" | "suspended"; reason?: string }) {
  const access = await requireSuperAdmin(req);
  const rows = await sql`select * from public.tenants where id = ${args.tenantId} limit 1`;
  const tenant = rows[0];
  if (!tenant) throw BAD_REQUEST("Tenant not found");
  await sql`update public.tenants set status = ${args.status}, suspended_reason = ${args.status === "suspended" ? args.reason ?? null : null} where id = ${args.tenantId}`;
  await audit({
    actorId: access.userId,
    actorLabel: access.user.email ?? "super_admin",
    tenantId: args.tenantId,
    action: args.status === "suspended" ? "STORE_SUSPENDED" : "STORE_REACTIVATED",
    resource: "tenant",
    resourceId: args.tenantId,
    oldData: { status: tenant.status },
    newData: { status: args.status, reason: args.reason },
  });
  return { ok: true };
}

export async function changeTenantPlan(req: Request, args: { tenantId: string; planCode: string }) {
  const access = await requireSuperAdmin(req);
  const rows = await sql`select * from public.tenants where id = ${args.tenantId} limit 1`;
  const tenant = rows[0];
  if (!tenant) throw BAD_REQUEST("Tenant not found");
  await sql`update public.tenants set plan_code = ${args.planCode} where id = ${args.tenantId}`;
  const sub = await sql`select * from public.subscriptions where tenant_id = ${args.tenantId} order by started_at desc limit 1`;
  if (sub[0]) {
    await sql`update public.subscriptions set plan_code = ${args.planCode}, status = 'active' where id = ${sub[0].id}`;
  } else {
    await sql`insert into public.subscriptions (tenant_id, plan_code, status, started_at) values (${args.tenantId}, ${args.planCode}, 'active', ${now()})`;
  }
  await audit({
    actorId: access.userId,
    actorLabel: access.user.email ?? "super_admin",
    tenantId: args.tenantId,
    action: "PLAN_CHANGED",
    resource: "tenant",
    resourceId: args.tenantId,
    oldData: { planCode: tenant.plan_code },
    newData: { planCode: args.planCode },
  });
  return { ok: true };
}

/** Removes tenant-scoped data. Super admin only. Cascades handle most tables. */
export async function deleteTenant(req: Request, tenantId: string) {
  const access = await requireSuperAdmin(req);
  const rows = await sql`select * from public.tenants where id = ${tenantId} limit 1`;
  const tenant = rows[0];
  if (!tenant) throw BAD_REQUEST("Tenant not found");
  await sql`delete from public.tenants where id = ${tenantId}`;
  await audit({
    actorId: access.userId,
    actorLabel: access.user.email ?? "super_admin",
    action: "TENANT_DELETED",
    resource: "tenant",
    resourceId: tenantId,
    oldData: { name: tenant.name, slug: tenant.slug },
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Staff Management (Owner only)
// ---------------------------------------------------------------------------
import { getAdminClient } from "./db.ts";

export async function listStaff(req: Request) {
  const access = await requireTenantMember(req);
  const tenantId = resolveTenantId(access);
  const rows = await sql`
    select tm.*, u.email, u.name as user_name_real
    from public.tenant_members tm
    left join public.app_users u on u.id = tm.user_id
    where tm.tenant_id = ${tenantId}
    order by tm.role = 'owner' desc, tm.user_email asc
  `;
  return camelizeAll(rows);
}

export async function saveStaff(req: Request, args: {
  email: string; name?: string; role: 'owner' | 'staff'; permissions?: string[]; password?: string; username?: string;
}) {
  const access = await requireTenantOwner(req);
  const tenantId = resolveTenantId(access);
  const t = now();

  // If password/username is provided, we use the virtual email logic
  const isInternal = !!args.username && !!args.password;
  const email = isInternal
    ? `${args.username!.toLowerCase()}@${access.tenantSlug}.staff.shoply`
    : args.email.toLowerCase().trim();

  const existing = await sql`
    select id from public.tenant_members
    where tenant_id = ${tenantId} and lower(user_email) = ${email}
    limit 1
  `;

  if (isInternal && args.password) {
    const admin = getAdminClient();
    const { data: user, error } = await admin.auth.admin.createUser({
      email,
      password: args.password,
      email_confirm: true,
      user_metadata: { name: args.name, is_staff: true, tenant_id: tenantId }
    });
    if (error) throw BAD_REQUEST(error.message);

    if (existing[0]) {
      await sql`
        update public.tenant_members
        set user_id = ${user.user.id}, user_name = ${args.name ?? null}, role = ${args.role},
            permissions = ${args.permissions ?? null}, username = ${args.username}
        where id = ${existing[0].id}
      `;
    } else {
      await sql`
        insert into public.tenant_members (tenant_id, user_id, user_email, user_name, role, permissions, invited_at, joined_at, username)
        values (${tenantId}, ${user.user.id}, ${email}, ${args.name ?? null}, ${args.role}, ${args.permissions ?? null}, ${t}, ${t}, ${args.username})
      `;
    }
  } else {
    // Normal invite flow
    if (existing[0]) {
      await sql`
        update public.tenant_members
        set user_name = ${args.name ?? null}, role = ${args.role}, permissions = ${args.permissions ?? null}
        where id = ${existing[0].id}
      `;
    } else {
      await sql`
        insert into public.tenant_members (tenant_id, user_email, user_name, role, permissions, invited_at)
        values (${tenantId}, ${email}, ${args.name ?? null}, ${args.role}, ${args.permissions ?? null}, ${t})
      `;
    }
  }

  return { ok: true };
}

export async function deleteStaff(req: Request, memberId: string) {
  const access = await requireTenantOwner(req);
  const tenantId = resolveTenantId(access);

  const member = await sql`select * from public.tenant_members where id = ${memberId} and tenant_id = ${tenantId} limit 1`;
  if (!member[0]) throw BAD_REQUEST("Member not found");
  if (member[0].role === 'owner') throw BAD_REQUEST("Cannot delete an owner");

  await sql`delete from public.tenant_members where id = ${memberId}`;

  // If it was an internal user, we might want to delete from auth.users too
  if (member[0].username && member[0].user_id) {
    const admin = getAdminClient();
    await admin.auth.admin.deleteUser(member[0].user_id);
  }

  return { ok: true };
}

export { shapeUser };
