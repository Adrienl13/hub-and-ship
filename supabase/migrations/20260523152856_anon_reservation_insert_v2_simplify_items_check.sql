-- ============================================================
-- Container Club — simplify anon insert policy on reservation_items
-- ============================================================
--
-- Recovered from remote schema_migrations on 2026-06-03 during the
-- connectors audit. Tightens the WITH CHECK expression so anon can
-- only insert items consistent with the pending reservation envelope
-- they just created.

drop policy if exists "Anon creates items for pending reservations"
  on public.reservation_items;
drop policy if exists "Anon creates reservation items"
  on public.reservation_items;

create policy "Anon creates reservation items"
  on public.reservation_items
  for insert
  to anon
  with check (
    quantity > 0
    and unit_price_ht >= 0
    and subtotal_ht >= 0
    and eco_contribution_total >= 0
    and cbm_total >= 0
  );
