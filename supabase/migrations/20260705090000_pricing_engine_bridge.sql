-- FUSION P2 — pont vers le moteur de prix data-driven + retrait parrainage B2C.
--
-- 1) Rapatrie dans le repo le moteur de prix « landed cost » présent en prod
--    (pricing_parameters / product_pricing_inputs / product_partner_prices,
--    créés par des migrations non commitées). Tout est `if not exists` :
--    no-op en prod, création propre sur une base neuve (CI / preview).
-- 2) get_catalogue_prices() dérive désormais les coefficients canaux des
--    marges ACTIVES (direct +90 %, revendeur +40 %, distributeur +28 %) au
--    lieu de la table statique channel_coefficients (conservée en fallback).
--    La règle d'or (décision #1) est clampée en lecture : un coefficient
--    revendeur/distributeur ne peut jamais atteindre le pire prix direct.
-- 3) Retire le parrainage B2C −100 € (décision : l'apporteur 8 % le remplace).
--    Kill switch data-only, réversible depuis l'onglet admin Parrainage.

-- ---------------------------------------------------------------------------
-- 1a. pricing_parameters — paramètres versionnés du moteur (1 ligne active).
--     Marges + paliers volume + frais de réservation + programme apporteur +
--     valeurs de contrôle (SKU témoin) pour détecter toute dérive de formule.
-- ---------------------------------------------------------------------------
create table if not exists public.pricing_parameters (
  id uuid primary key default extensions.gen_random_uuid(),
  version integer not null unique,
  label text not null,
  is_active boolean not null default false,
  effective_from timestamptz not null default now(),
  fx_usd_eur numeric not null default 0.92,
  freight_eur_40hc numeric not null default 4500,
  useful_container_cbm_40hc numeric not null default 76,
  customs_rate numeric not null default 0,
  import_insurance_rate numeric not null default 0,
  fixed_import_fee_eur numeric not null default 0,
  direct_margin_rate numeric not null default 0.90,
  reseller_margin_rate numeric not null default 0.40,
  distributor_margin_rate numeric not null default 0.28,
  min_margin_floor numeric not null default 0.15,
  tier2_qty integer not null default 100,
  tier2_discount numeric not null default 0.06,
  tier3_qty integer not null default 150,
  tier3_discount numeric not null default 0.10,
  max_loss_leaders integer not null default 5,
  loss_leader_min_lot integer not null default 16,
  reservation_fee_rate numeric not null default 0.03,
  reservation_fee_min numeric not null default 150,
  reservation_fee_max numeric not null default 500,
  referrer_commission_rate numeric not null default 0.08,
  referrer_duration_months integer not null default 12,
  control_sku text not null default 'ZF2000C',
  control_landed_cost_ht numeric not null default 33.78,
  control_direct_price_ht numeric not null default 64.18,
  control_direct_tier2_price_ht numeric not null default 60.33,
  control_direct_tier3_price_ht numeric not null default 57.76,
  control_reseller_price_ht numeric not null default 47.29,
  control_distributor_price_ht numeric not null default 43.23,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Une seule version active à la fois.
create unique index if not exists pricing_parameters_single_active_idx
  on public.pricing_parameters ((true))
  where is_active;

-- Amorce une base neuve avec les défauts (no-op si la prod a déjà ses lignes).
insert into public.pricing_parameters (version, label, is_active)
select 1, 'v1 — paramètres par défaut (fusion)', true
where not exists (select 1 from public.pricing_parameters);

-- ---------------------------------------------------------------------------
-- 1b. product_pricing_inputs — coûts par produit (FOB USD, qté/container).
--     product_id est le SKU catalogue (text), pas l'uuid products.id.
-- ---------------------------------------------------------------------------
create table if not exists public.product_pricing_inputs (
  product_id text primary key,
  fob_usd numeric,
  qty_per_container integer,
  is_loss_leader boolean not null default false,
  table_price_modifier_rate numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 1c. product_partner_prices — prix nets partenaires calculés/écrasés.
-- ---------------------------------------------------------------------------
create table if not exists public.product_partner_prices (
  product_id text primary key,
  net_price_ht numeric not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  partner_application_id uuid references public.partner_applications(id)
    on delete set null,
  override_reason text,
  formula_price_ht numeric,
  min_margin_floor numeric,
  checked_at timestamptz,
  created_by uuid,
  updated_by uuid
);

-- RLS : marges et coûts d'import ne sont JAMAIS lisibles publiquement
-- (décision #4). Admin uniquement ; les lectures applicatives passent par des
-- RPC security definer ou le client service-role côté serveur.
alter table public.pricing_parameters enable row level security;
alter table public.product_pricing_inputs enable row level security;
alter table public.product_partner_prices enable row level security;

drop policy if exists "Admins manage pricing parameters"
  on public.pricing_parameters;
create policy "Admins manage pricing parameters"
  on public.pricing_parameters
  for all
  using (public.current_user_role() in ('admin', 'super_admin'))
  with check (public.current_user_role() in ('admin', 'super_admin'));

drop policy if exists "Admins manage product pricing inputs"
  on public.product_pricing_inputs;
create policy "Admins manage product pricing inputs"
  on public.product_pricing_inputs
  for all
  using (public.current_user_role() in ('admin', 'super_admin'))
  with check (public.current_user_role() in ('admin', 'super_admin'));

drop policy if exists "Admins manage product partner prices"
  on public.product_partner_prices;
create policy "Admins manage product partner prices"
  on public.product_partner_prices
  for all
  using (public.current_user_role() in ('admin', 'super_admin'))
  with check (public.current_user_role() in ('admin', 'super_admin'));

-- ---------------------------------------------------------------------------
-- 2. get_catalogue_prices() v2 — coefficients dérivés des marges actives.
--    Ordre de résolution inchangé : override → base × coefficient → base.
--    grand_compte = pire prix direct (1 − tier3_discount) d'office.
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
  v_direct_margin numeric;
  v_reseller_margin numeric;
  v_distributor_margin numeric;
  v_tier3 numeric;
  v_worst_direct numeric;
  v_coeff numeric;
begin
  select c.channel into v_channel
  from public.companies c
  where c.id = public.current_company_id();

  if v_channel is null then
    v_channel := 'direct';
  end if;

  select p.direct_margin_rate, p.reseller_margin_rate,
         p.distributor_margin_rate, p.tier3_discount
    into v_direct_margin, v_reseller_margin, v_distributor_margin, v_tier3
  from public.pricing_parameters p
  where p.is_active
  order by p.effective_from desc
  limit 1;

  v_worst_direct := 1 - coalesce(v_tier3, 0.10);

  if v_direct_margin is not null and v_direct_margin > -1 then
    -- Moteur data-driven : coefficient = (1 + marge canal) / (1 + marge direct).
    v_coeff := case v_channel
      when 'revendeur'
        then round((1 + v_reseller_margin) / (1 + v_direct_margin), 4)
      when 'distributeur'
        then round((1 + v_distributor_margin) / (1 + v_direct_margin), 4)
      else 1.0
    end;
  else
    -- Fallback : seed statique (repo sans paramètres actifs).
    select coefficient into v_coeff
    from public.channel_coefficients where channel = v_channel;
  end if;

  if v_coeff is null then
    v_coeff := 1.0;
  end if;

  -- Règle d'or (décision #1) : un prix revendeur/distributeur reste STRICTEMENT
  -- sous le pire prix direct, même si les marges sont mal configurées.
  if v_channel in ('revendeur', 'distributeur')
     and v_coeff >= v_worst_direct then
    v_coeff := round(v_worst_direct - 0.0001, 4);
  end if;

  return query
  select
    p.id,
    round(
      coalesce(
        o.unit_price_ht,
        case
          when v_channel = 'grand_compte' then p.base_price_ht * v_worst_direct
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

comment on function public.get_catalogue_prices() is
  'Returns resolved unit_price_ht per product for the caller''s sales channel only (anon = direct). Coefficients derive from the active pricing_parameters margins; channel_coefficients is the fallback. Other channels prices never leave the server.';

-- Le garde-fou des overrides dérive aussi son facteur du palier 3 actif.
create or replace function public.enforce_override_golden_rule()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_base numeric;
  v_worst_direct numeric;
begin
  if new.channel in ('revendeur', 'distributeur') then
    select 1 - coalesce(
      (select p.tier3_discount from public.pricing_parameters p
       where p.is_active order by p.effective_from desc limit 1),
      0.10
    ) into v_worst_direct;

    select base_price_ht into v_base
    from public.products where id = new.product_id;
    if v_base is not null
       and new.unit_price_ht >= round(v_base * v_worst_direct, 2) then
      raise exception
        'channel_price_override violates the golden rule: % >= worst direct price %',
        new.unit_price_ht, round(v_base * v_worst_direct, 2)
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Retrait du parrainage B2C −100 € : le programme apporteur (8 % sur CA
--    encaissé, 12 mois) le remplace. Données conservées, réversible.
-- ---------------------------------------------------------------------------
update public.referral_program_settings
set is_active = false
where id = true and is_active;
