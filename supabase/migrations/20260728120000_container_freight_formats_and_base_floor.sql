-- Audit rentabilité 07/2026 — formats de container + plancher prix de base.
--
-- 1) Fret par format : le moteur ne connaissait QUE le 40' HC
--    (freight_eur_40hc). Le plan opérationnel démarre en 20' GP (un petit
--    container par mois, consolidé en 40' quand deux 20' s'additionnent) :
--    le fret par unité y est nettement plus cher (~40 % du volume d'un 40'
--    pour ~60-70 % de son prix). On ajoute freight_eur_20gp et
--    freight_eur_40gp, NULLABLE : aucune valeur inventée — l'admin les
--    renseigne depuis ses cotations réelles, et le simulateur de rentabilité
--    affiche « à renseigner » tant qu'elles manquent.
--
-- 2) Plancher sur base_price_ht : les prix nets partenaires étaient déjà
--    bloqués sous le plancher (M9), mais une édition MANUELLE du prix public
--    (products.base_price_ht) pouvait passer sous le coût rendu + marge
--    minimale sans aucun blocage SQL (le front n'avertit qu'en orange).
--    Trigger bloquant quand les coûts réels du produit sont connus.

-- ---------------------------------------------------------------------------
-- 1a. Colonnes de fret par format (nullable, jamais de défaut inventé).
-- ---------------------------------------------------------------------------
alter table public.pricing_parameters
  add column if not exists freight_eur_20gp numeric null,
  add column if not exists freight_eur_40gp numeric null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'pricing_parameters_freight_formats_chk'
  ) then
    alter table public.pricing_parameters
      add constraint pricing_parameters_freight_formats_chk check (
        (freight_eur_20gp is null or freight_eur_20gp >= 0)
        and (freight_eur_40gp is null or freight_eur_40gp >= 0)
      );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1b. Le RPC versionné porte les nouvelles colonnes d'une version à l'autre
