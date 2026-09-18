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
  /** « encore 50 assises pour −6 % », « −6 % acquis · encore 50 pour −10 % ». */
  readonly state: string
  readonly hasDiscount: boolean
}

/**
 * Les échelles de la jauge de remise — UNE PAR FAMILLE présente au panier.
 *
 * Une seule barre ne peut pas décrire trois familles aux paliers différents.
 * Un panier de 120 assises et 6 salons a sa remise sur les assises, mais ce
 * sont les salons qui sont le plus près de leur palier : afficher la seule
 * famille « la plus proche » montrerait une piste de salons à zéro sous un
 * bandeau annonçant une remise acquise. Chaque famille a donc sa ligne, avec
 * ses pièces, ses paliers et son état.
 *
 * Sur chaque ligne, UNE seule échelle : de zéro au dernier palier de la
 * famille. L'ancienne superposait trois repères sur une piste de 6 px — un
 * remplissage mesuré par rapport au palier suivant, des libellés répartis à
 * intervalles réguliers quelles que soient les vraies valeurs, et un trait
 * figé à 66,6 %. À 50 assises, la piste atteignait le libellé « −6 % » :
 * l'acheteur croyait avoir la remise alors qu'il lui manquait la moitié du
 * chemin.
 *
 * L'ordre est celui du catalogue, pas celui de la proximité : une liste qui
 * se réordonne à chaque ajout au panier se lit mal.
 */
export function buildVolumeScales(
  lines: ReadonlyArray<{ readonly category: string; readonly quantity: number }>,
): VolumeScale[] {
  const units = countUnitsByFamily(lines)

  return DISCOUNT_FAMILIES.filter((family) => units[family] > 0).flatMap(
    (family) => {
      const tiers = getFamilyDiscountTiers(family)
      const last = tiers[tiers.length - 1]
      if (!last || last.minUnits <= 0) return []

      const count = units[family]
      const word = DISCOUNT_FAMILY_UNIT[family]
      const plural = (n: number) => `${n} ${word}${n > 1 ? 's' : ''}`
      const pct = (value: number) =>
        `${Math.round(Math.min(100, Math.max(0, (value / last.minUnits) * 100)) * 10) / 10}%`

      const status = getCustomerDiscountStatus(count, tiers)
      const acquis = status.discountPercent
      const state = status.nextTier
        ? acquis > 0
          ? `−${acquis} % acquis · encore ${plural(status.nextGapUnits)} pour −${status.nextTier.discountPercent} %`
          : `encore ${plural(status.nextGapUnits)} pour −${status.nextTier.discountPercent} %`
        : `meilleur tarif volume : −${acquis} %`

      return [
        {
          family,
          familyLabel: DISCOUNT_FAMILY_LABEL[family],
          units: count,
          unitsLabel: plural(count),
          fill: pct(count),
          state,
          hasDiscount: acquis > 0,
          marks: tiers.map((tier, index) => ({
            left: pct(tier.minUnits),
            // Le dernier palier est au bout de la piste : son libellé se cale
            // sur la droite, sinon il déborde du cadre.
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
        },
      ]
    },
  )
}
