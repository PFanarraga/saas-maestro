-- Shoply schema — ported from Convex (src/convex/schema.ts) to Postgres/Supabase.
-- Conventions:
--   * PKs are uuid (gen_random_uuid) — replaces Convex Id<"..."> strings.
--   * Timestamps are bigint ms-epoch, matching the frontend formatters.
--   * Document-ish fields (theme, blocks, settings, seo, address, raw) are jsonb.
--   * Enums/literals are enforced with CHECK constraints.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Users (mirrors auth.users; platformRole lives here)
-- ---------------------------------------------------------------------------
create table if not exists public.app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  name text,
  image text,
  email_verified_at bigint,
  is_anonymous boolean not null default false,
  role text,
  platform_role text check (platform_role in ('super_admin')),
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);

-- ---------------------------------------------------------------------------
-- Platform
-- ---------------------------------------------------------------------------
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  price_monthly double precision not null default 0,
  currency text not null default 'USD',
  limits jsonb not null default '{}'::jsonb,
  is_active boolean not null default true
);

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active' check (status in ('active','suspended','draft')),
  template text,
  plan_code text not null default 'FREE',
  logo_url text,
  currency text default 'PEN',
  whatsapp_phone text,
  whatsapp_enabled boolean default true,
  coupons_enabled boolean default true,
  delivery_enabled boolean default true,
  payment_provider text default 'manual' check (payment_provider in ('manual','culqi')),
  seo jsonb,
  suspended_reason text,
  is_demo boolean default false,
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);
create index if not exists tenants_status_idx on public.tenants (status);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  plan_code text not null,
  status text not null check (status in ('active','trialing','past_due','cancelled')),
  started_at bigint not null,
  renews_at bigint
);
create index if not exists subscriptions_tenant_idx on public.subscriptions (tenant_id);

create table if not exists public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  enabled boolean not null default false,
  description text
);

create table if not exists public.platform_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb
);

-- ---------------------------------------------------------------------------
-- Tenancy
-- ---------------------------------------------------------------------------
create table if not exists public.tenant_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid references public.app_users(id) on delete set null,
  user_email text not null,
  user_name text,
  role text not null check (role in ('owner','staff')),
  permissions text[],
  invited_at bigint not null default (extract(epoch from now()) * 1000)::bigint,
  joined_at bigint
);
create index if not exists tenant_members_tenant_idx on public.tenant_members (tenant_id);
create index if not exists tenant_members_user_idx on public.tenant_members (user_id);
create unique index if not exists tenant_members_tenant_email_uq on public.tenant_members (tenant_id, lower(user_email));

create table if not exists public.tenant_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  key text not null,
  value jsonb,
  unique (tenant_id, key)
);
create index if not exists tenant_settings_tenant_idx on public.tenant_settings (tenant_id);

create table if not exists public.tenant_domains (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  domain text not null unique,
  type text not null check (type in ('subdomain','custom')),
  status text not null default 'pending' check (status in ('pending','active','failed')),
  verified_at bigint,
  ssl_status text
);
create index if not exists tenant_domains_tenant_idx on public.tenant_domains (tenant_id);

create table if not exists public.tenant_themes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  status text not null check (status in ('draft','published')),
  version integer not null default 1,
  theme jsonb not null default '{}'::jsonb,
  updated_at bigint not null default (extract(epoch from now()) * 1000)::bigint,
  published_at bigint
);
create index if not exists tenant_themes_tenant_status_idx on public.tenant_themes (tenant_id, status);

