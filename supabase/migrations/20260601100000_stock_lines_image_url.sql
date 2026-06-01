-- Let admins attach a specific photo to a stock 24h line — useful for
-- the "Carton ouvert" and "Exposition" conditions where the live shot
-- of the actual lot reassures the buyer more than the catalogue
-- glamour shot. Nullable; the front-end falls back to the product /
-- design hero photo when this column is empty.

alter table public.stock_lines
  add column if not exists image_url text;

comment on column public.stock_lines.image_url is
  'Optional photo of the actual warehouse lot. Falls back to the product / design hero on the public page when empty.';
