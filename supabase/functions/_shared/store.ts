// Port of src/convex/store.ts — themes, pages, delivery, coupons, customers.
import { sql, now, sanitizeText, isHexColor, BAD_REQUEST, camelize, camelizeAll, type Row } from "./db.ts";
import { audit, getAccessContext, requireTenantMember, resolveTenantId } from "./auth.ts";
import { DEFAULT_THEMES } from "./constants.ts";
import { TemplateRegistry } from "./templates/registry.ts";

// ---------------------------------------------------------------------------
// Tenant settings
// ---------------------------------------------------------------------------
export async function getSettings(req: Request) {
  const access = await getAccessContext(req);
  if (!access?.tenantId) return null;
  const rows = await sql`select * from public.tenants where id = ${access.tenantId} limit 1`;
  const tenant = rows[0];
  if (!tenant) return null;
  const settingsRows = await sql`select key, value from public.tenant_settings where tenant_id = ${access.tenantId}`;
  const map: Record<string, unknown> = {};
  for (const s of settingsRows) map[s.key] = s.value;
  return { tenant: camelize(tenant), settings: map };
}

export async function updateTenantInfo(req: Request, args: {
  name?: string; whatsappPhone?: string; whatsappEnabled?: boolean; couponsEnabled?: boolean;
  deliveryEnabled?: boolean; paymentProvider?: "manual" | "culqi"; logoUrl?: string; currency?: string;
  seoTitle?: string; seoDescription?: string;
}) {
  const access = await requireTenantMember(req);
  if (!access.tenantId) throw BAD_REQUEST("TENANT_REQUIRED");
  const tenantId = access.tenantId;
  const rows = await sql`select * from public.tenants where id = ${tenantId} limit 1`;
  const tenant = rows[0];
  if (!tenant) throw BAD_REQUEST("Tienda no encontrada");

  const patch: Row = {};
  if (args.name !== undefined) patch.name = sanitizeText(args.name, 120);
  if (args.whatsappPhone !== undefined) patch.whatsapp_phone = String(args.whatsappPhone).replace(/[^0-9+]/g, "");
  if (args.whatsappEnabled !== undefined) patch.whatsapp_enabled = args.whatsappEnabled;
  if (args.couponsEnabled !== undefined) patch.coupons_enabled = args.couponsEnabled;
  if (args.deliveryEnabled !== undefined) patch.delivery_enabled = args.deliveryEnabled;
  if (args.paymentProvider !== undefined) patch.payment_provider = args.paymentProvider;
  if (args.logoUrl !== undefined) patch.logo_url = args.logoUrl;
  if (args.currency !== undefined) patch.currency = args.currency;
  if (args.seoTitle !== undefined || args.seoDescription !== undefined) {
    const seo: Row = { ...(tenant.seo ?? {}) };
    if (args.seoTitle !== undefined) seo.title = sanitizeText(args.seoTitle, 120);
    if (args.seoDescription !== undefined) seo.description = sanitizeText(args.seoDescription, 300);
    patch.seo = seo;
  }

  const setClauses: string[] = [];
  const values: any[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(patch)) {
    setClauses.push(`${k} = $${i}`);
    values.push(typeof v === "object" ? JSON.stringify(v) : v);
    i++;
  }
  if (setClauses.length > 0) {
    values.push(tenantId);
    await sql(`update public.tenants set ${setClauses.join(", ")} where id = $${i}`, ...values);
  }
  await audit({
    actorId: access.userId, actorLabel: access.user.email ?? "admin", tenantId,
    action: "STORE_SETTINGS_CHANGED", resource: "tenant", resourceId: tenantId, newData: patch,
  });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Theme engine
// ---------------------------------------------------------------------------
export async function getThemeDraft(req: Request) {
  const access = await getAccessContext(req);
  if (!access?.tenantId) return null;
  const rows = await sql`
    select * from public.tenant_themes where tenant_id = ${access.tenantId} and status = 'draft'
    order by updated_at desc limit 1
  `;
  return camelize(rows[0]);
}

export async function getPublishedTheme(slug: string) {
  const tenants = await sql`select * from public.tenants where slug = ${slug} limit 1`;
  const tenant = tenants[0];
  if (!tenant || tenant.status === "suspended") return null;
  const themes = await sql`
    select * from public.tenant_themes where tenant_id = ${tenant.id} and status = 'published' limit 1
  `;
  const theme = themes[0];
  if (!theme) return null;
  return {
    theme: theme.theme,
    version: theme.version,
    tenant: {
      name: tenant.name,
      slug: tenant.slug,
      whatsappPhone: tenant.whatsapp_phone ?? null,
      whatsappEnabled: tenant.whatsapp_enabled ?? false,
      currency: tenant.currency ?? "PEN",
      seo: tenant.seo ?? null,
      logoUrl: tenant.logo_url ?? null,
      activeTemplateId: tenant.active_template_id ?? 'shoply-minimal',
    },
  };
}

export async function saveThemeDraft(req: Request, theme: Row) {
  const access = await requireTenantMember(req);
  if (!access.tenantId) throw BAD_REQUEST("TENANT_REQUIRED");
  const tenantId = access.tenantId;
  for (const [k, val] of Object.entries(theme.colors ?? {})) {
    if (typeof val === "string" && k !== "radius" && !isHexColor(val)) throw BAD_REQUEST(`Color inválido en ${k}`);
  }
  const drafts = await sql`
    select * from public.tenant_themes where tenant_id = ${tenantId} and status = 'draft' limit 1
  `;
  if (drafts[0]) {
    await sql`update public.tenant_themes set theme = ${JSON.stringify(theme)}::jsonb, updated_at = ${now()} where id = ${drafts[0].id}`;
    return { id: drafts[0].id };
  }
  const published = await sql`
    select * from public.tenant_themes where tenant_id = ${tenantId} and status = 'published' limit 1
  `;
  const created = await sql`
    insert into public.tenant_themes (tenant_id, status, version, theme, updated_at)
    values (${tenantId}, 'draft', ${published[0]?.version ?? 1}, ${JSON.stringify(theme)}::jsonb, ${now()}) returning id
  `;
  return { id: created[0].id };
}

export async function applyTemplate(req: Request, templateId: string) {
  const access = await requireTenantMember(req);
  if (!access.tenantId) throw BAD_REQUEST("TENANT_REQUIRED");
  const tenantId = access.tenantId;

  const template = TemplateRegistry.getById(templateId);
  if (!template) throw BAD_REQUEST("TEMPLATE_NOT_FOUND");

  const tenants = await sql`select * from public.tenants where id = ${tenantId} limit 1`;
  const tenant = tenants[0];

  // 1. Update Tenant design metadata
  await sql`
    update public.tenants
    set active_template_id = ${templateId},
        active_preset_id = 'default'
    where id = ${tenantId}
  `;

  // 2. Apply default theme for this template
  const theme = {
    ...template.defaultTheme,
    brand: { ...template.defaultTheme.brand, name: tenant?.name }
  };

  const drafts = await sql`select * from public.tenant_themes where tenant_id = ${tenantId} and status = 'draft' limit 1`;
  if (drafts[0]) {
    await sql`update public.tenant_themes set theme = ${JSON.stringify(theme)}::jsonb, updated_at = ${now()} where id = ${drafts[0].id}`;
  } else {
    await sql`insert into public.tenant_themes (tenant_id, status, version, theme, updated_at)
      values (${tenantId}, 'draft', 1, ${JSON.stringify(theme)}::jsonb, ${now()})`;
  }

  // 3. Set initial blocks if it's a fresh template apply (optional logic)
  // For now, let's keep it simple and just update the theme and metadata.
  // In a real scenario, we might want to ask if they want to overwrite blocks.

  await audit({
    actorId: access.userId, actorLabel: access.user.email ?? "admin", tenantId,
    action: "TEMPLATE_APPLIED", resource: "tenant", resourceId: tenantId, newData: { templateId },
  });

  return { ok: true };
}

export async function publishTheme(req: Request) {
  const access = await requireTenantMember(req);
  if (!access.tenantId) throw BAD_REQUEST("TENANT_REQUIRED");
  const tenantId = access.tenantId;
  const drafts = await sql`select * from public.tenant_themes where tenant_id = ${tenantId} and status = 'draft' limit 1`;
  const draft = drafts[0];
  if (!draft) throw BAD_REQUEST("No hay borrador para publicar");
  const publishedRows = await sql`select * from public.tenant_themes where tenant_id = ${tenantId} and status = 'published' limit 1`;
  const published = publishedRows[0];
  const newVersion = (published?.version ?? 0) + 1;
  if (published) await sql`delete from public.tenant_themes where id = ${published.id}`;
  await sql`update public.tenant_themes set status = 'published', version = ${newVersion}, published_at = ${now()}, updated_at = ${now()} where id = ${draft.id}`;
  await sql`insert into public.tenant_themes (tenant_id, status, version, theme, updated_at)
    values (${tenantId}, 'draft', ${newVersion}, ${JSON.stringify(draft.theme)}::jsonb, ${now()})`;
  await audit({
    actorId: access.userId, actorLabel: access.user.email ?? "admin", tenantId,
    action: "THEME_PUBLISHED", resource: "theme", resourceId: draft.id, newData: { version: newVersion },
  });
  return newVersion;
}

export async function themeVersions(req: Request) {
  const access = await getAccessContext(req);
  if (!access?.tenantId) return [];
  const rows = await sql`
    select id, version, published_at from public.tenant_themes
    where tenant_id = ${access.tenantId} and status = 'published'
    order by version desc
  `;
  return camelizeAll(rows);
}

// ---------------------------------------------------------------------------
// Page builder
// ---------------------------------------------------------------------------
export async function getPageDraft(req: Request, slug: string) {
  const access = await getAccessContext(req);
  if (!access?.tenantId) return null;
  const rows = await sql`
    select * from public.pages where tenant_id = ${access.tenantId} and slug = ${slug} and status = 'draft' limit 1
  `;
  return camelize(rows[0]);
}

export async function savePageDraft(req: Request, args: { slug: string; title: string; blocks: Row[] }) {
  const access = await requireTenantMember(req);
  if (!access.tenantId) throw BAD_REQUEST("TENANT_REQUIRED");
  const tenantId = access.tenantId;
  if (args.blocks.length > 40) throw BAD_REQUEST("Demasiados bloques (máx 40)");
  const drafts = await sql`
    select * from public.pages where tenant_id = ${tenantId} and slug = ${args.slug} and status = 'draft' limit 1
  `;
  if (drafts[0]) {
    await sql`update public.pages set title = ${sanitizeText(args.title, 120)}, blocks = ${JSON.stringify(args.blocks)}::jsonb, updated_at = ${now()} where id = ${drafts[0].id}`;
    return { id: drafts[0].id };
  }
  const created = await sql`
    insert into public.pages (tenant_id, slug, title, is_home, status, version, blocks, updated_at)
    values (${tenantId}, ${args.slug}, ${sanitizeText(args.title, 120)}, ${args.slug === "home"}, 'draft', 1, ${JSON.stringify(args.blocks)}::jsonb, ${now()})
    returning id
  `;
  return { id: created[0].id };
}

export async function publishPage(req: Request, slug: string) {
  const access = await requireTenantMember(req);
  if (!access.tenantId) throw BAD_REQUEST("TENANT_REQUIRED");
  const tenantId = access.tenantId;
  const drafts = await sql`select * from public.pages where tenant_id = ${tenantId} and slug = ${slug} and status = 'draft' limit 1`;
  const draft = drafts[0];
  if (!draft) throw BAD_REQUEST("No hay borrador para publicar");
  const publishedRows = await sql`select * from public.pages where tenant_id = ${tenantId} and slug = ${slug} and status = 'published' limit 1`;
  const published = publishedRows[0];
  const newVersion = (published?.version ?? 0) + 1;
  if (published) await sql`delete from public.pages where id = ${published.id}`;
  await sql`update public.pages set status = 'published', version = ${newVersion}, updated_at = ${now()} where id = ${draft.id}`;
  await audit({
    actorId: access.userId, actorLabel: access.user.email ?? "admin", tenantId,
    action: "PAGE_PUBLISHED", resource: "page", resourceId: draft.id, newData: { slug, version: newVersion },
  });
  return newVersion;
}

export async function getPublishedPage(slug: string, tenantSlug: string) {
  const tenants = await sql`select * from public.tenants where slug = ${tenantSlug} limit 1`;
  const tenant = tenants[0];
  if (!tenant || tenant.status === "suspended") return null;
  const rows = await sql`
    select title, blocks, version from public.pages
    where tenant_id = ${tenant.id} and slug = ${slug} and status = 'published' limit 1
  `;
  const page = rows[0];
  if (!page) return null;
  return { title: page.title, blocks: page.blocks, version: page.version };
}

// ---------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------
export async function listDelivery(req: Request) {
  const access = await getAccessContext(req);
  if (!access?.tenantId) return { zones: [], rates: [] };
  const zones = await sql`select * from public.delivery_zones where tenant_id = ${access.tenantId}`;
  const rates = await sql`select * from public.delivery_rates where tenant_id = ${access.tenantId}`;
  return { zones: camelizeAll(zones), rates: camelizeAll(rates) };
}

export async function saveDeliveryZone(req: Request, args: { id?: string; name: string; description?: string; isActive: boolean }) {
  const access = await requireTenantMember(req);
  if (!access.tenantId) throw BAD_REQUEST("TENANT_REQUIRED");
  if (args.id) {
    await sql`update public.delivery_zones set name = ${sanitizeText(args.name, 120)}, description = ${args.description ?? null}, is_active = ${args.isActive} where id = ${args.id}`;
    return { id: args.id };
  }
  const created = await sql`
    insert into public.delivery_zones (tenant_id, name, description, is_active)
    values (${access.tenantId}, ${sanitizeText(args.name, 120)}, ${args.description ?? null}, ${args.isActive}) returning id
  `;
  return { id: created[0].id };
}

export async function deleteDeliveryZone(req: Request, id: string) {
  const access = await requireTenantMember(req);
  const rows = await sql`select * from public.delivery_zones where id = ${id} limit 1`;
  if (!rows[0]) return { ok: true };
  resolveTenantId(access, rows[0].tenant_id);
  await sql`delete from public.delivery_zones where id = ${id}`; // rates cascade
  return { ok: true };
}

export async function saveDeliveryRate(req: Request, args: {
  id?: string; zoneId: string; name: string; method: "pickup" | "delivery" | "shipping";
  price: number; freeOver?: number; minOrder?: number; eta?: string; isActive: boolean;
}) {
  const access = await requireTenantMember(req);
  const zones = await sql`select * from public.delivery_zones where id = ${args.zoneId} limit 1`;
  const zone = zones[0];
  if (!zone) throw BAD_REQUEST("Zona no encontrada");
  const tenantId = resolveTenantId(access, zone.tenant_id);
  if (args.price < 0) throw BAD_REQUEST("El precio no puede ser negativo");
  if (args.id) {
    const existing = await sql`select * from public.delivery_rates where id = ${args.id} and tenant_id = ${tenantId} limit 1`;
    if (!existing[0]) throw BAD_REQUEST("Tarifa no encontrada");
    await sql`
      update public.delivery_rates set zone_id = ${args.zoneId}, name = ${sanitizeText(args.name, 120)}, method = ${args.method},
        price = ${args.price}, free_over = ${args.freeOver ?? null}, min_order = ${args.minOrder ?? null}, eta = ${args.eta ?? null}, is_active = ${args.isActive}
      where id = ${args.id}
    `;
    return { id: args.id };
  }
  const created = await sql`
    insert into public.delivery_rates (tenant_id, zone_id, name, method, price, free_over, min_order, eta, is_active)
    values (${tenantId}, ${args.zoneId}, ${sanitizeText(args.name, 120)}, ${args.method}, ${args.price}, ${args.freeOver ?? null}, ${args.minOrder ?? null}, ${args.eta ?? null}, ${args.isActive})
    returning id
  `;
  return { id: created[0].id };
}

export async function deleteDeliveryRate(req: Request, id: string) {
  const access = await requireTenantMember(req);
  const rows = await sql`select * from public.delivery_rates where id = ${id} limit 1`;
  if (!rows[0]) return { ok: true };
  resolveTenantId(access, rows[0].tenant_id);
  await sql`delete from public.delivery_rates where id = ${id}`;
  return { ok: true };
}

export async function listPublicDeliveryRates(slug: string) {
  const tenants = await sql`select * from public.tenants where slug = ${slug} limit 1`;
  const tenant = tenants[0];
  if (!tenant || tenant.status === "suspended" || !tenant.delivery_enabled) return [];
  const rates = await sql`select * from public.delivery_rates where tenant_id = ${tenant.id} and is_active = true`;
  const zones = await sql`select id, name from public.delivery_zones where tenant_id = ${tenant.id}`;
  const zoneMap = new Map(zones.map((z: any) => [z.id, z.name]));
  return camelizeAll(rates).map((r: any) => ({ ...r, zoneName: zoneMap.get(r.zoneId) ?? "" }));
}

// ---------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------
export async function listCoupons(req: Request) {
  const access = await getAccessContext(req);
  if (!access?.tenantId) return [];
  const rows = await sql`select * from public.coupons where tenant_id = ${access.tenantId} order by code asc`;
  return camelizeAll(rows);
}

export async function saveCoupon(req: Request, args: {
  id?: string; code: string; type: "percentage" | "fixed_amount" | "free_shipping"; value: number;
  minAmount?: number; maxUses?: number; endsAt?: number; isActive: boolean;
}) {
  const access = await requireTenantMember(req);
  if (!access.tenantId) throw BAD_REQUEST("TENANT_REQUIRED");
  const tenantId = access.tenantId;
  const code = args.code.toUpperCase().trim().replace(/\s+/g, "");
  if (args.type === "percentage" && (args.value <= 0 || args.value > 100)) {
    throw BAD_REQUEST("El porcentaje debe estar entre 1 y 100");
  }
  if (args.id) {
    const existing = await sql`select * from public.coupons where id = ${args.id} and tenant_id = ${tenantId} limit 1`;
    if (!existing[0]) throw BAD_REQUEST("Cupón no encontrado");
    await sql`
      update public.coupons set code = ${code}, type = ${args.type}, value = ${args.value}, min_amount = ${args.minAmount ?? null},
        max_uses = ${args.maxUses ?? null}, ends_at = ${args.endsAt ?? null}, is_active = ${args.isActive}
      where id = ${args.id}
    `;
    return { id: args.id };
  }
  const dup = await sql`select 1 from public.coupons where tenant_id = ${tenantId} and code = ${code} limit 1`;
  if (dup[0]) throw BAD_REQUEST("Ya existe un cupón con ese código");
  const created = await sql`
    insert into public.coupons (tenant_id, code, type, value, min_amount, max_uses, ends_at, is_active, usage_count)
    values (${tenantId}, ${code}, ${args.type}, ${args.value}, ${args.minAmount ?? null}, ${args.maxUses ?? null}, ${args.endsAt ?? null}, ${args.isActive}, 0)
    returning id
  `;
  return { id: created[0].id };
}

export async function deleteCoupon(req: Request, id: string) {
  const access = await requireTenantMember(req);
  const rows = await sql`select * from public.coupons where id = ${id} limit 1`;
  if (!rows[0]) return { ok: true };
  resolveTenantId(access, rows[0].tenant_id);
  await sql`delete from public.coupons where id = ${id}`;
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------
export async function listCustomers(req: Request, args: { search?: string }) {
  const access = await getAccessContext(req);
  if (!access?.tenantId) return [];
  const search = args.search ? `%${args.search.toLowerCase()}%` : null;
  const rows = await sql`
    select * from public.customers where tenant_id = ${access.tenantId}
    ${search ? sql`and (lower(name) like ${search} or lower(coalesce(email, '')) like ${search} or coalesce(phone, '') like ${search})` : sql``}
    order by total_spent desc limit 200
  `;
  return camelizeAll(rows);
}

export async function getCustomer(req: Request, id: string) {
  const access = await getAccessContext(req);
  if (!access) throw BAD_REQUEST("UNAUTHENTICATED");
  const rows = await sql`select * from public.customers where id = ${id} limit 1`;
  const customer = rows[0];
  if (!customer) return null;
  resolveTenantId(access, customer.tenant_id);
  const orders = await sql`
    select * from public.orders where tenant_id = ${customer.tenant_id} and customer_id = ${id}
    order by created_at desc limit 50
  `;
  return { ...camelize(customer), orders: camelizeAll(orders) };
}
