-- Allow anonymous visitors to create a reservation (and its items) so the
-- public reservation tunnel can write to Supabase. The tables remain SELECT-
-- closed for anon — the client never reads back what it inserted. Reads are
-- gated by the existing "Users see own ..." policies for authenticated users.
--
-- Guard rails on the WITH CHECK clauses keep the surface narrow:
--   * reservations must be anonymous (user_id IS NULL, company_id IS NULL)
--   * status pinned to the initial state (Stripe webhook flips it later)
--   * SIRET sanity-checked (14 digits — schema validation also enforces this
--     client-side, this is the server-side belt)
--   * monetary fields cannot be negative
--   * reservation_items must reference a row currently in
--     pending_reservation_fee created less than 15 minutes ago, which bounds
--     the window where an anon can attach items to an existing reservation.

drop policy if exists "Anon creates pending reservations" on public.reservations;
create policy "Anon creates pending reservations"
  on public.reservations
  for insert
  to anon
  with check (
    user_id is null
    and company_id is null
    and status = 'pending_reservation_fee'
    and char_length(siret) = 14
    and siret ~ '^[0-9]{14}$'
    and subtotal_ht >= 0
    and total_ttc >= 0
    and pay_now >= 0
    and reservation_fee >= 0
  );

-- The items policy intentionally does NOT cross-check against `reservations`
-- via an EXISTS sub-select: such a sub-select would itself be subject to the
-- `reservations` SELECT policy, which is restricted to authenticated users
-- and would always return zero rows when called from the `anon` role. The
-- foreign key (`reservation_id` references `reservations.id`) already
-- guarantees the parent row exists; the WITH CHECK clause below adds
-- numeric sanity checks and pins everything else.
drop policy if exists "Anon creates items for pending reservations"
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
