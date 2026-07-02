-- LOT 4 — Multi-channel pricing foundation.
--
-- The sales channel is an admin-attributed account attribute (decision #2 —
-- never self-service). Prices resolve server-side per channel via the
-- get_catalogue_prices() RPC so a client only ever receives THEIR channel's
-- resolved price (decision #4): channel_price_overrides and channel_coefficients
-- have NO public SELECT policy, and the security-definer RPC is the only reader.
--
-- Golden rule (decision #1): the worst direct price (max volume discount, −10%)
-- must stay STRICTLY greater than any reseller price. Enforced here both by a
-- trigger on channel_price_overrides and by the coefficient seed, and covered by
-- a permanent unit test.

do $$ begin
  create type public.sales_channel as enum
    ('direct', 'revendeur', 'distributeur', 'grand_compte');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- companies.channel — admin-set only.
-- ---------------------------------------------------------------------------
alter table public.companies
  add column if not exists channel public.sales_channel not null default 'direct',
  add column if not exists channel_set_by uuid references auth.users(id),
  add column if not exists channel_set_at timestamptz;

-- Column-level authorization: RLS is row-level, so a trigger guards the channel
-- columns. Non-admins cannot change them; admins' changes auto-stamp who/when.
create or replace function public.enforce_company_channel_admin_only()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.channel is distinct from old.channel
     or new.channel_set_by is distinct from old.channel_set_by
     or new.channel_set_at is distinct from old.channel_set_at then
    if not public.is_admin() then
      raise exception 'channel can only be changed by an admin'
        using errcode = '42501';
    end if;
    new.channel_set_by := auth.uid();
    new.channel_set_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists companies_enforce_channel_admin on public.companies;
create trigger companies_enforce_channel_admin
  before update on public.companies
  for each row execute function public.enforce_company_channel_admin_only();

-- ---------------------------------------------------------------------------
-- channel_coefficients — base_price_ht × coefficient, per channel.
-- Derived from the markup-on-cost grid (direct +90%, revendeur +40%,
-- distributeur +28%). grand_compte stays 1.0000 — its −10% edge is applied in
-- logic, not via the coefficient.
-- ---------------------------------------------------------------------------
create table if not exists public.channel_coefficients (
  channel public.sales_channel primary key,
  coefficient numeric(6, 4) not null check (coefficient > 0 and coefficient <= 1)
);

insert into public.channel_coefficients (channel, coefficient) values
  ('direct', 1.0000),
  ('revendeur', 0.7368),
  ('distributeur', 0.6737),
  ('grand_compte', 1.0000)
on conflict (channel) do nothing;

-- ---------------------------------------------------------------------------
-- channel_price_overrides — explicit per-product, per-channel price.
-- ---------------------------------------------------------------------------
create table if not exists public.channel_price_overrides (
  id uuid primary key default extensions.gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  channel public.sales_channel not null,
  unit_price_ht numeric(10, 2) not null check (unit_price_ht > 0),
  unique (product_id, channel)
);

-- Golden-rule guard: a reseller override must stay strictly below the worst
-- direct price (base × 0.90). Rejects a bad override at write time.
create or replace function public.enforce_override_golden_rule()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_base numeric;
begin
  if new.channel in ('revendeur', 'distributeur') then
    select base_price_ht into v_base
    from public.products where id = new.product_id;
    if v_base is not null and new.unit_price_ht >= round(v_base * 0.90, 2) then
      raise exception
        'channel_price_override violates the golden rule: % >= worst direct price %',
        new.unit_price_ht, round(v_base * 0.90, 2)
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists channel_price_overrides_golden_rule
  on public.channel_price_overrides;
create trigger channel_price_overrides_golden_rule
  before insert or update on public.channel_price_overrides
  for each row execute function public.enforce_override_golden_rule();

-- ---------------------------------------------------------------------------
-- RLS: overrides + coefficients are admin-managed and NEVER publicly readable
-- (decision #4). The security-definer RPC below is the only reader for anon /
-- authenticated callers.
-- ---------------------------------------------------------------------------
alter table public.channel_coefficients enable row level security;
alter table public.channel_price_overrides enable row level security;

drop policy if exists "Admins manage channel coefficients"
  on public.channel_coefficients;
create policy "Admins manage channel coefficients"
  on public.channel_coefficients
  for all
  using (public.current_user_role() in ('admin', 'super_admin'))
  with check (public.current_user_role() in ('admin', 'super_admin'));

drop policy if exists "Admins manage channel price overrides"
  on public.channel_price_overrides;
create policy "Admins manage channel price overrides"
  on public.channel_price_overrides
  for all
  using (public.current_user_role() in ('admin', 'super_admin'))
  with check (public.current_user_role() in ('admin', 'super_admin'));

create index if not exists channel_price_overrides_channel_idx
  on public.channel_price_overrides (channel);

-- ---------------------------------------------------------------------------
-- get_catalogue_prices() — resolve the caller's channel prices only.
-- Resolution order: override → base × coefficient → base. grand_compte gets the
-- max direct tier (−10%) d'office. anon / no company → direct.
-- ---------------------------------------------------------------------------
create or replace function public.get_catalogue_prices()
returns table (product_id uuid, unit_price_ht numeric)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_channel public.sales_channel;
  v_coeff numeric;
begin
  select c.channel into v_channel
  from public.companies c
  where c.id = public.current_company_id();

  if v_channel is null then
    v_channel := 'direct';
  end if;

  select coefficient into v_coeff
  from public.channel_coefficients where channel = v_channel;
  if v_coeff is null then
    v_coeff := 1.0;
  end if;

  return query
  select
    p.id,
    round(
      coalesce(
        o.unit_price_ht,
        case
          when v_channel = 'grand_compte' then p.base_price_ht * 0.90
          else p.base_price_ht * v_coeff
        end
      ),
      2
    )
  from public.products p
  left join public.channel_price_overrides o
    on o.product_id = p.id and o.channel = v_channel
  where p.is_active = true;
end;
$$;

revoke execute on function public.get_catalogue_prices() from public;
grant execute on function public.get_catalogue_prices() to anon, authenticated;

-- current_channel() — the caller's own channel (anon = direct). Used by the UI
-- to show the "Tarif <canal> actif" badge and gate volume discounts. A caller
-- can only ever learn their OWN channel, never anyone else's.
create or replace function public.current_channel()
returns public.sales_channel
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(
    (select channel from public.companies where id = public.current_company_id()),
    'direct'::public.sales_channel
  );
$$;

revoke execute on function public.current_channel() from public;
grant execute on function public.current_channel() to anon, authenticated;

comment on function public.get_catalogue_prices() is
  'Returns resolved unit_price_ht per product for the caller''s sales channel only (anon = direct). Other channels prices never leave the server.';
comment on column public.companies.channel is
  'Sales channel (admin-attributed only, enforced by trigger). Drives per-channel price resolution.';
