// Bénéfice estimé par produit — outil ADMIN uniquement (jamais importé par
// une page publique : le coût rendu dérive du FOB, donnée privée).
//
// Reprend exactement la formule du moteur SQL calculate_product_landed_cost_ht
// (migration 20260706110000) : FOB × taux USD/EUR × (1 + douane + assurance)
// + fret/quantité container + frais fixes. Le bénéfice est ensuite l'écart
// entre un prix de vente HT et ce coût rendu.

import type { AdminPricingParameters } from '@/lib/catalogue-admin/types'

export type LandedCostParameters = Pick<
  AdminPricingParameters,
  | 'fxUsdEur'
  | 'customsRate'
  | 'importInsuranceRate'
  | 'freightEur40hc'
  | 'fixedImportFeeEur'
  | 'minMarginFloor'
>

export interface ProductProfit {
  readonly landedCostHt: number
  /** Bénéfice HT par unité au prix de vente donné. */
  readonly unitProfitHt: number
  /** Marge en % du prix de vente (bénéfice / prix). */
  readonly marginPercent: number
  /** Bénéfice HT projeté sur un container plein (unité × qté/40HC). */
  readonly containerProfitHt: number
  /** Vrai quand le prix de vente est sous le plancher landed × (1 + floor). */
  readonly belowFloor: boolean
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/** Coût rendu HT par unité, ou null si les coûts réels manquent. */
export function computeLandedCostHt(
  fobUsd: number | null,
  qtyPerContainer: number | null,
  params: LandedCostParameters,
): number | null {
  if (fobUsd === null || fobUsd <= 0) return null
  if (qtyPerContainer === null || qtyPerContainer <= 0) return null
  return round2(
    fobUsd * params.fxUsdEur * (1 + params.customsRate + params.importInsuranceRate) +
      params.freightEur40hc / qtyPerContainer +
      params.fixedImportFeeEur,
  )
}

/**
 * Bénéfice estimé pour un prix de vente HT donné, ou null quand il n'est pas
 * calculable (coûts FOB manquants ou prix nul).
 */
export function computeProductProfit(
  sellPriceHt: number,
  fobUsd: number | null,
  qtyPerContainer: number | null,
  params: LandedCostParameters,
): ProductProfit | null {
  const landedCostHt = computeLandedCostHt(fobUsd, qtyPerContainer, params)
  if (landedCostHt === null || sellPriceHt <= 0) return null

  const unitProfitHt = round2(sellPriceHt - landedCostHt)
  const floor = round2(landedCostHt * (1 + params.minMarginFloor))
  return {
    landedCostHt,
    unitProfitHt,
    marginPercent: round2((unitProfitHt / sellPriceHt) * 100),
    // qtyPerContainer est non-null dès que landedCostHt l'est.
    containerProfitHt: round2(unitProfitHt * (qtyPerContainer as number)),
    belowFloor: sellPriceHt < floor,
  }
}
