export type ClaimType =
  | 'apparent_defect'
  | 'non_conformity'
  | 'hidden_defect'
  | 'transport_damage'

export interface ClaimRules {
  readonly type: ClaimType
  readonly maxDaysAfterDelivery: number
  readonly requiresPhotos: boolean
  readonly description: string
}

export interface ClaimEligibility {
  readonly eligible: boolean
  readonly daysElapsed: number
  readonly deadline: Date
  readonly rules: ClaimRules
}

export const CLAIM_RULES: Record<ClaimType, ClaimRules> = {
  apparent_defect: {
    type: 'apparent_defect',
    maxDaysAfterDelivery: 2,
    requiresPhotos: true,
    description:
      'Defaut visible a la reception (casse, manquant, defaut esthetique evident)',
  },
  transport_damage: {
    type: 'transport_damage',
    maxDaysAfterDelivery: 2,
    requiresPhotos: true,
    description:
      'Dommage cause par le transport (a signaler aussi au transporteur)',
  },
  non_conformity: {
    type: 'non_conformity',
    maxDaysAfterDelivery: 14,
    requiresPhotos: true,
    description: 'Erreur de reference, couleur, dimensions, quantite manquante',
  },
  hidden_defect: {
    type: 'hidden_defect',
    maxDaysAfterDelivery: 730,
    requiresPhotos: true,
    description:
      'Vice cache decouvert apres usage normal (garantie legale 2 ans)',
  },
} as const

const MS_PER_DAY = 1000 * 60 * 60 * 24

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY)
}

export function isClaimEligible(
  claimType: ClaimType,
  deliveredAt: Date,
  reportedAt: Date = new Date(),
): ClaimEligibility {
  const rules = CLAIM_RULES[claimType]
  const daysElapsed = Math.floor(
    (reportedAt.getTime() - deliveredAt.getTime()) / MS_PER_DAY,
  )
  const deadline = addDays(deliveredAt, rules.maxDaysAfterDelivery)

  return {
    eligible: daysElapsed >= 0 && reportedAt.getTime() <= deadline.getTime(),
    daysElapsed,
    deadline,
    rules,
  }
}
