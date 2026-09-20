-- Restructuración completa del sistema de acceso

-- 1. Ampliación de app_users para soportar datos profesionales de clientes
ALTER TABLE public.app_users
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS tos_accepted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS marketing_accepted BOOLEAN DEFAULT FALSE;

-- 2. Ampliación de tenants para capturar datos de negocio durante el registro
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS business_name TEXT,
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS country TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS business_phone TEXT;

-- 3. Refuerzo de roles y permisos en tenant_members
-- Ya tenemos role (owner, staff), agregamos soporte para permisos granulares
-- Cambiamos permissions de text[] a jsonb para mayor flexibilidad futura si es necesario,
-- pero por ahora el array de strings es suficiente para RBAC simple.

-- 4. Tabla de sesiones de compradores (opcional, Supabase Auth ya maneja la sesión,
-- pero podríamos querer persistir metadatos específicos del comprador por tienda)
-- Por ahora usaremos app_users marcados como is_anonymous o sin platform_role para compradores.

-- 5. Eliminar Feature Flags obsoletos si existen y agregar los nuevos
DELETE FROM public.feature_flags WHERE key = 'maintenance_mode';
INSERT INTO public.feature_flags (key, enabled, description) VALUES
('allow_public_registration', true, 'Permite que nuevos dueños de tienda se registren en la plataforma'),
('require_email_verification', true, 'Obliga a los dueños de tienda a verificar su correo antes de acceder al panel');
