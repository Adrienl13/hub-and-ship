-- ============================================================
-- Container Club / Hub & Ship — Initial schema
-- ============================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------
create type product_category as enum ('chair', 'armchair', 'table', 'bench');
create type fire_rating as enum ('M1', 'M2');
create type container_status as enum ('open', 'locked', 'shipping', 'delivered', 'cancelled');
create type reservation_status as enum ('pending_payment', 'confirmed', 'cancelled');

-- ----------------------------------------------------------------
-- professionals : profil pro lié 1-1 à auth.users
-- ----------------------------------------------------------------
create table professionals (
  id              uuid primary key references auth.users(id) on delete cascade,
  company_name    text not null,
  contact_name    text not null,
  email           text not null,
  phone           text not null,
  siret           text not null,
  delivery_zip    text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint siret_format check (siret ~ '^[0-9]{14}$'),
  constraint siret_unique unique (siret)
);

create index professionals_email_idx on professionals (email);

-- ----------------------------------------------------------------
-- products
-- ----------------------------------------------------------------
create table products (
  id                text primary key,
  sku               text not null unique,
  category          product_category not null,
  name              text not null,
  description       text not null,
  dim_length_cm     int not null,
  dim_width_cm      int not null,
  dim_height_cm     int not null,
  cbm_per_unit      numeric(10, 4) not null check (cbm_per_unit > 0),
  weight_kg         numeric(10, 2) not null,
  moq_units         int not null check (moq_units > 0),
  base_price_ht     numeric(10, 2) not null check (base_price_ht >= 0),
  retail_price_ref  numeric(10, 2) not null check (retail_price_ref >= 0),
  eco_contribution  numeric(10, 2) not null default 0,
  main_image_url    text not null,
  gallery_urls      text[] not null default '{}',
  features          text[] not null default '{}',
  fire_rating       fire_rating,
  is_active         boolean not null default true,
  sort_order        int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index products_category_idx on products (category) where is_active;
create index products_sort_idx on products (sort_order) where is_active;

-- ----------------------------------------------------------------
-- product_variants : couleurs / finitions
-- ----------------------------------------------------------------
create table product_variants (
  id                  text primary key,
  product_id          text not null references products(id) on delete cascade,
  name                text not null,
  hex                 text not null check (hex ~ '^#[0-9a-fA-F]{6}$'),
  image_url           text,
  sort_order          int not null default 0,
  created_at          timestamptz not null default now()
);

create index product_variants_product_idx on product_variants (product_id, sort_order);

-- ----------------------------------------------------------------
-- containers
-- ----------------------------------------------------------------
create table containers (
  id                       uuid primary key default gen_random_uuid(),
  reference                text not null unique,
  port                     text not null,
  capacity_cbm             numeric(10, 2) not null check (capacity_cbm > 0),
  threshold_percent        int not null default 80 check (threshold_percent between 0 and 100),
  min_series_required      int not null default 3 check (min_series_required > 0),
  expected_close_at        date,
  status                   container_status not null default 'open',
  delivered_at             date,
  planned_days             int,
  actual_days              int,
  photo_url                text,
  testimonial_quote        text,
  testimonial_author       text,
  testimonial_location     text,
  testimonial_rating       int check (testimonial_rating between 1 and 5),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index containers_status_idx on containers (status, expected_close_at);

-- ----------------------------------------------------------------
-- container_reservations : engagement d'un pro sur un container
-- ----------------------------------------------------------------
create table container_reservations (
  id                       uuid primary key default gen_random_uuid(),
  container_id             uuid not null references containers(id) on delete restrict,
  professional_id          uuid not null references professionals(id) on delete restrict,
  status                   reservation_status not null default 'pending_payment',
  subtotal_ht              numeric(12, 2) not null check (subtotal_ht >= 0),
  eco_contribution_total   numeric(12, 2) not null default 0,
  reservation_fee          numeric(12, 2) not null check (reservation_fee >= 0),
  delivery_zip             text,
  notes                    text,
  created_at               timestamptz not null default now(),
  confirmed_at             timestamptz,
  cancelled_at             timestamptz,
  paid_reservation_at      timestamptz,
  paid_deposit_at          timestamptz,
  paid_balance_at          timestamptz
);

create index reservations_container_idx on container_reservations (container_id, status);
create index reservations_professional_idx on container_reservations (professional_id, created_at desc);

-- ----------------------------------------------------------------
-- container_reservation_items : lignes du panier au moment de la résa
-- prix figés (snapshot) pour ne pas être impactés par une MAJ du catalogue
-- ----------------------------------------------------------------
create table container_reservation_items (
  id                       uuid primary key default gen_random_uuid(),
  reservation_id           uuid not null references container_reservations(id) on delete cascade,
  product_id               text not null references products(id) on delete restrict,
  variant_id               text not null references product_variants(id) on delete restrict,
  quantity                 int not null check (quantity > 0),
  unit_price_ht            numeric(10, 2) not null check (unit_price_ht >= 0),
  eco_contribution_unit    numeric(10, 2) not null default 0,
  cbm_per_unit             numeric(10, 4) not null check (cbm_per_unit > 0),
  created_at               timestamptz not null default now()
);

create index reservation_items_reservation_idx on container_reservation_items (reservation_id);
create index reservation_items_variant_idx on container_reservation_items (variant_id);

-- ----------------------------------------------------------------
-- container_seed_commitments : compteurs "social proof" injectés
-- manuellement (démo ou phase de lancement avant les vrais pros).
-- À vider quand les vraies réservations prennent le relais.
-- ----------------------------------------------------------------
create table container_seed_commitments (
  container_id     uuid not null references containers(id) on delete cascade,
  variant_id       text not null references product_variants(id) on delete cascade,
  units_committed  int not null check (units_committed >= 0),
  primary key (container_id, variant_id)
);

-- ----------------------------------------------------------------
-- Vue agrégée : engagement par container/variant (seeds + vraies résas)
-- Utilisée par le front pour afficher la jauge MOQ par variante.
-- ----------------------------------------------------------------
create or replace view container_variant_commitments as
with real_commits as (
  select
    r.container_id,
    i.variant_id,
    sum(i.quantity)::int as units,
    sum(i.quantity * i.cbm_per_unit)::numeric(12, 4) as cbm
  from container_reservation_items i
  join container_reservations r on r.id = i.reservation_id
  where r.status in ('pending_payment', 'confirmed')
  group by r.container_id, i.variant_id
),
seed_commits as (
  select
    s.container_id,
    s.variant_id,
    s.units_committed::int as units,
    (s.units_committed * v.cbm_per_unit_resolved)::numeric(12, 4) as cbm
  from container_seed_commitments s
  join (
    select pv.id, p.cbm_per_unit as cbm_per_unit_resolved
    from product_variants pv
    join products p on p.id = pv.product_id
  ) v on v.id = s.variant_id
)
select
  coalesce(r.container_id, s.container_id) as container_id,
  coalesce(r.variant_id, s.variant_id)     as variant_id,
  coalesce(r.units, 0) + coalesce(s.units, 0)               as units_committed,
  (coalesce(r.cbm, 0) + coalesce(s.cbm, 0))::numeric(12, 4) as cbm_committed
from real_commits r
full outer join seed_commits s
  on r.container_id = s.container_id and r.variant_id = s.variant_id;

-- ----------------------------------------------------------------
-- Trigger : maintien updated_at
-- ----------------------------------------------------------------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_professionals_updated before update on professionals
  for each row execute function set_updated_at();
create trigger trg_products_updated before update on products
  for each row execute function set_updated_at();
create trigger trg_containers_updated before update on containers
  for each row execute function set_updated_at();
