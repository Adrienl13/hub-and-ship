-- Remise volume RÉELLEMENT appliquée (audit global C3).
--
-- Le site promet publiquement « −6 % dès 100 pièces, −10 % dès 150, appliqués
-- au panier sans code » (/prix), mais le montant payé ignorait la remise. Ce
-- correctif la rend effective de bout en bout : le client (calculateOrder) et
-- le serveur (create_reservation_with_items v5) déduisent la MÊME remise du
-- sous-total, calculée depuis les paliers des paramètres pricing actifs, sur
-- le canal direct. Anti-fraude v3/v4 intact : les prix ligne restent validés
-- au prix canal, la remise s'applique au niveau de l'en-tête.

-- Colonne de traçabilité : montant HT de la remise volume déduit.
alter table public.reservations
  add column if not exists volume_discount numeric(12, 2) not null default 0;

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
  v_units_sum int := 0;
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
  v_tier2_qty int;
  v_tier2_discount numeric;
  v_tier3_qty int;
  v_tier3 numeric;
  v_worst_direct numeric;
  v_coeff numeric;
  v_override numeric;
  v_channel_price numeric;
  v_client_price numeric;
  v_validated_price numeric;
  -- volume discount (public tiers, direct channel)
  v_volume_rate numeric := 0;
  v_net_subtotal numeric;
  v_volume_discount numeric := 0;
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
    or coalesce((v_reservation ->> 'volume_discount')::numeric, 0) < 0
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
         p.distributor_margin_rate, p.tier3_discount,
         p.tier2_qty, p.tier2_discount, p.tier3_qty
    into v_direct_margin, v_reseller_margin, v_distributor_margin, v_tier3,
         v_tier2_qty, v_tier2_discount, v_tier3_qty
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
    volume_discount,
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
    coalesce((v_reservation ->> 'volume_discount')::numeric, 0),
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
    -- échoué) — jamais en dessous du prix canal résolu. La remise volume
    -- s'applique en fin de calcul sur le SOUS-TOTAL, pas sur le prix ligne.
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
    v_units_sum := v_units_sum + v_qty;

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

  -- Header subtotal/eco/cbm must equal the authoritative line sums (subtotal
  -- reste le BRUT avant remise volume).
  if abs(v_subtotal_sum - v_expected_subtotal) > 0.01
    or abs(v_eco_sum - v_expected_eco) > 0.01
    or abs(v_cbm_sum - v_expected_cbm) > 0.01 then
    raise exception 'create_reservation_with_items: item totals do not match reservation totals';
  end if;

  -- --------------------------------------------------------------------
  -- Remise volume (C3) : paliers publics, canal direct uniquement. Basée sur
  -- le nombre total d'unités, appliquée au sous-total. Même calcul que le
  -- client (calculateOrder → get_public_pricing_rules).
  -- --------------------------------------------------------------------
  if v_channel = 'direct' then
    if v_units_sum >= coalesce(v_tier3_qty, 150) then
      v_volume_rate := coalesce(v_tier3, 0.10);
    elsif v_units_sum >= coalesce(v_tier2_qty, 100) then
      v_volume_rate := coalesce(v_tier2_discount, 0.06);
    end if;
  end if;
  v_net_subtotal := round(v_subtotal_sum * (1 - v_volume_rate), 2);
  v_volume_discount := round(v_subtotal_sum - v_net_subtotal, 2);

  -- Derived monetary fields recomputed from the authoritative NET subtotal.
  v_vat_rate := coalesce((v_reservation ->> 'vat_rate')::numeric, 20.00);
  v_vat := round(v_net_subtotal * v_vat_rate / 100, 2);
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

  if v_net_subtotal <= 0 then
    v_fee := 0;
  else
    v_fee := least(greatest(v_net_subtotal * v_fee_rate, v_fee_min), v_fee_max);
  end if;
  v_deposit := round(v_net_subtotal * 0.3, 2);
  v_pay_at_80 := greatest(0, v_net_subtotal * 0.3 - v_fee);
  v_balance := greatest(0, v_net_subtotal - v_fee - v_pay_at_80);
  v_referral_discount := coalesce((v_reservation ->> 'referral_discount')::numeric, 0);
  v_pay_now := coalesce((v_reservation ->> 'pay_now')::numeric, v_fee);

  if abs(coalesce((v_reservation ->> 'volume_discount')::numeric, 0) - v_volume_discount) > c_tol
    or abs((v_reservation ->> 'total_ht')::numeric - v_net_subtotal) > c_tol
    or abs((v_reservation ->> 'vat_amount')::numeric - v_vat) > c_tol
    or abs((v_reservation ->> 'total_ttc')::numeric - (v_net_subtotal + v_vat)) > c_tol
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
  'v5 — checkout reservation + item snapshots. Re-derives unit economics at the CALLER''s channel price (anti-tampering), applies the public volume discount (direct channel, from active pricing_parameters tiers) to the subtotal, persists attribution (utm_*, partner_ref) and the volume_discount amount.';
