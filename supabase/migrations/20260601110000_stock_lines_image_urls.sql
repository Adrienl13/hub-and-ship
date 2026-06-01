-- Add a multi-photo gallery on each stock 24h line.
--
-- `image_url` (already shipped in 20260601100000) is the hero — the
-- thumbnail in the public list. `image_urls` is the supporting set
-- (5–6 shots typical) shown in the right-hand details panel so the
-- buyer can scrutinise the actual lot before requesting it. Same
-- pattern as `products.gallery_urls`.

alter table public.stock_lines
  add column if not exists image_urls text[] not null default '{}'::text[];

comment on column public.stock_lines.image_urls is
  'Additional photos of the actual warehouse lot. Combined with image_url + product / design hero to feed the public details panel.';
