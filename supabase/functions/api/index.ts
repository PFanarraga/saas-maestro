// Shoply API — Edge Function (Deno) — port of all Convex query/mutation handlers.
import { Hono } from "npm:hono@4";
import { ApiError } from "../_shared/db.ts";
import * as pub from "../_shared/public-handlers.ts";
import * as authed from "../_shared/authed-handlers.ts";
import * as catalog from "../_shared/catalog.ts";
import * as store from "../_shared/store.ts";
import * as orders from "../_shared/orders.ts";

const app = new Hono();

app.use("*", async (c, next) => {
  await next();
  c.res.headers.set("Access-Control-Allow-Origin", "*");
  c.res.headers.set("Access-Control-Allow-Headers", "authorization, content-type, apikey");
  c.res.headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
});

app.options("*", (c) => c.body(null, 204));

app.get("/", (c) => c.json({ ok: true, service: "shoply-api" }));

// ---------------------------------------------------------------------------
// Public storefront
// ---------------------------------------------------------------------------
app.get("/public/stats", async (c) => c.json(await pub.publicStats()));
app.get("/public/tenants/:slug", async (c) => c.json(await pub.getTenantBySlug(c.req.param("slug"))));
app.get("/public/tenants/:slug/products", async (c) =>
  c.json(await pub.listPublicProducts({
    slug: c.req.param("slug"),
    categorySlug: c.req.query("category") ?? undefined,
    search: c.req.query("search") ?? undefined,
  })));
app.get("/public/tenants/:slug/categories", async (c) => c.json(await pub.listPublicCategories(c.req.param("slug"))));
app.get("/public/tenants/:slug/products/:productSlug", async (c) =>
  c.json(await pub.getPublicProduct({ slug: c.req.param("slug"), productSlug: c.req.param("productSlug") })));
app.post("/public/tenants/:slug/events", async (c) =>
  c.json(await pub.trackEvent({ slug: c.req.param("slug"), ...(await c.req.json()) })));

app.get("/public/tenants/:slug/theme", async (c) => c.json(await store.getPublishedTheme(c.req.param("slug"))));
app.get("/public/tenants/:slug/pages/:pageSlug", async (c) =>
  c.json(await store.getPublishedPage(c.req.param("pageSlug"), c.req.param("slug"))));
app.get("/public/tenants/:slug/delivery-rates", async (c) => c.json(await store.listPublicDeliveryRates(c.req.param("slug"))));

// Demo data
app.get("/public/has-demo-data", async (c) => c.json(await pub.hasDemoData()));
app.post("/admin/seed-demo-data", async (c) => c.json(await pub.seedDemoData(c.req.raw)));

// ---------------------------------------------------------------------------
// Cart (public, guest)
// ---------------------------------------------------------------------------
app.get("/cart", async (c) => c.json(await pub.getCart({
  slug: c.req.query("slug")!,
  sessionKey: c.req.query("sessionKey")!,
})));
app.post("/cart/items", async (c) => c.json(await pub.addToCart(await c.req.json())));
app.patch("/cart/items/:itemId", async (c) =>
  c.json(await pub.updateCartItem({ itemId: c.req.param("itemId"), ...(await c.req.json()) })));
app.delete("/cart/items/:itemId", async (c) => c.json(await pub.removeCartItem({
  slug: c.req.query("slug")!,
  sessionKey: c.req.query("sessionKey")!,
  itemId: c.req.param("itemId"),
})));
app.delete("/cart", async (c) => c.json(await pub.clearCart({
  slug: c.req.query("slug")!,
  sessionKey: c.req.query("sessionKey")!,
})));

// ---------------------------------------------------------------------------
// Authed: platform
// ---------------------------------------------------------------------------
app.get("/me/user", async (c) => c.json(await authed.currentUser(c.req.raw)));
app.get("/me/access", async (c) => c.json(await authed.myAccess(c.req.raw)));
app.post("/me/bootstrap", async (c) => c.json(await authed.bootstrap(c.req.raw, await c.req.json().catch(() => ({})))));
app.post("/me/claim-membership", async (c) => c.json(await authed.claimMembership(c.req.raw)));

app.get("/platform/plans", async (c) => c.json(await authed.listPlans()));
app.get("/platform/feature-flags", async (c) => c.json(await authed.listFeatureFlags(c.req.raw)));
app.post("/platform/feature-flags", async (c) => c.json(await authed.setFeatureFlag(c.req.raw, await c.req.json())));
app.get("/platform/global-stats", async (c) => c.json(await authed.globalStats(c.req.raw)));
app.get("/platform/global-orders", async (c) => c.json(await authed.globalOrders(c.req.raw)));
app.get("/platform/audit-logs", async (c) => c.json(await authed.auditLogs(c.req.raw, { tenantId: c.req.query("tenantId") ?? undefined })));