-- Page builder
create table if not exists public.pages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  slug text not null,
  title text not null,
  is_home boolean not null default false,
  status text not null check (status in ('draft','published')),
  version integer not null default 1,
  blocks jsonb not null default '[]'::jsonb,
  updated_at bigint not null default (extract(epoch from now()) * 1000)::bigint,
  unique (tenant_id, slug, status)
);
create index if not exists pages_tenant_slug_idx on public.pages (tenant_id, slug);

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------
create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  slug text not null
);
create index if not exists brands_tenant_idx on public.brands (tenant_id);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  image_url text,
  parent_id uuid references public.categories(id) on delete set null,
  position integer default 0
);
create index if not exists categories_tenant_idx on public.categories (tenant_id);
create index if not exists categories_tenant_slug_idx on public.categories (tenant_id, slug);
create index if not exists categories_tenant_parent_idx on public.categories (tenant_id, parent_id);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  short_description text,
  sku text,
  price double precision not null default 0,
  compare_price double precision,
  cost double precision,
  stock integer not null default 0,
  status text not null default 'active' check (status in ('active','draft','archived')),
  featured boolean not null default false,
  brand_id uuid references public.brands(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  images text[],
  has_variants boolean not null default false,
  options jsonb,
  weight double precision,
  dimensions text,
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint,
  updated_at bigint not null default (extract(epoch from now()) * 1000)::bigint,
  unique (tenant_id, slug)
);
create index if not exists products_tenant_idx on public.products (tenant_id);
create index if not exists products_tenant_status_idx on public.products (tenant_id, status);
create index if not exists products_tenant_category_idx on public.products (tenant_id, category_id);
create index if not exists products_tenant_featured_idx on public.products (tenant_id, featured);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  sku text,
  options jsonb not null default '[]'::jsonb,
  price double precision,
  stock integer not null default 0,
  image_url text,
  weight double precision,
  dimensions text
);
create index if not exists product_variants_product_idx on public.product_variants (product_id);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete set null,
  delta integer not null,
  reason text not null,
  order_id uuid,
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);
create index if not exists inventory_movements_product_idx on public.inventory_movements (product_id);

create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  storage_id text,
  url text not null,
  name text not null,
  folder text not null default 'products',
  size bigint,
  content_type text,
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);
create index if not exists media_tenant_folder_idx on public.media (tenant_id, folder);

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  total_orders integer not null default 0,
  total_spent double precision not null default 0,
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);
create index if not exists customers_tenant_idx on public.customers (tenant_id);
create index if not exists customers_tenant_email_idx on public.customers (tenant_id, email);
create index if not exists customers_tenant_phone_idx on public.customers (tenant_id, phone);

create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  label text,
  line1 text not null,
  city text,
  region text,
  postal_code text,
  reference text,
  is_default boolean default false
);
create index if not exists customer_addresses_customer_idx on public.customer_addresses (customer_id);

-- ---------------------------------------------------------------------------
-- Cart
-- ---------------------------------------------------------------------------
create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  session_key text not null,
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint,
  updated_at bigint not null default (extract(epoch from now()) * 1000)::bigint,
  unique (tenant_id, session_key)
);

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete set null,
  name text not null,
  variant_label text,
  unit_price double precision not null,
  quantity integer not null default 1,
  image_url text,
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);
create index if not exists cart_items_cart_idx on public.cart_items (cart_id);

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  number text not null,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text not null,
  customer_email text,
  customer_phone text not null,
  status text not null default 'pending'
    check (status in ('pending','payment_pending','paid','processing','ready','shipped','delivered','cancelled','refunded')),
  items_total double precision not null default 0,
  discount_total double precision not null default 0,
  delivery_total double precision not null default 0,
  total double precision not null default 0,
  currency text not null default 'PEN',
  coupon_code text,
  delivery_method text,
  delivery_rate_id uuid,
  address jsonb,
  notes text,
  idempotency_key text unique,
  is_demo boolean default false,
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint,
  updated_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);
create index if not exists orders_tenant_idx on public.orders (tenant_id);
create index if not exists orders_tenant_number_idx on public.orders (tenant_id, number);
create index if not exists orders_number_idx on public.orders (number);
create index if not exists orders_tenant_created_idx on public.orders (tenant_id, created_at desc);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  name text not null,
  variant_label text,
  unit_price double precision not null,
  quantity integer not null default 1,
  total double precision not null,
  image_url text
);
create index if not exists order_items_order_idx on public.order_items (order_id);

create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status text,
  to_status text not null,
  note text,
  actor text not null default 'system',
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);
create index if not exists order_status_history_order_idx on public.order_status_history (order_id);

-- ---------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null default 'manual',
  provider_payment_id text,
  amount double precision not null,
  currency text not null default 'PEN',
  status text not null check (status in ('pending','succeeded','failed','refunded')),
  raw jsonb,
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint,
  updated_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);
create index if not exists payments_order_idx on public.payments (order_id);

