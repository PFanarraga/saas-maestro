import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";
import { audit, requireSuperAdmin } from "./lib/auth";
import { DEFAULT_HOMEPAGE_BLOCKS, DEFAULT_THEMES, PLAN_PRESETS, TemplateKey, slugify } from "./lib/shared";

// ---------------------------------------------------------------------------
// Public tenant resolution
// ---------------------------------------------------------------------------
export const getTenantBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const tenant = await ctx.db.query("tenants").withIndex("by_slug", (q) => q.eq("slug", slug)).first();
    if (!tenant || tenant.status === "suspended") return null;
    return {
      name: tenant.name,
      slug: tenant.slug,
      logoUrl: tenant.logoUrl,
      currency: tenant.currency ?? "PEN",
      whatsappPhone: tenant.whatsappPhone,
      whatsappEnabled: tenant.whatsappEnabled,
      couponsEnabled: tenant.couponsEnabled,
      deliveryEnabled: tenant.deliveryEnabled,
      seo: tenant.seo,
      isDemo: tenant.isDemo,
      planCode: tenant.planCode,
    };
  },
});

// ---------------------------------------------------------------------------
// Public catalog
// ---------------------------------------------------------------------------
export const listPublicProducts = query({
  args: { slug: v.string(), categorySlug: v.optional(v.string()), search: v.optional(v.string()) },
  handler: async (ctx, { slug, categorySlug, search }) => {
    const tenant = await ctx.db.query("tenants").withIndex("by_slug", (q) => q.eq("slug", slug)).first();
    if (!tenant || tenant.status === "suspended") return [];
    let products = await ctx.db.query("products").withIndex("by_tenant_status", (q) => q.eq("tenantId", tenant._id).eq("status", "active")).collect();
    if (categorySlug) {
      const cat = await ctx.db.query("categories").withIndex("by_tenant_slug", (q) => q.eq("tenantId", tenant._id).eq("slug", categorySlug)).first();
      if (cat) products = products.filter((p) => p.categoryId === cat._id);
      else products = [];
    }
    if (search) {
      const s = search.toLowerCase();
      products = products.filter((p) => p.name.toLowerCase().includes(s) || (p.shortDescription ?? "").toLowerCase().includes(s));
    }
    return products
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((p) => ({
        _id: p._id,
        name: p.name,
        slug: p.slug,
        shortDescription: p.shortDescription,
        price: p.price,
        comparePrice: p.comparePrice,
        stock: p.stock,
        images: p.images,
        featured: p.featured,
        hasVariants: p.hasVariants ?? false,
        categoryId: p.categoryId,
      }));
  },
});

export const getPublicProduct = query({
  args: { slug: v.string(), productSlug: v.string() },
  handler: async (ctx, { slug, productSlug }) => {
    const tenant = await ctx.db.query("tenants").withIndex("by_slug", (q) => q.eq("slug", slug)).first();
    if (!tenant || tenant.status === "suspended") return null;
    const product = await ctx.db.query("products").withIndex("by_tenant_slug", (q) => q.eq("tenantId", tenant._id).eq("slug", productSlug)).first();
    if (!product || product.status !== "active") return null;
    const variants = product.hasVariants ? await ctx.db.query("productVariants").withIndex("by_product", (q) => q.eq("productId", product._id)).collect() : [];
    const category = product.categoryId ? await ctx.db.get(product.categoryId) : null;
    return {
      _id: product._id,
      name: product.name,
      description: product.description,
      shortDescription: product.shortDescription,
      sku: product.sku,
      price: product.price,
      comparePrice: product.comparePrice,
      stock: product.stock,
      images: product.images,
      featured: product.featured,
      options: product.options ?? [],
      variants: variants.map((v) => ({ _id: v._id, options: v.options, price: v.price, stock: v.stock, imageUrl: v.imageUrl })),
      categoryName: category?.name ?? null,
      categorySlug: category?.slug ?? null,
    };
  },
});

