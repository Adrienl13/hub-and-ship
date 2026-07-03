-- LOT 2 — UTM / partner attribution columns.
--
-- Every partner link / QR carries first-touch tracking params
-- (?ref=<CODE>&utm_source=partner&utm_medium=qr&utm_campaign=corner_depot).
-- These are captured client-side on the landing visit (first-touch wins,
-- localStorage, 90d TTL) and written to the row created by the visitor so we
-- can attribute a reservation / stock request back to the channel that drove
-- it — before the first demo corner is even posted.
--
-- Nullable everywhere: legacy rows and untagged organic traffic stay clean.
-- `partner_ref` maps to the `?ref=` code; the three utm_* map 1:1.
-- partner_applications (LOT 3) gets the same four columns in its own migration.

alter table public.reservations
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists partner_ref text;

alter table public.stock_requests
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists partner_ref text;

-- Partner-code attribution reporting: which reservations/stock requests a
-- given partner_ref drove. Partial indexes keep them tiny (organic = NULL).
create index if not exists reservations_partner_ref_idx
  on public.reservations (partner_ref)
  where partner_ref is not null;

create index if not exists stock_requests_partner_ref_idx
  on public.stock_requests (partner_ref)
  where partner_ref is not null;

comment on column public.reservations.utm_source is
  'First-touch utm_source captured on the landing visit (nullable, first-touch wins).';
comment on column public.reservations.partner_ref is
  'First-touch partner referral code from ?ref=<CODE> (nullable).';
comment on column public.stock_requests.utm_source is
  'First-touch utm_source captured on the landing visit (nullable, first-touch wins).';
comment on column public.stock_requests.partner_ref is
  'First-touch partner referral code from ?ref=<CODE> (nullable).';
