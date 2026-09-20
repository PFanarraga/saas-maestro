-- Platform Support System
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number SERIAL UNIQUE,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  subject text NOT NULL,
  description text,
  category text NOT NULL CHECK (category IN ('Account', 'Store', 'Products', 'Orders', 'Payments', 'Subscription', 'Billing', 'Delivery', 'Domain', 'Design', 'Technical', 'Other')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting_customer', 'resolved', 'closed')),
  assigned_to uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  updated_at bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint,
  resolved_at bigint,
  closed_at bigint
);

CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_user_id uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  sender_type text NOT NULL CHECK (sender_type IN ('customer', 'admin', 'system')),
  message text NOT NULL,
  attachments text[], -- URLs to storage
  created_at bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS support_tickets_tenant_idx ON public.support_tickets (tenant_id);
CREATE INDEX IF NOT EXISTS support_tickets_user_idx ON public.support_tickets (user_id);
CREATE INDEX IF NOT EXISTS support_tickets_status_idx ON public.support_tickets (status);
CREATE INDEX IF NOT EXISTS support_ticket_messages_ticket_idx ON public.support_ticket_messages (ticket_id);

-- Reinforce Financial Traceability
-- Payments are already fairly standard, but let's ensure indices for global reporting
CREATE INDEX IF NOT EXISTS payments_status_idx ON public.payments (status);
CREATE INDEX IF NOT EXISTS payments_created_at_idx ON public.payments (created_at DESC);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON public.subscriptions (status);

-- Indices for user management
CREATE INDEX IF NOT EXISTS app_users_platform_role_idx ON public.app_users (platform_role);
CREATE INDEX IF NOT EXISTS app_users_email_idx ON public.app_users (email);

-- Feature Flags Environment
ALTER TABLE public.feature_flags ADD COLUMN IF NOT EXISTS environment text DEFAULT 'production';
ALTER TABLE public.feature_flags ADD COLUMN IF NOT EXISTS updated_at bigint DEFAULT (extract(epoch from now()) * 1000)::bigint;

-- RLS for new tables
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

-- Note: Policies will be bypasses by service role in Edge Functions,
-- but we define them for safety in Studio/Direct access.
CREATE POLICY "Super Admins can manage all tickets" ON public.support_tickets
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.app_users WHERE id = auth.uid() AND platform_role = 'super_admin')
  );

CREATE POLICY "Owners can see their own tickets" ON public.support_tickets
  FOR SELECT TO authenticated USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid() AND role = 'owner')
  );