// ---------------------------------------------------------------------------
// Public analytics tracking (fire-and-forget events)
// ---------------------------------------------------------------------------
export const trackEvent = mutation({
  args: {
    slug: v.string(),
    type: v.union(
      v.literal("page_view"),
      v.literal("product_view"),
      v.literal("add_to_cart"),
      v.literal("checkout_started"),
      v.literal("order_created"),
      v.literal("whatsapp_click"),
    ),
    productId: v.optional(v.id("products")),
    sessionId: v.optional(v.string()),
    path: v.optional(v.string()),
    value: v.optional(v.number()),
  },
  handler: async (ctx, { slug, type, productId, sessionId, path, value }) => {
    const tenant = await ctx.db.query("tenants").withIndex("by_slug", (q) => q.eq("slug", slug)).first();
    if (!tenant) return;
    await ctx.db.insert("analyticsEvents", {
      tenantId: tenant._id,
      type,
      productId,
      sessionId,
      path,
      value,
      createdAt: Date.now(),
    });
  },
});

// ---------------------------------------------------------------------------
// Demo seed (§51): 3 demo stores with categories, products, customers, orders
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

export const seedDemoData = mutation({
  args: {},
  handler: async (ctx) => {
    await requireSuperAdmin(ctx);
    const now = Date.now();

    // Skip if demo data already exists
    const existingDemo = await ctx.db.query("tenants").withIndex("by_slug", (q) => q.eq("slug", DEMO_STORES[0].slug)).first();
    if (existingDemo) return { skipped: true };

    for (const store of DEMO_STORES) {
      const tenantId = await ctx.db.insert("tenants", {
        name: store.name,
        slug: store.slug,
        status: "active",
        template: store.template,
        planCode: "PRO",
        currency: "PEN",
        whatsappPhone: store.whatsapp,
        whatsappEnabled: true,
        couponsEnabled: true,
        deliveryEnabled: true,
        paymentProvider: "manual",
        isDemo: true,
        createdAt: now - 30 * 24 * 3600 * 1000,
        seo: { title: `${store.name} — Tienda oficial`, description: `Compra en ${store.name} con delivery y pago por WhatsApp.` },
      });

      const theme = { ...DEFAULT_THEMES[store.template], brand: { ...DEFAULT_THEMES[store.template].brand, name: store.name } };
      await ctx.db.insert("tenantThemes", { tenantId, status: "published", version: 1, theme, updatedAt: now, publishedAt: now });
      await ctx.db.insert("tenantThemes", { tenantId, status: "draft", version: 1, theme, updatedAt: now });
      await ctx.db.insert("pages", { tenantId, slug: "home", title: "Inicio", isHome: true, status: "published", version: 1, blocks: DEFAULT_HOMEPAGE_BLOCKS.map((b) => ({ ...b, settings: { ...b.settings } })), updatedAt: now });
      await ctx.db.insert("pages", { tenantId, slug: "home", title: "Inicio", isHome: true, status: "draft", version: 1, blocks: DEFAULT_HOMEPAGE_BLOCKS.map((b) => ({ ...b, settings: { ...b.settings } })), updatedAt: now });
      await ctx.db.insert("tenantDomains", { tenantId, domain: `${store.slug}.shoply.app`, type: "subdomain", status: "active", verifiedAt: now, sslStatus: "active" });
      await ctx.db.insert("subscriptions", { tenantId, planCode: "PRO", status: "active", startedAt: now - 30 * 24 * 3600 * 1000 });

      // Categories
      const catIdByPath = new Map<string, Id<"categories">>();
      let pos = 0;
      for (const cat of store.categories) {
        const catId = await ctx.db.insert("categories", { tenantId, name: cat.name, slug: slugify(cat.name), position: pos++ });
        catIdByPath.set(cat.name, catId);
        for (const child of cat.children ?? []) {
          const childId = await ctx.db.insert("categories", { tenantId, name: child.name, slug: slugify(child.name), parentId: catId, position: 0 });
          catIdByPath.set(`${cat.name}/${child.name}`, childId);
        }
      }

      // Delivery
      const zoneId = await ctx.db.insert("deliveryZones", { tenantId, name: "Zona A — Centro", isActive: true });
      await ctx.db.insert("deliveryRates", { tenantId, zoneId, name: "Delivery Zona A", method: "delivery", price: 5, freeOver: 100, eta: "24-48h", isActive: true });
      await ctx.db.insert("deliveryRates", { tenantId, zoneId, name: "Recojo en tienda", method: "pickup", price: 0, eta: "Hoy", isActive: true });

      // Coupon
      await ctx.db.insert("coupons", { tenantId, code: "BIENVENIDO10", type: "percentage", value: 10, isActive: true, usageCount: 0 });

      // Products
      for (const [i, p] of store.products.entries()) {
        const productId = await ctx.db.insert("products", {
          tenantId,
          name: p.name,
          slug: slugify(p.name),
          description: `${p.name}. ${p.short}. Producto de ${store.name} con garantía y soporte por WhatsApp.`,
          shortDescription: p.short,
          sku: `${store.slug.slice(0, 3).toUpperCase()}-${1000 + i}`,
          price: p.price,
          comparePrice: p.comparePrice,
          stock: p.stock,
          status: "active",
          featured: p.featured ?? false,
          categoryId: catIdByPath.get(p.category),
          createdAt: now - (store.products.length - i) * 3600 * 1000,
          updatedAt: now,
        });
        await ctx.db.insert("analyticsEvents", { tenantId, type: "product_view", productId, value: p.price, createdAt: now - i * 3600 * 1000 });
      }

      // Demo customers + orders
      const demoCustomers = [
        { name: "María Torres", phone: "+51990111001", email: "maria.demo@example.com" },
        { name: "Jorge Ramos", phone: "+51990111002", email: "jorge.demo@example.com" },
        { name: "Lucía Fernández", phone: "+51990111003", email: null },
      ];
      const products = await ctx.db.query("products").withIndex("by_tenant_status", (q) => q.eq("tenantId", tenantId).eq("status", "active")).collect();
      for (const [ci, dc] of demoCustomers.entries()) {
        const customerId = await ctx.db.insert("customers", {
          tenantId,
          name: dc.name,
          email: dc.email ?? undefined,
          phone: dc.phone,
          totalOrders: 0,
          totalSpent: 0,
          createdAt: now - (10 - ci) * 24 * 3600 * 1000,
        });
        const product = products[ci % products.length];
        const qty = 1 + (ci % 2);
        const itemsTotal = product.price * qty;
        const deliveryTotal = 5;
        const total = itemsTotal + deliveryTotal;
        const isPaid = ci % 2 === 0;
        const orderId = await ctx.db.insert("orders", {
          tenantId,
          number: `D${store.slug.slice(0, 2).toUpperCase()}${100 + ci}`,
          customerId,
          customerName: dc.name,
          customerEmail: dc.email ?? undefined,
          customerPhone: dc.phone,
          status: isPaid ? "delivered" : "payment_pending",
          itemsTotal,
          discountTotal: 0,
          deliveryTotal,
          total,
          currency: "PEN",
          deliveryMethod: "delivery",
          isDemo: true,
          createdAt: now - (7 - ci) * 24 * 3600 * 1000,
          updatedAt: now - (7 - ci) * 24 * 3600 * 1000,
        });
        await ctx.db.insert("orderItems", { tenantId, orderId, productId: product._id, name: product.name, unitPrice: product.price, quantity: qty, total: itemsTotal });
        await ctx.db.insert("orderStatusHistory", { tenantId, orderId, toStatus: isPaid ? "delivered" : "payment_pending", actor: "demo-seed", createdAt: now - (7 - ci) * 24 * 3600 * 1000 });
        await ctx.db.insert("analyticsEvents", { tenantId, type: "order_created", value: total, createdAt: now - (7 - ci) * 24 * 3600 * 1000 });
        if (isPaid) await ctx.db.insert("analyticsEvents", { tenantId, type: "payment_succeeded", value: total, createdAt: now - (6 - ci) * 24 * 3600 * 1000 });
        await ctx.db.patch(customerId, { totalOrders: 1, totalSpent: total });
      }

      // Funnel demo events
      await ctx.db.insert("analyticsEvents", { tenantId, type: "page_view", createdAt: now - 3600 * 1000 });
      await ctx.db.insert("analyticsEvents", { tenantId, type: "add_to_cart", value: 89.9, createdAt: now - 1800 * 1000 });
      await audit(ctx, { actorLabel: "demo-seed", tenantId, action: "DEMO_TENANT_SEEDED", resource: "tenant", resourceId: tenantId });
    }
    return { seeded: true };
  },
});

export const hasDemoData = query({
  args: {},
  handler: async (ctx) => {
    await getAuthUserId(ctx);
    const t = await ctx.db.query("tenants").withIndex("by_slug", (q) => q.eq("slug", DEMO_STORES[0].slug)).first();
    return !!t;
  },
});
