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

/** Un palier placé sur l'échelle de la jauge. */
export interface VolumeScaleMark {
  /** Position sur la piste, en pourcentage — « 66.7% ». */
  readonly left: string
  /** Décalage du libellé pour qu'il ne déborde pas de la piste. */
  readonly shift: string
  /** « 100 · −6 % ». */
  readonly label: string
  readonly reached: boolean
  /** Couleur du libellé : un palier acquis se lit autrement qu'un palier visé. */
  readonly tone: string
}

export interface VolumeScale {
  readonly family: DiscountFamily
  readonly familyLabel: string
  /** Pièces de cette famille au panier. */
  readonly units: number
  /** « 50 assises », déjà accordé. */
  readonly unitsLabel: string
  /** Remplissage de la piste, en pourcentage — « 33.3% ». */
  readonly fill: string
  readonly marks: ReadonlyArray<VolumeScaleMark>
}

/**
 * L'échelle de la jauge de remise.
 *
 * Elle existe parce que l'ancienne superposait TROIS repères différents sur
 * une même piste de 6 px : un remplissage mesuré par rapport au palier
 * suivant, des libellés « 50 / 100 · −6 % / 150 · −10 % » répartis à
 * intervalles réguliers quelles que soient les vraies valeurs, et un trait
 * figé à 66,6 %. À 50 assises, le remplissage atteignait 50 % de la piste,
 * c'est-à-dire pile sous le libellé « −6 % » — l'acheteur croyait avoir la
 * remise alors qu'il lui manquait la moitié du chemin.
 *
 * Ici, UNE seule échelle : de zéro au dernier palier de la famille. Le
 * remplissage et les paliers s'y lisent avec la même règle, donc la barre
 * n'atteint un palier que lorsqu'il est réellement atteint.
 */
export function buildVolumeScale(
  lines: ReadonlyArray<{ readonly category: string; readonly quantity: number }>,
): VolumeScale | null {
  const units = countUnitsByFamily(lines)
  const present = DISCOUNT_FAMILIES.filter((family) => units[family] > 0)
  if (present.length === 0) return null

  // La famille montrée est celle sur laquelle l'acheteur a le plus de prise :
  // la plus proche de son palier suivant. Quand tout est déjà acquis, celle
  // qui pèse le plus de pièces.
  const step = nextVolumeStep(lines)
  const family =
    step?.family ??
    present.reduce((best, f) => (units[f] > units[best] ? f : best), present[0]!)

  const tiers = getFamilyDiscountTiers(family)
  const last = tiers[tiers.length - 1]
  if (!last || last.minUnits <= 0) return null

  const count = units[family]
  const unitWord = DISCOUNT_FAMILY_UNIT[family]
  const pct = (value: number) =>
    `${Math.round(Math.min(100, Math.max(0, (value / last.minUnits) * 100)) * 10) / 10}%`

  return {
    family,
    familyLabel: DISCOUNT_FAMILY_LABEL[family],
    units: count,
    unitsLabel: `${count} ${unitWord}${count > 1 ? 's' : ''}`,
    fill: pct(count),
    marks: tiers.map((tier, index) => ({
      left: pct(tier.minUnits),
      // Le dernier palier est au bout de la piste : son libellé se cale sur
      // la droite, sinon il déborde du cadre.
      shift:
        index === tiers.length - 1
          ? 'translateX(-100%)'
          : 'translateX(-50%)',
      label: `${tier.minUnits} · −${tier.discountPercent} %`,
      reached: count >= tier.minUnits,
      tone:
        count >= tier.minUnits
          ? 'var(--color-accent-700)'
          : 'color-mix(in srgb, var(--color-text) 55%, transparent)',
    })),
  }
}
