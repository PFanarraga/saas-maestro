// Port of src/convex/catalog.ts.
import { sql, now, slugify, sanitizeText, BAD_REQUEST, camelize, camelizeAll, type Row } from "./db.ts";
import { audit, getAccessContext, requireTenantMember, resolveTenantId, type AccessContext } from "./auth.ts";
import { DEFAULT_THEMES } from "./constants.ts";

export async function getPlanLimits(tenantId: string): Promise<Row | null> {
  const tenants = await sql`select plan_code from public.tenants where id = ${tenantId} limit 1`;
  const tenant = tenants[0];
  if (!tenant) return null;
  const plans = await sql`select limits from public.plans where code = ${tenant.plan_code} limit 1`;
  return plans[0]?.limits ?? null;
}

async function effectiveTenantId(req: Request, requested?: string): Promise<string | null> {
  const access = await getAccessContext(req);
  if (!access) throw BAD_REQUEST("UNAUTHENTICATED");
  return access.isSuperAdmin ? requested ?? null : access.tenantId;
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------
export async function listCategories(req: Request, args: { tenantId?: string }) {
  const access = await getAccessContext(req);
  if (!access) throw BAD_REQUEST("UNAUTHENTICATED");
  const effective = access.isSuperAdmin ? args.tenantId : access.tenantId;
  if (!effective) return [];
  const rows = await sql`select * from public.categories where tenant_id = ${effective} order by coalesce(position, 0) asc`;
  return camelizeAll(rows);
}

export async function saveCategory(req: Request, args: {
  id?: string; tenantId?: string; name: string; parentId?: string;
  description?: string; imageUrl?: string; position?: number;
}) {
  const access = await requireTenantMember(req, args.tenantId);
  const tenantId = resolveTenantId(access, args.tenantId);
  if (args.id) {
    const rows = await sql`select * from public.categories where id = ${args.id} and tenant_id = ${tenantId} limit 1`;
    if (!rows[0]) throw BAD_REQUEST("Categoría no encontrada");
    await sql`
      update public.categories set
        name = ${sanitizeText(args.name, 120)},
        parent_id = ${args.parentId ?? null},
        description = ${args.description ? sanitizeText(args.description, 1000) : null},
        image_url = ${args.imageUrl ?? null},
        position = ${args.position ?? null}
      where id = ${args.id}
    `;
    await audit({ actorId: access.userId, actorLabel: access.user.email ?? "admin", tenantId, action: "CATEGORY_UPDATED", resource: "category", resourceId: args.id });
    return { id: args.id };
  }
  let slug = slugify(args.name);
  const dup = await sql`select 1 from public.categories where tenant_id = ${tenantId} and slug = ${slug} limit 1`;
  if (dup[0]) slug = `${slug}-${now().toString(36).slice(-4)}`;
  const created = await sql`
    insert into public.categories (tenant_id, name, slug, parent_id, description, image_url, position)
    values (${tenantId}, ${sanitizeText(args.name, 120)}, ${slug}, ${args.parentId ?? null},
            ${args.description ? sanitizeText(args.description, 1000) : null}, ${args.imageUrl ?? null}, ${args.position ?? 0})
    returning id
  `;
  await audit({ actorId: access.userId, actorLabel: access.user.email ?? "admin", tenantId, action: "CATEGORY_CREATED", resource: "category", resourceId: created[0].id });
  return { id: created[0].id };
}

export async function deleteCategory(req: Request, id: string) {
  const access = await requireTenantMember(req);
  const rows = await sql`select * from public.categories where id = ${id} limit 1`;
  const cat = rows[0];
  if (!cat) throw BAD_REQUEST("Categoría no encontrada");
  const tenantId = resolveTenantId(access, cat.tenant_id);
  await sql`update public.categories set parent_id = null where tenant_id = ${tenantId} and parent_id = ${id}`;
  await sql`update public.products set category_id = null where tenant_id = ${tenantId} and category_id = ${id}`;
  await sql`delete from public.categories where id = ${id}`;
  await audit({ actorId: access.userId, actorLabel: access.user.email ?? "admin", tenantId, action: "CATEGORY_DELETED", resource: "category", resourceId: id });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------
export async function listProducts(req: Request, args: {
  tenantId?: string; status?: string; search?: string; categoryId?: string;
}) {
  const access = await getAccessContext(req);
  if (!access) throw BAD_REQUEST("UNAUTHENTICATED");
  const effective = access.isSuperAdmin ? args.tenantId : access.tenantId;
  if (!effective) return [];

  const status = args.status && args.status !== "all" ? args.status : null;
  const search = args.search ? `%${args.search.toLowerCase()}%` : null;
  const categoryId = args.categoryId ?? null;

  const rows = await sql`
    select p.*, c.name as category_name from public.products p
    left join public.categories c on c.id = p.category_id
    where p.tenant_id = ${effective}
      ${status ? sql`and p.status = ${status}` : sql``}
      ${search ? sql`and (lower(p.name) like ${search} or lower(coalesce(p.sku, '')) like ${search})` : sql``}
      ${categoryId ? sql`and p.category_id = ${categoryId}` : sql``}
    order by p.created_at desc
  `;
  return camelizeAll(rows).map((p: any) => ({ ...p, categoryName: p.categoryName ?? null }));
}

export async function getProduct(req: Request, id: string) {
  const access = await getAccessContext(req);
  if (!access) throw BAD_REQUEST("UNAUTHENTICATED");
  const rows = await sql`select * from public.products where id = ${id} limit 1`;
  const product = rows[0];
  if (!product) return null;
  resolveTenantId(access, product.tenant_id);
  const variants = await sql`select * from public.product_variants where product_id = ${id}`;
  return { ...camelize(product), variants: camelizeAll(variants) };
}

export async function saveProduct(req: Request, args: {
  id?: string; tenantId?: string; name: string; description?: string; shortDescription?: string;
  sku?: string; price: number; comparePrice?: number; cost?: number; stock: number;
  status: "active" | "draft" | "archived"; featured: boolean; categoryId?: string; brandId?: string;
  images?: string[]; hasVariants?: boolean; options?: Array<{ name: string; values: string[] }>;
}) {
  const access = await requireTenantMember(req, args.tenantId);
  const tenantId = resolveTenantId(access, args.tenantId);
  if (args.price < 0) throw BAD_REQUEST("El precio no puede ser negativo");
  const limits = await getPlanLimits(tenantId);
  const t = now();

  if (args.id) {
    const rows = await sql`select * from public.products where id = ${args.id} and tenant_id = ${tenantId} limit 1`;
    const existing = rows[0];
    if (!existing) throw BAD_REQUEST("Producto no encontrado");
    await sql`
      update public.products set
        name = ${sanitizeText(args.name, 200)},
        description = ${args.description ? sanitizeText(args.description, 20000) : null},
        short_description = ${args.shortDescription ? sanitizeText(args.shortDescription, 500) : null},
        sku = ${args.sku ?? null},
        price = ${args.price},
        compare_price = ${args.comparePrice ?? null},
        cost = ${args.cost ?? null},
        stock = ${args.stock},
        status = ${args.status},
        featured = ${args.featured},
        category_id = ${args.categoryId ?? null},
        brand_id = ${args.brandId ?? null},
        images = ${args.images ?? null},
        has_variants = ${args.hasVariants ?? false},
        options = ${args.options ? JSON.stringify(args.options) : null}::jsonb,
        updated_at = ${t}
      where id = ${args.id}
    `;
    await audit({
      actorId: access.userId, actorLabel: access.user.email ?? "admin", tenantId,
      action: "PRODUCT_UPDATED", resource: "product", resourceId: args.id,
      oldData: { name: existing.name, price: Number(existing.price), stock: existing.stock },
      newData: { name: args.name, price: args.price, stock: args.stock },
    });
    return { id: args.id };
  }

  if (limits && limits.maxProducts) {
    const count = await sql`select count(*)::int as n from public.products where tenant_id = ${tenantId} and status = 'active'`;
    if ((count[0]?.n ?? 0) >= limits.maxProducts) {
      throw BAD_REQUEST(`Límite del plan alcanzado (${limits.maxProducts} productos). Mejora tu plan para agregar más.`);
    }
  }
  let slug = slugify(args.name) || "producto";
  const dup = await sql`select 1 from public.products where tenant_id = ${tenantId} and slug = ${slug} limit 1`;
  if (dup[0]) slug = `${slug}-${t.toString(36).slice(-5)}`;
  const created = await sql`
    insert into public.products
      (tenant_id, name, slug, description, short_description, sku, price, compare_price, cost, stock, status, featured, category_id, brand_id, images, has_variants, options, created_at, updated_at)
    values
      (${tenantId}, ${sanitizeText(args.name, 200)}, ${slug},
       ${args.description ? sanitizeText(args.description, 20000) : null},
       ${args.shortDescription ? sanitizeText(args.shortDescription, 500) : null},
       ${args.sku ?? null}, ${args.price}, ${args.comparePrice ?? null}, ${args.cost ?? null}, ${args.stock},
       ${args.status}, ${args.featured}, ${args.categoryId ?? null}, ${args.brandId ?? null}, ${args.images ?? null},
       ${args.hasVariants ?? false}, ${args.options ? JSON.stringify(args.options) : null}::jsonb, ${t}, ${t})
    returning id
  `;
  await audit({
    actorId: access.userId, actorLabel: access.user.email ?? "admin", tenantId,
    action: "PRODUCT_CREATED", resource: "product", resourceId: created[0].id,
    newData: { name: args.name, price: args.price },
  });
  return { id: created[0].id };
}

export async function deleteProduct(req: Request, id: string) {
  const access = await requireTenantMember(req);
  const rows = await sql`select * from public.products where id = ${id} limit 1`;
  if (!rows[0]) throw BAD_REQUEST("Producto no encontrado");
  const tenantId = resolveTenantId(access, rows[0].tenant_id);
  await sql`delete from public.products where id = ${id}`; // variants cascade
  await audit({ actorId: access.userId, actorLabel: access.user.email ?? "admin", tenantId, action: "PRODUCT_DELETED", resource: "product", resourceId: id });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------
export async function saveVariant(req: Request, args: {
  id?: string; productId: string; sku?: string; options: Array<{ name: string; value: string }>;
  price?: number; stock: number; imageUrl?: string; weight?: number; dimensions?: string;
}) {
  const access = await requireTenantMember(req);
  const prods = await sql`select * from public.products where id = ${args.productId} limit 1`;
  const product = prods[0];
  if (!product) throw BAD_REQUEST("Producto no encontrado");
  const tenantId = resolveTenantId(access, product.tenant_id);
  const data = {
    sku: args.sku ?? null,
    options: JSON.stringify(args.options),
    price: args.price ?? null,
    stock: args.stock,
    imageUrl: args.imageUrl ?? null,
    weight: args.weight ?? null,
    dimensions: args.dimensions ?? null,
  };
  if (args.id) {
    const existing = await sql`select * from public.product_variants where id = ${args.id} and tenant_id = ${tenantId} limit 1`;
    if (!existing[0]) throw BAD_REQUEST("Variante no encontrada");
    await sql`
      update public.product_variants set sku = ${data.sku}, options = ${data.options}::jsonb, price = ${data.price},
        stock = ${data.stock}, image_url = ${data.imageUrl}, weight = ${data.weight}, dimensions = ${data.dimensions}
      where id = ${args.id}
    `;
    return { id: args.id };
  }
  const created = await sql`
    insert into public.product_variants (tenant_id, product_id, sku, options, price, stock, image_url, weight, dimensions)
    values (${tenantId}, ${args.productId}, ${data.sku}, ${data.options}::jsonb, ${data.price}, ${data.stock}, ${data.imageUrl}, ${data.weight}, ${data.dimensions})
    returning id
  `;
  await sql`update public.products set has_variants = true, updated_at = ${now()} where id = ${args.productId}`;
  return { id: created[0].id };
}

export async function deleteVariant(req: Request, id: string) {
  const access = await requireTenantMember(req);
  const rows = await sql`select * from public.product_variants where id = ${id} limit 1`;
  const variant = rows[0];
  if (!variant) throw BAD_REQUEST("Variante no encontrada");
  resolveTenantId(access, variant.tenant_id);
  await sql`delete from public.product_variants where id = ${id}`;
  return { ok: true };
}

export async function generateVariants(req: Request, productId: string) {
  const access = await requireTenantMember(req);
  const prods = await sql`select * from public.products where id = ${productId} limit 1`;
  const product = prods[0];
  if (!product) throw BAD_REQUEST("Producto no encontrado");
  const tenantId = resolveTenantId(access, product.tenant_id);
  const options = product.options ?? [];
  if (options.length === 0) throw BAD_REQUEST("El producto no tiene opciones definidas");
  const existing = await sql`select options from public.product_variants where product_id = ${productId}`;
  const existingKey = new Set(existing.map((v: any) => (v.options ?? []).map((o: any) => `${o.name}:${o.value}`).sort().join("|")));
  let combos: Array<Array<{ name: string; value: string }>> = [[]];
  for (const opt of options) {
    const next: Array<Array<{ name: string; value: string }>> = [];
    for (const combo of combos) {
      for (const value of opt.values) next.push([...combo, { name: opt.name, value }]);
    }
    combos = next;
  }
  let created = 0;
  for (const combo of combos) {
    const key = combo.map((o) => `${o.name}:${o.value}`).sort().join("|");
    if (existingKey.has(key)) continue;
    await sql`
      insert into public.product_variants (tenant_id, product_id, options, stock)
      values (${tenantId}, ${productId}, ${JSON.stringify(combo)}::jsonb, 0)
    `;
    created++;
  }
  await sql`update public.products set has_variants = true, updated_at = ${now()} where id = ${productId}`;
  return created;
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------
export async function adjustStock(req: Request, args: { productId: string; variantId?: string; delta: number; reason: string }) {
  const access = await requireTenantMember(req);
  const prods = await sql`select * from public.products where id = ${args.productId} limit 1`;
  const product = prods[0];
  if (!product) throw BAD_REQUEST("Producto no encontrado");
  const tenantId = resolveTenantId(access, product.tenant_id);
  if (args.variantId) {
    const vs = await sql`select * from public.product_variants where id = ${args.variantId} limit 1`;
    const variant = vs[0];
    if (!variant || variant.tenant_id !== tenantId) throw BAD_REQUEST("Variante no encontrada");
    await sql`update public.product_variants set stock = greatest(0, ${variant.stock + args.delta}) where id = ${args.variantId}`;
  } else {
    await sql`update public.products set stock = greatest(0, ${product.stock + args.delta}), updated_at = ${now()} where id = ${args.productId}`;
  }
  await sql`
    insert into public.inventory_movements (tenant_id, product_id, variant_id, delta, reason, created_at)
    values (${tenantId}, ${args.productId}, ${args.variantId ?? null}, ${args.delta}, ${args.reason}, ${now()})
  `;
  await audit({
    actorId: access.userId, actorLabel: access.user.email ?? "admin", tenantId,
    action: "STOCK_ADJUSTED", resource: "product", resourceId: args.productId,
    newData: { delta: args.delta, reason: args.reason },
  });
  return { ok: true };
}

export async function listInventoryMovements(req: Request, productId: string) {
  const access = await getAccessContext(req);
  if (!access) throw BAD_REQUEST("UNAUTHENTICATED");
  const prods = await sql`select * from public.products where id = ${productId} limit 1`;
  const product = prods[0];
  if (!product) return [];
  resolveTenantId(access, product.tenant_id);
  const rows = await sql`select * from public.inventory_movements where product_id = ${productId} order by created_at desc limit 50`;
  return camelizeAll(rows);
}

// ---------------------------------------------------------------------------
// Brands
// ---------------------------------------------------------------------------
export async function listBrands(req: Request) {
  const access = await getAccessContext(req);
  if (!access?.tenantId) return [];
  const rows = await sql`select * from public.brands where tenant_id = ${access.tenantId}`;
  return camelizeAll(rows);
}

export async function saveBrand(req: Request, args: { id?: string; name: string }) {
  const access = await requireTenantMember(req);
  if (!access.tenantId) throw BAD_REQUEST("TENANT_REQUIRED");
  if (args.id) {
    await sql`update public.brands set name = ${sanitizeText(args.name, 120)} where id = ${args.id}`;
    return { id: args.id };
  }
  const created = await sql`
    insert into public.brands (tenant_id, name, slug) values (${access.tenantId}, ${sanitizeText(args.name, 120)}, ${slugify(args.name)}) returning id
  `;
  return { id: created[0].id };
}

export { DEFAULT_THEMES };
