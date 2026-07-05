-- Server-side price re-validation (audit 2026-06-11).
--
-- create_reservation_with_items previously trusted ALL monetary values from the
-- client payload and only checked internal consistency (sum of items == header
-- totals). A forged request could therefore create a reservation at an
-- arbitrary unit price — and that reservation later seeds a legally numbered
-- invoice (issue_reservation_invoice snapshots these amounts).
--
-- This version re-derives the unit economics from the live catalogue:
--   * each item's product MUST exist and be active in public.products;
--   * unit_price_ht / unit_eco_contribution MUST match the catalogue (<= 0.01);
--   * line subtotal / eco / cbm are RECOMPUTED server-side and stored
--     (the client's line amounts are never trusted);
--   * header VAT, reservation fee and the 3%/27%/70% payment schedule are
--     recomputed from the authoritative subtotal and rejected if tampered;
--   * the referral discount may only ever reduce the up-front fee.
--
-- NOTE (follow-up, not covered here): the referral discount amount itself is
-- only bounded (0..fee), not fully re-validated against the referral engine.

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
  -- derived header totals
  v_vat_rate numeric;
  v_vat numeric;
  v_fee numeric;
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
    requested_container_type
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
    v_requested_container_type
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

    if abs((v_item ->> 'unit_price_ht')::numeric - v_db_price) > 0.01 then
      raise exception 'create_reservation_with_items: unit price mismatch for product %', v_product_id;
    end if;
    if abs((v_item ->> 'unit_eco_contribution')::numeric - v_db_eco) > 0.01 then
      raise exception 'create_reservation_with_items: eco contribution mismatch for product %', v_product_id;
    end if;

    v_line_subtotal := round(v_db_price * v_qty, 2);
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
      v_db_price,
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
  if v_subtotal_sum <= 0 then
    v_fee := 0;
  else
    v_fee := least(greatest(v_subtotal_sum * 0.03, 150), 500);
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
  'Atomically creates one public checkout reservation and its item snapshots, re-deriving all unit economics and the payment schedule from the live catalogue (anti-tampering).';
