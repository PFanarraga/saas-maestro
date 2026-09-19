// Port of src/convex/storefront.ts + src/convex/cart.ts (public endpoints).
import { sql, now, slugify, BAD_REQUEST, clean, camelize, camelizeAll, type Row } from "./db.ts";
import { audit, requireSuperAdmin } from "./auth.ts";
import { DEFAULT_HOMEPAGE_BLOCKS, DEFAULT_THEMES } from "./constants.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
export async function getTenantBySlugRow(slug: string): Promise<Row | null> {
  const rows = await sql`select * from public.tenants where slug = ${slug} limit 1`;
  return rows[0] ?? null;
}

function tenantPublic(t: Row) {
  return {
    id: t.id,
    name: t.name,
    slug: t.slug,
    logoUrl: t.logo_url,
    currency: t.currency ?? "PEN",
    whatsappPhone: t.whatsapp_phone,
    whatsappEnabled: t.whatsapp_enabled,
    couponsEnabled: t.coupons_enabled,
    deliveryEnabled: t.delivery_enabled,
    seo: t.seo ?? null,
    isDemo: t.is_demo ?? false,
    planCode: t.plan_code,
  };
}

// ---------------------------------------------------------------------------
// Storefront (public)
// ---------------------------------------------------------------------------
export async function getTenantBySlug(slug: string) {
  const t = await getTenantBySlugRow(slug);
  if (!t || t.status === "suspended") return null;
  return tenantPublic(t);
}

export async function publicStats() {
  const rows = await sql`select count(*)::int as n from public.tenants where status = 'active'`;
  return { activeTenants: rows[0]?.n ?? 0 };
}

export async function listPublicProducts(args: { slug: string; categorySlug?: string; search?: string }) {
  const tenant = await getTenantBySlugRow(args.slug);
  if (!tenant || tenant.status === "suspended") return [];

  let categoryId: string | null = null;
  if (args.categorySlug) {
    const cats = await sql`
      select id from public.categories
      where tenant_id = ${tenant.id} and slug = ${args.categorySlug} limit 1
    `;
    if (!cats[0]) return [];
    categoryId = cats[0].id;
  }

  const search = args.search ? `%${args.search.toLowerCase()}%` : null;
  const rows = await sql`
    select id, name, slug, short_description, price, compare_price, stock, images, featured, has_variants, category_id, created_at
    from public.products
    where tenant_id = ${tenant.id}
      and status = 'active'
      ${categoryId ? sql`and category_id = ${categoryId}` : sql``}
      ${search ? sql`and (lower(name) like ${search} or lower(coalesce(short_description, '')) like ${search})` : sql``}
    order by created_at desc
  `;
  return camelizeAll(rows).map((p: any) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    shortDescription: p.shortDescription ?? null,
    price: p.price,
    comparePrice: p.comparePrice ?? null,
    stock: p.stock,
    images: p.images ?? null,
    featured: p.featured,
    hasVariants: p.hasVariants ?? false,
    categoryId: p.categoryId ?? null,
  }));
}

export async function listPublicCategories(slug: string) {
  const tenant = await getTenantBySlugRow(slug);
  if (!tenant || tenant.status === "suspended") return [];
  const rows = await sql`
    select * from public.categories where tenant_id = ${tenant.id}
    order by coalesce(position, 0) asc, name asc
  `;
  return camelizeAll(rows);
}

