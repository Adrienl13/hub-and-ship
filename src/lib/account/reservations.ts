import type { OrderTotals } from '@/lib/order'
import type { PartnerLinkContext } from '@/lib/partners/link'
import type {
  ReservationDraft,
  ReservationDraftLine,
} from '@/lib/reservations/draft'
import type { LocalReservationRecord } from '@/lib/reservations/local-history'
import type {
  MyReservation,
  ReservationItemRow,
  ReservationRow,
} from '@/lib/reservations/repository'

export type AccountReservationStatus =
  | 'pending_reservation_fee'
  | 'reserved'
  | 'deposit_called'
  | 'deposit_paid'
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

export const ACCOUNT_RESERVATION_STATUS_LABEL: Record<
  AccountReservationStatus,
  string
> = {
  pending_reservation_fee: 'Frais reservation',
  reserved: 'Reservee',
  deposit_called: 'Acompte appele',
  deposit_paid: 'Acompte paye',
  in_production: 'Production',
  in_transit: 'Transit',
  delivered: 'Livree',
  cancelled: 'Annulee',
}

const ACTIVE_STATUSES: ReadonlySet<AccountReservationStatus> = new Set([
  'pending_reservation_fee',
  'reserved',
  'deposit_called',
  'deposit_paid',
  'in_production',
  'in_transit',
])

function nextActionLabelFor(status: AccountReservationStatus): string {
  switch (status) {
    case 'pending_reservation_fee':
      return 'Frais de reservation a regler'
    case 'reserved':
      return 'Acompte de 30 % a appeler'
    case 'deposit_called':
      return 'Acompte en attente de paiement'
    case 'deposit_paid':
      return 'Acompte encaisse — production a lancer'
    case 'in_production':
      // Le solde (70 %) est exigible AVANT expédition (CGV) : c'est pendant la
      // production qu'il se règle, pas une fois le container en mer.
      return 'Production en cours — solde a regler avant expedition'
    case 'in_transit':
      return 'Solde encaisse — container en mer'
    case 'delivered':
      return 'Livre — pieces et facture disponibles'
    case 'cancelled':
      return 'Reservation annulee'
  }
}

function paidAmountFor(row: ReservationRow): number {
  // Reservation fee is paid as soon as the Stripe webhook flips status to
  // 'reserved' (or any later state). Anything before that is unpaid.
  if (row.status === 'pending_reservation_fee') return 0
  return Number(row.reservation_fee)
}

function readPartnerContextFromSnapshot(
  snapshot: unknown,
): PartnerLinkContext | null {
  if (!snapshot || typeof snapshot !== 'object') return null
  const obj = snapshot as Record<string, unknown>
  const partner = obj.partner_context
  if (!partner || typeof partner !== 'object') return null
  const partnerObj = partner as Record<string, unknown>

  if (
    typeof partnerObj.slug !== 'string' ||
    typeof partnerObj.display_name !== 'string' ||
    typeof partnerObj.source_path !== 'string' ||
    typeof partnerObj.captured_at !== 'string' ||
    typeof partnerObj.expires_at !== 'string'
  ) {
    return null
  }

  return {
    slug: partnerObj.slug,
    displayName: partnerObj.display_name,
    sourcePath: partnerObj.source_path,
    selectionId:
      typeof partnerObj.selection_id === 'string'
        ? partnerObj.selection_id
        : null,
    capturedAt: partnerObj.captured_at,
    expiresAt: partnerObj.expires_at,
  }
}

function lineFromRow(row: ReservationItemRow): ReservationDraftLine {
  const snapshot = (row.product_snapshot ?? {}) as Partial<
    ReservationDraftLine['productSnapshot']
  >
  return {
    productId: row.product_id,
    sku: row.sku,
    productName: row.product_name,
    category: row.category,
    variantId: row.variant_id,
    variantName: row.variant_name,
    quantity: row.quantity,
    unitPriceHt: Number(row.unit_price_ht),
    unitEcoContribution: Number(row.unit_eco_contribution),
    subtotalHt: Number(row.subtotal_ht),
    ecoContributionTotal: Number(row.eco_contribution_total),
    cbmTotal: Number(row.cbm_total),
    productSnapshot: {
      dimensions: snapshot.dimensions ?? { l: 0, w: 0, h: 0 },
      cbmPerUnit: snapshot.cbmPerUnit ?? Number(row.cbm_total) / row.quantity,
      weightKg: snapshot.weightKg ?? 0,
      retailPriceRef: snapshot.retailPriceRef ?? Number(row.unit_price_ht),
      imageUrl: snapshot.imageUrl ?? '',
    },
  }
}

