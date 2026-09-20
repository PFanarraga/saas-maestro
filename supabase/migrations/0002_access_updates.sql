-- Evolution of Access and Roles System

-- 1. Updates to app_users
ALTER TABLE public.app_users
ADD COLUMN IF NOT EXISTS tos_accepted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS marketing_accepted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;

-- 2. Updates to tenant_members for Staff access
ALTER TABLE public.tenant_members
ADD COLUMN IF NOT EXISTS username TEXT,
ADD COLUMN IF NOT EXISTS password_hash TEXT,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- 3. Unique index for username within a tenant
CREATE UNIQUE INDEX IF NOT EXISTS tenant_members_username_uq ON public.tenant_members (tenant_id, lower(username)) WHERE (username IS NOT NULL);

-- 4. Audit Log for Access Changes
INSERT INTO public.feature_flags (key, enabled, description)
VALUES ('password_auth_enabled', true, 'Permite el inicio de sesión con contraseña para administradores y staff')
ON CONFLICT (key) DO NOTHING;
