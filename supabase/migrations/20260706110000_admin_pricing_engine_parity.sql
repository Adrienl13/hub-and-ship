-- Parité moteur de prix admin (audit régression pilotage).
--
-- La prod exécute déjà tout ceci via les migrations CODEX non commitées
-- (récupérées depuis la branche codex/etat-local-images) : colonnes de coût
-- sur products + admin_save_product_full v pricing (FOB, qté/container,
-- loss leader, modificateur table, prix net partenaire). Cette migration
-- rapatrie l'état prod dans le repo — idempotente : no-op en prod, création
-- propre sur base neuve.

alter table public.products
  add column if not exists fob_usd numeric(12, 4),
  add column if not exists qty_per_container int,
  add column if not exists is_loss_leader boolean not null default false,
  add column if not exists table_price_modifier_rate numeric(8, 4);


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
      base_price_ht, fob_usd, qty_per_container, is_loss_leader,
      table_price_modifier_rate, retail_price_ref, eco_contribution,
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
      nullif(v_product ->> 'fob_usd', '')::numeric,
      nullif(v_product ->> 'qty_per_container', '')::int,
      coalesce((v_product ->> 'is_loss_leader')::boolean, false),
      nullif(v_product ->> 'table_price_modifier_rate', '')::numeric,
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
      fob_usd = case
        when v_product ? 'fob_usd' then nullif(v_product ->> 'fob_usd', '')::numeric
        else fob_usd
      end,
      qty_per_container = case
        when v_product ? 'qty_per_container' then nullif(v_product ->> 'qty_per_container', '')::int
        else qty_per_container
      end,
      is_loss_leader = coalesce((v_product ->> 'is_loss_leader')::boolean, is_loss_leader),
      table_price_modifier_rate = case
        when v_product ? 'table_price_modifier_rate' then nullif(v_product ->> 'table_price_modifier_rate', '')::numeric
        else table_price_modifier_rate
      end,
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

revoke execute on function public.admin_save_product_full(jsonb) from public, anon;
grant execute on function public.admin_save_product_full(jsonb) to authenticated;
