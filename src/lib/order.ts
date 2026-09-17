// ============================================================
// Terrassea — logique métier (panier, MOQ, container)
// ============================================================

import type { SalesChannel } from './supabase/types'
import { getActiveSalesChannel } from './pricing/channel-state'
import { getCustomerDiscountStatus } from './pricing/customer-discounts'
import {
  DISCOUNT_FAMILY_LABEL,
  countUnitsByFamily,
  resolveDiscountFamily,
  type DiscountFamily,
} from './pricing/discount-families'
import {
  getFamilyDiscountTiers,
  getPublicPricingRules,
  getVolumeFamilyTiers,
} from './pricing/public-rules'
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

/** Une remise volume obtenue sur une famille de produits. */
export interface VolumeDiscountLine {
  readonly family: DiscountFamily
  readonly label: string
  /** Pièces de cette famille dans le panier — ce qui déclenche le palier. */
  readonly units: number
  readonly discountPercent: number
  readonly amount: number
}

export interface OrderTotals {
  /** Somme des lignes AVANT remise volume. */
  subtotalHt: number
  /**
   * Remise volume EFFECTIVE sur l'ensemble du panier, en %. Avec des paliers
   * par famille, un panier mixte n'a pas un taux unique : celui-ci est le
   * rapport remise/sous-total, arrondi au dixième. Pour l'afficher
   * honnêtement, préférer `volumeDiscountLines` dès qu'il y a plus d'une
   * famille remisée.
   */
  volumeDiscountPercent: number
  /** Montant HT de la remise volume déduit du sous-total. */
  volumeDiscountAmount: number
  /** Détail famille par famille — vide si aucune remise. */
  volumeDiscountLines: ReadonlyArray<VolumeDiscountLine>
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

/**
 * Taux de TVA française applicable au catalogue. Le RPC de réservation
 * applique EXACTEMENT le même depuis la migration 47 — il ne le lit plus dans
 * le payload du client.
 */
export const VAT_RATE = 0.2

export interface LineVatBreakdown {
  /** Prix unitaire HT, tel qu'affiché au catalogue. */
  readonly unitHt: number
  /** Le même, TVA comprise — ce que l'acheteur paiera pour une pièce. */
  readonly unitTtc: number
  readonly lineHt: number
  readonly lineVat: number
  readonly lineTtc: number
}

/**
 * TVA d'une ligne, pour que l'acheteur voie ce que coûte CHAQUE produit TTC
 * et pas seulement un total en bas de page (demande Adrien 18/09/2026).
 *
 * Ces colonnes affichent le prix CATALOGUE : c'est celui que l'acheteur
 * compare. La remise volume, elle, porte sur la commande entière et apparaît
 * en pied de devis — usage normal d'une remise globale. Le total TVA du pied
 * n'est donc pas la somme de CES lignes-ci, mais la somme des mêmes lignes
 * remisées (cf. calculateOrder) : dans les deux cas un total n'est JAMAIS un
 * pourcentage appliqué à un autre total, toujours une somme de lignes.
 */
export function calculateLineVat(item: CartItem): LineVatBreakdown {
  const unitHt = item.product.basePriceHt
  const lineHt = round2(unitHt * item.quantity)
  const lineVat = round2(lineHt * VAT_RATE)
  return {
    unitHt,
    unitTtc: round2(unitHt * (1 + VAT_RATE)),
    lineHt,
    lineVat,
    lineTtc: round2(lineHt + lineVat),
  }
}

/**
 * Ligne de commande réduite à ce dont le calcul a besoin. Permet aux surfaces
 * qui ne manipulent pas de `CartItem` — devis co-brandé d'un partenaire,
 * sélection publiée — d'utiliser LE MÊME moteur que le checkout, au lieu de
 * recopier la remise et la TVA et de dériver au premier changement de grille.
 */
export interface OrderLineInput {
  readonly basePriceHt: number
  readonly ecoContribution: number
  readonly retailPriceRef: number
  readonly category: string
  readonly quantity: number
}

export function calculateOrder(items: CartItem[]): OrderTotals {
  return calculateOrderLines(
    items.map((item) => ({
      basePriceHt: item.product.basePriceHt,
      ecoContribution: item.product.ecoContribution,
      retailPriceRef: item.product.retailPriceRef,
      category: item.product.category,
      quantity: item.quantity,
    })),
  )
}

export function calculateOrderLines(
  items: ReadonlyArray<OrderLineInput>,
  options?: {
    /**
     * Canal dont la grille s'applique. Par défaut celui de la session. Un
     * devis destiné au client FINAL (sélection co-brandée d'un partenaire)
     * passe 'direct' explicitement : il affiche des prix publics, la remise
     * ne doit pas dépendre de qui a le devis sous les yeux.
     */
    readonly channel?: SalesChannel
  },
): OrderTotals {
  // Chaque ligne est arrondie au centime AVANT d'être sommée — exactement
  // comme le RPC de réservation (`round(prix × qté, 2)` puis accumulation).
  const grossLines = items.map((item) =>
    round2(item.basePriceHt * item.quantity),
  )
  const subtotalHt = grossLines.reduce((sum, line) => sum + line, 0)
  const ecoContributionTotal = items.reduce(
    (sum, item) => sum + item.ecoContribution * item.quantity,
    0,
  )

  // Remise volume publique, CANAL DIRECT UNIQUEMENT — les revendeurs et
  // distributeurs ont déjà leur prix canal.
  //
  // DEUX RÉGIMES, et c'est le serveur qui décide lequel : tant que la grille
  // par famille n'est pas configurée, on compte TOUTES les pièces du panier et
  // on applique la grille unique historique. Dès qu'elle l'est, chaque famille
  // — assises, tables, salons — compte ses propres pièces et suit ses propres
  // paliers, parce qu'un salon à 1 400 € et une chaise à 82 € ne déclenchent
  // pas un volume au même seuil. Le RPC de réservation lit la même
  // configuration et bascule sur la même condition : les deux côtés changent
  // de régime ensemble, jamais l'un sans l'autre.
  const isDirect = (options?.channel ?? getActiveSalesChannel()) === 'direct'
  const families = getVolumeFamilyTiers()
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0)
  const unitsByFamily = countUnitsByFamily(items)

