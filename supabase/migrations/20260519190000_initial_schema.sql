-- ============================================================
-- Container Club — initial schema
-- Captures reservations and their line items so that the front
-- end can persist real bookings instead of the current
-- setTimeout-based mock in ReservationDialog.tsx.
-- ============================================================

-- --- Helpers ----------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- --- reservations ----------------------------------------------

create table if not exists public.reservations (
  id                       uuid primary key default gen_random_uuid(),
  container_reference      text        not null,
  status                   text        not null default 'pending'
                                check (status in ('pending','paid','cancelled','refunded','expired')),
  -- Contact information collected at step 1 of ReservationDialog
  name                     text        not null,
  company                  text        not null,
  email                    text        not null,
  phone                    text        not null,
  zip                      text,
  siret                    text,
  -- Money in cents (integer) to avoid floating-point surprises
  subtotal_ht_cents        integer     not null check (subtotal_ht_cents >= 0),
  reservation_fee_cents    integer     not null check (reservation_fee_cents >= 0),
  total_units              integer     not null default 0 check (total_units >= 0),
  used_cbm                 numeric(8,3) not null default 0 check (used_cbm >= 0),
  -- Payment linkage (Stripe)
  stripe_payment_intent_id text,
  stripe_customer_id       text,
  -- Free-form for future use without migration
  metadata                 jsonb       not null default '{}'::jsonb,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists reservations_email_idx       on public.reservations (lower(email));
create index if not exists reservations_status_idx      on public.reservations (status);
create index if not exists reservations_container_idx   on public.reservations (container_reference);
create index if not exists reservations_created_at_idx  on public.reservations (created_at desc);

drop trigger if exists reservations_updated_at on public.reservations;
create trigger reservations_updated_at
  before update on public.reservations
  for each row execute function public.set_updated_at();

-- --- reservation_items -----------------------------------------

create table if not exists public.reservation_items (
  id                        uuid primary key default gen_random_uuid(),
  reservation_id            uuid not null references public.reservations(id) on delete cascade,
  product_sku               text not null,
  product_name              text not null,
  variant_id                text not null,
  variant_name              text not null,
  variant_hex               text not null,
  quantity                  integer not null check (quantity > 0),
  unit_price_ht_cents       integer not null check (unit_price_ht_cents >= 0),
  cbm_per_unit              numeric(8,4) not null check (cbm_per_unit >= 0),
  eco_contribution_cents    integer not null default 0 check (eco_contribution_cents >= 0),
  created_at                timestamptz not null default now()
);

create index if not exists reservation_items_reservation_idx on public.reservation_items (reservation_id);
create index if not exists reservation_items_sku_idx         on public.reservation_items (product_sku);

-- --- comment ----------------------------------------------------

comment on table public.reservations is
  'One row per professional booking on a Container Club container. Captured at step 1 of the reservation dialog, payment_intent attached at step 2.';
comment on table public.reservation_items is
  'Line items of a reservation. Mirrors the cart state (product, variant, quantity, price) at the moment the booking was submitted.';
