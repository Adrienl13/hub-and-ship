// ============================================================
// Container Club — logique métier (panier, MOQ, container)
// ============================================================

import { getActiveSalesChannel } from './pricing/channel-state'
import { getCustomerDiscountStatus } from './pricing/customer-discounts'
import { getPublicPricingRules } from './pricing/public-rules'
import type { DesignVariant, Product } from './products'

export interface CartItem {
  product: Product
  variant: DesignVariant
  quantity: number
  /** True when this load belongs to a pro who already reserved (read
   *  from `product_variants.unitsCommitted`). Used by the 3D scene to
   *  render those packages in a muted "engaged" colour so the live
   *  visitor can tell their own load from the existing book. */
  reserved?: boolean
}

export interface OrderTotals {
  /** Somme des lignes AVANT remise volume. */
  subtotalHt: number
  /** Palier de remise volume atteint (en %, ex. 10 pour −10 %). */
  volumeDiscountPercent: number
  /** Montant HT de la remise volume déduit du sous-total. */
  volumeDiscountAmount: number
  ecoContributionTotal: number
  reservationFee: number
  payNow: number
  payAt80Percent: number
  payBeforeShipping: number
  /** Total HT réellement dû = sous-total − remise volume. */
  totalHt: number
  vat: number
  totalTtc: number
  retailReference: number
  savings: number
  savingsPercent: number
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

// Grille historique (défaut). Les valeurs effectives viennent des paramètres
// pricing actifs via get_public_pricing_rules() — même source que le RPC de
// réservation, qui revalide ces montants côté serveur (tolérance 0,05 €).
export const RESERVATION_RATE = 0.03
export const RESERVATION_MIN = 150
export const RESERVATION_MAX = 500

export function calculateReservationFee(subtotalHt: number): number {
  if (subtotalHt <= 0) return 0
  const rules = getPublicPricingRules()
  const calculated = subtotalHt * rules.reservationFeeRate
  return Math.min(
    Math.max(calculated, rules.reservationFeeMin),
    rules.reservationFeeMax,
  )
}

export function calculateOrder(items: CartItem[]): OrderTotals {
  const subtotalHt = items.reduce(
    (sum, item) => sum + item.product.basePriceHt * item.quantity,
    0,
  )
  const ecoContributionTotal = items.reduce(
    (sum, item) => sum + item.product.ecoContribution * item.quantity,
    0,
  )

  // Remise volume publique (« −6 % dès 100 pièces, −10 % dès 150 »), CANAL
  // DIRECT UNIQUEMENT — les revendeurs/distributeurs ont déjà leur prix canal.
  // Basée sur le nombre TOTAL d'unités du panier, appliquée au sous-total. Le
  // RPC de réservation recompute et revalide exactement la même remise depuis
  // les paramètres pricing actifs — client et serveur restent synchrones.
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0)
  const volumeDiscountPercent =
    getActiveSalesChannel() === 'direct'
      ? getCustomerDiscountStatus(totalUnits).discountPercent
      : 0
  const volumeDiscountAmount = round2(
    (subtotalHt * volumeDiscountPercent) / 100,
  )
  const netHt = round2(subtotalHt - volumeDiscountAmount)

  const reservationFee = calculateReservationFee(netHt)
  const deposit30 = netHt * 0.3
  const payAt80Percent = Math.max(0, deposit30 - reservationFee)
  // Solde = reste à payer après les frais de réservation déjà encaissés et
  // l'acompte appelé à 80%. On ne fige PAS le solde à 70% : sinon, quand les
  // frais plancher (150€) dépassent l'acompte de 30% sur une petite commande,
  // le total encaissé (frais + 0 + 70%) dépasserait 100% du total. En
  // dérivant le solde, frais + acompte + solde == total HT net, toujours.
  const payBeforeShipping = Math.max(
    0,
    netHt - reservationFee - payAt80Percent,
  )
  const retailReference = items.reduce(
    (sum, item) => sum + item.product.retailPriceRef * item.quantity,
    0,
  )
  const savings = retailReference - netHt

  return {
    subtotalHt,
    volumeDiscountPercent,
    volumeDiscountAmount,
    ecoContributionTotal,
    reservationFee,
    payNow: reservationFee,
    payAt80Percent,
    payBeforeShipping,
    totalHt: netHt,
    vat: round2(netHt * 0.2),
    totalTtc: round2(netHt * 1.2),
    retailReference,
    savings,
    savingsPercent: retailReference > 0 ? (savings / retailReference) * 100 : 0,
  }
}

export type MoqStatus = {
  status: 'reached' | 'almost' | 'progressing' | 'starting'
  label: string
  tone: 'success' | 'amber' | 'ochre' | 'neutral'
  committed: number
  required: number
  percent: number
}

/** committed = unitsCommitted (autres pros) + qty courante du panier */
export function getMoqStatus(
  committed: number,
  moqRequired: number,
): MoqStatus {
  const percent = (committed / moqRequired) * 100
  const remaining = Math.max(0, moqRequired - committed)

  if (committed >= moqRequired) {
    return {
      status: 'reached',
      label: `Série confirmée ${committed}/${moqRequired}`,
      tone: 'success',
      committed,
      required: moqRequired,
      percent: 100,
    }
  }
  if (percent >= 80) {
    return {
      status: 'almost',
      label: `Manque ${remaining} unités, presque atteint`,
      tone: 'amber',
      committed,
      required: moqRequired,
      percent,
    }
  }
  if (percent >= 50) {
    return {
      status: 'progressing',
      label: `Manque ${remaining} unités`,
      tone: 'amber',
      committed,
      required: moqRequired,
      percent,
    }
  }
  return {
    status: 'starting',
    label: `Manque ${remaining} unités`,
    tone: 'ochre',
    committed,
    required: moqRequired,
    percent,
  }
}

export function calculateContainerFill(items: CartItem[], capacity: number) {
  const usedCbm = items.reduce(
    (sum, item) => sum + item.product.cbmPerUnit * item.quantity,
    0,
  )
  return {
    usedCbm,
    capacity,
    percent: Math.min(100, (usedCbm / capacity) * 100),
    remaining: Math.max(0, capacity - usedCbm),
  }
}

export const formatEUR = (n: number) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n)

export const formatEURprecise = (n: number) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(n)
