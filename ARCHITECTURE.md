# Arquitectura

## Principio multi-tenant

Una sola aplicación + una sola base de datos sirven a N tiendas. La entidad central es `tenants` y **toda** tabla de negocio lleva `tenantId`. El aislamiento se aplica **en el servidor** (funciones Convex), nunca confiando en filtros del frontend.

```
┌────────────────────────── Navegador ──────────────────────────┐
│  Landing /auth  /start   /admin (Super Admin)                 │
│  /store/* (Panel tienda)   /t/:slug (Storefront público)      │
│  /pay/:token (página de pago alojada)                         │
└──────────────┬────────────────────────────────────────────────┘
               │ ConvexReactClient (WebSocket)
┌──────────────▼────────────────────────────────────────────────┐
│ Convex: queries / mutations / actions / httpActions           │
│  - lib/auth.ts: guards de rol + aislamiento + audit log       │
│  - Módulos por dominio: catalog, store, orders, payments...   │
└──────────────┬────────────────────────────────────────────────┘
               │
   Base de datos Convex (35 tablas, todas con tenantId)
```

## Roles y permisos (RBAC)

| Rol | Alcance | Permisos |
|---|---|---|
| `super_admin` (users.platformRole) | Global | Crear/suspender/borrar tenants, cambiar planes, ver pedidos globales, feature flags, audit logs |
| `owner` (tenantMembers.role) | Su tienda | Todo el panel de su tienda |
| `staff` (tenantMembers.role) | Su tienda | Panel de su tienda (permisos finos preparados vía `permissions[]`) |
| `customer` | Sin cuenta | Storefront: carrito, checkout como invitado, consulta de pedido |

La resolución de autoridad vive en `src/convex/lib/auth.ts`:

- `getAccessContext(ctx)`: carga usuario + membresía + flag de super admin.
- `requireSuperAdmin / requireTenantMember / requireTenantOwner`: guards que lanzan error si no corresponde.
- `resolveTenantId(access, requested)`: obliga a super admin a pasar un `tenantId` explícito y bloquea el cross-tenant para el resto.
- `audit(...)`: escribe `auditLogs` en cada operación sensible (login admin, CRUD de productos, cambios de estado, suspensión de tiendas, etc.).

## Theme Engine

- Tabla `tenantThemes` con `status: draft | published` y `version`.
- Publicar convierte el draft en la versión publicada N+1 y deja un draft nuevo (versionado y restaurable).
- El tema es un documento JSON (colores, tipografía, marca, header/footer). El storefront lo convierte en CSS custom properties `--sf-*` scopeadas a `.sf-scope`, sin CSS por tienda ni código generado.
- Plantillas base (`minimal | vibrant | classic`) como presets editables.

## Page Builder

- Tabla `pages` con bloques `{ id, type, position, hidden, settings }`, también con draft/published.
- Bloques soportados en el renderer: hero, banner, categories, featured_products, new_products, text, image, video, testimonials, faq, newsletter, spacer.
- El editor (admin) permite agregar, mover, duplicar, ocultar, editar settings y publicar; la vista previa usa el draft.

## PaymentService (capa abstracta)

```
createPaymentLink (mutation)  ──►  provider "manual": /pay/:token (hosted)
createCulqiLink (action)      ──►  paymentsNode (Node) ──► API Culqi
webhook /webhooks/culqi       ──►  verifyWebhookSignature (HMAC, Node)
                              ──►  processPaymentEvent (idempotente)
                                   ├─ dedupe (provider, eventId)
                                   ├─ verificación de monto
                                   └─ marca pedido paid + historial + analytics
```

Reglas: el frontend **nunca** define el estado del pago; la confirmación llega por webhook (real o simulado con token en el proveedor manual). Los eventos quedan en `paymentEvents` para auditoría.

## WhatsApp

- Mensajes generados desde helpers (`buildProductInquiryMessage`, `buildCartMessage`, `buildPaymentMessage`, ...) y abiertos vía `wa.me` (click-to-chat). 
- `WhatsAppService` preparado para evolucionar a WhatsApp Business API (las plantillas viven en `notificationTemplates`).

## Analytics

- Eventos en `analyticsEvents` (page_view, product_view, add_to_cart, checkout_started, order_created, payment_succeeded, whatsapp_click).
- `analytics.storeDashboard` calcula KPIs, embudo y serie diaria; el Super Admin ve métricas globales.

## Escalabilidad

- Índices por `(tenantId, …)` en todas las tablas calientes; paginación preparada en listados.
- Funciones Convex stateless y eventos desacoplados; el webhook es idempotente y reintentable.
- El storefront lee solo datos publicados (draft/published separa escritura de lectura).
