-- Re-baseline `cbm_per_unit` for tables to reflect that tables ship
-- disassembled (top + leg bundle), not fully built.
--
-- Why: the visual packer in the front-end uses cbm_per_unit to size
-- each package, and a 20' HC (37 m³) only fits ~100 fully-assembled
-- tables. Container Club's actual norm is ~400 tables per container,
-- which corresponds to disassembled tops stacked on pallets.
--
-- The new values approximate a 6 cm plywood/HPL top + a bundle of
-- folded legs of the same footprint, so the table footprint stays the
-- same but its height collapses from 73 cm assembled to ~12 cm flat.

update public.products
set cbm_per_unit = 0.08,
    updated_at = now()
where category = 'table'
  and dim_length_cm * dim_width_cm <= 8000; -- e.g. 80×80, 80×100, …

update public.products
set cbm_per_unit = 0.12,
    updated_at = now()
where category = 'table'
  and dim_length_cm * dim_width_cm > 8000; -- e.g. 160×80, 180×90, …
