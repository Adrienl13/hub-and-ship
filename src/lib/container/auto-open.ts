import type { ContainerStatus } from './status'

export type AutoOpenMode = 'manual' | 'semi_auto' | 'full_auto'

export interface AutoOpenPort {
  readonly id: string
  readonly countryCode: string
  readonly isActive: boolean
}

export interface AutoOpenContainerSummary {
  readonly id: string
  readonly portId: string
  readonly reference: string
  readonly status: ContainerStatus
  readonly createdAt: string
}

export type AutoOpenAction = 'none' | 'suggest' | 'awaiting_approval' | 'open'

export interface AutoOpenDecision {
  readonly mode: AutoOpenMode
  readonly action: AutoOpenAction
  readonly shouldCreateContainer: boolean
  readonly newContainerStatus: 'draft' | 'open' | null
  readonly reference: string | null
  readonly expectedCloseAt: Date | null
  readonly reason: string
}

const ELIGIBLE_PREVIOUS_STATUSES: ReadonlyArray<ContainerStatus> = [
  'production',
  'manufactured',
  'shipped',
  'customs',
  'arrived',
  'delivered',
] as const

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function generateNextContainerReference(
  year: number,
  existingCountForYear: number,
): string {
  const safeYear = Math.max(0, Math.trunc(year))
  const safeCount = Math.max(0, Math.trunc(existingCountForYear))
  return `CC-${safeYear}-${String(safeCount + 1).padStart(3, '0')}`
}

export function shouldOpenNextContainer(
  lastContainer: AutoOpenContainerSummary | null,
): boolean {
  if (!lastContainer) return true
  return ELIGIBLE_PREVIOUS_STATUSES.includes(lastContainer.status)
}

export function evaluateAutoOpen({
  mode,
  port,
  openContainersForPort,
  lastContainer,
  existingCountForYear,
  now = new Date(),
  closeDelayDays = 35,
}: {
  readonly mode: AutoOpenMode
  readonly port: AutoOpenPort
  readonly openContainersForPort: ReadonlyArray<AutoOpenContainerSummary>
  readonly lastContainer: AutoOpenContainerSummary | null
  readonly existingCountForYear: number
  readonly now?: Date
  readonly closeDelayDays?: number
}): AutoOpenDecision {
  if (!port.isActive) {
    return {
      mode,
      action: 'none',
      shouldCreateContainer: false,
      newContainerStatus: null,
      reference: null,
      expectedCloseAt: null,
      reason: 'Port inactif',
    }
  }

  if (openContainersForPort.length > 0) {
    return {
      mode,
      action: 'none',
      shouldCreateContainer: false,
      newContainerStatus: null,
      reference: null,
      expectedCloseAt: null,
      reason: 'Un container est deja ouvert sur ce port',
    }
  }

  if (!shouldOpenNextContainer(lastContainer)) {
    return {
      mode,
      action: 'none',
      shouldCreateContainer: false,
      newContainerStatus: null,
      reference: null,
      expectedCloseAt: null,
      reason: 'Le dernier container du port nest pas encore assez avance',
    }
  }

  const reference = generateNextContainerReference(
    now.getFullYear(),
    existingCountForYear,
  )
  const expectedCloseAt = addDays(now, closeDelayDays)

  if (mode === 'manual') {
    return {
      mode,
      action: 'suggest',
      shouldCreateContainer: false,
      newContainerStatus: null,
      reference,
      expectedCloseAt,
      reason: 'Mode manuel - suggestion admin uniquement',
    }
  }

  if (mode === 'semi_auto') {
    return {
      mode,
      action: 'awaiting_approval',
      shouldCreateContainer: true,
      newContainerStatus: 'draft',
      reference,
      expectedCloseAt,
      reason: 'Mode semi-auto - validation admin requise',
    }
  }

  return {
    mode,
    action: 'open',
    shouldCreateContainer: true,
    newContainerStatus: 'open',
    reference,
    expectedCloseAt,
    reason: 'Mode full-auto - ouverture immediate',
  }
}
