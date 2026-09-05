// Admin overview KPIs — computed from the LIVE database, never from fixtures.
//
// Replaces the pre-launch dashboard snapshot that mixed demo stock requests and
// the static container mock into the back-office KPIs. Everything here goes
// through the admin RLS policies; the shape is kept minimal and mockable so the
// aggregation has unit tests.

interface RowsResult<Row> {
  readonly data: ReadonlyArray<Row> | null
  readonly error: { readonly message: string } | null
}

interface CountResult {
  readonly count: number | null
  readonly error: { readonly message: string } | null
}

interface ReservationKpiRow {
  readonly total_ht: number | string | null
  readonly total_cbm: number | string | null
}

interface StockKpiRow {
  readonly available_units: number | null
}

export interface OpenContainerRow {
  readonly reference: string
  readonly capacity_cbm: number | string | null
  readonly expected_close_at: string | null
}

interface FilterBuilder<Row> {
  eq: (
    column: string,
    value: string | boolean,
  ) => PromiseLike<RowsResult<Row> & Partial<CountResult>>
  in: (
    column: string,
    values: ReadonlyArray<string>,
  ) => PromiseLike<RowsResult<Row> & Partial<CountResult>>
}

export interface AdminOverviewClient {
  from: (table: string) => {
    select: (
      columns: string,
      options?: { readonly count: 'exact'; readonly head: true },
    ) => FilterBuilder<Record<string, unknown>>
  }
}

export interface AdminOverviewKpis {
  readonly activeReservations: number
  readonly committedHt: number
  readonly reservedCbm: number
  readonly openContainer: {
    readonly reference: string
    readonly capacityCbm: number
    readonly expectedCloseAt: string | null
    readonly fillPercent: number
  } | null
  readonly newStockRequests: number
  readonly stockAvailableUnits: number
  readonly activeProductReferences: number
}

/** Statuts qui engagent réellement un container (ni brouillon, ni livré, ni annulé). */
export const ACTIVE_RESERVATION_STATUSES: ReadonlyArray<string> = [
  'pending_reservation_fee',
  'reserved',
  'deposit_called',
  'deposit_paid',
  'in_production',
  'in_transit',
]

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

async function rows<Row>(
  query: PromiseLike<RowsResult<Row>>,
  label: string,
): Promise<ReadonlyArray<Row>> {
  const { data, error } = await query
  if (error) throw new Error(`${label}: ${error.message}`)
  return data ?? []
}

async function count(
  query: PromiseLike<Partial<CountResult> & { error: CountResult['error'] }>,
  label: string,
): Promise<number> {
  const { count: value, error } = await query
  if (error) throw new Error(`${label}: ${error.message}`)
  return value ?? 0
}

export function summarizeOverview(input: {
  readonly reservations: ReadonlyArray<ReservationKpiRow>
  readonly openContainers: ReadonlyArray<OpenContainerRow>
  readonly stockLines: ReadonlyArray<StockKpiRow>
  readonly newStockRequests: number
  readonly activeProductReferences: number
}): AdminOverviewKpis {
  const committedHt = input.reservations.reduce(
    (sum, row) => sum + toNumber(row.total_ht),
    0,
  )
  const reservedCbm = input.reservations.reduce(
    (sum, row) => sum + toNumber(row.total_cbm),
    0,
  )
  const open = input.openContainers[0] ?? null
  const capacityCbm = open ? toNumber(open.capacity_cbm) : 0

  return {
    activeReservations: input.reservations.length,
    committedHt,
    reservedCbm,
    openContainer: open
      ? {
          reference: open.reference,
          capacityCbm,
          expectedCloseAt: open.expected_close_at,
          fillPercent:
            capacityCbm > 0
              ? Math.min(100, (reservedCbm / capacityCbm) * 100)
              : 0,
        }
      : null,
    newStockRequests: input.newStockRequests,
    stockAvailableUnits: input.stockLines.reduce(
      (sum, row) => sum + toNumber(row.available_units),
      0,
    ),
    activeProductReferences: input.activeProductReferences,
  }
}

export async function loadAdminOverview(
  client: AdminOverviewClient,
): Promise<AdminOverviewKpis> {
  const [
    reservations,
    openContainers,
    stockLines,
    newStockRequests,
    activeProductReferences,
  ] = await Promise.all([
    rows<ReservationKpiRow>(
      client
        .from('reservations')
        .select('total_ht,total_cbm')
        .in('status', ACTIVE_RESERVATION_STATUSES) as PromiseLike<
        RowsResult<ReservationKpiRow>
      >,
      'reservations',
    ),
    rows<OpenContainerRow>(
      client
        .from('containers')
        .select('reference,capacity_cbm,expected_close_at')
        .eq('status', 'open') as PromiseLike<RowsResult<OpenContainerRow>>,
      'containers',
    ),
    rows<StockKpiRow>(
      client
        .from('stock_lines')
        .select('available_units')
        .eq('is_active', true) as PromiseLike<RowsResult<StockKpiRow>>,
      'stock_lines',
    ),
    count(
      client
        .from('stock_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'new'),
      'stock_requests',
    ),
    count(
      client
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true),
      'products',
    ),
  ])

  return summarizeOverview({
    reservations,
    openContainers,
    stockLines,
    newStockRequests,
    activeProductReferences,
  })
}
