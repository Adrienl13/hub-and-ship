-- ============================================================
-- Container Club — Row Level Security
-- Anon role (browser using the publishable key) can INSERT new
-- reservations but cannot read them back. Reads are reserved for
-- the service-role key on the server side (admin dashboard).
-- ============================================================

alter table public.reservations        enable row level security;
alter table public.reservation_items   enable row level security;

-- --- INSERT policies (anonymous web visitors) ------------------

drop policy if exists "anon can insert reservations" on public.reservations;
create policy "anon can insert reservations"
  on public.reservations
  for insert
  to anon
  with check (
    -- Minimal hygiene checks. Heavy validation should be done
    -- in an Edge Function or via Stripe webhook before flipping
    -- status to 'paid'.
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

-- --- No SELECT/UPDATE/DELETE for anon --------------------------
-- The service-role key (used by trusted server code only) bypasses
-- RLS entirely, so the admin dashboard / Edge Functions retain
-- full access without explicit policies.

-- --- Notes -----------------------------------------------------
-- Future hardening to apply once auth is wired up:
--   * Add 'professionals' table linked to auth.users.
--   * Replace 'anon insert' policies with 'authenticated insert
--     where professional_id = auth.uid()'.
--   * Add SELECT/UPDATE policies scoped to the owner.
--   * Rate-limiting at the edge (Cloudflare WAF or a Supabase
--     Edge Function with a sliding window).
