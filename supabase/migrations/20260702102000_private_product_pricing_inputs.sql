-- Move sensitive product pricing inputs out of the public catalogue row.
--
-- `products` is publicly readable for active catalogue rows. Cost inputs such
-- as FOB, real container quantity and loss-leader flags must therefore live in
-- an admin-only companion table. The legacy columns remain nullable for
-- compatibility, but are scrubbed and no longer used by pricing functions.

create table if not exists public.product_pricing_inputs (
  product_id text primary key references public.products(id) on delete cascade,
  fob_usd numeric(12, 4)
    check (fob_usd is null or fob_usd >= 0),
  qty_per_container int
    check (qty_per_container is null or qty_per_container > 0),
  is_loss_leader boolean not null default false,
  table_price_modifier_rate numeric(8, 4)
    check (table_price_modifier_rate is null or table_price_modifier_rate > -1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists product_pricing_inputs_set_updated_at
  on public.product_pricing_inputs;
create trigger product_pricing_inputs_set_updated_at
  before update on public.product_pricing_inputs
  for each row execute function public.set_updated_at();

insert into public.product_pricing_inputs (
  product_id,
  fob_usd,
  qty_per_container,
  is_loss_leader,
  table_price_modifier_rate
)
select
  id,
  fob_usd,
  qty_per_container,
  coalesce(is_loss_leader, false),
  table_price_modifier_rate
from public.products
where fob_usd is not null
   or qty_per_container is not null
   or coalesce(is_loss_leader, false)
   or table_price_modifier_rate is not null
on conflict (product_id) do update set
  fob_usd = coalesce(
    public.product_pricing_inputs.fob_usd,
    excluded.fob_usd
  ),
  qty_per_container = coalesce(
    public.product_pricing_inputs.qty_per_container,
    excluded.qty_per_container
  ),
  is_loss_leader = public.product_pricing_inputs.is_loss_leader
    or excluded.is_loss_leader,
  table_price_modifier_rate = coalesce(
    public.product_pricing_inputs.table_price_modifier_rate,
    excluded.table_price_modifier_rate
  ),
  updated_at = now();

update public.products
set
  fob_usd = null,
  qty_per_container = null,
  is_loss_leader = false,
  table_price_modifier_rate = null
where fob_usd is not null
   or qty_per_container is not null
   or coalesce(is_loss_leader, false)
   or table_price_modifier_rate is not null;

alter table public.product_pricing_inputs enable row level security;

drop policy if exists "Admins full access product pricing inputs"
  on public.product_pricing_inputs;
create policy "Admins full access product pricing inputs"
  on public.product_pricing_inputs for all
  using (public.current_user_role() in ('admin', 'super_admin'))
  with check (public.current_user_role() in ('admin', 'super_admin'));

revoke all on table public.product_pricing_inputs
  from anon, public, authenticated;
grant select, insert, update, delete
  on public.product_pricing_inputs to authenticated;

comment on table public.product_pricing_inputs is
  'Admin-only product pricing inputs. Never exposed to anonymous visitors or standard authenticated accounts.';
comment on column public.product_pricing_inputs.fob_usd is
  'Manual source-of-truth product FOB cost in USD from the private quote sheet.';
comment on column public.product_pricing_inputs.qty_per_container is
  'Manual source-of-truth units per 40HC container. CBM is only a review signal.';

create or replace function public.calculate_product_landed_cost_ht(
  p_product_id text,
  p_at timestamptz default now()
)
returns numeric
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_product public.products%rowtype;
  v_inputs public.product_pricing_inputs%rowtype;
  v_params public.pricing_parameters%rowtype;
begin
  select * into v_product
  from public.products
  where id = p_product_id;

  if not found then
    raise exception 'calculate_product_landed_cost_ht: unknown product %', p_product_id;
  end if;

  select * into v_inputs
  from public.product_pricing_inputs
  where product_pricing_inputs.product_id = p_product_id;

  v_params := public.active_pricing_parameters(p_at);
  if v_params.id is null then
    raise exception 'calculate_product_landed_cost_ht: no active pricing parameters';
  end if;

  if v_inputs.fob_usd is not null and v_inputs.qty_per_container is not null then
    return round(
      (
        v_inputs.fob_usd * v_params.fx_usd_eur *
          (1 + v_params.customs_rate + v_params.import_insurance_rate)
      )
      + (v_params.freight_eur_40hc / v_inputs.qty_per_container)
      + v_params.fixed_import_fee_eur,
      2
    );
  end if;

  return round(v_product.base_price_ht / (1 + v_params.direct_margin_rate), 2);
end;
$$;

create or replace function public.get_price(
  p_product_id text,
  p_channel public.pricing_channel default 'direct',
  p_quantity int default 1,
  p_partner_application_id uuid default null,
  p_at timestamptz default now()
)
returns table (
  product_id text,
  channel public.pricing_channel,
  quantity int,
  landed_cost_ht numeric,
  formula_price_ht numeric,
  override_price_ht numeric,
  unit_price_ht numeric,
  tier_applied text,
  parameters_version int,
  parameters_snapshot jsonb
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_product public.products%rowtype;
  v_inputs public.product_pricing_inputs%rowtype;
  v_params public.pricing_parameters%rowtype;
  v_landed numeric;
  v_base numeric;
  v_tier text := 'none';
  v_formula numeric;
  v_floor numeric;
  v_override numeric;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'get_price: quantity must be positive';
  end if;

  select * into v_product
  from public.products
  where id = p_product_id and is_active;

  if not found then
    raise exception 'get_price: unknown or inactive product %', p_product_id;
  end if;

  select * into v_inputs
  from public.product_pricing_inputs
  where product_pricing_inputs.product_id = p_product_id;

  v_params := public.active_pricing_parameters(p_at);
  if v_params.id is null then
    raise exception 'get_price: no active pricing parameters';
  end if;

  v_landed := public.calculate_product_landed_cost_ht(p_product_id, p_at);
  v_floor := round(v_landed * (1 + v_params.min_margin_floor), 2);

  if p_channel = 'reseller' then
    v_base := v_landed * (1 + v_params.reseller_margin_rate);
  elsif p_channel = 'distributor' then
    v_base := v_landed * (1 + v_params.distributor_margin_rate);
  else
    v_base := v_landed * (1 + v_params.direct_margin_rate);
  end if;

  if p_channel = 'direct'
    and coalesce(v_inputs.is_loss_leader, false)
    and p_quantity >= v_params.loss_leader_min_lot then
    v_base := v_floor;
    v_tier := 'loss_leader';
  elsif p_channel = 'direct' and p_quantity >= v_params.tier3_qty then
    v_base := v_base * (1 - v_params.tier3_discount);
    v_tier := 'tier3';
  elsif p_channel = 'direct' and p_quantity >= v_params.tier2_qty then
    v_base := v_base * (1 - v_params.tier2_discount);
    v_tier := 'tier2';
  end if;

  v_formula := greatest(round(v_base, 2), v_floor);

  if p_channel in ('reseller', 'distributor') then
    select ppp.net_price_ht
      into v_override
    from public.product_partner_prices ppp
    where ppp.product_id = p_product_id
      and ppp.is_active
      and (
        (p_partner_application_id is not null
          and ppp.partner_application_id = p_partner_application_id)
        or ppp.partner_application_id is null
      )
    order by (ppp.partner_application_id is not null) desc, ppp.updated_at desc
    limit 1;

    if v_override is not null and v_override < v_floor then
      raise exception 'get_price: partner override below minimum margin floor for product %', p_product_id;
    end if;
  end if;

  return query
  select
    p_product_id,
    p_channel,
    p_quantity,
    v_landed,
    v_formula,
    v_override,
    coalesce(v_override, v_formula),
    v_tier,
    v_params.version,
    jsonb_build_object(
      'version', v_params.version,
      'fx_usd_eur', v_params.fx_usd_eur,
      'freight_eur_40hc', v_params.freight_eur_40hc,
      'customs_rate', v_params.customs_rate,
      'import_insurance_rate', v_params.import_insurance_rate,
      'fixed_import_fee_eur', v_params.fixed_import_fee_eur,
      'direct_margin_rate', v_params.direct_margin_rate,
      'reseller_margin_rate', v_params.reseller_margin_rate,
      'distributor_margin_rate', v_params.distributor_margin_rate,
      'min_margin_floor', v_params.min_margin_floor,
      'tier2_qty', v_params.tier2_qty,
      'tier2_discount', v_params.tier2_discount,
      'tier3_qty', v_params.tier3_qty,
      'tier3_discount', v_params.tier3_discount,
      'loss_leader_min_lot', v_params.loss_leader_min_lot
    );
end;
$$;

create or replace function public.enforce_max_loss_leaders()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_max int;
  v_count int;
begin
  if not coalesce(new.is_loss_leader, false) then
    return new;
  end if;

  select max_loss_leaders
    into v_max
  from public.pricing_parameters
  where is_active
  order by version desc
  limit 1;

  select count(*)
    into v_count
  from public.product_pricing_inputs ppi
  join public.products p on p.id = ppi.product_id
  where ppi.is_loss_leader
    and p.is_active
    and ppi.product_id <> new.product_id;

  if v_count >= coalesce(v_max, 5) then
    raise exception 'product_pricing_inputs: maximum active loss leaders reached (%)', coalesce(v_max, 5);
  end if;

  return new;
end;
$$;

drop trigger if exists products_enforce_max_loss_leaders
  on public.products;
drop trigger if exists product_pricing_inputs_enforce_max_loss_leaders
  on public.product_pricing_inputs;
create trigger product_pricing_inputs_enforce_max_loss_leaders
  before insert or update of is_loss_leader
  on public.product_pricing_inputs
  for each row execute function public.enforce_max_loss_leaders();

create or replace view public.product_pricing_readiness as
select
  p.id,
  p.sku,
  p.name,
  ppi.fob_usd,
  ppi.qty_per_container,
  p.cbm_per_unit,
  round(pp.useful_container_cbm_40hc / nullif(p.cbm_per_unit, 0))::int
    as indicative_qty_per_container_from_cbm,
  case
    when ppi.qty_per_container is null or p.cbm_per_unit <= 0 then null
    else abs(
      ppi.qty_per_container
      - round(pp.useful_container_cbm_40hc / nullif(p.cbm_per_unit, 0))::int
    )::numeric / greatest(ppi.qty_per_container, 1)
  end as qty_container_delta_ratio,
  case
    when ppi.qty_per_container is null or p.cbm_per_unit <= 0 then false
    else (
      abs(
        ppi.qty_per_container
        - round(pp.useful_container_cbm_40hc / nullif(p.cbm_per_unit, 0))::int
      )::numeric / greatest(ppi.qty_per_container, 1)
    ) > 0.15
  end as needs_qty_container_review
from public.products p
left join public.product_pricing_inputs ppi on ppi.product_id = p.id
cross join lateral (
  select useful_container_cbm_40hc
  from public.pricing_parameters
  where is_active
  order by version desc
  limit 1
) pp
where public.current_user_role() in ('admin', 'super_admin');

create or replace function public.admin_save_product_full(payload jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_product_id text := payload ->> 'id';
  v_is_create boolean := coalesce((payload ->> 'create')::boolean, false);
  v_product jsonb := payload -> 'product';
  v_partner_net_price numeric;
  v_variant jsonb;
  v_commitment jsonb;
  v_removed_id text;
begin
  if not public.is_admin() then
    raise exception 'admin_save_product_full: caller is not admin'
      using errcode = '42501';
  end if;

  if v_product_id is null or v_product_id = '' then
    raise exception 'admin_save_product_full: missing product id';
  end if;

  if v_product is null then
    raise exception 'admin_save_product_full: missing product payload';
  end if;

  if v_is_create then
    insert into public.products (
      id, sku, category, name, description,
      dim_length_cm, dim_width_cm, dim_height_cm,
      cbm_per_unit, weight_kg, moq_units,
      base_price_ht, retail_price_ref, eco_contribution,
      main_image_url, gallery_urls, features,
      fire_rating, is_active, sort_order
    )
    values (
      v_product_id,
      v_product ->> 'sku',
      (v_product ->> 'category')::public.product_category,
      v_product ->> 'name',
      coalesce(v_product ->> 'description', ''),
      coalesce((v_product ->> 'dim_length_cm')::int, 0),
      coalesce((v_product ->> 'dim_width_cm')::int, 0),
      coalesce((v_product ->> 'dim_height_cm')::int, 0),
      coalesce((v_product ->> 'cbm_per_unit')::numeric, 0.01),
      coalesce((v_product ->> 'weight_kg')::numeric, 0),
      coalesce((v_product ->> 'moq_units')::int, 1),
      coalesce((v_product ->> 'base_price_ht')::numeric, 0),
      coalesce((v_product ->> 'retail_price_ref')::numeric, 0),
      coalesce((v_product ->> 'eco_contribution')::numeric, 0),
      coalesce(v_product ->> 'main_image_url', ''),
      coalesce(
        array(select jsonb_array_elements_text(v_product -> 'gallery_urls')),
        '{}'::text[]
      ),
      coalesce(
        array(select jsonb_array_elements_text(v_product -> 'features')),
        '{}'::text[]
      ),
      nullif(v_product ->> 'fire_rating', '')::public.fire_rating,
      coalesce((v_product ->> 'is_active')::boolean, true),
      coalesce((v_product ->> 'sort_order')::int, 0)
    );
  else
    update public.products set
      sku = coalesce(v_product ->> 'sku', sku),
      category = coalesce((v_product ->> 'category')::public.product_category, category),
      name = coalesce(v_product ->> 'name', name),
      description = coalesce(v_product ->> 'description', description),
      dim_length_cm = coalesce((v_product ->> 'dim_length_cm')::int, dim_length_cm),
      dim_width_cm = coalesce((v_product ->> 'dim_width_cm')::int, dim_width_cm),
      dim_height_cm = coalesce((v_product ->> 'dim_height_cm')::int, dim_height_cm),
      cbm_per_unit = coalesce((v_product ->> 'cbm_per_unit')::numeric, cbm_per_unit),
      weight_kg = coalesce((v_product ->> 'weight_kg')::numeric, weight_kg),
      moq_units = coalesce((v_product ->> 'moq_units')::int, moq_units),
      base_price_ht = coalesce((v_product ->> 'base_price_ht')::numeric, base_price_ht),
      retail_price_ref = coalesce((v_product ->> 'retail_price_ref')::numeric, retail_price_ref),
      eco_contribution = coalesce((v_product ->> 'eco_contribution')::numeric, eco_contribution),
      main_image_url = coalesce(v_product ->> 'main_image_url', main_image_url),
      gallery_urls = case
        when v_product ? 'gallery_urls' then
          coalesce(
            array(select jsonb_array_elements_text(v_product -> 'gallery_urls')),
            '{}'::text[]
          )
        else gallery_urls
      end,
      features = case
        when v_product ? 'features' then
          coalesce(
            array(select jsonb_array_elements_text(v_product -> 'features')),
            '{}'::text[]
          )
        else features
      end,
      fire_rating = case
        when v_product ? 'fire_rating' then
          nullif(v_product ->> 'fire_rating', '')::public.fire_rating
        else fire_rating
      end,
      is_active = coalesce((v_product ->> 'is_active')::boolean, is_active),
      sort_order = coalesce((v_product ->> 'sort_order')::int, sort_order),
      updated_at = now()
    where id = v_product_id;

    if not found then
      raise exception 'admin_save_product_full: product % not found', v_product_id;
    end if;
  end if;

  insert into public.product_pricing_inputs (
    product_id,
    fob_usd,
    qty_per_container,
    is_loss_leader,
    table_price_modifier_rate
  ) values (
    v_product_id,
    nullif(v_product ->> 'fob_usd', '')::numeric,
    nullif(v_product ->> 'qty_per_container', '')::int,
    coalesce((v_product ->> 'is_loss_leader')::boolean, false),
    nullif(v_product ->> 'table_price_modifier_rate', '')::numeric
  )
  on conflict (product_id) do update set
    fob_usd = case
      when v_product ? 'fob_usd' then excluded.fob_usd
      else public.product_pricing_inputs.fob_usd
    end,
    qty_per_container = case
      when v_product ? 'qty_per_container' then excluded.qty_per_container
      else public.product_pricing_inputs.qty_per_container
    end,
    is_loss_leader = case
      when v_product ? 'is_loss_leader' then excluded.is_loss_leader
      else public.product_pricing_inputs.is_loss_leader
    end,
    table_price_modifier_rate = case
      when v_product ? 'table_price_modifier_rate' then excluded.table_price_modifier_rate
      else public.product_pricing_inputs.table_price_modifier_rate
    end,
    updated_at = now();

  if v_product ? 'partner_net_price_ht' then
    v_partner_net_price := nullif(v_product ->> 'partner_net_price_ht', '')::numeric;

    if coalesce(v_partner_net_price, 0) > 0 then
      insert into public.product_partner_prices (
        product_id,
        net_price_ht,
        is_active,
        override_reason,
        created_by,
        updated_by
      ) values (
        v_product_id,
        v_partner_net_price,
        true,
        coalesce(
          nullif(v_product ->> 'partner_net_override_reason', ''),
          'Admin product form global partner price'
        ),
        auth.uid(),
        auth.uid()
      )
      on conflict (product_id) do update set
        net_price_ht = excluded.net_price_ht,
        is_active = true,
        override_reason = excluded.override_reason,
        updated_by = auth.uid(),
        updated_at = now();
    else
      update public.product_partner_prices
      set is_active = false,
          updated_by = auth.uid(),
          updated_at = now()
      where product_id = v_product_id;
    end if;
  end if;

  for v_removed_id in
    select jsonb_array_elements_text(coalesce(payload -> 'removed_variant_ids', '[]'::jsonb))
  loop
    delete from public.product_variants where id = v_removed_id;
  end loop;

  for v_variant in
    select * from jsonb_array_elements(coalesce(payload -> 'variants', '[]'::jsonb))
  loop
    if coalesce(trim(v_variant ->> 'name'), '') = '' then
      continue;
    end if;
    insert into public.product_variants (
      id, product_id, name, image_url, gallery_urls, sort_order
    ) values (
      v_variant ->> 'id',
      v_product_id,
      v_variant ->> 'name',
      nullif(v_variant ->> 'image_url', ''),
      coalesce(
        array(select jsonb_array_elements_text(v_variant -> 'gallery_urls')),
        '{}'::text[]
      ),
      coalesce((v_variant ->> 'sort_order')::int, 0)
    )
    on conflict (id) do update set
      product_id = excluded.product_id,
      name = excluded.name,
      image_url = excluded.image_url,
      gallery_urls = excluded.gallery_urls,
      sort_order = excluded.sort_order;
  end loop;

  for v_commitment in
    select * from jsonb_array_elements(coalesce(payload -> 'commitments', '[]'::jsonb))
  loop
    if coalesce((v_commitment ->> 'units_committed')::int, 0) <= 0 then
      delete from public.container_seed_commitments
      where container_id = (v_commitment ->> 'container_id')::uuid
        and variant_id = v_commitment ->> 'variant_id';
    else
      insert into public.container_seed_commitments (
        container_id, variant_id, units_committed
      ) values (
        (v_commitment ->> 'container_id')::uuid,
        v_commitment ->> 'variant_id',
        (v_commitment ->> 'units_committed')::int
      )
      on conflict (container_id, variant_id) do update set
        units_committed = excluded.units_committed;
    end if;
  end loop;
end;
$$;

revoke all on table public.product_pricing_readiness
  from anon, public, authenticated;
grant select on public.product_pricing_readiness to authenticated;

revoke all on function public.get_price(text, public.pricing_channel, int, uuid, timestamptz)
  from public, anon, authenticated;
revoke execute on function public.admin_save_product_full(jsonb) from public, anon;
grant execute on function public.admin_save_product_full(jsonb) to authenticated;
