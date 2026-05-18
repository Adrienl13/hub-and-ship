export type ContainerStatus =
  | 'draft'
  | 'open'
  | 'threshold_reached'
  | 'production'
  | 'manufactured'
  | 'shipped'
  | 'customs'
  | 'arrived'
  | 'delivered'
  | 'cancelled'

export interface ProductionConditions {
  readonly fillPercent: number
  readonly seriesReached: number
  readonly minSeriesRequired: number
  readonly thresholdPercent: number
  readonly hasUnpaidDeposits: boolean
}

export interface ProductionReadiness {
  readonly canStart: boolean
  readonly reasons: ReadonlyArray<string>
}

export const ALLOWED_CONTAINER_TRANSITIONS: Record<
  ContainerStatus,
  ReadonlyArray<ContainerStatus>
> = {
  draft: ['open', 'cancelled'],
  open: ['threshold_reached', 'cancelled'],
  threshold_reached: ['production', 'cancelled', 'open'],
  production: ['manufactured', 'cancelled'],
  manufactured: ['shipped'],
  shipped: ['customs'],
  customs: ['arrived'],
  arrived: ['delivered'],
  delivered: [],
  cancelled: [],
} as const

export function canTransition(
  from: ContainerStatus,
  to: ContainerStatus,
): boolean {
  return ALLOWED_CONTAINER_TRANSITIONS[from].includes(to)
}

export function getAllowedContainerTransitions(
  from: ContainerStatus,
): ReadonlyArray<ContainerStatus> {
  return ALLOWED_CONTAINER_TRANSITIONS[from]
}

export function getContainerOperationalStatus({
  status,
  fillPercent,
  thresholdPercent,
}: {
  readonly status: ContainerStatus
  readonly fillPercent: number
  readonly thresholdPercent: number
}): ContainerStatus {
  if (status === 'open' && fillPercent >= thresholdPercent) {
    return 'threshold_reached'
  }

  return status
}

export function canStartProduction(
  conditions: ProductionConditions,
): ProductionReadiness {
  const reasons: string[] = []

  if (conditions.fillPercent < conditions.thresholdPercent) {
    reasons.push(
      `Remplissage ${conditions.fillPercent.toFixed(1)}% < ${conditions.thresholdPercent}%`,
    )
  }

  if (conditions.seriesReached < conditions.minSeriesRequired) {
    reasons.push(
      `${conditions.seriesReached} series atteintes / ${conditions.minSeriesRequired} requises`,
    )
  }

  if (conditions.hasUnpaidDeposits) {
    reasons.push('Acomptes non encore tous payes')
  }

  return {
    canStart: reasons.length === 0,
    reasons,
  }
}