--     (sans cela, chaque sauvegarde de paramètres les remettrait à NULL).
--     Copie fidèle de la version P0, + les 2 colonnes de fret.
-- ---------------------------------------------------------------------------
create or replace function public.admin_save_pricing_parameters(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_active public.pricing_parameters%rowtype;
  v_new public.pricing_parameters%rowtype;
  v_control record;
  v_control_product_id text;
begin
  if not public.is_admin() then
    raise exception 'admin_save_pricing_parameters: caller is not admin'
      using errcode = '42501';
  end if;
  if jsonb_typeof(payload) is distinct from 'object' then
    raise exception 'admin_save_pricing_parameters: payload must be an object';
  end if;

  select * into v_active
  from public.pricing_parameters
  where is_active
  order by effective_from desc
  limit 1;
  if v_active.id is null then
    raise exception 'admin_save_pricing_parameters: no active parameters row';
  end if;

  update public.pricing_parameters set is_active = false where id = v_active.id;

  insert into public.pricing_parameters (
    version, label, is_active, effective_from,
    fx_usd_eur, freight_eur_40hc, useful_container_cbm_40hc,
    freight_eur_20gp, freight_eur_40gp,
    customs_rate, import_insurance_rate, fixed_import_fee_eur,
    direct_margin_rate, reseller_margin_rate, distributor_margin_rate,
    min_margin_floor,
    tier2_qty, tier2_discount, tier3_qty, tier3_discount,
    max_loss_leaders, loss_leader_min_lot,
    reservation_fee_rate, reservation_fee_min, reservation_fee_max,
    referrer_commission_rate, referrer_duration_months,
    control_sku, control_landed_cost_ht, control_direct_price_ht,
    control_direct_tier2_price_ht, control_direct_tier3_price_ht,
    control_reseller_price_ht, control_distributor_price_ht,
    created_by
  )
  select
    (select coalesce(max(version), 0) + 1 from public.pricing_parameters),
    coalesce(nullif(payload ->> 'label', ''),
             'v' || (select coalesce(max(version), 0) + 1
                     from public.pricing_parameters) || ' — ajustement admin'),
    true, now(),
    coalesce((payload ->> 'fx_usd_eur')::numeric, v_active.fx_usd_eur),
    coalesce((payload ->> 'freight_eur_40hc')::numeric, v_active.freight_eur_40hc),
    coalesce((payload ->> 'useful_container_cbm_40hc')::numeric, v_active.useful_container_cbm_40hc),
    -- Nullable : payload explicite > valeur active (pas de coalesce simple,
    -- sinon impossible de repasser un fret à NULL — on garde le comportement
    -- « champ absent = inchangé, champ null = effacé »).
    case when payload ? 'freight_eur_20gp'
      then (payload ->> 'freight_eur_20gp')::numeric
      else v_active.freight_eur_20gp end,
    case when payload ? 'freight_eur_40gp'
      then (payload ->> 'freight_eur_40gp')::numeric
      else v_active.freight_eur_40gp end,
    coalesce((payload ->> 'customs_rate')::numeric, v_active.customs_rate),
    coalesce((payload ->> 'import_insurance_rate')::numeric, v_active.import_insurance_rate),
    coalesce((payload ->> 'fixed_import_fee_eur')::numeric, v_active.fixed_import_fee_eur),
    coalesce((payload ->> 'direct_margin_rate')::numeric, v_active.direct_margin_rate),
    coalesce((payload ->> 'reseller_margin_rate')::numeric, v_active.reseller_margin_rate),
    coalesce((payload ->> 'distributor_margin_rate')::numeric, v_active.distributor_margin_rate),
    coalesce((payload ->> 'min_margin_floor')::numeric, v_active.min_margin_floor),
    coalesce((payload ->> 'tier2_qty')::int, v_active.tier2_qty),
    coalesce((payload ->> 'tier2_discount')::numeric, v_active.tier2_discount),
    coalesce((payload ->> 'tier3_qty')::int, v_active.tier3_qty),
    coalesce((payload ->> 'tier3_discount')::numeric, v_active.tier3_discount),
    coalesce((payload ->> 'max_loss_leaders')::int, v_active.max_loss_leaders),
    coalesce((payload ->> 'loss_leader_min_lot')::int, v_active.loss_leader_min_lot),
    coalesce((payload ->> 'reservation_fee_rate')::numeric, v_active.reservation_fee_rate),
    coalesce((payload ->> 'reservation_fee_min')::numeric, v_active.reservation_fee_min),
    coalesce((payload ->> 'reservation_fee_max')::numeric, v_active.reservation_fee_max),
    coalesce((payload ->> 'referrer_commission_rate')::numeric, v_active.referrer_commission_rate),
    coalesce((payload ->> 'referrer_duration_months')::int, v_active.referrer_duration_months),
    v_active.control_sku, v_active.control_landed_cost_ht, v_active.control_direct_price_ht,
    v_active.control_direct_tier2_price_ht, v_active.control_direct_tier3_price_ht,
    v_active.control_reseller_price_ht, v_active.control_distributor_price_ht,
    auth.uid()
  returning * into v_new;

  begin
    select p.id into v_control_product_id
    from public.products p
    where (p.sku = v_new.control_sku or p.id = v_new.control_sku)
      and p.is_active
    order by (p.sku = v_new.control_sku) desc
    limit 1;

    if v_control_product_id is not null then
      select gp.landed_cost_ht, gp.unit_price_ht into v_control
      from public.get_price(v_control_product_id, 'direct', 1) gp;
      if v_control.unit_price_ht is not null then
        update public.pricing_parameters set
          control_landed_cost_ht = v_control.landed_cost_ht,
          control_direct_price_ht = v_control.unit_price_ht,
          control_direct_tier2_price_ht = (
            select unit_price_ht from public.get_price(v_control_product_id, 'direct', v_new.tier2_qty)),
          control_direct_tier3_price_ht = (
            select unit_price_ht from public.get_price(v_control_product_id, 'direct', v_new.tier3_qty)),
          control_reseller_price_ht = (
            select unit_price_ht from public.get_price(v_control_product_id, 'reseller', 1)),
          control_distributor_price_ht = (
            select unit_price_ht from public.get_price(v_control_product_id, 'distributor', 1))
        where id = v_new.id;
      end if;
    end if;
  exception when others then
    null; -- témoin non calculable (coûts manquants) : on garde les anciens.
  end;

  return to_jsonb((select p from public.pricing_parameters p where p.id = v_new.id));
end;
$$;

revoke execute on function public.admin_save_pricing_parameters(jsonb) from public, anon;
grant execute on function public.admin_save_pricing_parameters(jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Plancher SQL sur le prix public (base_price_ht).
--    Bloque toute écriture (édition manuelle, RPC produit, import) qui
--    mettrait le prix public sous coût rendu × (1 + marge minimale), quand
--    les coûts réels (FOB + qté/container) sont renseignés. Le reprice moteur
--    écrit toujours ≥ plancher, il n'est donc jamais gêné.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_base_price_floor()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_floor numeric;
begin
  -- Uniquement quand le prix change (ou insertion) et qu'il est positif.
  if tg_op = 'UPDATE' and new.base_price_ht = old.base_price_ht then
    return new;
  end if;
  if new.base_price_ht is null or new.base_price_ht <= 0 then
    return new; -- fiches incomplètes tolérées : produit non publiable de fait
  end if;

  v_floor := public.product_hard_margin_floor(new.id);
  if v_floor is not null and new.base_price_ht < v_floor then
    raise exception
      'Prix public % € sous le plancher de marge % € (coût rendu + marge minimale) pour %',
      new.base_price_ht, v_floor, new.id
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists products_enforce_base_price_floor on public.products;
create trigger products_enforce_base_price_floor
  before insert or update of base_price_ht on public.products
  for each row execute function public.enforce_base_price_floor();
