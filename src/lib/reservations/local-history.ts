import type { ReservationStatus } from '@/lib/supabase/types'
import type { ReservationDraft } from './draft'

export const LOCAL_RESERVATION_HISTORY_KEY = 'container-club-local-reservations'
export const LOCAL_RESERVATION_FEE_PAID_LABEL = 'Frais de réservation réglés'

// Les frais sont réglés dès que le webhook Stripe a sorti la réservation de
// 'pending_reservation_fee' — sauf annulation.
export function isReservationFeeSettled(status: string): boolean {
  return status !== 'pending_reservation_fee' && status !== 'cancelled'
}

export interface LocalReservationRecord {
  readonly id: string
  readonly status: 'pending_reservation_fee' | 'reserved'
  readonly draft: ReservationDraft
  readonly paidAmount: number
  readonly nextActionLabel: string
  readonly updatedAt: string
}

export interface ReservationHistoryStorage {
  readonly getItem: (key: string) => string | null
  readonly setItem: (key: string, value: string) => void
}

function isLocalReservationRecord(
  value: unknown,
): value is LocalReservationRecord {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Partial<LocalReservationRecord>
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.status === 'string' &&
    typeof candidate.paidAmount === 'number' &&
    typeof candidate.nextActionLabel === 'string' &&
    typeof candidate.updatedAt === 'string' &&
    Boolean(candidate.draft)
  )
}

export function createLocalReservationRecord({
  draft,
  persisted,
}: {
  readonly draft: ReservationDraft
  readonly persisted: boolean
}): LocalReservationRecord {
  return {
    id: draft.id,
    status: 'pending_reservation_fee',
    draft,
    paidAmount: 0,
    nextActionLabel: persisted
      ? 'Reservation enregistree, paiement a finaliser'
      : 'Reservation locale prete a synchroniser',
    updatedAt: draft.cgvAcceptedAt,
  }
}

export function readLocalReservationHistory(
  storage: ReservationHistoryStorage,
): ReadonlyArray<LocalReservationRecord> {
  const raw = storage.getItem(LOCAL_RESERVATION_HISTORY_KEY)
  if (!raw) return []

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed.filter(isLocalReservationRecord)
  } catch {
    return []
  }
}

export function writeLocalReservationHistory({
  storage,
  records,
}: {
  readonly storage: ReservationHistoryStorage
  readonly records: ReadonlyArray<LocalReservationRecord>
}): void {
  storage.setItem(LOCAL_RESERVATION_HISTORY_KEY, JSON.stringify(records))
}

export function saveReservationDraftToLocalHistory({
  storage,
  draft,
  persisted,
}: {
  readonly storage: ReservationHistoryStorage
  readonly draft: ReservationDraft
  readonly persisted: boolean
}): LocalReservationRecord {
  const record = createLocalReservationRecord({ draft, persisted })
  const previous = readLocalReservationHistory(storage).filter(
    (entry) =>
      entry.id !== record.id &&
      entry.draft.id !== draft.id &&
      entry.draft.reference !== draft.reference,
  )

  writeLocalReservationHistory({
    storage,
    records: [record, ...previous].slice(0, 20),
  })

  return record
}

/**
 * Répercute le statut serveur (retour Stripe) sur l'enregistrement local :
 * 'reserved' + montant réglé dès que les frais sont soldés. Le statut local
 * n'a pas de valeur 'cancelled' : dans ce cas on ne touche qu'au montant.
 * No-op (null) si la réservation n'est pas dans l'historique local.
 */
export function applyPaymentStatusToLocalHistory({
  storage,
  reservationId,
  status,
  paidAmount,
  now = new Date(),
}: {
  readonly storage: ReservationHistoryStorage
  readonly reservationId: string
  readonly status: ReservationStatus
  readonly paidAmount: number
  readonly now?: Date
}): LocalReservationRecord | null {
  const records = readLocalReservationHistory(storage)
  const index = records.findIndex(
    (entry) => entry.id === reservationId || entry.draft.id === reservationId,
  )
  const current = records[index]
  if (!current) return null

  const settled = isReservationFeeSettled(status)
  const next: LocalReservationRecord = {
    ...current,
    status: settled ? 'reserved' : current.status,
    paidAmount,
    nextActionLabel: settled
      ? LOCAL_RESERVATION_FEE_PAID_LABEL
      : current.nextActionLabel,
    updatedAt: now.toISOString(),
  }

  writeLocalReservationHistory({
    storage,
    records: records.map((entry, position) =>
      position === index ? next : entry,
    ),
  })

  return next
}
