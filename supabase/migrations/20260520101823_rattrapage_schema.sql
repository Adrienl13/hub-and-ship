-- ============================================================
-- Container Club — rattrapage schema (idempotent)
-- ------------------------------------------------------------
-- Captures the actual remote state of the DB for tables that
-- predate the migration repo (`professionals`, `products`,
-- `product_variants`, `containers`, `container_reservations`,
-- `container_reservation_items`, `container_seed_commitments`),
-- plus the supporting enums, functions, triggers, view and RLS
-- policies. The earlier `reservations` / `reservation_items`
-- tables and their RLS live in
-- `20260519190000_initial_schema.sql` and
-- `20260519190001_rls_policies.sql` and are NOT re-declared here.
--
-- This migration is intentionally idempotent — it will not be
-- applied to the live project, it only realigns the repo with
-- the existing schema so future migrations have a known base.
-- ============================================================

-- ============================================================
-- Enums
-- ============================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'container_status') then
    create type public.container_status as enum (
      'open',
      'locked',
      'shipping',
      'delivered',
      'cancelled'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'fire_rating') then
    create type public.fire_rating as enum ('M1', 'M2');
  end if;

  if not exists (select 1 from pg_type where typname = 'product_category') then
    create type public.product_category as enum (
      'chair',
      'armchair',
      'table',
      'bench'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'reservation_status') then
    create type public.reservation_status as enum (
      'pending_payment',
      'confirmed',
      'cancelled'
    );
  end if;
end
$$;

-- ============================================================
-- Helper functions
-- ============================================================

-- `set_updated_at` already lives in 20260519190000_initial_schema.sql.
-- Re-declared with `create or replace` here for completeness so the
-- file is self-contained when read in isolation.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(
    (select is_admin from public.professionals where id = auth.uid()),
    false
  );
$$;

create or replace function public.handle_new_professional()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.raw_user_meta_data ->> 'company_name' is not null
     and new.raw_user_meta_data ->> 'siret' is not null
     and new.raw_user_meta_data ->> 'contact_name' is not null
     and new.raw_user_meta_data ->> 'phone' is not null then
    insert into public.professionals (
      id, company_name, contact_name, email, phone, siret, delivery_zip
    ) values (
      new.id,
      new.raw_user_meta_data ->> 'company_name',
      new.raw_user_meta_data ->> 'contact_name',
      new.email,
      new.raw_user_meta_data ->> 'phone',
      new.raw_user_meta_data ->> 'siret',
      new.raw_user_meta_data ->> 'delivery_zip'
    );
  end if;
  return new;
end;
$$;

-- ============================================================
-- Tables
-- ============================================================

-- --- professionals ---------------------------------------------
create table if not exists public.professionals (
  id            uuid        not null,
  company_name  text        not null,
  contact_name  text        not null,
  email         text        not null,
  phone         text        not null,
  siret         text        not null,
  delivery_zip  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  is_admin      boolean     not null default false,
  constraint professionals_pkey primary key (id),
  constraint professionals_id_fkey foreign key (id)
    references auth.users(id) on delete cascade,
  constraint siret_unique unique (siret),
  constraint siret_format check (siret ~ '^[0-9]{14}$')
);

create index if not exists professionals_email_idx
  on public.professionals (email);
create index if not exists professionals_is_admin_idx
  on public.professionals (is_admin) where is_admin;

-- --- products --------------------------------------------------
create table if not exists public.products (
  id                text                       not null,
  sku               text                       not null,
  category          public.product_category    not null,
  name              text                       not null,
  description       text                       not null,
  dim_length_cm     integer                    not null,
  dim_width_cm      integer                    not null,
  dim_height_cm     integer                    not null,
  cbm_per_unit      numeric                    not null check (cbm_per_unit > 0),
  weight_kg         numeric                    not null,
  moq_units         integer                    not null check (moq_units > 0),
  base_price_ht     numeric                    not null check (base_price_ht >= 0),
  retail_price_ref  numeric                    not null check (retail_price_ref >= 0),
  eco_contribution  numeric                    not null default 0,
  main_image_url    text                       not null,
  gallery_urls      text[]                     not null default '{}'::text[],
  features          text[]                     not null default '{}'::text[],
  fire_rating       public.fire_rating,
  is_active         boolean                    not null default true,
  sort_order        integer                    not null default 0,
  created_at        timestamptz                not null default now(),
  updated_at        timestamptz                not null default now(),
  constraint products_pkey primary key (id),
  constraint products_sku_key unique (sku)
);

