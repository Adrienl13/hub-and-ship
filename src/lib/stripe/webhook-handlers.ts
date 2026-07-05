import type Stripe from 'stripe'

interface RepositoryError {
  readonly message: string
}

interface ReservationUpdateResult {
  readonly error: RepositoryError | null
}

export interface ReservationUpdateBuilder extends PromiseLike<ReservationUpdateResult> {
  eq: (
    column: 'id' | 'status' | 'stripe_checkout_session_id',
    value: string,
  ) => ReservationUpdateBuilder
}

export interface WebhookReservationClient {
  from: (table: 'reservations') => {
    update: (payload: Record<string, unknown>) => ReservationUpdateBuilder
  }
}

function getReservationId(session: Stripe.Checkout.Session): string | null {
  return session.metadata?.reservation_id ?? null
}

function getPaymentIntentId(session: Stripe.Checkout.Session): string | null {
  return typeof session.payment_intent === 'string'
    ? session.payment_intent
    : (session.payment_intent?.id ?? null)
}

function getCustomerId(session: Stripe.Checkout.Session): string | null {
  return typeof session.customer === 'string'
    ? session.customer
    : (session.customer?.id ?? null)
}

export async function markReservationReserved({
  client,
  session,
  now = new Date(),
}: {
  readonly client: WebhookReservationClient
  readonly session: Stripe.Checkout.Session
  readonly now?: Date
}): Promise<void> {
  const reservationId = getReservationId(session)
  if (!reservationId) {
    console.warn(
      'stripe webhook: checkout.session.completed without reservation_id metadata',
      { sessionId: session.id },
    )
    return
  }

  const nowIso = now.toISOString()
  const { error } = await client
    .from('reservations')
    .update({
      status: 'reserved',
      stripe_payment_intent_id: getPaymentIntentId(session),
      stripe_customer_id: getCustomerId(session),
      stripe_checkout_session_id: session.id,
      paid_reservation_fee_at: nowIso,
      reserved_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', reservationId)
    .eq('status', 'pending_reservation_fee')

  if (error) {
    console.error('stripe webhook: failed to mark reservation reserved', {
      reservationId,
      error,
    })
  }
}

export async function markReservationCancelled({
  client,
  session,
  now = new Date(),
}: {
  readonly client: WebhookReservationClient
  readonly session: Stripe.Checkout.Session
  readonly now?: Date
}): Promise<void> {
  const reservationId = getReservationId(session)
  if (!reservationId) {
    console.warn(
      'stripe webhook: session expired/failed without reservation_id metadata',
      { sessionId: session.id },
    )
    return
  }

  const nowIso = now.toISOString()
  const { error } = await client
    .from('reservations')
    .update({
      status: 'cancelled',
      cancelled_at: nowIso,
      cancellation_reason: 'stripe_payment_failed',
      updated_at: nowIso,
    })
    .eq('id', reservationId)
    .eq('status', 'pending_reservation_fee')
    .eq('stripe_checkout_session_id', session.id)

  if (error) {
    console.error('stripe webhook: failed to mark reservation cancelled', {
      reservationId,
      error,
    })
  }
}
