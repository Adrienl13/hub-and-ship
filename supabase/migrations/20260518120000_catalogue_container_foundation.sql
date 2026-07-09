-- Catalogue, container and professional foundations.
--
-- These objects were historically present in the live database before the
-- migrations that versioned their RLS policies. Keeping them here makes a fresh
-- Supabase bootstrap reproducible: later migrations can safely alter these
-- tables, add editorial columns, and attach policies.

do $$
begin
  create type public.product_category as enum (
    'chair',
    'armchair',
    'table',
    'bench'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.fire_rating as enum ('M1', 'M2');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.container_status as enum (
    'open',
    'locked',
    'shipping',
    'delivered',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.professionals (
  id uuid primary key references auth.users(id) on delete cascade,
  company_name text,
  contact_name text,
  email text,
  phone text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.containers (
  id uuid primary key default extensions.gen_random_uuid(),
  reference text not null unique,
  port text not null,
  capacity_cbm numeric(8, 2) not null check (capacity_cbm > 0),
  threshold_percent int not null default 70
    check (threshold_percent between 1 and 100),
  min_series_required int not null default 4 check (min_series_required > 0),
  expected_close_at date,
  status public.container_status not null default 'open',
  delivered_at date,
  planned_days int check (planned_days is null or planned_days >= 0),
  actual_days int check (actual_days is null or actual_days >= 0),
  photo_url text,
  testimonial_quote text,
  testimonial_author text,
  testimonial_location text,
  testimonial_rating int
    check (testimonial_rating is null or testimonial_rating between 1 and 5),
  display_series_target int not null default 4
    check (display_series_target > 0),
  display_pros_count int not null default 0 check (display_pros_count >= 0),
  display_items_count int not null default 0 check (display_items_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id text primary key,
  sku text not null unique,
  category public.product_category not null,
  name text not null,
  description text not null default '',
  dim_length_cm int not null check (dim_length_cm >= 0),
  dim_width_cm int not null check (dim_width_cm >= 0),
  dim_height_cm int not null check (dim_height_cm >= 0),
  cbm_per_unit numeric(10, 4) not null check (cbm_per_unit > 0),
  weight_kg numeric(10, 2) not null default 0 check (weight_kg >= 0),
  moq_units int not null default 1 check (moq_units > 0),
  base_price_ht numeric(10, 2) not null check (base_price_ht >= 0),
  retail_price_ref numeric(10, 2) not null default 0
    check (retail_price_ref >= 0),
  eco_contribution numeric(8, 2) not null default 0
    check (eco_contribution >= 0),
  main_image_url text not null default '',
  gallery_urls text[] not null default '{}'::text[],
  features text[] not null default '{}'::text[],
  fire_rating public.fire_rating,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_variants (
  id text primary key,
  product_id text not null references public.products(id) on delete cascade,
  name text not null,
  image_url text,
  gallery_urls text[] not null default '{}'::text[],
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.container_seed_commitments (
  container_id uuid not null references public.containers(id) on delete cascade,
  variant_id text not null references public.product_variants(id) on delete cascade,
  units_committed int not null default 0 check (units_committed >= 0),
  primary key (container_id, variant_id)
);

create index if not exists idx_products_category_active
  on public.products(category, sort_order)
  where is_active;
create index if not exists idx_product_variants_product
  on public.product_variants(product_id, sort_order);
create index if not exists idx_containers_status_created
  on public.containers(status, created_at desc);
create index if not exists idx_seed_commitments_variant
  on public.container_seed_commitments(variant_id);

drop trigger if exists professionals_set_updated_at on public.professionals;
create trigger professionals_set_updated_at
  before update on public.professionals
  for each row execute function public.set_updated_at();

drop trigger if exists containers_set_updated_at on public.containers;
create trigger containers_set_updated_at
  before update on public.containers
  for each row execute function public.set_updated_at();

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_professional()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.professionals (id, email, contact_name)
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'first_name', '') || ' ' ||
                coalesce(new.raw_user_meta_data ->> 'last_name', '')), '')
  )
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();

  return new;
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_admin from public.professionals where id = auth.uid()),
    false
  );
$$;

alter table public.professionals enable row level security;
alter table public.containers enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.container_seed_commitments enable row level security;

grant select, insert, update on public.professionals to authenticated;
grant select on public.containers to anon, authenticated;
grant insert, update, delete on public.containers to authenticated;
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
grant select on public.product_variants to anon, authenticated;
grant insert, update, delete on public.product_variants to authenticated;
grant select on public.container_seed_commitments to anon, authenticated;
grant insert, update, delete on public.container_seed_commitments to authenticated;

comment on table public.products is
  'Public catalogue products; public SELECT is later gated to active rows by RLS.';
comment on table public.containers is
  'Commercial and editorial container rows; public visibility is later gated by status/published_at.';
comment on table public.professionals is
  'Legacy professional profile/admin flag table mirrored by is_admin().';
