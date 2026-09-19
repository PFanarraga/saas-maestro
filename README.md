# Shoply — Plataforma SaaS Multi-Tienda

Plataforma de comercio electrónico **multi-tenant** construida con Vite + React 19 + TypeScript + Tailwind 4 + shadcn/ui + **Convex** (backend, base de datos y auth). Un único despliegue sirve N tiendas independientes (storefront + panel de administración + super admin).

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19, Vite, TypeScript, Tailwind CSS 4, shadcn/ui, Framer Motion |
| Backend / DB | Convex (funciones query/mutation/action + HTTP router) |
| Auth | Convex Auth (email OTP + anónimo), roles: `super_admin`, `owner`, `staff` |
| Pagos | PaymentService abstracto: proveedor `manual` (hosted pay page) + `culqi` (Payment Links API, requiere clave secreta server-side) |
| PWA | Manifest + installable, responsive mobile-first |

## Primeros pasos

1. Entra a la app y regístrate con tu email (código OTP). **El primer usuario real se convierte automáticamente en Super Admin** de la plataforma.
2. En el Super Admin (`/admin`) pulsa **"Datos demo"** para crear 3 tiendas de ejemplo con catálogo, pedidos y clientes (marcadas como demo).
3. Para que un comerciante administre una tienda: crea la tienda desde Super Admin con el email del administrador; al iniciar sesión con ese email, su membresía `owner` se reclama automáticamente en `/start`.
4. Panel de tienda: `/store` (productos, categorías, pedidos, clientes, delivery, cupones, apariencia, páginas, configuración).
5. Storefront público: `/t/{slug}` (home por bloques, catálogo, producto, carrito, checkout como invitado, confirmación).
6. Página de pago alojada: `/pay/{token}` (creada desde el pedido; botón "Link de pago").

## Flujos clave

- **Crear tienda (Super Admin):** nombre + slug + plantilla + plan + email del administrador → crea tenant con theme publicado/draft, homepage, subdominio, suscripción y zona de delivery.
- **Checkout:** carrito → datos del cliente → método de entrega → cupón opcional → pedido `payment_pending` con idempotency key → confirmación pública con link de pago y contacto WhatsApp.
- **Pagos:** el estado definitivo solo cambia con el **webhook** del proveedor (`processPaymentEvent`, idempotente por `provider+eventId`, con verificación de monto). El proveedor manual expone una página de pago con confirmación simulada para pruebas; Culqi se activa configurando la clave secreta (ver abajo).
- **WhatsApp:** botones dinámicos de consulta de producto, compra de carrito, consulta de pedido y envío de link de pago (mensajes generados server/client-side).

## Variables de entorno (claves del proveedor de pagos)

| Variable | Dónde | Para qué |
|---|---|---|
| `CULQI_SECRET_KEY` | Entorno del backend Convex (nunca en el frontend) | Crear Payment Links reales de Culqi (`createCulqiLink`) y validar firma del webhook (fallback) |
| `CULQI_WEBHOOK_SECRET` | Entorno del backend Convex | Validar la firma HMAC del webhook de Culqi |
| `APP_BASE_URL` | Entorno del backend Convex | Construir URLs absolutas de links de pago |

Sin claves configuradas, la plataforma funciona con el proveedor `manual` (página de pago alojada + confirmación), útil para demo y pruebas end-to-end.

## Estructura

```
src/
├── convex/               # Backend Convex
│   ├── schema.ts         # ~35 tablas multi-tenant (tenantId en todo)
│   ├── lib/auth.ts       # Guards: super admin, owner/staff, isolation, audit
│   ├── lib/shared.ts     # Presets de themes/plans/blocks + helpers server
│   ├── platform.ts       # Bootstrap, planes, flags, stats globales, auditoría
│   ├── superadmin.ts     # CRUD de tenants (crear/suspender/plan/borrar)
│   ├── catalog.ts        # Categorías, productos, variantes, inventario
│   ├── store.ts          # Settings, theme engine, page builder, delivery, cupones, clientes
│   ├── cart.ts           # Carrito público por sesión
│   ├── orders.ts         # Checkout (idempotente), pedidos, historial, lookup público
│   ├── payments.ts       # PaymentService, links, webhook idempotente
│   ├── paymentsNode.ts   # Acciones Node: HMAC webhook + API Culqi
│   ├── storefront.ts     # Tenant público, catálogo público, tracking, seed demo
│   ├── analytics.ts      # KPIs, embudo, serie diaria
│   └── http.ts           # Rutas HTTP (auth + /webhooks/culqi)
├── pages/
│   ├── Landing.tsx       # Landing comercial
│   ├── Start.tsx         # Hub post-login (bootstrap + claim de membresía)
│   ├── superadmin/       # Panel maestro
│   ├── admin/            # Panel de tienda (10 secciones)
│   └── storefront/       # Storefront por slug + página de pago
└── lib/utils-shared.ts   # Helpers compartidos (mensajes WhatsApp, formato, labels)
```

## Scripts

```bash
bun dev            # desarrollo (la plataforma gestiona el dev server)
bun tsc -b --noEmit  # typecheck
bunx convex dev --once  # codegen + push de funciones Convex
```

## Documentación adicional

- [ARCHITECTURE.md](./ARCHITECTURE.md) — decisiones y capas
- [DATABASE.md](./DATABASE.md) — modelo de datos
- [API.md](./API.md) — funciones Convex y endpoints HTTP
- [SECURITY.md](./SECURITY.md) — modelo de seguridad y multi-tenancy
- [DEPLOYMENT.md](./DEPLOYMENT.md) — operación y dominios
