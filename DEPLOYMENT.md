# Despliegue y operación

## Entornos

- **App + Convex:** la plataforma ejecuta `vite` (dev) y `convex dev` en sesiones gestionadas; los cambios de `src/convex/` se sincronizan con `convex dev --once` y el typecheck corre automáticamente en cada turno.
- **Producción (referencia):** build estático de Vite + deployment Convex dedicado (`npx convex deploy`). Variables del backend configuradas en el dashboard de Convex.

## Dominios y multi-tenancy

- Modelo actual: subdominio lógico por tienda (`{slug}.shoply.app`) registrado en `tenantDomains`, y ruta pública `/t/{slug}` que resuelve el tenant por `slug` (equivalente funcional al lookup por hostname).
- Migración a dominios propios (`www.cliente.com`):
  1. Registrar el dominio en `tenantDomains` (`type: "custom"`, `status: "pending"`).
  2. Apuntar DNS (CNAME) a la plataforma y verificar (campos `verifiedAt`, `sslStatus`).
  3. Resolver el tenant por `Host` en el edge/server y montar la misma app con `slug` resuelto (el storefront ya está aislado por tenant).

## Pagos (Culqi)

1. Obtener la llave secreta en el panel de Culqi y guardarla como variable de entorno del backend Convex: `CULQI_SECRET_KEY` (y opcionalmente `CULQI_WEBHOOK_SECRET`).
2. Configurar el webhook de Culqi hacia `https://<tu-convex>.convex.site/webhooks/culqi`.
3. (Opcional) definir `APP_BASE_URL` para links absolutos.
4. En la tienda: Configuración → Proveedor de pago → `Culqi`. Los links de pedido usarán la API real (`payments.createCulqiLink`).

Sin claves, el proveedor `manual` permite probar todo el flujo con la página `/pay/:token` (confirmación simulada con token del link).

## Datos demo

- Botón **"Datos demo"** en el Super Admin: crea 3 tiendas (`aurora-tech`, `cafe-verduras`, `velvet-moda`) con categorías, productos, clientes, pedidos, cupón `BIENVENIDO10`, delivery y eventos analíticos. Las tiendas y pedidos quedan marcados `isDemo`.
- `seedDemoData` es idempotente (no duplica si ya existen).

## Salud y verificación

- Typecheck del proyecto: `bun tsc -b --noEmit`.
- Push de funciones: `bunx convex dev --once` (falla ante errores de schema/TS — no ignorar).
- La auditoría (`auditLogs`) y los eventos de pago (`paymentEvents`) son el primer punto de diagnóstico ante incidencias de órdenes/pagos.

## Problemas comunes

| Síntoma | Causa probable | Acción |
|---|---|---|
| "Did you forget to run convex dev?" | Funciones no sincronizadas | `bunx convex dev --once` |
| Preview en blanco | Error de tipos/runtime | Revisar typecheck; el RootErrorBoundary muestra el stack |
| No puedo entrar al Super Admin | No eres el primer usuario real | Otro usuario ya hizo bootstrap; pedir rol desde la plataforma |
| El pedido no pasa a "pagado" | Webhook no recibido/verificado | Revisar `paymentEvents` (verified, duplicated) y la firma |
| Límite del plan alcanzado | Plan FREE/BASIC | Cambiar plan desde Super Admin |
