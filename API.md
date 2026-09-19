# API

Toda la API de la aplicación son funciones Convex (llamadas por el cliente con `api.<módulo>.<función>`) más un router HTTP para auth y webhooks. La autorización se aplica dentro de cada función (ver SECURITY.md).

## HTTP endpoints (src/convex/http.ts)

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/webhooks/culqi` | Webhook de Culqi: valida firma HMAC (Node), deduplca por `id` del evento y confirma pagos |
| * | (Convex Auth) | Rutas de autenticación email-OTP / anónimo |

## platform

| Función | Tipo | Args | Descripción |
|---|---|---|---|
| `bootstrap` | mutation | `{name?}` | Semilla planes/flags; primer usuario real → super_admin |
| `myAccess` | query | `{}` | Resumen de rol/membresía del usuario actual |
| `claimMembership` | mutation | `{}` | Reclama membresía owner/staff pendiente por email |
| `listPlans` / `listFeatureFlags` | query | `{}` | Catálogos de plataforma |
| `setFeatureFlag` | mutation | `{key, enabled}` | Super admin |
| `globalStats` / `globalOrders` / `auditLogs` | query | `{}` | Super admin |

## superadmin

| Función | Tipo | Args |
|---|---|---|
| `listTenants` | query | `{}` |
| `getTenant` | query | `{tenantId}` |
| `createTenant` | mutation | `{name, slug, template, planCode, adminEmail, adminName?, whatsappPhone?, currency?, isDemo?}` |
| `setTenantStatus` | mutation | `{tenantId, status: active\|suspended, reason?}` |
| `changeTenantPlan` | mutation | `{tenantId, planCode}` |
| `deleteTenant` | mutation | `{tenantId}` (borrado en cascada) |

## catalog

- `listCategories` (auth) / `listPublicCategories` (público por slug de tienda)
- `saveCategory` `{id?, name, parentId?, …}` · `deleteCategory {id}`
- `listProducts {status?, search?, categoryId?, paginationOpts?}` · `getProduct {id}` (incluye variantes)
- `saveProduct` (valida límites del plan) · `deleteProduct {id}`
- `saveVariant` · `deleteVariant` · `generateVariants {productId}` (matriz de opciones)
- `adjustStock {productId, variantId?, delta, reason}` · `listInventoryMovements {productId}`
- `listBrands` · `saveBrand`

## store

- Settings: `getSettings` · `updateTenantInfo {name?, whatsapp*, paymentProvider?, currency?, seo*?}`
- Theme: `getThemeDraft` · `saveThemeDraft {theme}` · `applyTemplate {template}` · `publishTheme` · `themeVersions` · `getPublishedTheme {slug}` (público)
- Pages: `getPageDraft {slug}` · `savePageDraft {slug,title,blocks}` · `publishPage {slug}` · `getPublishedPage {slug, tenantSlug}` (público)
- Delivery: `listDelivery` · `saveDeliveryZone` · `deleteDeliveryZone` · `saveDeliveryRate` · `deleteDeliveryRate` · `listPublicDeliveryRates {slug}` (público)
- Coupons: `listCoupons` · `saveCoupon` · `deleteCoupon`
- Customers: `listCustomers {search?}` · `getCustomer {id}`

## cart (público, invitado)

`getCart {slug, sessionKey}` · `addToCart {slug, sessionKey, productId, variantId?, quantity}` · `updateCartItem` · `removeCartItem` · `clearCart`

## orders

- Staff: `listOrders {status?}` · `getOrder {id}` (items + historial + pagos + links) · `setOrderStatus {orderId, status, note?}`
- Público: `checkout {slug, sessionKey, customerName, customerPhone, customerEmail?, deliveryRateId?, address*, notes?, couponCode?, idempotencyKey?}` → `{orderId, orderNumber}` (idempotente) · `lookupPublicOrder {slug, number, phone}`

## payments

- `createPaymentLink {orderId}` (mutation, link interno `/pay/:token`) · `createCulqiLink {orderId}` (action, API real)
- `attachCulqiLink` · `processPaymentEvent` (internal, idempotente) · `simulatePayment {token}` (página manual)
- `publicPayPage {token}` (público) · `listPaymentEvents` (staff)
- HTTP: `culqiWebhook` en `/webhooks/culqi`

## storefront (público)

`getTenantBySlug {slug}` · `listPublicProducts {slug, categorySlug?, search?}` · `getPublicProduct {slug, productSlug}` · `trackEvent {slug, type, …}` · `seedDemoData` (super admin) · `hasDemoData`

## analytics

`storeDashboard` → KPIs (ingresos, pedidos, pendientes, clientes, stock bajo, conversión), embudo y serie diaria.