// Super admin tenants
app.get("/superadmin/tenants", async (c) => c.json(await authed.listTenants(c.req.raw)));
app.get("/superadmin/tenants/:tenantId", async (c) => c.json(await authed.getTenantDetail(c.req.raw, c.req.param("tenantId"))));
app.post("/superadmin/tenants", async (c) => c.json(await authed.createTenant(c.req.raw, await c.req.json())));
app.post("/superadmin/tenants/:tenantId/status", async (c) =>
  c.json(await authed.setTenantStatus(c.req.raw, { tenantId: c.req.param("tenantId"), ...(await c.req.json()) })));
app.post("/superadmin/tenants/:tenantId/plan", async (c) =>
  c.json(await authed.changeTenantPlan(c.req.raw, { tenantId: c.req.param("tenantId"), ...(await c.req.json()) })));
app.delete("/superadmin/tenants/:tenantId", async (c) => c.json(await authed.deleteTenant(c.req.raw, c.req.param("tenantId"))));

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------
app.get("/catalog/categories", async (c) => c.json(await catalog.listCategories(c.req.raw, { tenantId: c.req.query("tenantId") ?? undefined })));
app.post("/catalog/categories", async (c) => c.json(await catalog.saveCategory(c.req.raw, await c.req.json())));
app.delete("/catalog/categories/:id", async (c) => c.json(await catalog.deleteCategory(c.req.raw, c.req.param("id"))));

app.get("/catalog/products", async (c) => c.json(await catalog.listProducts(c.req.raw, {
  tenantId: c.req.query("tenantId") ?? undefined,
  status: c.req.query("status") ?? undefined,
  search: c.req.query("search") ?? undefined,
  categoryId: c.req.query("categoryId") ?? undefined,
})));
app.get("/catalog/products/:id", async (c) => c.json(await catalog.getProduct(c.req.raw, c.req.param("id"))));
app.post("/catalog/products", async (c) => c.json(await catalog.saveProduct(c.req.raw, await c.req.json())));
app.delete("/catalog/products/:id", async (c) => c.json(await catalog.deleteProduct(c.req.raw, c.req.param("id"))));

app.post("/catalog/variants", async (c) => c.json(await catalog.saveVariant(c.req.raw, await c.req.json())));
app.delete("/catalog/variants/:id", async (c) => c.json(await catalog.deleteVariant(c.req.raw, c.req.param("id"))));
app.post("/catalog/products/:id/generate-variants", async (c) => c.json(await catalog.generateVariants(c.req.raw, c.req.param("id"))));

app.post("/catalog/stock/adjust", async (c) => c.json(await catalog.adjustStock(c.req.raw, await c.req.json())));
app.get("/catalog/products/:id/movements", async (c) => c.json(await catalog.listInventoryMovements(c.req.raw, c.req.param("id"))));

app.get("/catalog/brands", async (c) => c.json(await catalog.listBrands(c.req.raw)));
app.post("/catalog/brands", async (c) => c.json(await catalog.saveBrand(c.req.raw, await c.req.json())));

// ---------------------------------------------------------------------------
// Store management
// ---------------------------------------------------------------------------
app.get("/store/settings", async (c) => c.json(await store.getSettings(c.req.raw)));
app.post("/store/settings", async (c) => c.json(await store.updateTenantInfo(c.req.raw, await c.req.json())));

app.get("/store/theme-draft", async (c) => c.json(await store.getThemeDraft(c.req.raw)));
app.post("/store/theme-draft", async (c) => c.json(await store.saveThemeDraft(c.req.raw, (await c.req.json()).theme)));
app.post("/store/theme/apply-template", async (c) => c.json(await store.applyTemplate(c.req.raw, (await c.req.json()).template)));
app.post("/store/theme/publish", async (c) => c.json(await store.publishTheme(c.req.raw)));
app.get("/store/theme-versions", async (c) => c.json(await store.themeVersions(c.req.raw)));

app.get("/store/pages/:slug/draft", async (c) => c.json(await store.getPageDraft(c.req.raw, c.req.param("slug"))));
app.post("/store/pages/:slug/draft", async (c) =>
  c.json(await store.savePageDraft(c.req.raw, { slug: c.req.param("slug"), ...(await c.req.json()) })));
app.post("/store/pages/:slug/publish", async (c) => c.json(await store.publishPage(c.req.raw, c.req.param("slug"))));

app.get("/store/delivery", async (c) => c.json(await store.listDelivery(c.req.raw)));
app.post("/store/delivery/zones", async (c) => c.json(await store.saveDeliveryZone(c.req.raw, await c.req.json())));
app.delete("/store/delivery/zones/:id", async (c) => c.json(await store.deleteDeliveryZone(c.req.raw, c.req.param("id"))));
app.post("/store/delivery/rates", async (c) => c.json(await store.saveDeliveryRate(c.req.raw, await c.req.json())));
app.delete("/store/delivery/rates/:id", async (c) => c.json(await store.deleteDeliveryRate(c.req.raw, c.req.param("id"))));

