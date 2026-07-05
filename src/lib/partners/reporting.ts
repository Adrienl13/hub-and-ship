// Pure partner reporting aggregates, computed from the partner workspace data
// (deals + attributed reservations the RLS already scopes to this partner).

import type {
  PartnerWorkspaceDeal,
  PartnerWorkspaceReservation,
} from '@/lib/partners/portal'

const PROTECTED_STATUSES = new Set(['protected', 'quoted', 'reserved'])

export interface PartnerReport {
  readonly totalDeals: number
  readonly protectedDeals: number
  readonly wonDeals: number
  readonly attributedReservations: number
  readonly attributedTotalHt: number
}

export function computePartnerReport(
  deals: ReadonlyArray<PartnerWorkspaceDeal>,
  reservations: ReadonlyArray<PartnerWorkspaceReservation>,
): PartnerReport {
  return {
    totalDeals: deals.length,
    protectedDeals: deals.filter((d) => PROTECTED_STATUSES.has(d.status)).length,
    wonDeals: deals.filter((d) => d.status === 'won').length,
    attributedReservations: reservations.length,
    attributedTotalHt: reservations.reduce((sum, r) => sum + r.totalHt, 0),
  }
}

export interface DealStatusCount {
  readonly status: PartnerWorkspaceDeal['status']
  readonly count: number
}

/** Deal counts grouped by status, ordered by descending count. */
export function dealsByStatus(
  deals: ReadonlyArray<PartnerWorkspaceDeal>,
): ReadonlyArray<DealStatusCount> {
  const counts = new Map<PartnerWorkspaceDeal['status'], number>()
  for (const deal of deals) {
    counts.set(deal.status, (counts.get(deal.status) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count)
}
