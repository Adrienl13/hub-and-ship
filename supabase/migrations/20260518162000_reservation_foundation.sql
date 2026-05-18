-- Reservation foundation used by the checkout draft and future Stripe flow.

do $$
begin
  create type public.delivery_mode as enum (
    'pickup_at_port',
    'self_arranged',
    'partner_carrier_needed'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.reservation_status as enum (
    'draft',
    'pending_reservation_fee',
    'reserved',
    'deposit_called',
    'deposit_paid',
    'in_production',
    'in_transit',
    'delivered',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.reservations (
  id uuid primary key default extensions.gen_random_uuid(),
  reference text unique not null,
  container_reference text not null,
  container_id uuid,
  user_id uuid references public.users_profile(id),
  company_id uuid references public.companies(id),
  siret text not null,
  contact_snapshot jsonb not null,
  delivery_mode public.delivery_mode not null default 'pickup_at_port',
  delivery_note text,
  delivery_fee numeric(8, 2) not null default 0,
  subtotal_ht numeric(10, 2) not null,
  eco_contribution_total numeric(8, 2) not null default 0,
  referral_code text,
  referral_discount numeric(8, 2) not null default 0,
  total_ht numeric(10, 2) not null,
  vat_rate numeric(4, 2) not null default 20.00,
  vat_amount numeric(10, 2) not null,
  total_ttc numeric(10, 2) not null,
  total_cbm numeric(8, 4) not null,
  reservation_fee numeric(8, 2) not null,
  pay_now numeric(8, 2) not null,
  deposit_amount numeric(10, 2) not null,
  pay_at_80_percent numeric(10, 2) not null,
  balance_amount numeric(10, 2) not null,
  status public.reservation_status not null default 'draft',
  cgv_version_accepted text not null,
  cgv_accepted_at timestamptz not null,
  reserved_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reservation_items (
  id uuid primary key default extensions.gen_random_uuid(),
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  product_id text not null,
  sku text not null,
  product_name text not null,
  category text not null,
  variant_id text not null,
  variant_name text not null,
  quantity int not null check (quantity > 0),
  unit_price_ht numeric(10, 2) not null,
  unit_eco_contribution numeric(6, 2) not null default 0,
  subtotal_ht numeric(10, 2) not null,
  eco_contribution_total numeric(8, 2) not null default 0,
  cbm_total numeric(8, 4) not null,
  product_snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_reservations_company
  on public.reservations(company_id, created_at desc)
  where company_id is not null;

create index if not exists idx_reservations_user
  on public.reservations(user_id, created_at desc)
  where user_id is not null;

create index if not exists idx_reservations_status
  on public.reservations(status, created_at desc);

create index if not exists idx_reservation_items_reservation
  on public.reservation_items(reservation_id);

drop trigger if exists reservations_set_updated_at on public.reservations;
create trigger reservations_set_updated_at
  before update on public.reservations
  for each row execute function public.set_updated_at();

alter table public.reservations enable row level security;
alter table public.reservation_items enable row level security;

drop policy if exists "Users see own reservations" on public.reservations;
create policy "Users see own reservations"
  on public.reservations for select
  using (
    user_id = auth.uid()
    or company_id = public.current_company_id()
  );

drop policy if exists "Users see own reservation items" on public.reservation_items;
create policy "Users see own reservation items"
  on public.reservation_items for select
  using (
    reservation_id in (
      select id
      from public.reservations
      where user_id = auth.uid()
         or company_id = public.current_company_id()
    )
  );

drop policy if exists "Admins full access reservations" on public.reservations;
create policy "Admins full access reservations"
  on public.reservations for all
  using (public.current_user_role() in ('admin', 'super_admin'))
  with check (public.current_user_role() in ('admin', 'super_admin'));

drop policy if exists "Admins full access reservation items" on public.reservation_items;
create policy "Admins full access reservation items"
  on public.reservation_items for all
  using (public.current_user_role() in ('admin', 'super_admin'))
  with check (public.current_user_role() in ('admin', 'super_admin'));
