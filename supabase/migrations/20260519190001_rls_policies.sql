-- ============================================================
-- Container Club — Row Level Security (initial)
-- Anon role (browser using the publishable key) can INSERT new
-- reservations but cannot read them back. Reads are reserved for
-- the service-role key on the server side (admin dashboard).
-- ============================================================
--
-- Recovered from remote schema_migrations on 2026-06-03 during the
-- connectors audit. Subsequent migrations
-- (anon_reservation_insert, anon_reservation_insert_v2,
--  versioned_admin_policies_…) supersede the bodies of these
-- policies — keeping the original here so that the migration
-- timeline matches what Supabase tracks.

alter table public.reservations        enable row level security;
alter table public.reservation_items   enable row level security;

drop policy if exists "anon can insert reservations" on public.reservations;
create policy "anon can insert reservations"
  on public.reservations
  for insert
  to anon
  with check (
    char_length(name)       between 2 and 120
    and char_length(company) between 2 and 200
    and email like '%@%'
    and char_length(phone) between 6 and 30
    and subtotal_ht_cents > 0
    and reservation_fee_cents > 0
    and status = 'pending'
  );

drop policy if exists "anon can insert reservation_items" on public.reservation_items;
create policy "anon can insert reservation_items"
  on public.reservation_items
  for insert
  to anon
  with check (
    quantity > 0
    and unit_price_ht_cents >= 0
  );
