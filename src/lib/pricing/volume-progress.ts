// « Encore 4 salons pour −10 % » — le pas suivant, et lequel.
//
// Avec une grille unique, un panier n'avait qu'une progression : le total des
// pièces vers le palier suivant. Avec des paliers par famille, il y en a une
// par famille — et afficher la mauvaise décourage. Un acheteur de salons qui
// lit « encore 94 unités » alors que sa remise se déclenche à 10 pièces ne
// comprend pas qu'il en est à deux salons du but.
//
// On retient donc la famille la PLUS PROCHE de son palier suivant : c'est le
// seul conseil actionnable dans le tiroir du catalogue.

import { getCustomerDiscountStatus } from './customer-discounts'
import {
  DISCOUNT_FAMILIES,
  DISCOUNT_FAMILY_LABEL,
  DISCOUNT_FAMILY_UNIT,
  countUnitsByFamily,
  type DiscountFamily,
} from './discount-families'
import { getFamilyDiscountTiers } from './public-rules'

export interface VolumeProgress {
  readonly family: DiscountFamily
  readonly familyLabel: string
  /** Pièces de cette famille déjà au panier. */
  readonly units: number
  readonly missingUnits: number
  readonly nextPercent: number
  /** Progression vers ce palier, en % (0 à 100) — pour une jauge. */
  readonly progressPercent: number
  /** « Encore 4 salons pour −10 % de remise. » */
  readonly label: string
}

export function nextVolumeStep(
  lines: ReadonlyArray<{ readonly category: string; readonly quantity: number }>,
): VolumeProgress | null {
  const units = countUnitsByFamily(lines)
  let best: VolumeProgress | null = null

  for (const family of DISCOUNT_FAMILIES) {
    // Une famille absente du panier n'a rien à conseiller : proposer d'ajouter
    // des salons à qui compose une terrasse de chaises serait du remplissage.
    if (units[family] <= 0) continue

    const status = getCustomerDiscountStatus(
      units[family],
      getFamilyDiscountTiers(family),
    )
    if (!status.nextTier || status.nextGapUnits <= 0) continue

    const unitWord = DISCOUNT_FAMILY_UNIT[family]
    const plural = status.nextGapUnits > 1 ? 's' : ''
    const progress: VolumeProgress = {
      family,
      familyLabel: DISCOUNT_FAMILY_LABEL[family],
      units: units[family],
      missingUnits: status.nextGapUnits,
      nextPercent: status.nextTier.discountPercent,
      progressPercent: Math.min(
        100,
        Math.round((units[family] / status.nextTier.minUnits) * 100),
      ),
      label: `Encore ${status.nextGapUnits} ${unitWord}${plural} pour −${status.nextTier.discountPercent} % de remise.`,
    }

    if (!best || progress.missingUnits < best.missingUnits) best = progress
  }

  return best
}
