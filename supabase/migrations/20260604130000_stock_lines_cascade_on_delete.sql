-- Align stock_lines foreign keys with the cascade pattern already used by
-- container_seed_commitments (variant_id ON DELETE CASCADE).
--
-- Before: stock_lines.variant_id and .product_id were ON DELETE RESTRICT, so
-- removing a design (or product) that had a 24h stock lot attached raised
--   "update or delete on table product_variants violates foreign key
--    constraint stock_lines_variant_id_fkey on table stock_lines"
-- and — since the admin UI only deactivates stock lines, never hard-deletes
-- them — left the admin permanently unable to edit/delete that product.
--
-- After: deleting a design or product also removes its stock lot(s). A lot of
-- a design that no longer exists is meaningless, and nothing references
-- stock_lines via a foreign key (stock_requests keeps only a soft, historical
-- reference), so the cascade is safe.

alter table public.stock_lines
  drop constraint if exists stock_lines_variant_id_fkey,
  add constraint stock_lines_variant_id_fkey
    foreign key (variant_id) references public.product_variants (id)
    on delete cascade;

alter table public.stock_lines
  drop constraint if exists stock_lines_product_id_fkey,
  add constraint stock_lines_product_id_fkey
    foreign key (product_id) references public.products (id)
    on delete cascade;
