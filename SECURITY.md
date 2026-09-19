# Seguridad

## Aislamiento multi-tenant (defensa en el servidor)

- Toda consulta/mutación de datos de negocio resuelve primero el `tenantId` autorizado:
  - Usuarios con tienda → `tenantMembers.userId` (una tienda por usuario en esta versión).
  - Super admin → debe pasar `tenantId` explícito y `resolveTenantId` lo valida.
- Nunca se confía en filtros del frontend: los ids que llegan del cliente se verifican contra el tenant del llamador (`resolveTenantId`, o comparación directa `doc.tenantId === access.tenantId`) antes de leer/escribir.
- Los endpoints públicos (storefront, carrito, checkout) solo exponen datos publicados/activos por `slug` de tienda y nunca exponen datos de otras tiendas.

## Autenticación y autorización

- Convex Auth con email OTP (códigos de un solo uso) + proveedor anónimo deshabilitado para bootstrap del platform admin.
- El primer usuario **real** (no anónimo) que pasa por `platform.bootstrap` se convierte en `super_admin`; el resto requiere invitación (membresía por email que se reclama al iniciar sesión).
- RBAC: `super_admin` (plataforma) / `owner` / `staff` (tienda) verificados con guards en cada función (`requireSuperAdmin`, `requireTenantMember`, `requireTenantOwner`).

## Secretos y pagos

- Claves de Culqi solo en el runtime del backend (`process.env` en acciones Node de Convex). Nunca en el frontend ni en variables `VITE_*`.
- El estado "pagado" **solo** se establece desde el webhook del proveedor (`processPaymentEvent`), nunca desde un redirect del frontend.
- Firma del webhook validada por HMAC-SHA256 en acción Node (`paymentsNode.verifyWebhookSignature`) antes de confirmar pagos.

## Webhooks e idempotencia

- Dedupe por `(provider, eventId)` en `paymentEvents`: reintentos del proveedor no duplican efectos.
- Verificación de monto contra el total del pedido (tolerancia de redondeo); los mismatches se registran como pago fallido.
- Checkout con `idempotencyKey` (índice en `orders`) para evitar pedidos duplicados.
- Los links de pago caducan (48h) y su confirmación manual exige el `token` del link.

## Validación de entrada

- Args tipados por Convex (`v.string()`, `v.number()`, unions) en todas las funciones.
- Sanitización y límites de longitud en textos (`sanitizeText`), códigos normalizados (cupones, teléfonos con dígitos), colores validados con `isHexColor`.
- Reglas de negocio server-side: stock, mínimo de cupón, mínimos de tarifa, dirección obligatoria para delivery, límites de productos por plan.

## Auditoría

- `auditLogs` registra acción, actor, tenant, recurso, datos antes/después (suspensión de tiendas, cambios de plan, creación/borrado de productos, cambios de estado de pedidos, publicación de temas, cambios de flags, etc.).
- `paymentEvents` y `orderStatusHistory` proveen trazabilidad completa de pagos y estados.

## Frontend

- React escapes por defecto (sin `dangerouslySetInnerHTML`).
- Cookies/sesión gestionadas por Convex Auth; no se guardan tokens en localStorage.
- La página de pago por token no revela datos del cliente; la consulta pública de pedido exige número + teléfono.
