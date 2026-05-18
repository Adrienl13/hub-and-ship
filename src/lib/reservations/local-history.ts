import type { ReservationDraft } from './draft'

export const LOCAL_RESERVATION_HISTORY_KEY =
  'container-club-local-reservations'

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

function isLocalReservationRecord(value: unknown): value is LocalReservationRecord {
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
  const status = persisted ? 'reserved' : 'pending_reservation_fee'

  return {
    id: `local-${draft.reference}`,
    status,
    draft,
    paidAmount: persisted ? draft.payment.payNow : 0,
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
    (entry) => entry.id !== record.id,
  )

  writeLocalReservationHistory({
    storage,
    records: [record, ...previous].slice(0, 20),
  })

  return record
}