  function rateFor(item: OrderLineInput): number {
    if (!isDirect) return 0
    if (!families) return getCustomerDiscountStatus(totalUnits).discountPercent
    const family = resolveDiscountFamily(item.category)
    return getCustomerDiscountStatus(
      unitsByFamily[family],
      getFamilyDiscountTiers(family),
    ).discountPercent
  }

  // SOMME STRICTE DES LIGNES (demande Adrien 18/09/2026). Le total HT et la
  // TVA ne sont PAS un pourcentage appliqué au sous-total : ce sont les lignes,
  // remisées puis arrondies une par une, additionnées. Sans ça, la TVA affichée
  // ligne à ligne et la TVA du pied divergeaient de 1 à 2 centimes dès qu'une
  // remise s'appliquait — et sur un gros panier l'écart pouvait dépasser la
  // tolérance de 0,05 € du RPC et faire REFUSER une réservation légitime.
  // La migration 48 applique le même calcul, ligne par ligne, côté serveur.
  // C'est aussi ce qui rend les remises par famille possibles sans rien
  // réécrire : chaque ligne porte déjà son propre taux.
  const lineRates = items.map((item) => rateFor(item))
  const netLines = grossLines.map((line, index) =>
    round2(line * (1 - lineRates[index]! / 100)),
  )
  const netHt = round2(netLines.reduce((sum, line) => sum + line, 0))
  const volumeDiscountAmount = round2(subtotalHt - netHt)
  const vat = round2(
    netLines.reduce((sum, line) => sum + round2(line * VAT_RATE), 0),
  )

  // Détail par famille : un panier mixte n'a pas UN taux de remise, il en a
  // un par famille. On ne l'invente pas à l'affichage, on le remonte.
  const discountByFamily = new Map<DiscountFamily, VolumeDiscountLine>()
  items.forEach((item, index) => {
    const percent = lineRates[index]!
    if (percent <= 0) return
    const family = resolveDiscountFamily(item.category)
    const amount = round2(grossLines[index]! - netLines[index]!)
    const existing = discountByFamily.get(family)
    discountByFamily.set(family, {
      family,
      label: DISCOUNT_FAMILY_LABEL[family],
      units: unitsByFamily[family],
      discountPercent: percent,
      amount: round2((existing?.amount ?? 0) + amount),
    })
  })
  const volumeDiscountLines = [...discountByFamily.values()]
  // Taux effectif sur l'ensemble : exact quand une seule grille s'applique,
  // moyenne pondérée sinon.
  const volumeDiscountPercent =
    subtotalHt > 0
      ? Math.round((volumeDiscountAmount / subtotalHt) * 1000) / 10
      : 0

