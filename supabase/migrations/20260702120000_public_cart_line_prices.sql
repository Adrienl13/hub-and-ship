-- Customer-safe cart line pricing.
--
-- The catalogue price projection handles a single shared quantity. The cart
-- needs product-specific quantities so tier discounts are reflected before the
-- reservation is submitted. This wrapper returns only commercial price fields.

create or replace function public.get_public_product_prices_for_lines(
  p_lines jsonb
)
returns table (
  product_id text,
  quantity int,
  unit_price_ht numeric,
  tier_applied text,
  parameters_version int
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_line jsonb;
  v_product_id text;
  v_quantity int;
  v_count int;
begin
  if jsonb_typeof(p_lines) is distinct from 'array' then
    raise exception 'get_public_product_prices_for_lines: lines must be an array';
  end if;

  v_count := jsonb_array_length(p_lines);
  if v_count > 50 then
    raise exception 'get_public_product_prices_for_lines: too many lines';
  end if;

  for v_line in select value from jsonb_array_elements(p_lines)
  loop
    if jsonb_typeof(v_line) is distinct from 'object' then
      raise exception 'get_public_product_prices_for_lines: line must be an object';
    end if;

    v_product_id := nullif(v_line ->> 'product_id', '');
    v_quantity := greatest(coalesce((v_line ->> 'quantity')::int, 1), 1);

    if v_product_id is null then
      raise exception 'get_public_product_prices_for_lines: missing product_id';
    end if;

    return query
    select
      gp.product_id,
      gp.quantity,
      gp.unit_price_ht,
      gp.tier_applied,
      gp.parameters_version
    from public.get_price(
      v_product_id,
      'direct'::public.pricing_channel,
      v_quantity,
      null,
      now()
    ) gp;
  end loop;
end;
$$;

revoke all on function public.get_public_product_prices_for_lines(jsonb)
  from public, anon, authenticated;
grant execute on function public.get_public_product_prices_for_lines(jsonb)
  to anon, authenticated;

comment on function public.get_public_product_prices_for_lines(jsonb) is
  'Customer-safe per-line direct cart prices. Does not expose landed cost, cost inputs, margins, freight, or pricing parameters.';
