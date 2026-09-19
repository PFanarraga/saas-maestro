# Modelo de datos

Convex (documento + índices). Todas las tablas de negocio llevan `tenantId`. Convex añade `_id` y `_creationTime` a todo documento.

## Plataforma

| Tabla | Campos clave | Notas |
|---|---|---|
| `users` | email, name, `platformRole?: "super_admin"` | Tabla de Convex Auth extendida |
| `plans` | code (FREE…ENTERPRISE), priceMonthly, `limits{maxProducts, maxStaff, maxStorageMb, customDomain, analytics, coupons, whatsapp, paymentIntegrations, apiAccess}` | Índice `by_code` |
| `subscriptions` | tenantId, planCode, status | Una activa por tenant |
| `featureFlags` | key, enabled | whatsapp_enabled, coupons_enabled, custom_domains… |
| `auditLogs` | actorId, tenantId, action, resource, oldData, newData, createdAt | Índices por tiempo y tenant |

## Tenencia

| Tabla | Campos clave | Índices |
|---|---|---|
| `tenants` | name, slug, status(active/suspended/draft), planCode, whatsapp*, paymentProvider, seo, isDemo | `by_slug`, `by_status` |
| `tenantMembers` | tenantId, userEmail, userId?, role(owner/staff), permissions[] | `by_tenant_email`, `by_user` |
| `tenantSettings` | tenantId, key, value | `by_tenant_key` |
| `tenantDomains` | tenantId, domain, type(subdomain/custom), status, sslStatus | `by_domain` |
| `tenantThemes` | tenantId, status(draft/published), version, theme JSON | `by_tenant_status` |
| `pages` | tenantId, slug, isHome, status, version, `blocks[{id,type,position,hidden,settings}]` | `by_tenant_slug` + filtro por status |

## Catálogo

`brands`, `categories` (jerárquicas vía `parentId`), `products` (precio, comparePrice, stock, status, featured, options, imágenes; índices `by_tenant_status`, `by_tenant_slug`, `by_tenant_category`), `productVariants` (options, price, stock por variante), `inventoryMovements` (delta + razón + orderId), `media` (por tenant y carpeta).

## Clientes y carrito

- `customers` (por tenant; email/phone únicos por tienda), `customerAddresses`.
- `carts` (tenantId + sessionKey del navegador), `cartItems` (snapshot de precio y variante).

## Pedidos y pagos

- `orders`: number, customer snapshot, status (`pending|payment_pending|paid|processing|ready|shipped|delivered|cancelled|refunded`), itemsTotal/discountTotal/deliveryTotal/total, deliveryMethod, address, `idempotencyKey` (índice único lógico).
- `orderItems`: snapshot por ítem (precio al momento de la compra).
- `orderStatusHistory`: cada cambio con actor (checkout, staff, webhook).
- `payments`: registros de cobros por proveedor con `raw`.
- `paymentLinks`: token, url, amount, expiración, status; índice `by_token`.
- `paymentEvents`: log idempotente de webhooks (`by_provider_event`).

## Marketing / entrega

- `coupons` (percentage | fixed_amount | free_shipping; minAmount, maxUses, endsAt, usageCount), `couponUsages`.
- `deliveryZones` y `deliveryRates` (pickup | delivery | shipping; price, freeOver, minOrder, eta).

## Observabilidad

- `analyticsEvents` (tipo, sessionId, productId, value) con índice `by_tenant_type_time`.
- `notificationTemplates` para plantillas futuras (WhatsApp Business API / email).

## Patrones

- **Draft/Published:** `tenantThemes` y `pages` guardan dos filas por entidad (status draft/published); publicar crea la versión N+1.
- **Multi-tenant:** filtros `withIndex("by_tenant…")` + guardas de `lib/auth.ts` en cada función.
- **Idempotencia:** `orders.idempotencyKey` y dedupe de eventos `(provider, eventId)`.