  const reservationFee = calculateReservationFee(netHt)
  const deposit30 = netHt * 0.3
  const payAt80Percent = Math.max(0, deposit30 - reservationFee)
  // Solde = reste à payer après les frais de réservation déjà encaissés et
  // l'acompte appelé à 80%. On ne fige PAS le solde à 70% : sinon, quand les
  // frais plancher (150€) dépassent l'acompte de 30% sur une petite commande,
  // le total encaissé (frais + 0 + 70%) dépasserait 100% du total. En
  // dérivant le solde, frais + acompte + solde == total HT net, toujours.
  const payBeforeShipping = Math.max(0, netHt - reservationFee - payAt80Percent)
  // « Équivalent retail FR » et « Économie » ne se calculent QUE sur les
  // lignes où le prix de référence veut dire quelque chose, c'est-à-dire
  // au-dessus de notre propre prix. Une ligne dont la référence vaut 0 ou
  // passe sous le prix Terrassea n'est pas comparable : la compter tirait
  // l'économie vers le négatif et affichait « Économie --4 365 € (-111 %) »
  // au moment de confirmer — vu en production sur ROP-001, BIS-030 et
  // SKU-336. On compare donc le retail des lignes éligibles au prix net de
  // CES MÊMES lignes, remise volume répartie au prorata.
  const comparable = items.filter(
    (item) => item.retailPriceRef > item.basePriceHt && item.basePriceHt > 0,
  )
  const retailReference = comparable.reduce(
    (sum, item) => sum + item.retailPriceRef * item.quantity,
    0,
  )
  const comparableGrossHt = comparable.reduce(
    (sum, item) => sum + item.basePriceHt * item.quantity,
    0,
  )
  const comparableNetHt =
    subtotalHt > 0
      ? round2(comparableGrossHt * (netHt / subtotalHt))
      : comparableGrossHt
  const savings = Math.max(0, round2(retailReference - comparableNetHt))

  return {
    subtotalHt,
    volumeDiscountPercent,
    volumeDiscountAmount,
    volumeDiscountLines,
    ecoContributionTotal,
    reservationFee,
    payNow: reservationFee,
    payAt80Percent,
    payBeforeShipping,
    totalHt: netHt,
    vat,
    totalTtc: round2(netHt + vat),
    retailReference,
    savings,
    savingsPercent: retailReference > 0 ? (savings / retailReference) * 100 : 0,
  }
}

/**
 * Lignes de remise à afficher dans un récapitulatif.
 *
 * Un panier mixte n'a pas UN taux de remise : les assises et les salons ne
 * suivent pas la même grille. Plutôt que d'afficher une moyenne pondérée que
 * personne ne peut recalculer, on détaille dès qu'il y a plus d'une famille
 * remisée — et on garde le libellé historique quand il n'y en a qu'une.
 */
export function describeVolumeDiscounts(
  totals: Pick<
    OrderTotals,
    'volumeDiscountLines' | 'volumeDiscountAmount' | 'volumeDiscountPercent'
  >,
): ReadonlyArray<{ key: string; label: string; amount: number }> {
  const lines = totals.volumeDiscountLines
  if (lines.length === 0) {
    // Réservation relue depuis la base : le détail n'est pas persisté, on
    // retombe sur le taux effectif.
    return totals.volumeDiscountAmount > 0
      ? [
          {
            key: 'total',
            label: `Remise volume −${formatPercent(totals.volumeDiscountPercent)} %`,
            amount: totals.volumeDiscountAmount,
          },
        ]
      : []
  }
  if (lines.length === 1) {
    const only = lines[0]!
    return [
      {
        key: only.family,
        label: `Remise volume −${formatPercent(only.discountPercent)} %`,
        amount: only.amount,
      },
    ]
  }
  return lines.map((line) => ({
    key: line.family,
    label: `Remise ${line.label.toLowerCase()} −${formatPercent(line.discountPercent)} %`,
    amount: line.amount,
  }))
}

/** 6 → « 6 », 7.25 → « 7,25 » — jamais « 6.0 ». */
function formatPercent(value: number): string {
  return String(Math.round(value * 100) / 100).replace('.', ',')
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
