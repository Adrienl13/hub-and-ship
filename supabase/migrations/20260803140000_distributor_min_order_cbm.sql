-- Minimum de commande distributeur (décision 08/2026).
--
-- Les prix distributeur (marge +28 % sur coût) ne sont viables qu'au volume :
-- une commande de 50 unités à prix distributeur ferait perdre l'avantage du
-- fret mutualisé. Règle : une commande distributeur doit remplir au moins un
-- 20' GP utile (28 m³) — paramétrable, NULL = règle désactivée.
--
-- 1) pricing_parameters.distributor_min_order_cbm (numeric, nullable).
--    Les lignes actives passent à 28 (volume utile d'un 20' GP, constante
--    métier déjà utilisée par le front) — l'admin peut l'ajuster ou le vider.
-- 2) Trigger BEFORE INSERT sur reservations : bloque toute réservation d'une
--    société canal 'distributeur' sous le seuil. Garde SERVEUR : le front
--    affiche la règle, le trigger l'impose quel que soit le chemin d'écriture.
--    Bypass admin (commandes d'échantillons passées par l'équipe).
-- 3) admin_save_pricing_parameters ré-émis : la nouvelle colonne (et les
--    frets 20'/40' GP de la migration 20) sont portés de version en version.

-- ---------------------------------------------------------------------------
-- 1. Colonne + valeur initiale.
-- ---------------------------------------------------------------------------
alter table public.pricing_parameters
  add column if not exists distributor_min_order_cbm numeric null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'pricing_parameters_distributor_min_chk'
  ) then
    alter table public.pricing_parameters
      add constraint pricing_parameters_distributor_min_chk check (
        distributor_min_order_cbm is null or distributor_min_order_cbm >= 0
      );
  end if;
end $$;

-- Volume utile d'un 20' GP — même valeur que CONTAINER_USABLE_CBM['20_dv']
-- côté front. Uniquement si jamais renseigné (rejouable sans écraser un
-- ajustement admin).
update public.pricing_parameters
set distributor_min_order_cbm = 28
where is_active and distributor_min_order_cbm is null;

-- ---------------------------------------------------------------------------
-- 2. Garde serveur sur les réservations distributeur.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_distributor_order_minimum()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_channel public.sales_channel;
  v_min_cbm numeric;
begin
  -- L'équipe peut passer des commandes hors règle (échantillons, SAV).
  if public.is_admin() then
    return new;
  end if;

  select c.channel into v_channel
  from public.companies c
  where c.id = public.current_company_id();

  if v_channel is distinct from 'distributeur' then
    return new;
  end if;

  select p.distributor_min_order_cbm into v_min_cbm
  from public.pricing_parameters p
  where p.is_active
  order by p.effective_from desc
  limit 1;

  if v_min_cbm is not null
     and coalesce(new.total_cbm, 0) < v_min_cbm then
    raise exception
      'Commande distributeur : minimum % m³ (un 20'' GP) — volume actuel % m³. Complétez la commande ou contactez-nous.',
      v_min_cbm, coalesce(new.total_cbm, 0)
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists reservations_enforce_distributor_minimum
  on public.reservations;
create trigger reservations_enforce_distributor_minimum
  before insert on public.reservations
  for each row execute function public.enforce_distributor_order_minimum();

-- ---------------------------------------------------------------------------
-- 3. RPC de sauvegarde versionnée : porte la nouvelle colonne.
--    (Copie de la version migration 20, + distributor_min_order_cbm avec la
--    même sémantique nullable : champ absent = inchangé, null = effacé.)
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
    freight_eur_20gp, freight_eur_40gp, distributor_min_order_cbm,
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
    case when payload ? 'freight_eur_20gp'
      then (payload ->> 'freight_eur_20gp')::numeric
      else v_active.freight_eur_20gp end,
    case when payload ? 'freight_eur_40gp'
      then (payload ->> 'freight_eur_40gp')::numeric
      else v_active.freight_eur_40gp end,
    case when payload ? 'distributor_min_order_cbm'
      then (payload ->> 'distributor_min_order_cbm')::numeric
      else v_active.distributor_min_order_cbm end,
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
