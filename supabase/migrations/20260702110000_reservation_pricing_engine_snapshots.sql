-- Reservation pricing engine snapshots.
--
-- Public checkout must never trust browser-sent prices. This version of the
-- RPC prices every line through the private pricing engine, stores the
-- commercial snapshot on reservation_items, and derives the reservation fee
-- from pricing_parameters. Sensitive landed costs are deliberately not stored
-- on reservation_items because customers can read their own reservation lines.

create or replace function public.create_reservation_with_items(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reservation jsonb;
  v_items jsonb;
  v_item jsonb;
  v_line jsonb;
  v_lines jsonb := '[]'::jsonb;
  v_reservation_id uuid;
  v_reference text;
  v_container_id uuid;
  v_requested_container_type public.container_type;
  v_item_count int;
  v_subtotal_sum numeric := 0;
  v_eco_sum numeric := 0;
  v_cbm_sum numeric := 0;
  v_product_id text;
  v_variant_id text;
  v_qty int;
  v_price record;
  v_params public.pricing_parameters%rowtype;
  v_db_eco numeric;
  v_db_cbm numeric;
  v_line_subtotal numeric;
  v_line_eco numeric;
  v_line_cbm numeric;
  v_vat_rate numeric;
  v_vat numeric;
  v_fee numeric;
  v_deposit numeric;
  v_pay_at_80 numeric;
  v_balance numeric;
  v_referral_code text;
  v_referral_discount numeric := 0;
  v_pay_now numeric;
  v_program_discount numeric := 100;
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

  v_params := public.active_pricing_parameters(now());
  if v_params.id is null then
    raise exception 'create_reservation_with_items: no active pricing parameters';
  end if;

  for v_item in select value from jsonb_array_elements(v_items)
  loop
    if jsonb_typeof(v_item) is distinct from 'object' then
      raise exception 'create_reservation_with_items: item must be an object';
    end if;

    if nullif(v_item ->> 'reservation_id', '') is null
      or (v_item ->> 'reservation_id')::uuid <> v_reservation_id then
      raise exception 'create_reservation_with_items: item reservation_id mismatch';
    end if;

    v_product_id := v_item ->> 'product_id';
    v_variant_id := v_item ->> 'variant_id';
    v_qty := (v_item ->> 'quantity')::int;

    if v_qty <= 0 or v_qty > 10000 then
      raise exception 'create_reservation_with_items: invalid item quantity';
    end if;

    if jsonb_typeof(v_item -> 'product_snapshot') is distinct from 'object' then
      raise exception 'create_reservation_with_items: product_snapshot must be an object';
    end if;

    if not exists (
      select 1
      from public.product_variants pv
      where pv.id = v_variant_id
        and pv.product_id = v_product_id
    ) then
      raise exception 'create_reservation_with_items: unknown variant % for product %',
        v_variant_id, v_product_id;
    end if;

    select p.eco_contribution, p.cbm_per_unit
      into v_db_eco, v_db_cbm
    from public.products p
    where p.id = v_product_id
      and p.is_active;

    if not found then
      raise exception 'create_reservation_with_items: unknown or inactive product %', v_product_id;
    end if;

    select *
      into v_price
    from public.get_price(
      v_product_id,
      'direct'::public.pricing_channel,
      v_qty,
      null,
      now()
    );

    if v_price.unit_price_ht is null then
      raise exception 'create_reservation_with_items: price unavailable for product %', v_product_id;
    end if;

    v_line_subtotal := round(v_price.unit_price_ht * v_qty, 2);
    v_line_eco := round(v_db_eco * v_qty, 2);
    v_line_cbm := round(v_db_cbm * v_qty, 2);

    v_subtotal_sum := v_subtotal_sum + v_line_subtotal;
    v_eco_sum := v_eco_sum + v_line_eco;
    v_cbm_sum := v_cbm_sum + v_line_cbm;

    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object(
        'product_id', v_product_id,
        'sku', v_item ->> 'sku',
        'product_name', v_item ->> 'product_name',
        'category', v_item ->> 'category',
        'variant_id', v_variant_id,
        'variant_name', v_item ->> 'variant_name',
        'quantity', v_qty,
        'unit_price_ht', v_price.unit_price_ht,
        'unit_eco_contribution', v_db_eco,
        'subtotal_ht', v_line_subtotal,
        'eco_contribution_total', v_line_eco,
        'cbm_total', v_line_cbm,
        'product_snapshot', v_item -> 'product_snapshot',
        'pricing_channel', v_price.channel,
        'pricing_tier_applied', v_price.tier_applied,
        'pricing_parameters_snapshot', jsonb_build_object(
          'version', v_price.parameters_version,
          'channel', v_price.channel,
          'quantity', v_qty,
          'tier_applied', v_price.tier_applied
        )
      )
    );
  end loop;

  v_vat_rate := coalesce((v_reservation ->> 'vat_rate')::numeric, 20.00);
  v_vat := round(v_subtotal_sum * v_vat_rate / 100, 2);
  if v_subtotal_sum <= 0 then
    v_fee := 0;
  else
    v_fee := round(
      least(
        greatest(v_subtotal_sum * v_params.reservation_fee_rate, v_params.reservation_fee_min),
        v_params.reservation_fee_max
      ),
      2
    );
  end if;
  v_deposit := round(v_subtotal_sum * 0.3, 2);
  v_pay_at_80 := round(greatest(0, v_deposit - v_fee), 2);
  v_balance := round(greatest(0, v_subtotal_sum - v_fee - v_pay_at_80), 2);

  v_referral_code := nullif(v_reservation ->> 'referral_code', '');
  if v_referral_code is not null then
    select referred_discount
      into v_program_discount
    from public.referral_program_settings
    where id = true;
    v_referral_discount := least(coalesce(v_program_discount, 100), v_fee);
  end if;
  v_pay_now := greatest(v_fee - v_referral_discount, 0);

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
    v_subtotal_sum,
    v_eco_sum,
    v_referral_code,
    v_referral_discount,
    v_subtotal_sum,
    v_vat_rate,
    v_vat,
    v_subtotal_sum + v_vat,
    v_cbm_sum,
    v_fee,
    v_pay_now,
    v_deposit,
    v_pay_at_80,
    v_balance,
    'pending_reservation_fee'::public.reservation_status,
    v_reservation ->> 'cgv_version_accepted',
    (v_reservation ->> 'cgv_accepted_at')::timestamptz,
    v_requested_container_type
  );

  for v_line in select value from jsonb_array_elements(v_lines)
  loop
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
      product_snapshot,
      pricing_channel,
      unit_landed_cost_ht,
      pricing_tier_applied,
      pricing_parameters_snapshot
    )
    values (
      v_reservation_id,
      v_line ->> 'product_id',
      v_line ->> 'sku',
      v_line ->> 'product_name',
      v_line ->> 'category',
      v_line ->> 'variant_id',
      v_line ->> 'variant_name',
      (v_line ->> 'quantity')::int,
      (v_line ->> 'unit_price_ht')::numeric,
      (v_line ->> 'unit_eco_contribution')::numeric,
      (v_line ->> 'subtotal_ht')::numeric,
      (v_line ->> 'eco_contribution_total')::numeric,
      (v_line ->> 'cbm_total')::numeric,
      v_line -> 'product_snapshot',
      (v_line ->> 'pricing_channel')::public.pricing_channel,
      null,
      v_line ->> 'pricing_tier_applied',
      v_line -> 'pricing_parameters_snapshot'
    );
  end loop;

  return jsonb_build_object(
    'id', v_reservation_id::text,
    'reference', v_reference
  );
end;
$$;

drop policy if exists "Anon creates pending reservations"
  on public.reservations;
drop policy if exists "Anon creates items for pending reservations"
  on public.reservation_items;
drop policy if exists "Anon creates reservation items"
  on public.reservation_items;

revoke execute on function public.create_reservation_with_items(jsonb)
  from public;
grant execute on function public.create_reservation_with_items(jsonb)
  to anon, authenticated;

comment on function public.create_reservation_with_items(jsonb) is
  'Atomically creates one public checkout reservation and its item snapshots, pricing each line through the private pricing engine and storing only non-sensitive commercial pricing metadata on customer-readable rows.';
