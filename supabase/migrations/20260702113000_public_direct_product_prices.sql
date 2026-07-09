-- Public commercial price projection.
--
-- The private pricing engine returns landed cost and parameter snapshots, so it
-- is not exposed directly. This wrapper returns only customer-safe commercial
-- fields for public catalogue display.

create or replace function public.get_public_product_prices(
  p_quantity int default 1
)
returns table (
  product_id text,
  unit_price_ht numeric,
  tier_applied text,
  parameters_version int
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    p.id as product_id,
    gp.unit_price_ht,
    gp.tier_applied,
    gp.parameters_version
  from public.products p
  cross join lateral public.get_price(
    p.id,
    'direct'::public.pricing_channel,
    greatest(coalesce(p_quantity, 1), 1),
    null,
    now()
  ) gp
  where p.is_active;
$$;

revoke all on function public.get_public_product_prices(int)
  from public, anon, authenticated;
grant execute on function public.get_public_product_prices(int)
  to anon, authenticated;

comment on function public.get_public_product_prices(int) is
  'Customer-safe public direct prices. Does not expose landed cost, cost inputs, margins, freight, or pricing parameters.';
