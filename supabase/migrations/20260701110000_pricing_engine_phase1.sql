-- Pricing engine phase 1: parameterized hub-and-ship foundations.
--
-- This migration is deliberately additive. Existing checkout code keeps using
-- reservation snapshots until the later RPC/front migration switches to
-- public.get_price(...). That lets us shadow-compare calculated prices before
-- making the pricing engine authoritative.

do $$
begin
  create type public.pricing_channel as enum (
    'direct',
    'reseller',
    'distributor',
    'admin'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.pricing_parameters (
  id uuid primary key default extensions.gen_random_uuid(),
  version int not null unique check (version > 0),
  label text not null,
  is_active boolean not null default false,
  effective_from timestamptz not null default now(),
  fx_usd_eur numeric(10, 4) not null default 0.92 check (fx_usd_eur > 0),
  freight_eur_40hc numeric(12, 2) not null default 4500 check (freight_eur_40hc >= 0),
  useful_container_cbm_40hc numeric(8, 2) not null default 76 check (useful_container_cbm_40hc > 0),
  customs_rate numeric(8, 4) not null default 0 check (customs_rate >= 0),
  import_insurance_rate numeric(8, 4) not null default 0 check (import_insurance_rate >= 0),
  fixed_import_fee_eur numeric(10, 2) not null default 0 check (fixed_import_fee_eur >= 0),
  direct_margin_rate numeric(8, 4) not null default 0.90 check (direct_margin_rate >= 0),
  reseller_margin_rate numeric(8, 4) not null default 0.40 check (reseller_margin_rate >= 0),
  distributor_margin_rate numeric(8, 4) not null default 0.28 check (distributor_margin_rate >= 0),
  min_margin_floor numeric(8, 4) not null default 0.15 check (min_margin_floor >= 0),
  tier2_qty int not null default 100 check (tier2_qty > 0),
  tier2_discount numeric(8, 4) not null default 0.06 check (tier2_discount between 0 and 1),
  tier3_qty int not null default 150 check (tier3_qty > 0),
  tier3_discount numeric(8, 4) not null default 0.10 check (tier3_discount between 0 and 1),
  max_loss_leaders int not null default 5 check (max_loss_leaders >= 0),
  loss_leader_min_lot int not null default 16 check (loss_leader_min_lot > 0),
  reservation_fee_rate numeric(8, 4) not null default 0.03 check (reservation_fee_rate >= 0),
  reservation_fee_min numeric(10, 2) not null default 150 check (reservation_fee_min >= 0),
  reservation_fee_max numeric(10, 2) not null default 500 check (reservation_fee_max >= 0),
  referrer_commission_rate numeric(8, 4) not null default 0.08 check (referrer_commission_rate >= 0),
  referrer_duration_months int not null default 12 check (referrer_duration_months > 0),
  control_sku text not null default 'ZF2000C',
  control_landed_cost_ht numeric(10, 2) not null default 33.78,
  control_direct_price_ht numeric(10, 2) not null default 64.18,
  control_direct_tier2_price_ht numeric(10, 2) not null default 60.33,
  control_direct_tier3_price_ht numeric(10, 2) not null default 57.76,
  control_reseller_price_ht numeric(10, 2) not null default 47.29,
  control_distributor_price_ht numeric(10, 2) not null default 43.23,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pricing_parameters_tier_order
    check (tier3_qty > tier2_qty),
  constraint pricing_parameters_fee_order
    check (reservation_fee_max >= reservation_fee_min)
);

create unique index if not exists pricing_parameters_one_active
  on public.pricing_parameters (is_active)
  where is_active;

drop trigger if exists pricing_parameters_set_updated_at
  on public.pricing_parameters;
create trigger pricing_parameters_set_updated_at
  before update on public.pricing_parameters
  for each row execute function public.set_updated_at();

insert into public.pricing_parameters (
  version,
  label,
  is_active
) values (
  1,
  'Phase 1 default hub-and-ship parameters',
  true
)
on conflict (version) do update set
  label = excluded.label,
  is_active = excluded.is_active,
  updated_at = now();

alter table public.pricing_parameters enable row level security;

drop policy if exists "Admins full access pricing parameters"
  on public.pricing_parameters;
create policy "Admins full access pricing parameters"
  on public.pricing_parameters for all
  using (public.current_user_role() in ('admin', 'super_admin'))
  with check (public.current_user_role() in ('admin', 'super_admin'));

revoke all on table public.pricing_parameters from anon, public, authenticated;
grant select, insert, update, delete
  on public.pricing_parameters to authenticated;

alter table public.products
  add column if not exists fob_usd numeric(12, 4)
    check (fob_usd is null or fob_usd >= 0),
  add column if not exists qty_per_container int
    check (qty_per_container is null or qty_per_container > 0),
  add column if not exists is_loss_leader boolean not null default false,
  add column if not exists table_price_modifier_rate numeric(8, 4)
    check (table_price_modifier_rate is null or table_price_modifier_rate > -1);

alter table public.reservation_items
  add column if not exists pricing_channel public.pricing_channel,
  add column if not exists unit_landed_cost_ht numeric(10, 2),
  add column if not exists pricing_tier_applied text,
  add column if not exists pricing_parameters_snapshot jsonb
    not null default '{}'::jsonb;

-- The companion partner price table exists in the migration history, but some
-- live environments may not have applied it yet. Keep this block compatible
-- with that earlier definition so pricing phase 1 can be applied safely.
create table if not exists public.product_partner_prices (
  product_id text primary key references public.products(id) on delete cascade,
  net_price_ht numeric(10, 2) not null default 0
    check (net_price_ht >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists product_partner_prices_set_updated_at
  on public.product_partner_prices;
create trigger product_partner_prices_set_updated_at
  before update on public.product_partner_prices
  for each row execute function public.set_updated_at();

alter table public.product_partner_prices enable row level security;

drop policy if exists "Admins full access product partner prices"
  on public.product_partner_prices;
create policy "Admins full access product partner prices"
  on public.product_partner_prices for all
  using (public.current_user_role() in ('admin', 'super_admin'))
  with check (public.current_user_role() in ('admin', 'super_admin'));

drop policy if exists "Partners read active net prices"
  on public.product_partner_prices;
create policy "Partners read active net prices"
  on public.product_partner_prices for select
  to authenticated
  using (
    is_active
    and exists (select 1 from public.current_partner_application_ids())
  );

revoke all on table public.product_partner_prices from anon, public, authenticated;
grant select, insert, update, delete
  on public.product_partner_prices to authenticated;

alter table public.product_partner_prices
  add column if not exists partner_application_id uuid
    references public.partner_applications(id) on delete cascade,
  add column if not exists override_reason text,
  add column if not exists formula_price_ht numeric(10, 2),
  add column if not exists min_margin_floor numeric(8, 4),
  add column if not exists checked_at timestamptz,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

create unique index if not exists product_partner_prices_product_partner_idx
  on public.product_partner_prices (product_id, partner_application_id)
  where partner_application_id is not null;

comment on table public.pricing_parameters is
  'Versioned authoritative pricing settings. Phase 1 keeps it admin-only and uses get_price for shadow comparison before checkout migration.';
comment on column public.products.fob_usd is
  'Manual source-of-truth product FOB cost in USD from the quote sheet.';
comment on column public.products.qty_per_container is
  'Manual source-of-truth units per 40HC container. CBM-derived quantity is only a warning, never an automatic overwrite.';
comment on column public.products.is_loss_leader is
  'Admin-only business flag. get_price restricts loss leaders to direct channel, minimum lot and no tier stacking.';
comment on column public.products.table_price_modifier_rate is
  'Future replacement for hardcoded table configurator modifiers.';
comment on column public.product_partner_prices.partner_application_id is
  'When set, this row is a traced override for one product and one partner application. Null rows are legacy global partner prices.';
comment on column public.product_partner_prices.override_reason is
  'Required business reason for partner override changes once the admin UI writes per-partner overrides.';

create or replace function public.active_pricing_parameters(p_at timestamptz default now())
returns public.pricing_parameters
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select pp
  from public.pricing_parameters pp
  where pp.is_active
    and pp.effective_from <= p_at
  order by pp.version desc
  limit 1;
$$;

create or replace function public.calculate_product_landed_cost_ht(
  p_product_id text,
  p_at timestamptz default now()
)
returns numeric
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_product public.products%rowtype;
  v_params public.pricing_parameters%rowtype;
begin
  select * into v_product
  from public.products
  where id = p_product_id;

  if not found then
    raise exception 'calculate_product_landed_cost_ht: unknown product %', p_product_id;
  end if;

  v_params := public.active_pricing_parameters(p_at);
  if v_params.id is null then
    raise exception 'calculate_product_landed_cost_ht: no active pricing parameters';
  end if;

  if v_product.fob_usd is not null and v_product.qty_per_container is not null then
    return round(
      (
        v_product.fob_usd * v_params.fx_usd_eur *
          (1 + v_params.customs_rate + v_params.import_insurance_rate)
      )
      + (v_params.freight_eur_40hc / v_product.qty_per_container)
      + v_params.fixed_import_fee_eur,
      2
    );
  end if;

  -- Shadow fallback while cost fields are being backfilled. This keeps
  -- get_price usable without changing the current checkout truth source.
  return round(v_product.base_price_ht / (1 + v_params.direct_margin_rate), 2);
end;
$$;

create or replace function public.get_price(
  p_product_id text,
  p_channel public.pricing_channel default 'direct',
  p_quantity int default 1,
  p_partner_application_id uuid default null,
  p_at timestamptz default now()
)
returns table (
  product_id text,
  channel public.pricing_channel,
  quantity int,
  landed_cost_ht numeric,
  formula_price_ht numeric,
  override_price_ht numeric,
  unit_price_ht numeric,
  tier_applied text,
  parameters_version int,
  parameters_snapshot jsonb
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_product public.products%rowtype;
  v_params public.pricing_parameters%rowtype;
  v_landed numeric;
  v_base numeric;
  v_tier text := 'none';
  v_formula numeric;
  v_floor numeric;
  v_override numeric;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'get_price: quantity must be positive';
  end if;

  select * into v_product
  from public.products
  where id = p_product_id and is_active;

  if not found then
    raise exception 'get_price: unknown or inactive product %', p_product_id;
  end if;

  v_params := public.active_pricing_parameters(p_at);
  if v_params.id is null then
    raise exception 'get_price: no active pricing parameters';
  end if;

  v_landed := public.calculate_product_landed_cost_ht(p_product_id, p_at);
  v_floor := round(v_landed * (1 + v_params.min_margin_floor), 2);

  if p_channel = 'reseller' then
    v_base := v_landed * (1 + v_params.reseller_margin_rate);
  elsif p_channel = 'distributor' then
    v_base := v_landed * (1 + v_params.distributor_margin_rate);
  else
    v_base := v_landed * (1 + v_params.direct_margin_rate);
  end if;

  if p_channel = 'direct'
    and v_product.is_loss_leader
    and p_quantity >= v_params.loss_leader_min_lot then
    v_base := v_floor;
    v_tier := 'loss_leader';
  elsif p_channel = 'direct' and p_quantity >= v_params.tier3_qty then
    v_base := v_base * (1 - v_params.tier3_discount);
    v_tier := 'tier3';
  elsif p_channel = 'direct' and p_quantity >= v_params.tier2_qty then
    v_base := v_base * (1 - v_params.tier2_discount);
    v_tier := 'tier2';
  end if;

  v_formula := greatest(round(v_base, 2), v_floor);

  if p_channel in ('reseller', 'distributor') then
    select ppp.net_price_ht
      into v_override
    from public.product_partner_prices ppp
    where ppp.product_id = p_product_id
      and ppp.is_active
      and (
        (p_partner_application_id is not null
          and ppp.partner_application_id = p_partner_application_id)
        or ppp.partner_application_id is null
      )
    order by (ppp.partner_application_id is not null) desc, ppp.updated_at desc
    limit 1;

    if v_override is not null and v_override < v_floor then
      raise exception 'get_price: partner override below minimum margin floor for product %', p_product_id;
    end if;
  end if;

  return query
  select
    p_product_id,
    p_channel,
    p_quantity,
    v_landed,
    v_formula,
    v_override,
    coalesce(v_override, v_formula),
    v_tier,
    v_params.version,
    jsonb_build_object(
      'version', v_params.version,
      'fx_usd_eur', v_params.fx_usd_eur,
      'freight_eur_40hc', v_params.freight_eur_40hc,
      'customs_rate', v_params.customs_rate,
      'import_insurance_rate', v_params.import_insurance_rate,
      'fixed_import_fee_eur', v_params.fixed_import_fee_eur,
      'direct_margin_rate', v_params.direct_margin_rate,
      'reseller_margin_rate', v_params.reseller_margin_rate,
      'distributor_margin_rate', v_params.distributor_margin_rate,
      'min_margin_floor', v_params.min_margin_floor,
      'tier2_qty', v_params.tier2_qty,
      'tier2_discount', v_params.tier2_discount,
      'tier3_qty', v_params.tier3_qty,
      'tier3_discount', v_params.tier3_discount,
      'loss_leader_min_lot', v_params.loss_leader_min_lot
    );
end;
$$;

create or replace function public.enforce_product_partner_price_floor()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_landed numeric;
  v_params public.pricing_parameters%rowtype;
  v_floor numeric;
begin
  if coalesce(new.net_price_ht, 0) <= 0 or not coalesce(new.is_active, true) then
    return new;
  end if;

  v_params := public.active_pricing_parameters(now());
  v_landed := public.calculate_product_landed_cost_ht(new.product_id, now());
  v_floor := round(v_landed * (1 + v_params.min_margin_floor), 2);

  if new.net_price_ht < v_floor then
    raise exception 'product_partner_prices: override %.2f below minimum floor %.2f for product %',
      new.net_price_ht, v_floor, new.product_id;
  end if;

  new.formula_price_ht := coalesce(
    new.formula_price_ht,
    (select formula_price_ht from public.get_price(
      new.product_id,
      'reseller'::public.pricing_channel,
      1,
      new.partner_application_id,
      now()
    ))
  );
  new.min_margin_floor := v_params.min_margin_floor;
  new.checked_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);

  return new;
end;
$$;

drop trigger if exists product_partner_prices_enforce_floor
  on public.product_partner_prices;
create trigger product_partner_prices_enforce_floor
  before insert or update of net_price_ht, is_active, product_id, partner_application_id
  on public.product_partner_prices
  for each row execute function public.enforce_product_partner_price_floor();

create or replace function public.enforce_max_loss_leaders()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_max int;
  v_count int;
begin
  if not coalesce(new.is_loss_leader, false) or not coalesce(new.is_active, true) then
    return new;
  end if;

  select max_loss_leaders
    into v_max
  from public.pricing_parameters
  where is_active
  order by version desc
  limit 1;

  select count(*)
    into v_count
  from public.products
  where is_loss_leader
    and is_active
    and id <> new.id;

  if v_count >= coalesce(v_max, 5) then
    raise exception 'products: maximum active loss leaders reached (%)', coalesce(v_max, 5);
  end if;

  return new;
end;
$$;

drop trigger if exists products_enforce_max_loss_leaders
  on public.products;
create trigger products_enforce_max_loss_leaders
  before insert or update of is_loss_leader, is_active
  on public.products
  for each row execute function public.enforce_max_loss_leaders();

create or replace view public.product_pricing_readiness as
select
  p.id,
  p.sku,
  p.name,
  p.fob_usd,
  p.qty_per_container,
  p.cbm_per_unit,
  round(pp.useful_container_cbm_40hc / nullif(p.cbm_per_unit, 0))::int
    as indicative_qty_per_container_from_cbm,
  case
    when p.qty_per_container is null or p.cbm_per_unit <= 0 then null
    else abs(
      p.qty_per_container
      - round(pp.useful_container_cbm_40hc / nullif(p.cbm_per_unit, 0))::int
    )::numeric / greatest(p.qty_per_container, 1)
  end as qty_container_delta_ratio,
  case
    when p.qty_per_container is null or p.cbm_per_unit <= 0 then false
    else (
      abs(
        p.qty_per_container
        - round(pp.useful_container_cbm_40hc / nullif(p.cbm_per_unit, 0))::int
      )::numeric / greatest(p.qty_per_container, 1)
    ) > 0.15
  end as needs_qty_container_review
from public.products p
cross join lateral (
  select useful_container_cbm_40hc
  from public.pricing_parameters
  where is_active
  order by version desc
  limit 1
) pp;

revoke all on table public.product_pricing_readiness from anon, public, authenticated;
revoke all on function public.active_pricing_parameters(timestamptz) from public, anon, authenticated;
revoke all on function public.calculate_product_landed_cost_ht(text, timestamptz) from public, anon, authenticated;
revoke all on function public.get_price(text, public.pricing_channel, int, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.enforce_product_partner_price_floor() from public, anon, authenticated;
revoke all on function public.enforce_max_loss_leaders() from public, anon, authenticated;

grant execute on function public.get_price(text, public.pricing_channel, int, uuid, timestamptz)
  to authenticated;
grant select on public.product_pricing_readiness to authenticated;

comment on function public.get_price(text, public.pricing_channel, int, uuid, timestamptz) is
  'Shadow pricing engine. Control fixture with landed_cost=33.78 yields direct=64.18, direct tier2=60.33, direct tier3=57.76, reseller=47.29, distributor=43.23.';