export async function getPublicProduct(args: { slug: string; productSlug: string }) {
  const tenant = await getTenantBySlugRow(args.slug);
  if (!tenant || tenant.status === "suspended") return null;
  const prods = await sql`
    select * from public.products where tenant_id = ${tenant.id} and slug = ${args.productSlug} limit 1
  `;
  const product = prods[0];
  if (!product || product.status !== "active") return null;

  let variants: Row[] = [];
  if (product.has_variants) {
    variants = await sql`
      select id, options, price, stock, image_url from public.product_variants where product_id = ${product.id}
    `;
  }
  let category: Row | null = null;
  if (product.category_id) {
    const cats = await sql`select name, slug from public.categories where id = ${product.category_id} limit 1`;
    category = cats[0] ?? null;
  }

  return {
    id: product.id,
    name: product.name,
    description: product.description ?? null,
    shortDescription: product.short_description ?? null,
    sku: product.sku ?? null,
    price: product.price,
    comparePrice: product.compare_price ?? null,
    stock: product.stock,
    images: product.images ?? null,
    featured: product.featured,
    options: product.options ?? [],
    variants: variants.map((v: any) => ({
      id: v.id,
      options: v.options ?? [],
      price: v.price ?? null,
      stock: v.stock,
      imageUrl: v.image_url ?? null,
    })),
    categoryName: category?.name ?? null,
    categorySlug: category?.slug ?? null,
  };
}