create table if not exists public.payment_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  order_number text not null,
  provider text not null default 'manual',
  provider_link_id text,
  token text not null unique,
  url text not null,
  amount double precision not null,
  currency text not null default 'PEN',
  status text not null default 'pending' check (status in ('pending','paid','expired','cancelled')),
  expires_at bigint,
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);
create index if not exists payment_links_order_idx on public.payment_links (order_id);
create index if not exists payment_links_tenant_order_idx on public.payment_links (tenant_id, order_id);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  provider text not null,
  event_id text not null,
  event_type text not null,
  verified boolean not null default false,
  simulated boolean default false,
  payload jsonb,
  processed_at bigint not null default (extract(epoch from now()) * 1000)::bigint,
  unique (provider, event_id)
);

-- ---------------------------------------------------------------------------
-- Coupons
-- ---------------------------------------------------------------------------
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  code text not null,
  type text not null check (type in ('percentage','fixed_amount','free_shipping')),
  value double precision not null default 0,
  min_amount double precision,
  max_uses integer,
  max_uses_per_customer integer,
  first_purchase_only boolean default false,
  starts_at bigint,
  ends_at bigint,
  is_active boolean not null default true,
  usage_count integer not null default 0,
  unique (tenant_id, code)
);
create index if not exists coupons_tenant_idx on public.coupons (tenant_id);

create table if not exists public.coupon_usages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  customer_email text,
  amount double precision not null default 0,
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);
create index if not exists coupon_usages_coupon_idx on public.coupon_usages (coupon_id);

-- ---------------------------------------------------------------------------
-- Delivery
-- ---------------------------------------------------------------------------
create table if not exists public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true
);
create index if not exists delivery_zones_tenant_idx on public.delivery_zones (tenant_id);

create table if not exists public.delivery_rates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  zone_id uuid not null references public.delivery_zones(id) on delete cascade,
  name text not null,
  method text not null check (method in ('pickup','delivery','shipping')),
  price double precision not null default 0,
  free_over double precision,
  min_order double precision,
  eta text,
  is_active boolean not null default true
);
create index if not exists delivery_rates_zone_idx on public.delivery_rates (zone_id);
create index if not exists delivery_rates_tenant_idx on public.delivery_rates (tenant_id);

-- ---------------------------------------------------------------------------
-- Analytics, audit, notifications
-- ---------------------------------------------------------------------------
create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  type text not null check (type in ('page_view','product_view','add_to_cart','checkout_started','order_created','payment_succeeded','whatsapp_click')),
  session_id text,
  product_id uuid references public.products(id) on delete set null,
  path text,
  value double precision,
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);
create index if not exists analytics_events_tenant_type_time_idx on public.analytics_events (tenant_id, type, created_at desc);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.app_users(id) on delete set null,
  actor_label text not null,
  tenant_id uuid references public.tenants(id) on delete cascade,
  action text not null,
  resource text not null,
  resource_id text,
  old_data jsonb,
  new_data jsonb,
  ip text,
  user_agent text,
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);
create index if not exists audit_logs_tenant_time_idx on public.audit_logs (tenant_id, created_at desc);
create index if not exists audit_logs_time_idx on public.audit_logs (created_at desc);

create table if not exists public.notification_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  key text not null,
  channel text not null default 'whatsapp',
  subject text,
  body text not null,
  unique (tenant_id, key)
);

-- ---------------------------------------------------------------------------
-- RLS: the app talks to Postgres through the API Worker using the service
-- role (which bypasses RLS). All tenant authorization is enforced in the
-- Worker (port of src/convex/lib/auth.ts). Direct anon/authenticated access
-- is denied by default.
-- ---------------------------------------------------------------------------
alter table public.app_users enable row level security;
alter table public.plans enable row level security;
alter table public.tenants enable row level security;
alter table public.subscriptions enable row level security;
alter table public.feature_flags enable row level security;
alter table public.platform_settings enable row level security;
alter table public.tenant_members enable row level security;
alter table public.tenant_settings enable row level security;
alter table public.tenant_domains enable row level security;
alter table public.tenant_themes enable row level security;
alter table public.pages enable row level security;
alter table public.brands enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.media enable row level security;
alter table public.customers enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;
alter table public.payments enable row level security;
alter table public.payment_links enable row level security;
alter table public.payment_events enable row level security;
alter table public.coupons enable row level security;
alter table public.coupon_usages enable row level security;
alter table public.delivery_zones enable row level security;
alter table public.delivery_rates enable row level security;
alter table public.analytics_events enable row level security;
alter table public.audit_logs enable row level security;
alter table public.notification_templates enable row level security;
