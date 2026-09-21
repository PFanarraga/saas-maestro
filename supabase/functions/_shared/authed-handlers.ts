import { sql, now, camelize, camelizeAll, sanitizeText, BAD_REQUEST, type Row } from "./db.ts";
import { audit, getAccessContext, requireSuperAdmin, requireUser, type AccessContext, requireTenantMember, requireTenantOwner, resolveTenantId, requirePermission } from "./auth.ts";
import { DEFAULT_HOMEPAGE_BLOCKS, DEFAULT_THEMES, PLAN_PRESETS } from "./constants.ts";
import { getAdminClient } from "./db.ts";
import { TemplateRegistry } from "./templates/registry.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function shapeUser(u: Row | null | undefined) {
  if (!u) return null;
  return {
    id: u.id,
    name: u.name ?? null,
    firstName: u.first_name ?? null,
    lastName: u.last_name ?? null,
    email: u.email ?? null,
    phone: u.phone ?? null,
    image: u.image ?? null,
    isAnonymous: u.is_anonymous ?? false,
    role: u.role ?? null,
    platformRole: u.platform_role ?? null,
    isVerified: u.is_verified ?? false,
    tosAccepted: u.tos_accepted ?? false,
    marketingAccepted: u.marketing_accepted ?? false,
    status: u.is_blocked ? 'blocked' : 'active',
    createdAt: u.created_at,
  };
}

export async function currentUser(req: Request) {
  const access = await getAccessContext(req);
  if (!access) return null;

  // Platform-wide Maintenance Check
  if (!access.isSuperAdmin) {
    const maintenance = await getSetting('maintenance_mode');
    if (maintenance?.value === true) {
      throw new Error("MAINTENANCE_MODE_ACTIVE");
    }
  }

  // Security: Check if user is blocked
  if (access.user.is_blocked) {
    throw new Error("USER_BLOCKED");
  }

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
    permissions: access.membership?.permissions ?? [],
  };
}

// ---------------------------------------------------------------------------
// Platform Users Management
// ---------------------------------------------------------------------------
export async function listPlatformUsers(req: Request) {
  await requireSuperAdmin(req);
  const rows = await sql`
    select u.*, count(tm.id)::int as tenant_count
    from public.app_users u
    left join public.tenant_members tm on tm.user_id = u.id
    group by u.id
    order by u.created_at desc
    limit 200
  `;
  return camelizeAll(rows).map(shapeUser);
}

export async function setUserStatus(req: Request, args: { userId: string; status: 'active' | 'blocked' }) {
  const access = await requireSuperAdmin(req);
  const isBlocked = args.status === 'blocked';

  // Security: Cannot block self
  if (args.userId === access.userId) throw BAD_REQUEST("No puedes bloquear tu propia cuenta");

  await sql`update public.app_users set is_blocked = ${isBlocked} where id = ${args.userId}`;

  await audit({
    actorId: access.userId,
    actorLabel: access.user.email ?? "admin",
    action: isBlocked ? "USER_BLOCKED" : "USER_UNBLOCKED",
    resource: "user",
    resourceId: args.userId,
    newData: { status: args.status }
  });

  return { ok: true };
}