export async function trackEvent(args: {
  slug: string;
  type: string;
  productId?: string;
  sessionId?: string;
  path?: string;
  value?: number;
}) {
  const tenant = await getTenantBySlugRow(args.slug);
  if (!tenant) return { ok: true };
  await sql`
    insert into public.analytics_events (tenant_id, type, product_id, session_id, path, value, created_at)
    values (${tenant.id}, ${args.type}, ${args.productId ?? null}, ${args.sessionId ?? null}, ${args.path ?? null}, ${args.value ?? null}, ${now()})
  `;
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Demo seed (port of seedDemoData)
// ---------------------------------------------------------------------------
const DEMO_STORES: Array<{
  name: string;
  slug: string;
  template: TemplateKey;
  whatsapp: string;
  categories: Array<{ name: string; children?: Array<{ name: string }> }>;
  products: Array<{ name: string; price: number; comparePrice?: number; stock: number; category: string; featured?: boolean; short: string }>;
}> = [
  {
    name: "Aurora Tech",
    slug: "aurora-tech",
    template: "minimal",
    whatsapp: "51987000001",
    categories: [
      { name: "Laptops", children: [{ name: "Ultrabooks" }, { name: "Gaming" }] },
      { name: "Accesorios", children: [{ name: "Audífonos" }, { name: "Teclados" }] },
      { name: "Smartphones" },
    ],
    products: [
      { name: "Laptop Aurora Pro 14", price: 4599, comparePrice: 5299, stock: 8, category: "Laptops", featured: true, short: "Potencia profesional en 1.2 kg" },
      { name: "Laptop Aurora Gamer X", price: 6299, stock: 5, category: "Gaming", featured: true, short: "RTX y pantalla 165Hz" },
      { name: "Laptop Air Slim 13", price: 2899, stock: 12, category: "Ultrabooks", short: "Ligera y con batería de 18h" },
      { name: "Audífonos ANC Studio", price: 349, comparePrice: 429, stock: 30, category: "Audífonos", featured: true, short: "Cancelación activa de ruido" },
      { name: "Teclado Mecánico TKL", price: 259, stock: 22, category: "Teclados", short: "Switches rojos, RGB" },
      { name: "Smartphone Nova 5G", price: 1899, stock: 15, category: "Smartphones", featured: true, short: "Cámara de 108MP" },
    ],
  },
  {
    name: "Café Verduras",
    slug: "cafe-verduras",
    template: "classic",
    whatsapp: "51987000002",
    categories: [
      { name: "Frutas", children: [{ name: "Cítricos" }, { name: "Berries" }] },
      { name: "Verduras" },
      { name: "Canasta Semanal" },
    ],
    products: [
      { name: "Palta Hass (kg)", price: 8.9, stock: 50, category: "Frutas", featured: true, short: "Fresca, de Chanchán" },
      { name: "Arándanos (500g)", price: 12.5, comparePrice: 15, stock: 24, category: "Berries", featured: true, short: "Antioxidantes naturales" },
      { name: "Mandarina (kg)", price: 5.5, stock: 40, category: "Cítricos", short: "Dulce y jugosa" },
      { name: "Tomate Orgánico (kg)", price: 6.8, stock: 35, category: "Verduras", short: "Cultivo hidropónico" },
      { name: "Canasta Familiar", price: 79.9, comparePrice: 95, stock: 10, category: "Canasta Semanal", featured: true, short: "12kg de frutas y verduras" },
    ],
  },
  {
    name: "Vélvet Moda",
    slug: "velvet-moda",
    template: "vibrant",
    whatsapp: "51987000003",
    categories: [
      { name: "Ropa", children: [{ name: "Polos" }, { name: "Vestidos" }, { name: "Pantalones" }] },
      { name: "Accesorios" },
    ],
    products: [
      { name: "Polo Oversized Basic", price: 59.9, comparePrice: 79.9, stock: 60, category: "Polos", featured: true, short: "Algodón pima peruano" },
      { name: "Vestido Midi Satinado", price: 149.9, stock: 18, category: "Vestidos", featured: true, short: "Elegancia para toda ocasión" },
      { name: "Jeans Mom Fit", price: 119.9, stock: 25, category: "Pantalones", short: "Tela stretch premium" },
      { name: "Bolso Tote Cuero", price: 199.9, comparePrice: 249.9, stock: 9, category: "Accesorios", featured: true, short: "Cuero legítimo artesanal" },
      { name: "Polo Graphic Vintage", price: 69.9, stock: 33, category: "Polos", short: "Estampados exclusivos" },
    ],
  },
];

export async function hasDemoData() {
  const rows = await sql`select 1 from public.tenants where slug = ${DEMO_STORES[0].slug} limit 1`;
  return !!rows[0];
}

export async function seedDemoData(req: Request) {
  await requireSuperAdmin(req);
  const t = now();

  const existing = await sql`select 1 from public.tenants where slug = ${DEMO_STORES[0].slug} limit 1`;
  if (existing[0]) return { skipped: true };

  for (const store of DEMO_STORES) {
    const tenantRows = await sql`
      insert into public.tenants
        (name, slug, status, template, plan_code, currency, whatsapp_phone, whatsapp_enabled, coupons_enabled, delivery_enabled, payment_provider, is_demo, created_at, seo)
      values
        (${store.name}, ${store.slug}, 'active', ${store.template}, 'PRO', 'PEN', ${store.whatsapp}, true, true, true, 'manual', true, ${t - 30 * 86400_000},
         ${JSON.stringify({ title: `${store.name} — Tienda oficial`, description: `Compra en ${store.name} con delivery y pago por WhatsApp.` })}::jsonb)
      returning id
    `;
    const tenantId = tenantRows[0].id;

    const theme = { ...DEFAULT_THEMES[store.template], brand: { ...DEFAULT_THEMES[store.template].brand, name: store.name } };
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
      values (${tenantId}, ${`${store.slug}.shoply.app`}, 'subdomain', 'active', ${t}, 'active')`;
    await sql`insert into public.subscriptions (tenant_id, plan_code, status, started_at)
      values (${tenantId}, 'PRO', 'active', ${t - 30 * 86400_000})`;

    // Categories
    const catIdByPath = new Map<string, string>();
    let pos = 0;
    for (const cat of store.categories) {
      const c = await sql`
        insert into public.categories (tenant_id, name, slug, position) values (${tenantId}, ${cat.name}, ${slugify(cat.name)}, ${pos++}) returning id
      `;
      catIdByPath.set(cat.name, c[0].id);
      for (const child of cat.children ?? []) {
        const cc = await sql`
          insert into public.categories (tenant_id, name, slug, parent_id, position) values (${tenantId}, ${child.name}, ${slugify(child.name)}, ${c[0].id}, 0) returning id
        `;
        catIdByPath.set(`${cat.name}/${child.name}`, cc[0].id);
      }
    }

    // Delivery
    const zone = await sql`
      insert into public.delivery_zones (tenant_id, name, is_active) values (${tenantId}, 'Zona A — Centro', true) returning id
    `;
    await sql`insert into public.delivery_rates (tenant_id, zone_id, name, method, price, free_over, eta, is_active)
      values (${tenantId}, ${zone[0].id}, 'Delivery Zona A', 'delivery', 5, 100, '24-48h', true)`;
    await sql`insert into public.delivery_rates (tenant_id, zone_id, name, method, price, eta, is_active)
      values (${tenantId}, ${zone[0].id}, 'Recojo en tienda', 'pickup', 0, 'Hoy', true)`;

    // Coupon
    await sql`insert into public.coupons (tenant_id, code, type, value, is_active, usage_count)
      values (${tenantId}, 'BIENVENIDO10', 'percentage', 10, true, 0)`;

    // Products
    const productIds: string[] = [];
    for (let i = 0; i < store.products.length; i++) {
      const p = store.products[i];
      const pr = await sql`
        insert into public.products
          (tenant_id, name, slug, description, short_description, sku, price, compare_price, stock, status, featured, category_id, created_at, updated_at)
        values
          (${tenantId}, ${p.name}, ${slugify(p.name)}, ${`${p.name}. ${p.short}. Producto de ${store.name} con garantía y soporte por WhatsApp.`},
           ${p.short}, ${`${store.slug.slice(0, 3).toUpperCase()}-${1000 + i}`}, ${p.price}, ${p.comparePrice ?? null}, ${p.stock}, 'active', ${p.featured ?? false},
           ${catIdByPath.get(p.category) ?? null}, ${t - (store.products.length - i) * 3600_000}, ${t})
        returning id
      `;
      productIds.push(pr[0].id);
      await sql`insert into public.analytics_events (tenant_id, type, product_id, value, created_at)
        values (${tenantId}, 'product_view', ${pr[0].id}, ${p.price}, ${t - i * 3600_000})`;
    }

    // Demo customers + orders
    const demoCustomers = [
      { name: "María Torres", phone: "+51990111001", email: "maria.demo@example.com" },
      { name: "Jorge Ramos", phone: "+51990111002", email: "jorge.demo@example.com" },
      { name: "Lucía Fernández", phone: "+51990111003", email: null },
    ];
    const prods = await sql`
      select id, name, price from public.products where tenant_id = ${tenantId} and status = 'active' order by created_at desc
    `;
    for (let ci = 0; ci < demoCustomers.length; ci++) {
      const dc = demoCustomers[ci];
      const cust = await sql`
        insert into public.customers (tenant_id, name, email, phone, total_orders, total_spent, created_at)
        values (${tenantId}, ${dc.name}, ${dc.email}, ${dc.phone}, 0, 0, ${t - (10 - ci) * 86400_000}) returning id
      `;
      const customerId = cust[0].id;
      const product = prods[ci % prods.length];
      const qty = 1 + (ci % 2);
      const itemsTotal = Number(product.price) * qty;
      const deliveryTotal = 5;
      const total = itemsTotal + deliveryTotal;
      const isPaid = ci % 2 === 0;
      const order = await sql`
        insert into public.orders
          (tenant_id, number, customer_id, customer_name, customer_email, customer_phone, status, items_total, discount_total, delivery_total, total, currency, delivery_method, is_demo, created_at, updated_at)
        values
          (${tenantId}, ${`D${store.slug.slice(0, 2).toUpperCase()}${100 + ci}`}, ${customerId}, ${dc.name}, ${dc.email}, ${dc.phone},
           ${isPaid ? "delivered" : "payment_pending"}, ${itemsTotal}, 0, ${deliveryTotal}, ${total}, 'PEN', 'delivery', true, ${t - (7 - ci) * 86400_000}, ${t - (7 - ci) * 86400_000})
        returning id
      `;
      const orderId = order[0].id;
      await sql`insert into public.order_items (tenant_id, order_id, product_id, name, unit_price, quantity, total)
        values (${tenantId}, ${orderId}, ${product.id}, ${product.name}, ${product.price}, ${qty}, ${itemsTotal})`;
      await sql`insert into public.order_status_history (tenant_id, order_id, to_status, actor, created_at)
        values (${tenantId}, ${orderId}, ${isPaid ? "delivered" : "payment_pending"}, 'demo-seed', ${t - (7 - ci) * 86400_000})`;
      await sql`insert into public.analytics_events (tenant_id, type, value, created_at)
        values (${tenantId}, 'order_created', ${total}, ${t - (7 - ci) * 86400_000})`;
      if (isPaid) {
        await sql`insert into public.analytics_events (tenant_id, type, value, created_at)
          values (${tenantId}, 'payment_succeeded', ${total}, ${t - (6 - ci) * 86400_000})`;
      }
      await sql`update public.customers set total_orders = 1, total_spent = ${total} where id = ${customerId}`;
    }

    // Funnel demo events
    await sql`insert into public.analytics_events (tenant_id, type, created_at) values (${tenantId}, 'page_view', ${t - 3600_000})`;
    await sql`insert into public.analytics_events (tenant_id, type, value, created_at) values (${tenantId}, 'add_to_cart', 89.9, ${t - 1800_000})`;
    await audit({ actorLabel: "demo-seed", tenantId, action: "DEMO_TENANT_SEEDED", resource: "tenant", resourceId: tenantId });
  }
  return { seeded: true };
}

// ---------------------------------------------------------------------------
// Cart (public, guest) — port of cart.ts
// ---------------------------------------------------------------------------
import { buildCartMessage, formatMoney, whatsappLink } from "./format.ts";

async function resolveTenantForCart(slug: string): Promise<Row> {
  const tenant = await getTenantBySlugRow(slug);
  if (!tenant) throw BAD_REQUEST("Tienda no encontrada");
  if (tenant.status === "suspended") throw BAD_REQUEST("Tienda suspendida");
  return tenant;
}

async function getCartWithItems(tenantId: string, sessionKey: string) {
  const carts = await sql`
    select * from public.carts where tenant_id = ${tenantId} and session_key = ${sessionKey} limit 1
  `;
  const cart = carts[0];
  if (!cart) return { cart: null, items: [] as Row[] };
  const items = await sql`
    select * from public.cart_items where cart_id = ${cart.id} order by created_at asc
  `;
  return { cart, items };
}

export async function getCart(args: { slug: string; sessionKey: string }) {
  const tenant = await getTenantBySlugRow(args.slug);
  if (!tenant || tenant.status === "suspended") {
    return { items: [], subtotal: 0, itemCount: 0, currency: "PEN", whatsappUrl: null };
  }
  const { items } = await getCartWithItems(tenant.id, args.sessionKey);
  const subtotal = items.reduce((s: number, i: any) => s + Number(i.unit_price) * i.quantity, 0);
  const itemCount = items.reduce((s: number, i: any) => s + i.quantity, 0);
  const whatsappUrl =
    tenant.whatsapp_enabled && tenant.whatsapp_phone && items.length > 0
      ? whatsappLink(
          tenant.whatsapp_phone,
          buildCartMessage(
            items.map((i: any) => ({ name: i.name, quantity: i.quantity, variantLabel: i.variant_label ?? undefined })),
            subtotal,
            tenant.currency ?? "PEN",
          ),
        )
      : null;
  return {
    items: items.map((i: any) => ({
      id: i.id,
      productId: i.product_id,
      variantId: i.variant_id ?? null,
      name: i.name,
      variantLabel: i.variant_label ?? null,
      unitPrice: Number(i.unit_price),
      quantity: i.quantity,
      imageUrl: i.image_url ?? null,
    })),
    subtotal,
    itemCount,
    currency: tenant.currency ?? "PEN",
    whatsappUrl,
  };
}

export async function addToCart(args: {
  slug: string;
  sessionKey: string;
  productId: string;
  variantId?: string;
  quantity: number;
}) {
  const tenant = await resolveTenantForCart(args.slug);
  if (args.quantity < 1 || args.quantity > 99) throw BAD_REQUEST("Cantidad inválida");
  const prods = await sql`select * from public.products where id = ${args.productId} limit 1`;
  const product = prods[0];
  if (!product || product.tenant_id !== tenant.id || product.status !== "active") throw BAD_REQUEST("Producto no disponible");

  let unitPrice = Number(product.price);
  const name = product.name;
  let variantLabel: string | null = null;
  let imageUrl: string | null = product.images?.[0] ?? null;
  let stock = product.stock;

  if (args.variantId) {
    const vs = await sql`select * from public.product_variants where id = ${args.variantId} limit 1`;
    const variant = vs[0];
    if (!variant || variant.tenant_id !== tenant.id || variant.product_id !== product.id) throw BAD_REQUEST("Variante no válida");
    if (variant.price != null) unitPrice = Number(variant.price);
    variantLabel = (variant.options ?? []).map((o: any) => o.value).join(" / ");
    if (variant.image_url) imageUrl = variant.image_url;
    stock = variant.stock;
  }
  if (stock <= 0) throw BAD_REQUEST("Producto agotado");

  const { cart } = await getCartWithItems(tenant.id, args.sessionKey);
  let cartId = cart?.id;
  if (!cartId) {
    const t = now();
    const created = await sql`
      insert into public.carts (tenant_id, session_key, created_at, updated_at)
      values (${tenant.id}, ${args.sessionKey}, ${t}, ${t}) returning id
    `;
    cartId = created[0].id;
  }
  const existingItems = await sql`
    select * from public.cart_items where cart_id = ${cartId} and product_id = ${args.productId}
    and ${args.variantId ? sql`variant_id = ${args.variantId}` : sql`variant_id is null`}
    limit 1
  `;
  const existing = existingItems[0];
  const newQty = Math.min((existing?.quantity ?? 0) + args.quantity, Math.max(stock, 1), 99);
  if (existing) {
    await sql`update public.cart_items set quantity = ${newQty} where id = ${existing.id}`;
  } else {
    await sql`
      insert into public.cart_items (cart_id, tenant_id, product_id, variant_id, name, variant_label, unit_price, quantity, image_url, created_at)
      values (${cartId}, ${tenant.id}, ${args.productId}, ${args.variantId ?? null}, ${name}, ${variantLabel}, ${unitPrice}, ${newQty}, ${imageUrl}, ${now()})
    `;
  }
  await sql`update public.carts set updated_at = ${now()} where id = ${cartId}`;
  return { ok: true };
}

export async function updateCartItem(args: { slug: string; sessionKey: string; itemId: string; quantity: number }) {
  const tenant = await resolveTenantForCart(args.slug);
  const { cart } = await getCartWithItems(tenant.id, args.sessionKey);
  if (!cart) throw BAD_REQUEST("Carrito no encontrado");
  const items = await sql`select * from public.cart_items where id = ${args.itemId} and cart_id = ${cart.id} limit 1`;
  const item = items[0];
  if (!item) throw BAD_REQUEST("Ítem no encontrado");
  if (args.quantity <= 0) {
    await sql`delete from public.cart_items where id = ${args.itemId}`;
  } else {
    await sql`update public.cart_items set quantity = ${Math.min(args.quantity, 99)} where id = ${args.itemId}`;
    await sql`update public.carts set updated_at = ${now()} where id = ${cart.id}`;
  }
  return { ok: true };
}

export async function removeCartItem(args: { slug: string; sessionKey: string; itemId: string }) {
  const tenant = await resolveTenantForCart(args.slug);
  const { cart } = await getCartWithItems(tenant.id, args.sessionKey);
  if (!cart) return { ok: true };
  await sql`delete from public.cart_items where id = ${args.itemId} and cart_id = ${cart.id}`;
  return { ok: true };
}

export async function clearCart(args: { slug: string; sessionKey: string }) {
  const tenant = await resolveTenantForCart(args.slug);
  const { cart } = await getCartWithItems(tenant.id, args.sessionKey);
  if (!cart) return { ok: true };
  await sql`delete from public.cart_items where cart_id = ${cart.id}`;
  return { ok: true };
}
