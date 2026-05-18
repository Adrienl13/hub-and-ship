import type { Database, Json } from '@/lib/supabase/types'
import type { ReservationDraft } from './draft'

export type ReservationInsertPayload =
  Database['public']['Tables']['reservations']['Insert']
export type ReservationItemInsertPayload =
  Database['public']['Tables']['reservation_items']['Insert']

export function toReservationInsertPayload(
  draft: ReservationDraft,
): ReservationInsertPayload {
  return {
    reference: draft.reference,
    container_reference: draft.containerReference,
    container_id: draft.containerId,
    siret: draft.siret,
    contact_snapshot: draft.contact as unknown as Json,
    delivery_mode: draft.delivery.deliveryMode,
    delivery_note: draft.delivery.deliveryNote ?? null,
    subtotal_ht: draft.totals.subtotalHt,
    eco_contribution_total: draft.totals.ecoContributionTotal,
    referral_code: draft.referral.code,
    referral_discount: draft.referral.discountAmount,
    total_ht: draft.totals.totalHt,
    vat_amount: draft.totals.vat,
    total_ttc: draft.totals.totalTtc,
    total_cbm: draft.lines.reduce((sum, line) => sum + line.cbmTotal, 0),
    reservation_fee: draft.payment.reservationFee,
    pay_now: draft.payment.payNow,
    deposit_amount: draft.payment.depositAmount,
    pay_at_80_percent: draft.payment.payAt80Percent,
    balance_amount: draft.payment.balanceAmount,
    status: 'pending_reservation_fee',
    cgv_version_accepted: draft.cgvVersion,
    cgv_accepted_at: draft.cgvAcceptedAt,
  }
}

export function toReservationItemInsertPayloads({
  draft,
  reservationId,
}: {
  readonly draft: ReservationDraft
  readonly reservationId: string
}): ReadonlyArray<ReservationItemInsertPayload> {
  return draft.lines.map((line) => ({
    reservation_id: reservationId,
    product_id: line.productId,
    sku: line.sku,
    product_name: line.productName,
    category: line.category,
    variant_id: line.variantId,
    variant_name: line.variantName,
    quantity: line.quantity,
    unit_price_ht: line.unitPriceHt,
    unit_eco_contribution: line.unitEcoContribution,
    subtotal_ht: line.subtotalHt,
    eco_contribution_total: line.ecoContributionTotal,
    cbm_total: line.cbmTotal,
    product_snapshot: line.productSnapshot as unknown as Json,
  }))
}