export async function setPlatformRole(req: Request, args: { userId: string; role: string | null }) {
  const access = await requireSuperAdmin(req);

  // Security rules
  if (args.role === 'super_admin') throw BAD_REQUEST("Solo se puede asignar super_admin mediante base de datos");

  const user = await sql`select platform_role from public.app_users where id = ${args.userId} limit 1`;
  if (!user[0]) throw BAD_REQUEST("Usuario no encontrado");

  await sql`update public.app_users set platform_role = ${args.role} where id = ${args.userId}`;

  await audit({
    actorId: access.userId,
    actorLabel: access.user.email ?? "admin",
    action: "ROLE_CHANGED",
    resource: "user",
    resourceId: args.userId,
    oldData: { role: user[0].platform_role },
    newData: { role: args.role }
  });

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Business: Tenants, Plans & Subscriptions
// ---------------------------------------------------------------------------
export async function listTenants(req: Request) {
  await requireSuperAdmin(req);
  const rows = await sql`
    select t.*, count(o.id)::int as order_count, coalesce(sum(o.total), 0) as gmv
    from public.tenants t
    left join public.orders o on o.tenant_id = t.id and o.status in ('paid','processing','ready','shipped','delivered')
    group by t.id
    order by t.created_at desc
  `;
  return camelizeAll(rows);
}

export async function listPlans() {
  const rows = await sql`select * from public.plans order by price_monthly asc`;
  return camelizeAll(rows);
}

export async function listGlobalSubscriptions(req: Request) {
  await requireSuperAdmin(req);
  const rows = await sql`
    select s.*, t.name as tenant_name, u.email as owner_email, p.price_monthly, p.currency
    from public.subscriptions s
    join public.tenants t on t.id = s.tenant_id
    join public.plans p on p.code = s.plan_code
    left join public.tenant_members tm on tm.tenant_id = t.id and tm.role = 'owner'
    left join public.app_users u on u.id = tm.user_id
    order by s.started_at desc
  `;
  return camelizeAll(rows);
}

// ---------------------------------------------------------------------------
// Operations: Orders & Payments (Financial Ledger)
// ---------------------------------------------------------------------------
export async function globalOrders(req: Request) {
  await requireSuperAdmin(req);
  const rows = await sql`
    select o.*, t.name as tenant_name
    from public.orders o
    left join public.tenants t on t.id = o.tenant_id
    order by o.created_at desc limit 200
  `;
  return camelizeAll(rows);
}

export async function listGlobalPayments(req: Request) {
  await requireSuperAdmin(req);
  const rows = await sql`
    select p.*, t.name as tenant_name, o.customer_email, o.number as order_number
    from public.payments p
    join public.tenants t on t.id = p.tenant_id
    left join public.orders o on o.id = p.order_id
    order by p.created_at desc
    limit 200
  `;
  return camelizeAll(rows);
}

export async function createPaymentAdjustment(req: Request, args: {
  originalPaymentId: string; amount: number; reason: string; type: 'refund' | 'adjustment'
}) {
  const access = await requireSuperAdmin(req);
  const original = await sql`select * from public.payments where id = ${args.originalPaymentId} limit 1`;
  if (!original[0]) throw BAD_REQUEST("Pago original no encontrado");

  // Historic payments are immutable. Adjustments are NEW records.
  const adjustment = await sql`
    insert into public.payments (tenant_id, order_id, amount, currency, status, provider, raw, created_at)
    values (${original[0].tenant_id}, ${original[0].order_id}, ${args.amount}, ${original[0].currency}, 'succeeded', 'system_adjustment',
            ${JSON.stringify({ reason: args.reason, type: args.type, original_id: args.originalPaymentId })}, ${now()})
    returning *
  `;

  await audit({
    actorId: access.userId,
    actorLabel: access.user.email ?? "admin",
    action: args.type === 'refund' ? "PAYMENT_REFUNDED" : "PAYMENT_ADJUSTMENT",
    resource: "payment",
    resourceId: original[0].id,
    newData: { adjustmentId: adjustment[0].id, amount: args.amount, reason: args.reason }
  });

  return camelize(adjustment[0]);
}

// ---------------------------------------------------------------------------
// Support System
// ---------------------------------------------------------------------------
export async function listSupportTickets(req: Request) {
  await requireSuperAdmin(req);
  const rows = await sql`
    select st.*, t.name as tenant_name, u.email as user_email, u.name as user_name, admin.name as assigned_name
    from public.support_tickets st
    left join public.tenants t on t.id = st.tenant_id
    left join public.app_users u on u.id = st.user_id
    left join public.app_users admin on admin.id = st.assigned_to
    order by
      case when st.status = 'open' then 0 when st.status = 'in_progress' then 1 when st.status = 'waiting_customer' then 2 else 3 end,
      st.created_at desc
  `;
  return camelizeAll(rows);
}

export async function getSupportTicketDetail(req: Request, ticketId: string) {
  const access = await requireUser(req);
  const rows = await sql`
    select st.*, t.name as tenant_name, u.email as user_email, u.name as user_name
    from public.support_tickets st
    left join public.tenants t on t.id = st.tenant_id
    left join public.app_users u on u.id = st.user_id
    where st.id = ${ticketId}
    limit 1
  `;
  const ticket = rows[0];
  if (!ticket) throw BAD_REQUEST("Ticket no encontrado");

  // Authorization: Super Admin or creator
  if (!access.isSuperAdmin && ticket.user_id !== access.userId) {
    throw BAD_REQUEST("No tienes permiso para ver este ticket");
  }

  const messages = await sql`
    select m.*, u.name as sender_name, u.email as sender_email
    from public.support_ticket_messages m
    left join public.app_users u on u.id = m.sender_user_id
    where m.ticket_id = ${ticketId}
    order by m.created_at asc
  `;

  return {
    ticket: camelize(ticket),
    messages: camelizeAll(messages)
  };
}

export async function createSupportTicket(req: Request, args: {
  subject: string; description: string; category: string; priority?: string; tenantId?: string
}) {
  const access = await requireUser(req);
  const t = now();

  // Use sequence serial for ticket number
  const ticket = await sql`
    insert into public.support_tickets (tenant_id, user_id, subject, description, category, priority, status, created_at, updated_at)
    values (${args.tenantId ?? access.tenantId}, ${access.userId}, ${args.subject}, ${args.description}, ${args.category}, ${args.priority ?? 'normal'}, 'open', ${t}, ${t})
    returning *
  `;

  await sql`
    insert into public.support_ticket_messages (ticket_id, sender_user_id, sender_type, message, created_at)
    values (${ticket[0].id}, ${access.userId}, 'customer', ${args.description}, ${t})
  `;

  return camelize(ticket[0]);
}

export async function replyToSupportTicket(req: Request, args: { ticketId: string; message: string; attachments?: string[] }) {
  const access = await requireUser(req);
  const t = now();
  const type = access.isSuperAdmin ? 'admin' : 'customer';

  await sql`
    insert into public.support_ticket_messages (ticket_id, sender_user_id, sender_type, message, attachments, created_at)
    values (${args.ticketId}, ${access.userId}, ${type}, ${args.message}, ${args.attachments ?? null}, ${t})
  `;

  await sql`
    update public.support_tickets
    set status = ${access.isSuperAdmin ? 'in_progress' : 'waiting_customer'},
        updated_at = ${t}
    where id = ${args.ticketId}
  `;

  return { ok: true };
}

export async function updateSupportTicketStatus(req: Request, args: { ticketId: string; status: string; assignedTo?: string; priority?: string }) {
  await requireSuperAdmin(req);
  const t = now();

  await sql`
    update public.support_tickets
    set status = coalesce(${args.status ?? null}, status),
        priority = coalesce(${args.priority ?? null}, priority),
        assigned_to = coalesce(${args.assignedTo ?? null}, assigned_to),
        resolved_at = ${args.status === 'resolved' ? t : (args.status === 'open' ? null : sql`resolved_at`)},
        closed_at = ${args.status === 'closed' ? t : (args.status === 'open' ? null : sql`closed_at`)},
        updated_at = ${t}
    where id = ${args.ticketId}
  `;

  await audit({
    actorId: (await requireUser(req)).userId,
    actorLabel: "admin",
    action: "TICKET_STATUS_CHANGED",
    resource: "ticket",
    resourceId: args.ticketId,
    newData: { status: args.status, assignedTo: args.assignedTo }
  });

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Platform Settings & Feature Flags
// ---------------------------------------------------------------------------
export async function getPlatformSettings(req: Request) {
  await requireSuperAdmin(req);
  const rows = await sql`select * from public.platform_settings order by key asc`;
  return camelizeAll(rows);
}

export async function setPlatformSetting(req: Request, args: { key: string; value: any }) {
  await requireSuperAdmin(req);

  await sql`
    insert into public.platform_settings (key, value)
    values (${args.key}, ${JSON.stringify(args.value)}::jsonb)
    on conflict (key) do update set value = excluded.value
  `;

  await audit({
    actorId: (await requireUser(req)).userId,
    actorLabel: "admin",
    action: "PLATFORM_SETTING_CHANGED",
    resource: "setting",
    resourceId: args.key,
    newData: { value: args.value }
  });

  return { ok: true };
}

export async function getSetting(key: string) {
  const rows = await sql`select value from public.platform_settings where key = ${key} limit 1`;
  return rows[0] ?? null;
}

export async function listFeatureFlags(req: Request) {
  await requireSuperAdmin(req);
  const rows = await sql`select * from public.feature_flags order by key asc`;
  return camelizeAll(rows);
}

export async function setFeatureFlag(req: Request, args: {
  key: string; enabled: boolean; name?: string; description?: string; environment?: string
}) {
  await requireSuperAdmin(req);
  const t = now();

  const rows = await sql`
    insert into public.feature_flags (key, enabled, description, environment, updated_at)
    values (${args.key}, ${args.enabled}, ${args.description ?? ''}, ${args.environment ?? 'production'}, ${t})
    on conflict (key) do update
    set enabled = excluded.enabled,
        description = coalesce(${args.description ?? null}, feature_flags.description),
        environment = coalesce(${args.environment ?? null}, feature_flags.environment),
        updated_at = ${t}
    returning *
  `;

  await audit({
    actorId: (await requireUser(req)).userId,
    actorLabel: "admin",
    action: "FEATURE_FLAG_CHANGED",
    resource: "feature_flag",
    resourceId: args.key,
    newData: { enabled: args.enabled }
  });

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Existing Platform Admin Logic (Ported/Refactored)
// ---------------------------------------------------------------------------

export async function globalStats(req: Request) {
  await requireSuperAdmin(req);
  const thirtyDaysAgo = now() - (30 * 86400000);
  const fourteenDaysAgo = now() - (14 * 86400000);

  const tenants = await sql`select status, plan_code, count(*)::int as n from public.tenants group by status, plan_code`;
  const orders = await sql`select status, count(*)::int as n, coalesce(sum(total), 0) as total from public.orders group by status`;
  const users = await sql`select count(*)::int as n from public.app_users`;

  const recentTenantsCount = await sql`select count(*)::int as n from public.tenants where created_at > ${thirtyDaysAgo}`;
  const recentOrdersAgg = await sql`select count(*)::int as n, sum(total) as total from public.orders where created_at > ${thirtyDaysAgo} and status in ('paid','processing','ready','shipped','delivered')`;

  const planMap: Record<string, number> = {};
  tenants.forEach((t: any) => { planMap[t.plan_code] = (planMap[t.plan_code] || 0) + t.n; });

  const tenantStatusMap: Record<string, number> = {};
  tenants.forEach((t: any) => { tenantStatusMap[t.status] = (tenantStatusMap[t.status] || 0) + t.n; });

  const revenue = orders
    .filter((o: any) => ["paid", "processing", "ready", "shipped", "delivered"].includes(o.status))
    .reduce((s: number, o: any) => s + Number(o.total), 0);
  const orderCount = orders.reduce((s: number, o: any) => s + o.n, 0);

  const series = await sql`
    select
      date_trunc('day', to_timestamp(created_at / 1000)) as day,
      count(*)::int as orders,
      sum(total) as revenue
    from public.orders
    where created_at > ${fourteenDaysAgo} and status in ('paid','processing','ready','shipped','delivered')
    group by day
    order by day asc
  `;

  const topTenants = await sql`select id, name, slug, plan_code, status, created_at from public.tenants order by created_at desc limit 5`;
  const topOrders = await sql`
    select o.id, o.number, o.total, o.currency, o.status, o.created_at, t.name as tenant_name
    from public.orders o
    left join public.tenants t on t.id = o.tenant_id
    order by o.created_at desc limit 5
  `;

  return {
    tenants: Object.values(tenantStatusMap).reduce((s: number, n: any) => s + n, 0),
    activeTenants: tenantStatusMap["active"] ?? 0,
    suspendedTenants: tenantStatusMap["suspended"] ?? 0,
    orders: orderCount,
    revenue,
    users: users[0]?.n ?? 0,
    planDistribution: planMap,
    chartSeries: series.map((s: any) => ({
      day: s.day.toISOString().split('T')[0],
      orders: s.orders,
      revenue: Number(s.revenue ?? 0)
    })),
    recent: { tenants: camelizeAll(topTenants), orders: camelizeAll(topOrders) },
    growth: { newTenants30d: recentTenantsCount[0].n, newOrders30d: recentOrdersAgg[0].n, revenue30d: Number(recentOrdersAgg[0].total ?? 0) }
  };
}

export async function auditLogs(req: Request, args: { tenantId?: string }) {
  await requireSuperAdmin(req);
  const rows = args.tenantId
    ? await sql`select * from public.audit_logs where tenant_id = ${args.tenantId} order by created_at desc limit 100`
    : await sql`select * from public.audit_logs order by created_at desc limit 100`;
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
  businessName?: string; category?: string; description?: string; country?: string; city?: string; address?: string; businessPhone?: string;
}) {
  await requireSuperAdmin(req);
  const slug = args.slug.toLowerCase().trim();
  const exists = await sql`select 1 from public.tenants where slug = ${slug} limit 1`;
  if (exists[0]) throw BAD_REQUEST("El slug ya está en uso");

  const t = now();
  const tenantRows = await sql`
    insert into public.tenants
      (name, slug, status, template, plan_code, whatsapp_phone, currency, whatsapp_enabled, coupons_enabled, delivery_enabled, payment_provider, is_demo, created_at, seo,
       business_name, category, description, country, city, address, business_phone, active_template_id)
    values
      (${args.name.trim().slice(0, 120)}, ${slug}, 'active', ${args.template}, ${args.planCode}, ${args.whatsappPhone ?? null},
       ${args.currency ?? "PEN"}, true, true, true, 'manual', ${args.isDemo ?? false}, ${t},
       ${JSON.stringify({ title: `${args.name} — Tienda oficial`, description: `Compra en ${args.name} con delivery y pago por WhatsApp.` })}::jsonb,
       ${args.businessName ?? null}, ${args.category ?? null}, ${args.description ?? null}, ${args.country ?? null}, ${args.city ?? null}, ${args.address ?? null}, ${args.businessPhone ?? null},
       ${args.template})
    returning id
  `;
  const tenantId = tenantRows[0].id;

  const template = TemplateRegistry.getById(args.template);
  const theme = { ...template.defaultTheme, brand: { ...template.defaultTheme.brand, name: args.name } };

  await sql`insert into public.tenant_themes (tenant_id, status, version, theme, updated_at, published_at)
    values (${tenantId}, 'published', 1, ${JSON.stringify(theme)}::jsonb, ${t}, ${t})`;
  await sql`insert into public.tenant_themes (tenant_id, status, version, theme, updated_at)
    values (${tenantId}, 'draft', 1, ${JSON.stringify(theme)}::jsonb, ${t})`;

  const blocks = template.initialBlocks.map((b) => ({ ...b, id: `${b.type}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}` }));
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
    actorId: (await requireUser(req)).userId,
    actorLabel: "super_admin",
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
  if (member[0].username && member[0].user_id) {
    const admin = getAdminClient();
    await admin.auth.admin.deleteUser(member[0].user_id);
  }
  return { ok: true };
}

export { shapeUser };