create index if not exists products_category_idx
  on public.products (category) where is_active;
create index if not exists products_sort_idx
  on public.products (sort_order) where is_active;

-- --- product_variants ------------------------------------------
create table if not exists public.product_variants (
  id          text        not null,
  product_id  text        not null,
  name        text        not null,
  hex         text        not null check (hex ~ '^#[0-9a-fA-F]{6}$'),
  image_url   text,
  sort_order  integer     not null default 0,
  created_at  timestamptz not null default now(),
  constraint product_variants_pkey primary key (id),
  constraint product_variants_product_id_fkey foreign key (product_id)
    references public.products(id) on delete cascade
);

create index if not exists product_variants_product_idx
  on public.product_variants (product_id, sort_order);

-- --- containers ------------------------------------------------
create table if not exists public.containers (
  id                     uuid                       not null default gen_random_uuid(),
  reference              text                       not null,
  port                   text                       not null,
  capacity_cbm           numeric                    not null check (capacity_cbm > 0),
  threshold_percent      integer                    not null default 80
                              check (threshold_percent >= 0 and threshold_percent <= 100),
  min_series_required    integer                    not null default 3
                              check (min_series_required > 0),
  expected_close_at      date,
  status                 public.container_status    not null default 'open'::public.container_status,
  delivered_at           date,
  planned_days           integer,
  actual_days            integer,
  photo_url              text,
  testimonial_quote      text,
  testimonial_author     text,
  testimonial_location   text,
  testimonial_rating     integer
                              check (testimonial_rating >= 1 and testimonial_rating <= 5),
  created_at             timestamptz                not null default now(),
  updated_at             timestamptz                not null default now(),
  display_series_target  integer                    not null default 5,
  display_pros_count     integer                    not null default 0,
  display_items_count    integer                    not null default 0,
  constraint containers_pkey primary key (id),
  constraint containers_reference_key unique (reference)
);

create index if not exists containers_status_idx
  on public.containers (status, expected_close_at);

-- --- container_reservations ------------------------------------
create table if not exists public.container_reservations (
  id                       uuid                          not null default gen_random_uuid(),
  container_id             uuid                          not null,
  professional_id          uuid                          not null,
  status                   public.reservation_status     not null default 'pending_payment'::public.reservation_status,
  subtotal_ht              numeric                       not null check (subtotal_ht >= 0),
  eco_contribution_total   numeric                       not null default 0,
  reservation_fee          numeric                       not null check (reservation_fee >= 0),
  delivery_zip             text,
  notes                    text,
  created_at               timestamptz                   not null default now(),
  confirmed_at             timestamptz,
  cancelled_at             timestamptz,
  paid_reservation_at      timestamptz,
  paid_deposit_at          timestamptz,
  paid_balance_at          timestamptz,
  constraint container_reservations_pkey primary key (id),
  constraint container_reservations_container_id_fkey foreign key (container_id)
    references public.containers(id) on delete restrict,
  constraint container_reservations_professional_id_fkey foreign key (professional_id)
    references public.professionals(id) on delete restrict
);

create index if not exists reservations_container_idx
  on public.container_reservations (container_id, status);
create index if not exists reservations_professional_idx
  on public.container_reservations (professional_id, created_at desc);

