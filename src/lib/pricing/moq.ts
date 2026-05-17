export type MoqStatusKind =
  | 'reached'
  | 'almost'
  | 'progressing'
  | 'starting'
  | 'empty'

export type MoqColorClass = 'success' | 'amber' | 'neutral' | 'muted'

export interface MoqStatus {
  readonly status: MoqStatusKind
  readonly unitsCommitted: number
  readonly unitsRequired: number
  readonly unitsRemaining: number
  readonly percent: number
  readonly message: string
  readonly colorClass: MoqColorClass
}

function roundPercent(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function getMoqStatus(
  unitsCommitted: number,
  moqRequired: number,
): MoqStatus {
  const safeCommitted = Math.max(0, unitsCommitted)
  const safeRequired = Math.max(0, moqRequired)

  if (safeRequired === 0) {
    return {
      status: 'reached',
      unitsCommitted: safeCommitted,
      unitsRequired: 0,
      unitsRemaining: 0,
      percent: 100,
      message: 'Serie confirmee',
      colorClass: 'success',
    }
  }

  const percent = roundPercent((safeCommitted / safeRequired) * 100)
  const remaining = Math.max(0, safeRequired - safeCommitted)

  if (safeCommitted === 0) {
    return {
      status: 'empty',
      unitsCommitted: safeCommitted,
      unitsRequired: safeRequired,
      unitsRemaining: remaining,
      percent: 0,
      message: 'Soyez le premier a engager cette serie',
      colorClass: 'muted',
    }
  }

  if (safeCommitted >= safeRequired) {
    return {
      status: 'reached',
      unitsCommitted: safeCommitted,
      unitsRequired: safeRequired,
      unitsRemaining: 0,
      percent: 100,
      message: `Serie confirmee (${safeCommitted}/${safeRequired})`,
      colorClass: 'success',
    }
  }

  if (percent >= 80) {
    return {
      status: 'almost',
      unitsCommitted: safeCommitted,
      unitsRequired: safeRequired,
      unitsRemaining: remaining,
      percent,
      message: `Presque atteint ! Manque ${remaining} unites`,
      colorClass: 'amber',
    }
  }

  if (percent >= 40) {
    return {
      status: 'progressing',
      unitsCommitted: safeCommitted,
      unitsRequired: safeRequired,
      unitsRemaining: remaining,
      percent,
      message: `En cours - Manque ${remaining} unites`,
      colorClass: 'amber',
    }
  }

  return {
    status: 'starting',
    unitsCommitted: safeCommitted,
    unitsRequired: safeRequired,
    unitsRemaining: remaining,
    percent,
    message: `Demarrage - Manque ${remaining} unites`,
    colorClass: 'neutral',
  }
}
