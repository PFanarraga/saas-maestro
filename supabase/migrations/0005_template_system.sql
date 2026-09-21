-- Template System Integration

-- Add template_id and preset_id to tenants to track active design
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS active_template_id TEXT DEFAULT 'shoply-minimal',
ADD COLUMN IF NOT EXISTS active_preset_id TEXT DEFAULT 'default';

-- Create table for platform templates (optional but good for tracking)
CREATE TABLE IF NOT EXISTS public.platform_templates (
  id text PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  category text NOT NULL,
  is_official boolean DEFAULT true,
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at bigint NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);

-- Seed initial templates
INSERT INTO public.platform_templates (id, name, slug, category, is_official) VALUES
('shoply-minimal', 'Shoply Minimal', 'minimal', 'general', true),
('shoply-fashion', 'Shoply Fashion', 'fashion', 'fashion', true),
('shoply-beauty', 'Shoply Beauty', 'beauty', 'beauty', true),
('shoply-food', 'Shoply Food', 'food', 'food', true),
('shoply-market', 'Shoply Market', 'market', 'market', true),
('shoply-tech', 'Shoply Tech', 'tech', 'technology', true),
('shoply-boutique', 'Shoply Boutique', 'boutique', 'boutique', true),
('shoply-classic', 'Shoply Classic', 'classic', 'general', true)
ON CONFLICT (id) DO NOTHING;

-- RLS
ALTER TABLE public.platform_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read platform templates" ON public.platform_templates FOR SELECT TO public USING (is_active = true);
