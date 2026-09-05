// Statut de paiement d'une réservation au retour de Stripe Checkout.
//
// Cas d'usage : un acheteur INVITÉ (checkout anonyme, pas de session Supabase)
// est renvoyé par Stripe sur /account/reservations/<id>?session_id=cs_… La
// page ne connaît alors que l'historique local, dont le statut reste figé à
// 'pending_reservation_fee'. Cette server function lit la ligne via le client
// service-role et ne répond QUE si le couple (uuid, session id Stripe)
// correspond : ce couple fait office de jeton d'accès.

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { ReservationStatus } from '@/lib/supabase/types'

const inputSchema = z.object({
  reservationId: z.string().uuid(),
  sessionId: z.string().min(1).max(200),
})

export type ReservationPaymentStatusRow = {
  readonly id: string
  readonly status: ReservationStatus
  readonly reservation_fee: number | string | null
  readonly paid_reservation_fee_at: string | null
  readonly stripe_checkout_session_id: string | null
}

export type ReservationPaymentStatusResult =
  | { readonly found: false }
  | {
      readonly found: true
      readonly status: ReservationStatus
      readonly paidAmount: number
    }

/**
 * Logique pure : ne révèle le statut que si le session id Stripe fourni est
 * celui enregistré sur la réservation. Le montant réglé n'est renseigné
 * qu'une fois `paid_reservation_fee_at` posé par le webhook.
 */
export function resolvePaymentStatus(
  row: ReservationPaymentStatusRow | null,
  sessionId: string,
): ReservationPaymentStatusResult {
  if (!row) return { found: false }
  if (
    !row.stripe_checkout_session_id ||
    row.stripe_checkout_session_id !== sessionId
  ) {
    return { found: false }
  }

  const fee = Number(row.reservation_fee)
  const paidAmount =
    row.paid_reservation_fee_at && Number.isFinite(fee) && fee > 0 ? fee : 0

  return { found: true, status: row.status, paidAmount }
}

export const getReservationPaymentStatus = createServerFn({ method: 'POST' })
  .inputValidator(inputSchema)
  .handler(async ({ data }): Promise<ReservationPaymentStatusResult> => {
    const supabase = getSupabaseAdmin()

    const { data: row, error } = await supabase
      .from('reservations')
      .select(
        'id, status, reservation_fee, paid_reservation_fee_at, stripe_checkout_session_id',
      )
      .eq('id', data.reservationId)
      .maybeSingle()

    if (error) {
      // Détail en logs serveur, message générique côté client.
      console.error('getReservationPaymentStatus: supabase read failed', error)
      throw new Error('Reservation lookup failed')
    }

    return resolvePaymentStatus(row, data.sessionId)
  })

export const PAYMENT_STATUS_POLL_ATTEMPTS = 4
export const PAYMENT_STATUS_POLL_INTERVAL_MS = 1500

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Interroge le statut jusqu'à ce que le webhook Stripe ait fait basculer la
 * réservation (ou qu'elle soit annulée) : `attempts` essais espacés de
 * `intervalMs`. Une erreur réseau compte comme un essai sans interrompre la
 * boucle. Renvoie le dernier résultat obtenu (null si aucun appel n'a abouti)
 * — c'est l'appelant qui décide de l'UI.
 */
export async function pollReservationPaymentStatus({
  fetchStatus,
  attempts = PAYMENT_STATUS_POLL_ATTEMPTS,
  intervalMs = PAYMENT_STATUS_POLL_INTERVAL_MS,
  sleep = defaultSleep,
  isCancelled = () => false,
}: {
  readonly fetchStatus: () => Promise<ReservationPaymentStatusResult>
  readonly attempts?: number
  readonly intervalMs?: number
  readonly sleep?: (ms: number) => Promise<void>
  readonly isCancelled?: () => boolean
}): Promise<ReservationPaymentStatusResult | null> {
  let last: ReservationPaymentStatusResult | null = null

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (isCancelled()) return last

    try {
      last = await fetchStatus()
      // Payée ou annulée : le statut ne bougera plus, inutile d'insister.
      if (last.found && last.status !== 'pending_reservation_fee') return last
    } catch (error) {
      console.warn('getReservationPaymentStatus: poll attempt failed', error)
    }

    if (attempt < attempts - 1) await sleep(intervalMs)
  }

  return last
}