-- --- container_reservation_items -------------------------------
create table if not exists public.container_reservation_items (
  id                     uuid        not null default gen_random_uuid(),
  reservation_id         uuid        not null,
  product_id             text        not null,
  variant_id             text        not null,
  quantity               integer     not null check (quantity > 0),
  unit_price_ht          numeric     not null check (unit_price_ht >= 0),
  eco_contribution_unit  numeric     not null default 0,
  cbm_per_unit           numeric     not null check (cbm_per_unit > 0),
  created_at             timestamptz not null default now(),
  constraint container_reservation_items_pkey primary key (id),
  constraint container_reservation_items_reservation_id_fkey foreign key (reservation_id)
    references public.container_reservations(id) on delete cascade,
  constraint container_reservation_items_product_id_fkey foreign key (product_id)
    references public.products(id) on delete restrict,
  constraint container_reservation_items_variant_id_fkey foreign key (variant_id)
    references public.product_variants(id) on delete restrict
);

create index if not exists reservation_items_reservation_idx
  on public.container_reservation_items (reservation_id);
create index if not exists reservation_items_variant_idx
  on public.container_reservation_items (variant_id);

-- --- container_seed_commitments --------------------------------
create table if not exists public.container_seed_commitments (
  container_id     uuid    not null,
  variant_id       text    not null,
  units_committed  integer not null check (units_committed >= 0),
  constraint container_seed_commitments_pkey primary key (container_id, variant_id),
  constraint container_seed_commitments_container_id_fkey foreign key (container_id)
    references public.containers(id) on delete cascade,
  constraint container_seed_commitments_variant_id_fkey foreign key (variant_id)
    references public.product_variants(id) on delete cascade
);

-- ============================================================
-- Triggers
-- ============================================================

drop trigger if exists trg_professionals_updated on public.professionals;
create trigger trg_professionals_updated
  before update on public.professionals
  for each row execute function public.set_updated_at();

drop trigger if exists trg_products_updated on public.products;
create trigger trg_products_updated
  before update on public.products
  for each row execute function public.set_updated_at();

drop trigger if exists trg_containers_updated on public.containers;
create trigger trg_containers_updated
  before update on public.containers
  for each row execute function public.set_updated_at();

-- container_reservations has no updated_at column → no trigger.

-- auth.users trigger that bootstraps a professionals row from
-- raw_user_meta_data when a user signs up.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_professional();

-- ============================================================
-- View: container_variant_commitments
-- Aggregates real reservation items + seed commitments per
-- (container, variant). Consumed by the container scene UI.
-- ============================================================

create or replace view public.container_variant_commitments as
with real_commits as (
  select r.container_id,
         i.variant_id,
         sum(i.quantity)::integer as units,
         sum(i.quantity::numeric * i.cbm_per_unit)::numeric(12, 4) as cbm
    from public.container_reservation_items i
    join public.container_reservations r on r.id = i.reservation_id
   where r.status = any (array['pending_payment'::public.reservation_status,
                               'confirmed'::public.reservation_status])
   group by r.container_id, i.variant_id
),
seed_commits as (
  select s.container_id,
         s.variant_id,
         s.units_committed as units,
         (s.units_committed::numeric * v.cbm_per_unit_resolved)::numeric(12, 4) as cbm
    from public.container_seed_commitments s
    join (
      select pv.id,
             p.cbm_per_unit as cbm_per_unit_resolved
        from public.product_variants pv
        join public.products p on p.id = pv.product_id
    ) v on v.id = s.variant_id
)
select coalesce(r.container_id, s.container_id) as container_id,
       coalesce(r.variant_id, s.variant_id)     as variant_id,
       coalesce(r.units, 0) + coalesce(s.units, 0) as units_committed,
       (coalesce(r.cbm, 0::numeric) + coalesce(s.cbm, 0::numeric))::numeric(12, 4) as cbm_committed
  from real_commits r
  full join seed_commits s
    on r.container_id = s.container_id
   and r.variant_id   = s.variant_id;

-- ============================================================
-- RLS — enable on every captured table
-- ============================================================

alter table public.professionals                enable row level security;
alter table public.products                     enable row level security;
alter table public.product_variants             enable row level security;
alter table public.containers                   enable row level security;
alter table public.container_reservations       enable row level security;
alter table public.container_reservation_items  enable row level security;
alter table public.container_seed_commitments   enable row level security;

