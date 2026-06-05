-- Atomic public reservation creation.
--
-- Previous flow inserted `reservations` and `reservation_items` in two client
-- calls. If the second insert failed, ops could see an incomplete reservation.
-- This RPC makes the write transactional and lets us close the direct anon
-- INSERT policies on both tables.

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

    if (v_item ->> 'quantity')::int <= 0
      or (v_item ->> 'quantity')::int > 10000
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

    v_subtotal_sum := v_subtotal_sum + (v_item ->> 'subtotal_ht')::numeric;
    v_eco_sum := v_eco_sum + (v_item ->> 'eco_contribution_total')::numeric;
    v_cbm_sum := v_cbm_sum + (v_item ->> 'cbm_total')::numeric;

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
      v_item ->> 'product_id',
      v_item ->> 'sku',
      v_item ->> 'product_name',
      v_item ->> 'category',
      v_item ->> 'variant_id',
      v_item ->> 'variant_name',
      (v_item ->> 'quantity')::int,
      (v_item ->> 'unit_price_ht')::numeric,
      (v_item ->> 'unit_eco_contribution')::numeric,
      (v_item ->> 'subtotal_ht')::numeric,
      (v_item ->> 'eco_contribution_total')::numeric,
      (v_item ->> 'cbm_total')::numeric,
      v_item -> 'product_snapshot'
    );
  end loop;

  if abs(v_subtotal_sum - v_expected_subtotal) > 0.01
    or abs(v_eco_sum - v_expected_eco) > 0.01
    or abs(v_cbm_sum - v_expected_cbm) > 0.0001 then
    raise exception 'create_reservation_with_items: item totals do not match reservation totals';
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

drop policy if exists "Anon creates pending reservations"
  on public.reservations;
drop policy if exists "Anon creates items for pending reservations"
  on public.reservation_items;
drop policy if exists "Anon creates reservation items"
  on public.reservation_items;

comment on function public.create_reservation_with_items(jsonb) is
  'Atomically creates one public checkout reservation and its item snapshots.';