app.get("/store/coupons", async (c) => c.json(await store.listCoupons(c.req.raw)));
app.post("/store/coupons", async (c) => c.json(await store.saveCoupon(c.req.raw, await c.req.json())));
app.delete("/store/coupons/:id", async (c) => c.json(await store.deleteCoupon(c.req.raw, c.req.param("id"))));

app.get("/store/customers", async (c) => c.json(await store.listCustomers(c.req.raw, { search: c.req.query("search") ?? undefined })));
app.get("/store/customers/:id", async (c) => c.json(await store.getCustomer(c.req.raw, c.req.param("id"))));

// ---------------------------------------------------------------------------
// Orders & payments
// ---------------------------------------------------------------------------
app.post("/checkout", async (c) => c.json(await orders.checkout(await c.req.json())));
app.get("/orders", async (c) => c.json(await orders.listOrders(c.req.raw, { status: c.req.query("status") ?? undefined })));
app.get("/orders/:id", async (c) => c.json(await orders.getOrder(c.req.raw, c.req.param("id"))));
app.post("/orders/:id/status", async (c) =>
  c.json(await orders.setOrderStatus(c.req.raw, { orderId: c.req.param("id"), ...(await c.req.json()) })));

app.post("/orders/:id/payment-link", async (c) => c.json(await orders.createPaymentLink(c.req.raw, c.req.param("id"))));
app.get("/payments/events", async (c) => c.json(await orders.listPaymentEvents(c.req.raw)));

// Public payment page
app.get("/public/pay/:token", async (c) => c.json(await orders.publicPayPage({ token: c.req.param("token") })));
app.post("/public/pay/:token/simulate", async (c) => c.json(await orders.simulatePayment({ token: c.req.param("token") })));

// Public order lookup
app.get("/public/tenants/:slug/orders/:number", async (c) =>
  c.json(await orders.lookupPublicOrder({
    slug: c.req.param("slug"),
    number: c.req.param("number"),
    phone: c.req.query("phone") ?? "",
  })));

// Analytics dashboard
app.get("/analytics/dashboard", async (c) => c.json(await orders.storeDashboard(c.req.raw)));

// Culqi webhook (signature verified when CULQI_WEBHOOK_SECRET is set)
app.post("/webhooks/culqi", async (c) => {
  const raw = await c.req.text();
  let body: any = {};
  try {
    body = JSON.parse(raw);
  } catch {
    return c.json({ ok: false, error: "invalid_json" }, 400);
  }
  const secret = Deno.env.get("CULQI_WEBHOOK_SECRET") ?? Deno.env.get("CULQI_SECRET_KEY") ?? "";
  let verified = false;
  if (secret) {
    const timestamp = c.req.header("x-culqi-timestamp") ?? "";
    const signature = c.req.header("x-culqi-signature") ?? "";
    if (timestamp && signature) {
      const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${raw}${timestamp}`));
      const expected = Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
      verified = expected === signature;
    }
  }
  const eventType = body?.type ?? body?.event ?? "unknown";
  const eventId = String(body?.id ?? `${eventType}:${body?.data?.id ?? Date.now()}`);
  const metadata = body?.data?.metadata ?? body?.metadata ?? {};
  const result = await orders.processPaymentEvent({
    provider: "culqi",
    eventId,
    eventType,
    verified,
    payload: body,
    orderNumber: metadata.order_number,
    amount: body?.data?.amount !== undefined ? body.data.amount / 100 : undefined,
  });
  return c.json({ ok: true, verified, ...result }, 200);
});

app.notFound((c) => c.json({ error: "not_found", path: new URL(c.req.url).pathname }));
app.onError((err, c) => {
  if (err instanceof ApiError) {
    return c.json({ error: err.message }, err.status as any);
  }
  console.error("[api] unhandled error:", err);
  const msg = err instanceof Error ? err.message : "Internal error";
  return c.json({ error: msg }, 500);
});

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  let path = url.pathname;
  // Normalize known gateway prefixes so routes match regardless of what the
  // runtime passes through: /functions/v1/api/... or /api/...
  for (const prefix of ["/functions/v1/api", "/api"]) {
    if (path === prefix) { path = "/"; break; }
    if (path.startsWith(prefix + "/")) { path = path.slice(prefix.length) || "/"; break; }
  }
  if (path !== url.pathname) {
    const stripped = new Request(url.origin + path + url.search, req);
    return app.fetch(stripped);
  }
  return app.fetch(req);
});
