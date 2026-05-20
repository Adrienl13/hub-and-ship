import { getDefaultVariant } from '@/lib/catalogue'
import { CURRENT_CONTAINER, PRODUCTS, type Product } from '@/lib/products'
import {
  buildReservationDraft,
  type ReservationDraft,
} from '@/lib/reservations/draft'
import type { LocalReservationRecord } from '@/lib/reservations/local-history'

export type AccountReservationStatus =
  | 'pending_reservation_fee'
  | 'reserved'
  | 'deposit_called'
  | 'in_production'
  | 'in_transit'
  | 'delivered'
  | 'cancelled'

export interface AccountReservation {
  readonly id: string
  readonly status: AccountReservationStatus
  readonly draft: ReservationDraft
  readonly paidAmount: number
  readonly nextActionLabel: string
  readonly updatedAt: string
}

export interface AccountReservationKpis {
  readonly activeCount: number
  readonly totalCommittedHt: number
  readonly totalPaid: number
  readonly totalCbm: number
}

function requireProduct(id: string): Product {
  const product = PRODUCTS.find((item) => item.id === id)
  if (!product)
    throw new Error(`Missing account reservation fixture product ${id}`)

  return product
}

const chair = requireProduct('p1')
const armchair = requireProduct('p2')
const table = requireProduct('p3')

function requireDraft(
  result: ReturnType<typeof buildReservationDraft>,
): ReservationDraft {
  if (!result.ok) {
    throw new Error(result.issues[0]?.message ?? 'Reservation fixture invalid')
  }

  return result.draft
}

const activeDraft = requireDraft(
  buildReservationDraft({
    siret: '55208131701750',
    contact: {
      name: 'Adrien Laniez',
      company: 'Hotel Demo',
      email: 'direction@hotel-demo.fr',
      phone: '+33 6 12 34 56 78',
    },
    delivery: {
      deliveryMode: 'pickup_at_port',
      deliveryNote: 'Enlevement par transporteur partenaire.',
    },
    cgvAccepted: true,
    cgvVersion: '2026-05-18',
    containerReference: CURRENT_CONTAINER.reference,
    now: new Date('2026-05-18T10:00:00.000Z'),
    sequence: 18,
    items: [
      {
        product: chair,
        variant: getDefaultVariant(chair),
        quantity: 50,
      },
      {
        product: table,
        variant: getDefaultVariant(table),
        quantity: 20,
      },
    ],
  }),
)

const paidDraft = requireDraft(
  buildReservationDraft({
    siret: '55208131701750',
    contact: {
      name: 'Adrien Laniez',
      company: 'Hotel Demo',
      email: 'direction@hotel-demo.fr',
      phone: '+33 6 12 34 56 78',
    },
    delivery: { deliveryMode: 'self_arranged' },
    cgvAccepted: true,
    cgvVersion: '2026-05-18',
    containerReference: 'CC-2025-014',
    now: new Date('2025-12-12T09:30:00.000Z'),
    sequence: 4,
    items: [
      {
        product: armchair,
        variant: getDefaultVariant(armchair),
        quantity: 50,
      },
    ],
  }),
)

export const ACCOUNT_RESERVATIONS: ReadonlyArray<AccountReservation> = [
  {
    id: 'res-demo-active',
    status: 'pending_reservation_fee',
    draft: activeDraft,
    paidAmount: 0,
    nextActionLabel: 'Frais de reservation a regler',
    updatedAt: '2026-05-18T10:00:00.000Z',
  },
  {
    id: 'res-demo-paid',
    status: 'in_transit',
    draft: paidDraft,
    paidAmount: paidDraft.payment.depositAmount,
    nextActionLabel: 'Solde avant expedition a venir',
    updatedAt: '2026-01-28T08:00:00.000Z',
  },
] as const

export const ACCOUNT_RESERVATION_STATUS_LABEL: Record<
  AccountReservationStatus,
  string
> = {
  pending_reservation_fee: 'Frais reservation',
  reserved: 'Reservee',
  deposit_called: 'Acompte appele',
  in_production: 'Production',
  in_transit: 'Transit',
  delivered: 'Livree',
  cancelled: 'Annulee',
}

export function getAccountReservationById(
  id: string,
  reservations: ReadonlyArray<AccountReservation> = ACCOUNT_RESERVATIONS,
): AccountReservation | null {
  return reservations.find((reservation) => reservation.id === id) ?? null
}

export function accountReservationFromLocalRecord(
  record: LocalReservationRecord,
): AccountReservation {
  return {
    id: record.id,
    status: record.status,
    draft: record.draft,
    paidAmount: record.paidAmount,
    nextActionLabel: record.nextActionLabel,
    updatedAt: record.updatedAt,
  }
}

export function mergeAccountReservations({
  baseReservations = ACCOUNT_RESERVATIONS,
  localRecords,
}: {
  readonly baseReservations?: ReadonlyArray<AccountReservation>
  readonly localRecords: ReadonlyArray<LocalReservationRecord>
}): ReadonlyArray<AccountReservation> {
  const localReservations = localRecords.map(accountReservationFromLocalRecord)
  const localReferences = new Set(
    localReservations.map((reservation) => reservation.draft.reference),
  )

  return [
    ...localReservations,
    ...baseReservations.filter(
      (reservation) => !localReferences.has(reservation.draft.reference),
    ),
  ]
}

export function calculateAccountReservationKpis(
  reservations: ReadonlyArray<AccountReservation>,
): AccountReservationKpis {
  const activeReservations = reservations.filter(
    (reservation) =>
      reservation.status !== 'delivered' && reservation.status !== 'cancelled',
  )

  return {
    activeCount: activeReservations.length,
    totalCommittedHt: reservations.reduce(
      (sum, reservation) => sum + reservation.draft.totals.subtotalHt,
      0,
    ),
    totalPaid: reservations.reduce(
      (sum, reservation) => sum + reservation.paidAmount,
      0,
    ),
    totalCbm: reservations.reduce(
      (sum, reservation) =>
        sum +
        reservation.draft.lines.reduce(
          (lineSum, line) => lineSum + line.cbmTotal,
          0,
        ),
      0,
    ),
  }
}
