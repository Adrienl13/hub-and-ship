// Rentabilité par container — outil ADMIN uniquement (dérive du FOB, donnée
// privée ; jamais importé par une page publique).
//
// Répond à la question opérationnelle : « si je remplis un 20' GP (ou un
// 40' GP / 40' HC) avec ces produits vendus par tel canal, combien je gagne ? »
//
// Différence volontaire avec le moteur get_price : le moteur amortit le fret
// 40' HC via qty_per_container (donnée fournisseur). Ici on répartit le fret
// TOTAL du format choisi au volume réel (cbm_per_unit du mix), car un même
// produit occupe la même place dans un 20' et un 40' mais le fret par m³ y
// est très différent — c'est précisément ce que l'admin veut comparer.

import type { AdminPricingParameters } from '@/lib/catalogue-admin/types'
import { CONTAINER_USABLE_CBM } from '@/lib/container/pricing'

/** Formats proposés par le comparateur (fret paramétrable par l'admin). */
export type ProfitContainerFormat = '20_gp' | '40_gp' | '40_hc'

export const PROFIT_FORMAT_LABEL: Record<ProfitContainerFormat, string> = {
  '20_gp': "20' General Purpose",
  '40_gp': "40' General Purpose",
  '40_hc': "40' High Cube",
}

/** Volume utile commercial par format (m³). Le 20' GP = 20' Dry Van. */
export const PROFIT_FORMAT_USABLE_CBM: Record<ProfitContainerFormat, number> = {
  '20_gp': CONTAINER_USABLE_CBM['20_dv'],
  '40_gp': CONTAINER_USABLE_CBM['40_gp'],
  '40_hc': CONTAINER_USABLE_CBM['40_hc'],
}

/** Fret du format depuis les paramètres actifs — null = à renseigner. */
export function freightForFormat(
  format: ProfitContainerFormat,
  params: Pick<
    AdminPricingParameters,
    'freightEur40hc' | 'freightEur20gp' | 'freightEur40gp'
  >,
): number | null {
  switch (format) {
    case '20_gp':
      return params.freightEur20gp
    case '40_gp':
      return params.freightEur40gp
    case '40_hc':
      return params.freightEur40hc
  }
}

export interface ContainerMixLine {
  readonly productId: string
  readonly name: string
  /** Prix de vente HT unitaire du scénario (canal/palier choisi par l'appelant). */
  readonly unitPriceHt: number
  /** FOB usine en USD — null si la fiche produit est incomplète. */
  readonly fobUsd: number | null
  readonly cbmPerUnit: number
  readonly quantity: number
}

export interface ContainerMixLineResult extends ContainerMixLine {
  /** Coût marchandise HT (FOB converti + douane + assurance + frais fixes). */
  readonly goodsCostHt: number | null
  readonly lineRevenueHt: number
  readonly lineCbm: number
}

