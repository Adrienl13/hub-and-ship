-- Reshape `product_variants` from "color swatch" semantics to "design with
-- photos" semantics.
--
-- Context (product decision, 2026-05-30):
-- The catalogue was modelled around colour swatches: each variant carried a
-- `hex` triplet rendered as a pastille. The actual business is selling the
-- same shape (chaise, fauteuil…) declined in different *designs* (motifs,
-- finitions). The client should pick a design by browsing real photos, not
-- by clicking a coloured dot.
--
-- Schema impact:
--   - Drop `hex` (no longer surfaced anywhere).
--   - Add `gallery_urls text[]` so each design carries its own additional
--     photos on top of `image_url` (which is now the design's hero photo).
--     Default `'{}'` keeps existing rows valid without backfill.

alter table public.product_variants
  drop column if exists hex,
  add column if not exists gallery_urls text[] not null default '{}'::text[];

comment on column public.product_variants.image_url is
  'Hero photo of this design (shown as thumbnail in the selector and as the default in the gallery).';
comment on column public.product_variants.gallery_urls is
  'Additional photos for this design. Combined with image_url to feed the public ProductGallery when the design is selected.';
