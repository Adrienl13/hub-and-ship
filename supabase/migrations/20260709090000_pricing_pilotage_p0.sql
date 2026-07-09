-- Pilotage pricing P0 — l'outil admin devient VRAI (audit AUDIT_PILOTAGE_PRICING).
--
-- P0.1 Recalcul explicite : admin_preview_reprice() (dry-run, diff par
--      produit) + admin_apply_reprice() (écrit base_price_ht depuis le
--      moteur get_price, canal direct qty 1). Rien ne bouge sans clic admin.
-- P0.2 Versioning réel : admin_save_pricing_parameters() crée une NOUVELLE
--      version à chaque sauvegarde (l'historique est immuable) et re-tamponne
--      les valeurs témoin (control_*) au moment du save.
-- P0.3 Garde-fou témoin : check_pricing_control() compare le prix moteur du
--      SKU témoin aux valeurs tamponnées → détection de dérive.
-- P0.4 Une seule source pour paliers volume + frais de réservation :
--      get_public_pricing_rules() (faits publics uniquement — AUCUNE marge,
--      AUCUN coût) + create_reservation_with_items v4 lit les frais depuis
--      les paramètres actifs (fallback grille historique).

-- ---------------------------------------------------------------------------
-- P0.2 — Sauvegarde versionnée des paramètres (+ re-tamponnage du témoin).
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

  -- L'historique est immuable : on désactive l'actif puis on insère une
  -- nouvelle version = valeurs actives écrasées par le payload.
  update public.pricing_parameters set is_active = false where id = v_active.id;

  insert into public.pricing_parameters (
    version, label, is_active, effective_from,
    fx_usd_eur, freight_eur_40hc, useful_container_cbm_40hc,
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

  -- Re-tamponner le témoin avec les NOUVELLES valeurs (si calculable) : la
  -- dérive détectée ensuite ne peut venir que d'une corruption de formule ou
  -- de données, jamais d'un changement volontaire. control_sku peut désigner
  -- un SKU ou directement un id produit (get_price attend un id).
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
-- P0.3 — Vérification du SKU témoin (dérive de formule/données).
-- ---------------------------------------------------------------------------
create or replace function public.check_pricing_control()
returns table (
  control_sku text,
  computable boolean,
  expected_direct_ht numeric,
  actual_direct_ht numeric,
  drift_percent numeric
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_params public.pricing_parameters%rowtype;
  v_actual numeric;
  v_control_product_id text;
begin
  if not public.is_admin() then
    raise exception 'check_pricing_control: caller is not admin'
      using errcode = '42501';
  end if;

  select * into v_params
  from public.pricing_parameters where is_active
  order by effective_from desc limit 1;
  if v_params.id is null then
    return;
  end if;

  -- control_sku peut désigner un SKU ou directement un id produit.
  select p.id into v_control_product_id
  from public.products p
  where (p.sku = v_params.control_sku or p.id = v_params.control_sku)
    and p.is_active
  order by (p.sku = v_params.control_sku) desc
  limit 1;

  begin
    select gp.unit_price_ht into v_actual
    from public.get_price(v_control_product_id, 'direct', 1) gp;
  exception when others then
    v_actual := null;
  end;

  return query select
    v_params.control_sku,
    v_actual is not null,
    v_params.control_direct_price_ht,
    v_actual,
    case
      when v_actual is null or v_params.control_direct_price_ht = 0 then null
      else round(
        (v_actual - v_params.control_direct_price_ht)
          / v_params.control_direct_price_ht * 100, 2)
    end;
end;
$$;

revoke execute on function public.check_pricing_control() from public, anon;
grant execute on function public.check_pricing_control() to authenticated;

-- ---------------------------------------------------------------------------
-- P0.1 — Recalcul explicite : dry-run puis application.
-- ---------------------------------------------------------------------------
create or replace function public.admin_preview_reprice()
returns table (
  product_id text,
  sku text,
  name text,
  has_costs boolean,
  current_price_ht numeric,
  engine_price_ht numeric,
  delta_percent numeric,
  at_margin_floor boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'admin_preview_reprice: caller is not admin'
      using errcode = '42501';
  end if;

  return query
  select
    p.id,
    p.sku,
    p.name,
    (ppi.fob_usd is not null and ppi.qty_per_container is not null) as has_costs,
    p.base_price_ht,
    gp.unit_price_ht,
    case
      when gp.unit_price_ht is null or p.base_price_ht = 0 then null
      else round((gp.unit_price_ht - p.base_price_ht) / p.base_price_ht * 100, 2)
    end,
    coalesce(gp.unit_price_ht <= round(gp.landed_cost_ht * (
      1 + (select pp.min_margin_floor from public.pricing_parameters pp
           where pp.is_active order by pp.effective_from desc limit 1)
    ), 2), false)
  from public.products p
  left join public.product_pricing_inputs ppi on ppi.product_id = p.id
  left join lateral (
    select g.unit_price_ht, g.landed_cost_ht
    from public.get_price(p.id, 'direct', 1) g
    where ppi.fob_usd is not null and ppi.qty_per_container is not null
  ) gp on true
  where p.is_active
  order by p.sort_order, p.id;
end;
$$;

revoke execute on function public.admin_preview_reprice() from public, anon;
grant execute on function public.admin_preview_reprice() to authenticated;

create or replace function public.admin_apply_reprice()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_updated int := 0;
begin
  if not public.is_admin() then
    raise exception 'admin_apply_reprice: caller is not admin'
      using errcode = '42501';
  end if;

  with engine as (
    select p.id, g.unit_price_ht
    from public.products p
    join public.product_pricing_inputs ppi
      on ppi.product_id = p.id
     and ppi.fob_usd is not null
     and ppi.qty_per_container is not null
    cross join lateral public.get_price(p.id, 'direct', 1) g
    where p.is_active
  )
  update public.products p
  set base_price_ht = e.unit_price_ht
  from engine e
  where p.id = e.id
    and abs(p.base_price_ht - e.unit_price_ht) > 0.005;

  get diagnostics v_updated = row_count;
  return jsonb_build_object('updated', v_updated);
end;
$$;

revoke execute on function public.admin_apply_reprice() from public, anon;
grant execute on function public.admin_apply_reprice() to authenticated;

-- ---------------------------------------------------------------------------
-- P0.4 — Règles PUBLIQUES du prix (paliers + frais). AUCUNE marge, AUCUN coût :
-- uniquement les faits déjà affichés sur /prix et au checkout.
-- ---------------------------------------------------------------------------
create or replace function public.get_public_pricing_rules()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (
      select jsonb_build_object(
        'tier2_qty', p.tier2_qty,
        'tier2_discount', p.tier2_discount,
        'tier3_qty', p.tier3_qty,
        'tier3_discount', p.tier3_discount,
        'reservation_fee_rate', p.reservation_fee_rate,
        'reservation_fee_min', p.reservation_fee_min,
        'reservation_fee_max', p.reservation_fee_max
      )
      from public.pricing_parameters p
      where p.is_active
      order by p.effective_from desc
      limit 1
    ),
    jsonb_build_object(
      'tier2_qty', 100, 'tier2_discount', 0.06,
      'tier3_qty', 150, 'tier3_discount', 0.10,
      'reservation_fee_rate', 0.03,
      'reservation_fee_min', 150, 'reservation_fee_max', 500
    )
  );
$$;

revoke execute on function public.get_public_pricing_rules() from public;
grant execute on function public.get_public_pricing_rules() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- P0.4 — create_reservation_with_items v4 : frais depuis les paramètres.
-- (corps v3 inchangé par ailleurs : validation prix canal + attribution.)
-- ---------------------------------------------------------------------------
create or replace function public.create_reservation_with_items(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation jsonb;
  v_items jsonb;
  v_item jsonb;
  v_reservation_id uuid;
  v_reference text;
  v_container_id uuid;
  v_requested_container_type public.container_type;
  v_item_count int;
  v_subtotal_sum numeric := 0;
  v_eco_sum numeric := 0;
  v_cbm_sum numeric := 0;
  v_expected_subtotal numeric;
  v_expected_eco numeric;
  v_expected_cbm numeric;
  -- price re-validation
  v_product_id text;
  v_qty int;
  v_db_price numeric;
  v_db_eco numeric;
  v_db_cbm numeric;
  v_line_subtotal numeric;
  v_line_eco numeric;
  v_line_cbm numeric;
  -- channel pricing (caller-resolved, cf. get_catalogue_prices v2)
  v_channel public.sales_channel;
  v_direct_margin numeric;
  v_reseller_margin numeric;
  v_distributor_margin numeric;
  v_tier3 numeric;
  v_worst_direct numeric;
  v_coeff numeric;
  v_override numeric;
  v_channel_price numeric;
  v_client_price numeric;
  v_validated_price numeric;
  -- derived header totals
  v_vat_rate numeric;
  v_vat numeric;
  v_fee numeric;
  v_fee_rate numeric;
  v_fee_min numeric;
  v_fee_max numeric;
  v_deposit numeric;
  v_pay_at_80 numeric;
  v_balance numeric;
  v_referral_discount numeric;
  v_pay_now numeric;
  c_tol constant numeric := 0.05;
begin
  if jsonb_typeof(payload) is distinct from 'object' then
    raise exception 'create_reservation_with_items: payload must be an object';
  end if;

  v_reservation := payload -> 'reservation';
  v_items := payload -> 'items';

  if jsonb_typeof(v_reservation) is distinct from 'object' then
    raise exception 'create_reservation_with_items: missing reservation object';
  end if;

  if jsonb_typeof(v_items) is distinct from 'array' then
    raise exception 'create_reservation_with_items: missing items array';
  end if;

  v_item_count := jsonb_array_length(v_items);
  if v_item_count < 1 then
    raise exception 'create_reservation_with_items: reservation must contain at least one item';
  end if;
  if v_item_count > 50 then
    raise exception 'create_reservation_with_items: too many reservation items';
  end if;

  v_reservation_id := (v_reservation ->> 'id')::uuid;
  v_reference := nullif(v_reservation ->> 'reference', '');

  if v_reference is null then
    raise exception 'create_reservation_with_items: missing reference';
  end if;

  if coalesce(v_reservation ->> 'status', '') <> 'pending_reservation_fee' then
    raise exception 'create_reservation_with_items: invalid initial status';
  end if;

  if v_reservation ->> 'user_id' is not null
    or v_reservation ->> 'company_id' is not null then
    raise exception 'create_reservation_with_items: user_id and company_id must be null for public checkout';
  end if;

  if coalesce(v_reservation ->> 'siret', '') !~ '^[0-9]{14}$' then
    raise exception 'create_reservation_with_items: invalid siret';
  end if;

  if jsonb_typeof(v_reservation -> 'contact_snapshot') is distinct from 'object' then
    raise exception 'create_reservation_with_items: contact_snapshot must be an object';
  end if;

  if nullif(v_reservation ->> 'container_id', '') is not null then
    v_container_id := (v_reservation ->> 'container_id')::uuid;
  end if;

  if nullif(v_reservation ->> 'requested_container_type', '') is not null then
    v_requested_container_type :=
      (v_reservation ->> 'requested_container_type')::public.container_type;
  end if;

  v_expected_subtotal := (v_reservation ->> 'subtotal_ht')::numeric;
  v_expected_eco := (v_reservation ->> 'eco_contribution_total')::numeric;
  v_expected_cbm := (v_reservation ->> 'total_cbm')::numeric;

  if v_expected_subtotal < 0
    or v_expected_eco < 0
    or (v_reservation ->> 'referral_discount')::numeric < 0
    or (v_reservation ->> 'total_ht')::numeric < 0
    or (v_reservation ->> 'vat_amount')::numeric < 0
    or (v_reservation ->> 'total_ttc')::numeric < 0
    or v_expected_cbm < 0
    or (v_reservation ->> 'reservation_fee')::numeric < 0
    or (v_reservation ->> 'pay_now')::numeric < 0
    or (v_reservation ->> 'deposit_amount')::numeric < 0
    or (v_reservation ->> 'pay_at_80_percent')::numeric < 0
    or (v_reservation ->> 'balance_amount')::numeric < 0 then
    raise exception 'create_reservation_with_items: monetary and volume fields must be non-negative';
  end if;

  -- --------------------------------------------------------------------
  -- Résolution du canal du CALLER — identique à get_catalogue_prices v2.
  -- anon / sans société → direct (coefficient 1, aucun override lu).
  -- --------------------------------------------------------------------
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
    v_coeff := case v_channel
      when 'revendeur'
        then round((1 + v_reseller_margin) / (1 + v_direct_margin), 4)
      when 'distributeur'
        then round((1 + v_distributor_margin) / (1 + v_direct_margin), 4)
      else 1.0
    end;
  else
    select coefficient into v_coeff
    from public.channel_coefficients where channel = v_channel;
  end if;

  if v_coeff is null then
    v_coeff := 1.0;
  end if;

  if v_channel in ('revendeur', 'distributeur')
     and v_coeff >= v_worst_direct then
    v_coeff := round(v_worst_direct - 0.0001, 4);
  end if;

  insert into public.reservations (
    id,
    reference,
    container_reference,
    container_id,
    user_id,
    company_id,
    siret,
    contact_snapshot,
    delivery_mode,
    delivery_note,
    delivery_fee,
    subtotal_ht,
    eco_contribution_total,
    referral_code,
    referral_discount,
    total_ht,
    vat_rate,
    vat_amount,
    total_ttc,
    total_cbm,
    reservation_fee,
    pay_now,
    deposit_amount,
    pay_at_80_percent,
    balance_amount,
    status,
    cgv_version_accepted,
    cgv_accepted_at,
    requested_container_type,
    utm_source,
    utm_medium,
    utm_campaign,
    partner_ref
  )
  values (
    v_reservation_id,
    v_reference,
    v_reservation ->> 'container_reference',
    v_container_id,
    null,
    null,
    v_reservation ->> 'siret',
    v_reservation -> 'contact_snapshot',
    (v_reservation ->> 'delivery_mode')::public.delivery_mode,
    nullif(v_reservation ->> 'delivery_note', ''),
    coalesce((v_reservation ->> 'delivery_fee')::numeric, 0),
    v_expected_subtotal,
    v_expected_eco,
    nullif(v_reservation ->> 'referral_code', ''),
    (v_reservation ->> 'referral_discount')::numeric,
    (v_reservation ->> 'total_ht')::numeric,
    coalesce((v_reservation ->> 'vat_rate')::numeric, 20.00),
    (v_reservation ->> 'vat_amount')::numeric,
    (v_reservation ->> 'total_ttc')::numeric,
    v_expected_cbm,
    (v_reservation ->> 'reservation_fee')::numeric,
    (v_reservation ->> 'pay_now')::numeric,
    (v_reservation ->> 'deposit_amount')::numeric,
    (v_reservation ->> 'pay_at_80_percent')::numeric,
    (v_reservation ->> 'balance_amount')::numeric,
    'pending_reservation_fee'::public.reservation_status,
    v_reservation ->> 'cgv_version_accepted',
    (v_reservation ->> 'cgv_accepted_at')::timestamptz,
    v_requested_container_type,
    nullif(v_reservation ->> 'utm_source', ''),
    nullif(v_reservation ->> 'utm_medium', ''),
    nullif(v_reservation ->> 'utm_campaign', ''),
    nullif(v_reservation ->> 'partner_ref', '')
  );

  for v_item in select value from jsonb_array_elements(v_items)
  loop
    if jsonb_typeof(v_item) is distinct from 'object' then
      raise exception 'create_reservation_with_items: item must be an object';
    end if;

    if nullif(v_item ->> 'reservation_id', '') is null
      or (v_item ->> 'reservation_id')::uuid <> v_reservation_id then
      raise exception 'create_reservation_with_items: item reservation_id mismatch';
    end if;

    v_qty := (v_item ->> 'quantity')::int;
    if v_qty <= 0
      or v_qty > 10000
      or (v_item ->> 'unit_price_ht')::numeric < 0
      or (v_item ->> 'unit_eco_contribution')::numeric < 0
      or (v_item ->> 'subtotal_ht')::numeric < 0
      or (v_item ->> 'eco_contribution_total')::numeric < 0
      or (v_item ->> 'cbm_total')::numeric < 0 then
      raise exception 'create_reservation_with_items: invalid item numeric field';
    end if;

    if jsonb_typeof(v_item -> 'product_snapshot') is distinct from 'object' then
      raise exception 'create_reservation_with_items: product_snapshot must be an object';
    end if;

    -- Re-derive unit economics from the live catalogue; never trust the client.
    v_product_id := v_item ->> 'product_id';
    select base_price_ht, eco_contribution, cbm_per_unit
      into v_db_price, v_db_eco, v_db_cbm
      from public.products
      where id = v_product_id and is_active;
    if not found then
      raise exception 'create_reservation_with_items: unknown or inactive product %', v_product_id;
    end if;

    -- Prix canal du caller : override explicite sinon base × coefficient
    -- (grand_compte = pire prix direct). Le prix client doit correspondre au
    -- prix canal OU au prix de base (fallback affiché quand la RPC de prix a
    -- échoué) — jamais en dessous du prix canal résolu.
    select o.unit_price_ht into v_override
    from public.channel_price_overrides o
    where o.product_id = v_product_id and o.channel = v_channel;

    v_channel_price := round(
      coalesce(
        v_override,
        case
          when v_channel = 'grand_compte' then v_db_price * v_worst_direct
          else v_db_price * v_coeff
        end
      ),
      2
    );

    v_client_price := (v_item ->> 'unit_price_ht')::numeric;

    if abs(v_client_price - v_channel_price) <= 0.01 then
      v_validated_price := v_channel_price;
    elsif abs(v_client_price - v_db_price) <= 0.01 then
      v_validated_price := v_db_price;
    else
      raise exception 'create_reservation_with_items: unit price mismatch for product %', v_product_id;
    end if;

    if abs((v_item ->> 'unit_eco_contribution')::numeric - v_db_eco) > 0.01 then
      raise exception 'create_reservation_with_items: eco contribution mismatch for product %', v_product_id;
    end if;

    v_line_subtotal := round(v_validated_price * v_qty, 2);
    v_line_eco := round(v_db_eco * v_qty, 2);
    v_line_cbm := round(v_db_cbm * v_qty, 2);

    v_subtotal_sum := v_subtotal_sum + v_line_subtotal;
    v_eco_sum := v_eco_sum + v_line_eco;
    v_cbm_sum := v_cbm_sum + v_line_cbm;

    insert into public.reservation_items (
      reservation_id,
      product_id,
      sku,
      product_name,
      category,
      variant_id,
      variant_name,
      quantity,
      unit_price_ht,
      unit_eco_contribution,
      subtotal_ht,
      eco_contribution_total,
      cbm_total,
      product_snapshot
    )
    values (
      v_reservation_id,
      v_product_id,
      v_item ->> 'sku',
      v_item ->> 'product_name',
      v_item ->> 'category',
      v_item ->> 'variant_id',
      v_item ->> 'variant_name',
      v_qty,
      v_validated_price,
      v_db_eco,
      v_line_subtotal,
      v_line_eco,
      v_line_cbm,
      v_item -> 'product_snapshot'
    );
  end loop;

  -- Header subtotal/eco/cbm must equal the authoritative line sums.
  if abs(v_subtotal_sum - v_expected_subtotal) > 0.01
    or abs(v_eco_sum - v_expected_eco) > 0.01
    or abs(v_cbm_sum - v_expected_cbm) > 0.01 then
    raise exception 'create_reservation_with_items: item totals do not match reservation totals';
  end if;

  -- Derived monetary fields recomputed from the authoritative subtotal.
  v_vat_rate := coalesce((v_reservation ->> 'vat_rate')::numeric, 20.00);
  v_vat := round(v_subtotal_sum * v_vat_rate / 100, 2);
  -- P0.4 : les frais de réservation viennent des paramètres pricing actifs
  -- (fallback = grille historique 3% / 150 / 500). Le client lit la même
  -- source via get_public_pricing_rules() — les deux restent synchrones.
  select coalesce(p.reservation_fee_rate, 0.03),
         coalesce(p.reservation_fee_min, 150),
         coalesce(p.reservation_fee_max, 500)
    into v_fee_rate, v_fee_min, v_fee_max
  from public.pricing_parameters p
  where p.is_active
  order by p.effective_from desc
  limit 1;
  if v_fee_rate is null then
    v_fee_rate := 0.03; v_fee_min := 150; v_fee_max := 500;
  end if;

  if v_subtotal_sum <= 0 then
    v_fee := 0;
  else
    v_fee := least(greatest(v_subtotal_sum * v_fee_rate, v_fee_min), v_fee_max);
  end if;
  v_deposit := round(v_subtotal_sum * 0.3, 2);
  v_pay_at_80 := greatest(0, v_subtotal_sum * 0.3 - v_fee);
  v_balance := greatest(0, v_subtotal_sum - v_fee - v_pay_at_80);
  v_referral_discount := coalesce((v_reservation ->> 'referral_discount')::numeric, 0);
  v_pay_now := coalesce((v_reservation ->> 'pay_now')::numeric, v_fee);

  if abs((v_reservation ->> 'total_ht')::numeric - v_subtotal_sum) > c_tol
    or abs((v_reservation ->> 'vat_amount')::numeric - v_vat) > c_tol
    or abs((v_reservation ->> 'total_ttc')::numeric - (v_subtotal_sum + v_vat)) > c_tol
    or abs((v_reservation ->> 'reservation_fee')::numeric - v_fee) > c_tol
    or abs((v_reservation ->> 'deposit_amount')::numeric - v_deposit) > c_tol
    or abs((v_reservation ->> 'pay_at_80_percent')::numeric - v_pay_at_80) > c_tol
    or abs((v_reservation ->> 'balance_amount')::numeric - v_balance) > c_tol then
    raise exception 'create_reservation_with_items: derived monetary fields are inconsistent';
  end if;

  -- A referral can only reduce the up-front fee, never below zero.
  if v_referral_discount < 0
    or v_referral_discount > v_fee + 0.01
    or v_pay_now < 0
    or v_pay_now > v_fee + 0.01 then
    raise exception 'create_reservation_with_items: invalid referral discount';
  end if;

  return jsonb_build_object(
    'id', v_reservation_id::text,
    'reference', v_reference
  );
end;
$$;

revoke execute on function public.create_reservation_with_items(jsonb)
  from public;
grant execute on function public.create_reservation_with_items(jsonb)
  to anon, authenticated;

comment on function public.create_reservation_with_items(jsonb) is
  'Atomically creates one public checkout reservation and its item snapshots, re-deriving all unit economics from the live catalogue at the CALLER''s sales channel price (anti-tampering + LOT 4), and persisting first-touch attribution (utm_*, partner_ref).';