export interface ContainerProfitScenario {
  readonly format: ProfitContainerFormat
  readonly usableCbm: number
  readonly usedCbm: number
  readonly fillPercent: number
  readonly overCapacity: boolean
  readonly freightEur: number | null
  readonly revenueHt: number
  /** Somme des coûts marchandise des lignes calculables. */
  readonly goodsCostHt: number
  /** Commission apporteur (8 % du CA) si le scénario l'inclut. */
  readonly commissionHt: number
  /** RFA simulée (x % du CA) si le scénario l'inclut. */
  readonly rfaHt: number
  /** Bénéfice = CA − marchandise − fret − commission − RFA (null si fret manquant). */
  readonly profitHt: number | null
  readonly marginPercent: number | null
  /** Lignes dont le FOB manque : leur coût est EXCLU du calcul — le bénéfice
   *  affiché est donc surestimé tant que ces fiches sont incomplètes. */
  readonly incompleteLines: ReadonlyArray<string>
  readonly lines: ReadonlyArray<ContainerMixLineResult>
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/** Coût marchandise HT unitaire (hors fret — le fret est réparti au container). */
export function computeUnitGoodsCostHt(
  fobUsd: number | null,
  params: Pick<
    AdminPricingParameters,
    'fxUsdEur' | 'customsRate' | 'importInsuranceRate' | 'fixedImportFeeEur'
  >,
): number | null {
  if (fobUsd === null || fobUsd <= 0) return null
  return round2(
    fobUsd *
      params.fxUsdEur *
      (1 + params.customsRate + params.importInsuranceRate) +
      params.fixedImportFeeEur,
  )
}

/**
 * RFA maximale (en % du CA) qu'on peut accorder à un partenaire payé au
 * PLANCHER de marge sans passer en perte, commission apporteur incluse.
 *
 * Prix plancher = coût × (1 + floor). Bénéfice = prix × (1 − com − rfa) − coût.
 * Bénéfice ≥ 0 ⇔ rfa ≤ 1 − com − 1/(1 + floor).
 * Avec floor 15 % et commission 8 % : ≈ 5,0 % — au-delà, un prix au plancher
 * devient une vente à perte. C'est LA règle à contractualiser côté RFA.
 */
export function maxSafeRfaPercent(
  minMarginFloor: number,
  commissionRate = 0.08,
): number {
  return round2(
    Math.max(0, 1 - commissionRate - 1 / (1 + minMarginFloor)) * 100,
  )
}

export function computeContainerProfit({
  format,
  lines,
  params,
  includeCommission = false,
  rfaPercent = 0,
}: {
  readonly format: ProfitContainerFormat
  readonly lines: ReadonlyArray<ContainerMixLine>
  readonly params: AdminPricingParameters
  /** Inclure la commission apporteur (8 % du CA encaissé) dans les coûts. */
  readonly includeCommission?: boolean
  /** RFA de fin d'année simulée, en % du CA (0 = aucune). */
  readonly rfaPercent?: number
}): ContainerProfitScenario {
  const usableCbm = PROFIT_FORMAT_USABLE_CBM[format]
  const freightEur = freightForFormat(format, params)

  const lineResults: ContainerMixLineResult[] = lines
    .filter((line) => line.quantity > 0)
    .map((line) => {
      const unitGoods = computeUnitGoodsCostHt(line.fobUsd, params)
      return {
        ...line,
        goodsCostHt:
          unitGoods === null ? null : round2(unitGoods * line.quantity),
        lineRevenueHt: round2(line.unitPriceHt * line.quantity),
        lineCbm: round2(line.cbmPerUnit * line.quantity),
      }
    })

  const revenueHt = round2(
    lineResults.reduce((sum, line) => sum + line.lineRevenueHt, 0),
  )
  const goodsCostHt = round2(
    lineResults.reduce((sum, line) => sum + (line.goodsCostHt ?? 0), 0),
  )
  const usedCbm = round2(
    lineResults.reduce((sum, line) => sum + line.lineCbm, 0),
  )
  const commissionHt = includeCommission ? round2(revenueHt * 0.08) : 0
  const rfaHt = round2((revenueHt * Math.max(0, rfaPercent)) / 100)

  const profitHt =
    freightEur === null
      ? null
      : round2(revenueHt - goodsCostHt - freightEur - commissionHt - rfaHt)

  return {
    format,
    usableCbm,
    usedCbm,
    fillPercent:
      usableCbm > 0 ? Math.round((usedCbm / usableCbm) * 100) : 0,
    overCapacity: usedCbm > usableCbm,
    freightEur,
    revenueHt,
    goodsCostHt,
    commissionHt,
    rfaHt,
    profitHt,
    marginPercent:
      profitHt === null || revenueHt <= 0
        ? null
        : round2((profitHt / revenueHt) * 100),
    incompleteLines: lineResults
      .filter((line) => line.goodsCostHt === null)
      .map((line) => line.name),
    lines: lineResults,
  }
}
