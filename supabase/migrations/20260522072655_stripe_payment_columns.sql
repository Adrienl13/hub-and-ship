-- Stripe payment columns on reservations.
-- Added to support Stripe Checkout (mode redirect, fee-only) wired in
-- session 1 alongside the codex reservation foundation.
--
-- Status transitions handled by the webhook:
--   * checkout.session.completed         -> status='reserved', paid_reservation_fee_at=now()
--   * checkout.session.expired/failed    -> status='cancelled', cancellation_reason='stripe_payment_failed'
--
-- This migration is additive and idempotent so it can be applied alongside
-- the codex reservation_foundation migration without conflict.

alter table public.reservations
  add column if not exists stripe_payment_intent_id text,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_checkout_session_id text,
  add column if not exists paid_reservation_fee_at timestamptz;

create index if not exists reservations_stripe_session_idx
  on public.reservations (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

comment on column public.reservations.stripe_payment_intent_id is 'Stripe PaymentIntent id from successful checkout.session.completed';
comment on column public.reservations.stripe_customer_id is 'Stripe Customer id captured at checkout.session.completed';
comment on column public.reservations.stripe_checkout_session_id is 'Stripe Checkout Session id, set when createCheckoutSession is called';
comment on column public.reservations.paid_reservation_fee_at is 'Timestamp at which the reservation fee was confirmed paid by the Stripe webhook';
