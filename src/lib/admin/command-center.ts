// Admin Command Center — live counts of the day's operational urgencies.
//
// These are lightweight COUNT(*) queries (head: true, no rows returned) gated
// by the existing admin RLS policies, so an admin sees the real backlog across
// stock leads, partner pipeline and reservations awaiting their reservation
// fee. Kept as a thin, mockable repository so the aggregation has unit tests.

interface CountResult {
  readonly count: number | null
  readonly error: { readonly message: string } | null
}

interface CountFilterBuilder {
  eq: (column: string, value: string) => PromiseLike<CountResult>
  in: (column: string, values: ReadonlyArray<string>) => PromiseLike<CountResult>
}

export interface CommandCenterClient {
  from: (table: string) => {
    select: (
      columns: string,
      options: { readonly count: 'exact'; readonly head: true },
    ) => CountFilterBuilder
  }
}

export interface CommandCenterCounts {
  readonly newStockRequests: number
  readonly partnerApplicationsToReview: number
  readonly partnerDealsToQualify: number
  readonly reservationsPendingPayment: number
  readonly openClaims: number
}

async function runCount(
  query: PromiseLike<CountResult>,
  label: string,
): Promise<number> {
  const { count, error } = await query
  if (error) throw new Error(`${label}: ${error.message}`)
  return count ?? 0
}

function countHead(client: CommandCenterClient, table: string) {
  return client.from(table).select('id', { count: 'exact', head: true })
}

export async function loadCommandCenterCounts(
  client: CommandCenterClient,
): Promise<CommandCenterCounts> {
  const [
    newStockRequests,
    partnerApplicationsToReview,
    partnerDealsToQualify,
    reservationsPendingPayment,
    openClaims,
  ] = await Promise.all([
    runCount(
      countHead(client, 'stock_requests').eq('status', 'new'),
      'stock_requests',
    ),
    runCount(
      countHead(client, 'partner_applications').in('status', [
        'new',
        'reviewing',
      ]),
      'partner_applications',
    ),
    runCount(
      countHead(client, 'partner_deals').eq('status', 'submitted'),
      'partner_deals',
    ),
    runCount(
      countHead(client, 'reservations').eq('status', 'pending_reservation_fee'),
      'reservations',
    ),
    runCount(
      countHead(client, 'reservation_claims').eq('status', 'open'),
      'reservation_claims',
    ),
  ])

  return {
    newStockRequests,
    partnerApplicationsToReview,
    partnerDealsToQualify,
    reservationsPendingPayment,
    openClaims,
  }
}

export function totalUrgencies(counts: CommandCenterCounts): number {
  return (
    counts.newStockRequests +
    counts.partnerApplicationsToReview +
    counts.partnerDealsToQualify +
    counts.reservationsPendingPayment +
    counts.openClaims
  )
}
