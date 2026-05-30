-- Atomic admin save for a full product payload.
--
-- Context (audit, 2026-05-30): `AdminProductEditor.handleSubmit` was chaining
-- 4 separate awaits (product upsert/update + N variant deletes + N variant
-- upserts + N commitment upserts). A failure mid-flow left the DB in a
-- partial state (product saved but variants stale, or commitments saved
-- against a stale variant set). This RPC wraps the whole save in a single
-- transaction.
--
-- Inputs (JSONB):
--   {
--     "id": "p7",                       -- product id (text, required)
--     "create": true|false,             -- true = INSERT; false = UPDATE
--     "product": { ...products columns... },
--     "variants": [ { "id": "...", "name": "...", "image_url": null,
--                     "gallery_urls": [...], "sort_order": 0 }, ... ],
--     "removed_variant_ids": [ "id1", "id2" ],
--     "commitments": [ { "container_id": "uuid", "variant_id": "...",
--                        "units_committed": 12 }, ... ]
--   }
--
-- Security: SECURITY DEFINER + an `is_admin()` gate so non-admin callers
-- cannot bypass RLS by invoking the RPC directly. EXECUTE granted only to
-- the `authenticated` role (anon never reaches here).

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

  -- Remove dropped variants first (cascade would also drop their commitments).
  for v_removed_id in
    select jsonb_array_elements_text(coalesce(payload -> 'removed_variant_ids', '[]'::jsonb))
  loop
    delete from public.product_variants where id = v_removed_id;
  end loop;

  -- Upsert remaining variants.
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

  -- Upsert commitments (zero units → delete).
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
