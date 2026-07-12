-- Garde-fous d'intégrité pricing (audit global M1/M2/M9).
--
-- M2 : bornes DB sur pricing_parameters — une typo admin (tier3 ≤ tier2,
--      remise > 100 %, min > max, taux négatif) ne peut plus publier de prix
--      incohérents ou négatifs, quel que soit le chemin d'écriture (RPC
--      versionné OU update direct de secours).
-- M1 : quand base_price_ht change (reprice, ajustement ciblé, édition manuelle),
--      les overrides canaux qui violent désormais la règle d'or (ou passent
--      sous le plancher) sont automatiquement purgés — plus de prix revendeur
--      supérieur au prix public par effet de bord.
-- M9 : plancher de marge appliqué au niveau SQL sur les prix nets partenaires
--      (channel_price_overrides ET product_partner_prices) quand les coûts
--      réels existent — le front n'avertissait qu'en orange non bloquant.

-- ---------------------------------------------------------------------------
-- M2 — bornes de cohérence sur pricing_parameters (CHECK, tous chemins).
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'pricing_parameters_bounds_chk'
  ) then
    -- NOT VALID : la contrainte s'applique à TOUTE écriture future (le but de
    -- M2, empêcher une typo admin) sans rescanner les lignes existantes — la
    -- migration s'applique donc proprement quelle que soit la donnée en place.
    alter table public.pricing_parameters
      add constraint pricing_parameters_bounds_chk check (
        fx_usd_eur > 0
        and customs_rate >= 0 and customs_rate < 1
        and import_insurance_rate >= 0 and import_insurance_rate < 1
        and fixed_import_fee_eur >= 0
        and freight_eur_40hc >= 0
        and direct_margin_rate > -1
        and reseller_margin_rate > -1
        and distributor_margin_rate > -1
        and min_margin_floor >= 0
        and tier2_qty > 0
        and tier3_qty > tier2_qty
        and tier2_discount >= 0 and tier2_discount < 1
        and tier3_discount >= tier2_discount and tier3_discount < 1
        and reservation_fee_rate >= 0 and reservation_fee_rate < 1
        and reservation_fee_min >= 0
        and reservation_fee_max >= reservation_fee_min
      ) not valid;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- M9 — helper : plancher de marge d'un produit quand les coûts réels existent.
-- Retourne NULL quand le FOB n'est pas saisi (plancher non contraignant).
-- ---------------------------------------------------------------------------
create or replace function public.product_hard_margin_floor(p_product_id text)
returns numeric
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_has_costs boolean;
  v_landed numeric;
  v_floor_rate numeric;
begin
  select (fob_usd is not null and qty_per_container is not null)
    into v_has_costs
  from public.product_pricing_inputs
  where product_id = p_product_id;

  if v_has_costs is not true then
    return null;
  end if;

  v_landed := public.calculate_product_landed_cost_ht(p_product_id);
  select coalesce(min_margin_floor, 0) into v_floor_rate
  from public.pricing_parameters
  where is_active order by effective_from desc limit 1;

  return round(v_landed * (1 + coalesce(v_floor_rate, 0)), 2);
end;
$$;

-- Le plancher révèle indirectement le coût rendu (décision #4) : appelable
-- UNIQUEMENT en interne par les triggers (security definer). Aucun accès direct.
revoke execute on function public.product_hard_margin_floor(text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- M9 — golden rule + plancher sur channel_price_overrides (à l'écriture).
-- ---------------------------------------------------------------------------
create or replace function public.enforce_override_golden_rule()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_base numeric;
  v_worst_direct numeric;
  v_floor numeric;
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

  -- Plancher de marge : un prix net sous le coût rendu + marge mini fait
  -- perdre de l'argent. Contraignant uniquement si les coûts réels existent.
  v_floor := public.product_hard_margin_floor(new.product_id);
  if v_floor is not null and new.unit_price_ht < v_floor then
    raise exception
      'channel_price_override below margin floor: % < % (landed + min margin)',
      new.unit_price_ht, v_floor
      using errcode = '23514';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- M9 — plancher sur product_partner_prices (table lue par get_price).
-- ---------------------------------------------------------------------------
create or replace function public.enforce_partner_price_floor()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_floor numeric;
begin
  if coalesce(new.is_active, true) and coalesce(new.net_price_ht, 0) > 0 then
    v_floor := public.product_hard_margin_floor(new.product_id);
    if v_floor is not null and new.net_price_ht < v_floor then
      raise exception
        'product_partner_price below margin floor: % < % (landed + min margin)',
        new.net_price_ht, v_floor
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists product_partner_prices_floor on public.product_partner_prices;
create trigger product_partner_prices_floor
  before insert or update on public.product_partner_prices
  for each row execute function public.enforce_partner_price_floor();

-- ---------------------------------------------------------------------------
-- M1 — purge des overrides devenus invalides quand base_price_ht change.
-- Un override retiré fait retomber le canal sur base × coefficient (sûr).
-- ---------------------------------------------------------------------------
create or replace function public.prune_offending_channel_overrides()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_worst_direct numeric;
  v_floor numeric;
begin
  if new.base_price_ht is not distinct from old.base_price_ht then
    return new;
  end if;

  select 1 - coalesce(
    (select p.tier3_discount from public.pricing_parameters p
     where p.is_active order by p.effective_from desc limit 1),
    0.10
  ) into v_worst_direct;
  v_floor := public.product_hard_margin_floor(new.id);

  delete from public.channel_price_overrides o
  where o.product_id = new.id
    and (
      (o.channel in ('revendeur', 'distributeur')
        and o.unit_price_ht >= round(new.base_price_ht * v_worst_direct, 2))
      or (v_floor is not null and o.unit_price_ht < v_floor)
    );

  return new;
end;
$$;

drop trigger if exists products_prune_overrides on public.products;
create trigger products_prune_overrides
  after update of base_price_ht on public.products
  for each row execute function public.prune_offending_channel_overrides();

comment on function public.prune_offending_channel_overrides() is
  'M1: après un changement de base_price_ht (reprice, ajustement ciblé, édition manuelle), supprime les overrides canaux qui violeraient la règle d''or ou le plancher de marge — le canal retombe alors sur base × coefficient.';
