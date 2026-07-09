-- Ajustement ciblé des prix — modifier UNE catégorie / collection sans
-- toucher aux autres, dans la philosophie « recalcul explicite » du P0 :
-- dry-run (diff produit par produit) puis application en un clic, admin only.
--
-- Périmètre (payload jsonb) :
--   category   : filtre products.category (ex. 'table'), optionnel
--   sku_prefix : filtre sku (ex. 'TAB-' ou 'BIS-'), optionnel
--   percent    : ajustement en % du prix de base actuel, requis (-50..+100)
-- Les prix revendeur/distributeur suivent automatiquement (coefficients).

create or replace function public.admin_preview_price_adjustment(payload jsonb)
returns table (
  product_id text,
  sku text,
  name text,
  category text,
  current_price_ht numeric,
  new_price_ht numeric,
  delta_percent numeric,
  below_floor boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_category text;
  v_sku_prefix text;
  v_percent numeric;
begin
  if not public.is_admin() then
    raise exception 'admin_preview_price_adjustment: caller is not admin'
      using errcode = '42501';
  end if;
  if jsonb_typeof(payload) is distinct from 'object' then
    raise exception 'admin_preview_price_adjustment: payload must be an object';
  end if;

  v_category := nullif(payload ->> 'category', '');
  v_sku_prefix := nullif(payload ->> 'sku_prefix', '');
  v_percent := (payload ->> 'percent')::numeric;

  if v_percent is null or v_percent < -50 or v_percent > 100 then
    raise exception 'admin_preview_price_adjustment: percent must be between -50 and 100';
  end if;

  return query
  select
    p.id,
    p.sku,
    p.name,
    p.category::text,
    p.base_price_ht,
    round(p.base_price_ht * (1 + v_percent / 100), 2),
    v_percent,
    -- Sous-plancher vérifiable uniquement quand les coûts réels existent.
    coalesce(
      round(p.base_price_ht * (1 + v_percent / 100), 2) < gp.floor_ht,
      false
    )
  from public.products p
  left join public.product_pricing_inputs ppi on ppi.product_id = p.id
  left join lateral (
    select round(g.landed_cost_ht * (
      1 + (select pp.min_margin_floor from public.pricing_parameters pp
           where pp.is_active order by pp.effective_from desc limit 1)
    ), 2) as floor_ht
    from public.get_price(p.id, 'direct', 1) g
    where ppi.fob_usd is not null and ppi.qty_per_container is not null
  ) gp on true
  where p.is_active
    and (v_category is null or p.category::text = v_category)
    and (v_sku_prefix is null or upper(p.sku) like upper(v_sku_prefix) || '%')
  order by p.sort_order, p.id;
end;
$$;

revoke execute on function public.admin_preview_price_adjustment(jsonb) from public, anon;
grant execute on function public.admin_preview_price_adjustment(jsonb) to authenticated;

create or replace function public.admin_apply_price_adjustment(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_category text;
  v_sku_prefix text;
  v_percent numeric;
  v_updated int := 0;
begin
  if not public.is_admin() then
    raise exception 'admin_apply_price_adjustment: caller is not admin'
      using errcode = '42501';
  end if;
  if jsonb_typeof(payload) is distinct from 'object' then
    raise exception 'admin_apply_price_adjustment: payload must be an object';
  end if;

  v_category := nullif(payload ->> 'category', '');
  v_sku_prefix := nullif(payload ->> 'sku_prefix', '');
  v_percent := (payload ->> 'percent')::numeric;

  if v_percent is null or v_percent < -50 or v_percent > 100 then
    raise exception 'admin_apply_price_adjustment: percent must be between -50 and 100';
  end if;
  if v_percent = 0 then
    return jsonb_build_object('updated', 0);
  end if;

  update public.products p
  set base_price_ht = round(p.base_price_ht * (1 + v_percent / 100), 2)
  where p.is_active
    and (v_category is null or p.category::text = v_category)
    and (v_sku_prefix is null or upper(p.sku) like upper(v_sku_prefix) || '%');

  get diagnostics v_updated = row_count;
  return jsonb_build_object('updated', v_updated);
end;
$$;

revoke execute on function public.admin_apply_price_adjustment(jsonb) from public, anon;
grant execute on function public.admin_apply_price_adjustment(jsonb) to authenticated;

comment on function public.admin_apply_price_adjustment(jsonb) is
  'Scoped explicit price adjustment (category and/or sku prefix, ±%). Admin-only; pairs with admin_preview_price_adjustment for the dry-run diff.';