function totalsFromRow(
  row: ReservationRow,
  lines: ReadonlyArray<ReservationDraftLine>,
): OrderTotals {
  const subtotalHt = Number(row.subtotal_ht)
  const totalTtc = Number(row.total_ttc)
  const retailReference = lines.reduce(
    (sum, line) => sum + line.productSnapshot.retailPriceRef * line.quantity,
    0,
  )
  const volumeDiscountAmount = Number(row.volume_discount ?? 0)
  const savings = Math.max(0, retailReference - subtotalHt + volumeDiscountAmount)
  return {
    subtotalHt,
    volumeDiscountPercent:
      subtotalHt > 0
        ? Math.round((volumeDiscountAmount / subtotalHt) * 1000) / 10
        : 0,
    volumeDiscountAmount,
    ecoContributionTotal: Number(row.eco_contribution_total),
    reservationFee: Number(row.reservation_fee),
    payNow: Number(row.pay_now),
    payAt80Percent: Number(row.pay_at_80_percent),
    payBeforeShipping: Number(row.balance_amount),
    totalHt: Number(row.total_ht),
    vat: Number(row.vat_amount),
    totalTtc,
    retailReference,
    savings,
    savingsPercent: retailReference > 0 ? (savings / retailReference) * 100 : 0,
  }
}

function draftFromRow(
  row: ReservationRow,
  items: ReadonlyArray<ReservationItemRow>,
): ReservationDraft {
  const lines = items.map(lineFromRow)
  const contact = (row.contact_snapshot ?? {}) as ReservationDraft['contact']
  const partnerContext = readPartnerContextFromSnapshot(row.contact_snapshot)
  const totals = totalsFromRow(row, lines)

  return {
    id: row.id,
    reference: row.reference,
    status: 'ready_for_payment',
    containerReference: row.container_reference,
    containerId: row.container_id,
    siret: row.siret,
    contact,
    delivery: {
      deliveryMode: row.delivery_mode,
      deliveryNote: row.delivery_note ?? undefined,
    },
    cgvVersion: row.cgv_version_accepted,
    cgvAcceptedAt: row.cgv_accepted_at,
    lines,
    totals,
    payment: {
      reservationFee: Number(row.reservation_fee),
      payNow: Number(row.pay_now),
      depositAmount: Number(row.deposit_amount),
      payAt80Percent: Number(row.pay_at_80_percent),
      balanceAmount: Number(row.balance_amount),
    },
    referral: {
      code: row.referral_code,
      status: row.referral_discount > 0 ? 'applied' : 'none',
      discountAmount: Number(row.referral_discount),
    },
    partnerContext,
    requestedContainerType: row.requested_container_type ?? null,
  }
}

export function accountReservationFromMyReservation(
  reservation: MyReservation,
): AccountReservation {
  const status = reservation.row.status as AccountReservationStatus
  return {
    id: reservation.row.id,
    status,
    draft: draftFromRow(reservation.row, reservation.items),
    paidAmount: paidAmountFor(reservation.row),
    nextActionLabel: nextActionLabelFor(status),
    updatedAt: reservation.row.updated_at,
  }
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
  remoteReservations = [],
  localRecords,
}: {
  readonly remoteReservations?: ReadonlyArray<AccountReservation>
  readonly localRecords: ReadonlyArray<LocalReservationRecord>
}): ReadonlyArray<AccountReservation> {
  // Remote (Supabase) wins over local snapshots when both exist for the same
  // reservation id. Local records that don't match any remote row stay
  // visible — they represent reservations made in this browser as anon.
  const remoteIds = new Set(remoteReservations.map((r) => r.draft.id))
  const localOnly = localRecords
    .map(accountReservationFromLocalRecord)
    .filter((reservation) => !remoteIds.has(reservation.draft.id))

  return [...remoteReservations, ...localOnly]
}

export function getAccountReservationById(
  id: string,
  reservations: ReadonlyArray<AccountReservation>,
): AccountReservation | null {
  return (
    reservations.find(
      (reservation) => reservation.id === id || reservation.draft.id === id,
    ) ?? null
  )
}

export function calculateAccountReservationKpis(
  reservations: ReadonlyArray<AccountReservation>,
): AccountReservationKpis {
  const activeReservations = reservations.filter((reservation) =>
    ACTIVE_STATUSES.has(reservation.status),
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
