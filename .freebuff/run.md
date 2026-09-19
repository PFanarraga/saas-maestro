# Run doc — Shoply (Vite + React + Supabase)

## Cómo correr el dev server (frontend)

1. Instalar dependencias (si falta): `npm install` (npm, lockfile `package-lock.json`).
2. Variables de entorno: copiar `.env.local` desde el checkout principal (`D:\saas-maestro`) — nunca se commitea (está en `.gitignore`).
3. Arrancar en segundo plano (Windows, desde la raíz del proyecto):

```powershell
powershell -NoProfile -Command "(Start-Process -FilePath 'npm.cmd' -ArgumentList 'run','dev' -RedirectStandardOutput 'D:\saas-maestro\.freebuff\preview.log' -RedirectStandardError 'D:\saas-maestro\.freebuff\preview.log.err' -WindowStyle Hidden -PassThru).Id"
```

4. Verificar: `curl http://localhost:5173/` → HTTP 200. Puerto por defecto del proyecto: **5173** (Vite).

## Backend

- **Convex (legacy)**: el arranque original usaba `npx convex dev` (backend local en `127.0.0.1:3210`, deployment `local:...`). Está siendo reemplazado — ver `.freebuff/migration-status.md`.
- **Supabase (nuevo)**: la API es la Edge Function `api` del proyecto `mhjaxxrwrdtfcqjyqcsb`, en `https://mhjaxxrwrdtfcqjyqcsb.supabase.co/functions/v1/api`. El código fuente vive en `supabase/functions/` (router `api/index.ts` + módulos `_shared/*.ts`). Deploy por el conector MCP (`deploy_edge_function`, enviar los 11 archivos juntos — el deploy es reemplazo total).
- El schema está en `supabase/migrations/0001_init.sql` y ya está aplicado al proyecto (incluye trigger `auth.users → app_users`).

## Verificación rápida

- Typecheck: `npx tsc -b --pretty false`
- Preview de la app: registrado en la pestaña Preview de este hilo (`http://localhost:5173/`, log en `.freebuff/preview-*.log`).