-- --- professionals ---------------------------------------------
drop policy if exists "professionals select own" on public.professionals;
create policy "professionals select own"
  on public.professionals
  for select
  to authenticated
  using (id = auth.uid());

drop policy if exists "professionals insert own" on public.professionals;
create policy "professionals insert own"
  on public.professionals
  for insert
  to authenticated
  with check (id = auth.uid());

drop policy if exists "professionals update own" on public.professionals;
create policy "professionals update own"
  on public.professionals
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "admins select all professionals" on public.professionals;
create policy "admins select all professionals"
  on public.professionals
  for select
  to authenticated
  using (public.is_admin());

-- --- products --------------------------------------------------
drop policy if exists "products are public" on public.products;
create policy "products are public"
  on public.products
  for select
  to anon, authenticated
  using (is_active);

drop policy if exists "admins write products" on public.products;
create policy "admins write products"
  on public.products
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- --- product_variants ------------------------------------------
drop policy if exists "variants are public" on public.product_variants;
create policy "variants are public"
  on public.product_variants
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.products p
       where p.id = product_variants.product_id
         and p.is_active
    )
  );

drop policy if exists "admins write variants" on public.product_variants;
create policy "admins write variants"
  on public.product_variants
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- --- containers ------------------------------------------------
drop policy if exists "containers are public" on public.containers;
create policy "containers are public"
  on public.containers
  for select
  to anon, authenticated
  using (true);

drop policy if exists "admins write containers" on public.containers;
create policy "admins write containers"
  on public.containers
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- --- container_reservations ------------------------------------
drop policy if exists "reservations select own" on public.container_reservations;
create policy "reservations select own"
  on public.container_reservations
  for select
  to authenticated
  using (professional_id = auth.uid());

drop policy if exists "reservations insert own" on public.container_reservations;
create policy "reservations insert own"
  on public.container_reservations
  for insert
  to authenticated
  with check (
    professional_id = auth.uid()
    and exists (
      select 1 from public.containers c
       where c.id = container_reservations.container_id
         and c.status = 'open'::public.container_status
    )
  );

drop policy if exists "reservations update own pending" on public.container_reservations;
create policy "reservations update own pending"
  on public.container_reservations
  for update
  to authenticated
  using (
    professional_id = auth.uid()
    and status = 'pending_payment'::public.reservation_status
  )
  with check (professional_id = auth.uid());

drop policy if exists "admins select all reservations" on public.container_reservations;
create policy "admins select all reservations"
  on public.container_reservations
  for select
  to authenticated
  using (public.is_admin());

-- --- container_reservation_items -------------------------------
drop policy if exists "reservation items select own" on public.container_reservation_items;
create policy "reservation items select own"
  on public.container_reservation_items
  for select
  to authenticated
  using (
    exists (
      select 1 from public.container_reservations r
       where r.id = container_reservation_items.reservation_id
         and r.professional_id = auth.uid()
    )
  );

drop policy if exists "reservation items insert own pending" on public.container_reservation_items;
create policy "reservation items insert own pending"
  on public.container_reservation_items
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.container_reservations r
       where r.id = container_reservation_items.reservation_id
         and r.professional_id = auth.uid()
         and r.status = 'pending_payment'::public.reservation_status
    )
  );

drop policy if exists "reservation items delete own pending" on public.container_reservation_items;
create policy "reservation items delete own pending"
  on public.container_reservation_items
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.container_reservations r
       where r.id = container_reservation_items.reservation_id
         and r.professional_id = auth.uid()
         and r.status = 'pending_payment'::public.reservation_status
    )
  );

drop policy if exists "admins select all reservation items" on public.container_reservation_items;
create policy "admins select all reservation items"
  on public.container_reservation_items
  for select
  to authenticated
  using (public.is_admin());

-- --- container_seed_commitments --------------------------------
drop policy if exists "seed commitments are public" on public.container_seed_commitments;
create policy "seed commitments are public"
  on public.container_seed_commitments
  for select
  to anon, authenticated
  using (true);

drop policy if exists "admins write seed commitments" on public.container_seed_commitments;
create policy "admins write seed commitments"
  on public.container_seed_commitments
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
