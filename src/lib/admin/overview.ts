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

// ============================================================================
// Agrégats business — 12 mois glissants, conversion, demandes de contact
// ============================================================================
//
// Le propriétaire veut lire en un coup d'œil ce que l'activité rapporte et
// où les demandes se perdent. Tout est calculé à partir de lignes minimales
// (statut, montant, date) lues sous RLS admin ; les calculs sont purs et
// testés, la lecture paginée (PostgREST plafonne à 1 000 lignes par page).

/** Réservations dont le client a payé au moins les frais : c'est le CA HT
 * « encaissé » au sens du tableau de bord (brouillon, frais en attente,
 * acompte appelé et annulée en sont exclus). */
export const PAID_RESERVATION_STATUSES: ReadonlyArray<string> = [
  'reserved',
  'deposit_paid',
  'in_production',
  'in_transit',
  'delivered',
]

export const CONTACT_REQUEST_STATUSES = [
  'new',
  'contacted',
  'quoted',
  'won',
  'lost',
] as const
export type ContactRequestStatusKey = (typeof CONTACT_REQUEST_STATUSES)[number]

export const BUSINESS_MONTHS = 12

export interface PaidReservationRow {
  readonly total_ht: number | string | null
  readonly status: string
  readonly reserved_at: string | null
  readonly created_at: string
}

export interface CreatedAtRow {
  readonly created_at: string
}

export interface StatusRow {
  readonly status: string
}

export interface StatusCreatedRow extends StatusRow, CreatedAtRow {}

export interface MonthlyBusinessRow {
  /** Clé AAAA-MM (UTC). */
  readonly month: string
  /** Libellé court en français, ex. « sept. 2026 ». */
  readonly label: string
  readonly revenueHt: number
  readonly reservations: number
  readonly accounts: number
  /** Demandes stock 24h + demandes de contact reçues dans le mois. */
  readonly requests: number
}

export interface ConversionKpi {
  readonly won: number
  readonly total: number
  /** Pourcentage 0–100 ; 0 sans dénominateur. */
  readonly rate: number
}

export interface AdminBusinessKpis {
  readonly months: ReadonlyArray<MonthlyBusinessRow>
  readonly revenueHt: number
  readonly paidReservations: number
  readonly averageBasketHt: number
  readonly accountsCreated: number
  readonly stockRequestConversion: ConversionKpi
  readonly partnerDealConversion: ConversionKpi
  readonly contactRequestsByStatus: Readonly<
    Record<ContactRequestStatusKey, number>
  >
  readonly contactRequestsTotal: number
}

const FR_MONTH_SHORT = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
] as const

/** Clé AAAA-MM (UTC) d'une date ISO, null si illisible. */
export function monthKeyOf(iso: string | null | undefined): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key: string): string {
  const [year, month] = key.split('-')
  const index = Number(month) - 1
  return `${FR_MONTH_SHORT[index] ?? month} ${year}`
}

/** Premier jour (UTC) du mois situé `months - 1` mois avant `now`. */
export function businessWindowStart(now: Date, months = BUSINESS_MONTHS): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1),
  )
}

/** Clés AAAA-MM des `months` derniers mois, le plus ancien en premier. */
export function lastMonthKeys(now: Date, months = BUSINESS_MONTHS): string[] {
  const start = businessWindowStart(now, months)
  return Array.from({ length: months }, (_, i) => {
    const date = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1),
    )
    return monthKeyOf(date.toISOString()) as string
  })
}

function conversion(won: number, total: number): ConversionKpi {
  return { won, total, rate: total > 0 ? (won / total) * 100 : 0 }
}

export function summarizeBusiness(
  input: {
    readonly reservations: ReadonlyArray<PaidReservationRow>
    readonly profiles: ReadonlyArray<CreatedAtRow>
    readonly stockRequests: ReadonlyArray<StatusCreatedRow>
    readonly partnerDeals: ReadonlyArray<StatusRow>
    readonly contactRequests: ReadonlyArray<StatusCreatedRow>
  },
  options: { readonly now?: Date; readonly months?: number } = {},
): AdminBusinessKpis {
  const now = options.now ?? new Date()
  const months = options.months ?? BUSINESS_MONTHS
  const keys = lastMonthKeys(now, months)
  const buckets = new Map(
    keys.map((key) => [
      key,
      { revenueHt: 0, reservations: 0, accounts: 0, requests: 0 },
    ]),
  )

  let revenueHt = 0
  let paidReservations = 0
  for (const row of input.reservations) {
    if (!PAID_RESERVATION_STATUSES.includes(row.status)) continue
    // Le mois est celui de la réservation effective, sinon de la création.
    const bucket = buckets.get(
      monthKeyOf(row.reserved_at) ?? monthKeyOf(row.created_at) ?? '',
    )
    if (!bucket) continue
    const amount = toNumber(row.total_ht)
    bucket.revenueHt += amount
    bucket.reservations += 1
    revenueHt += amount
    paidReservations += 1
  }

  let accountsCreated = 0
  for (const row of input.profiles) {
    const bucket = buckets.get(monthKeyOf(row.created_at) ?? '')
    if (!bucket) continue
    bucket.accounts += 1
    accountsCreated += 1
  }

  for (const row of [...input.stockRequests, ...input.contactRequests]) {
    const bucket = buckets.get(monthKeyOf(row.created_at) ?? '')
    if (bucket) bucket.requests += 1
  }

  const contactRequestsByStatus: Record<ContactRequestStatusKey, number> = {
    new: 0,
    contacted: 0,
    quoted: 0,
    won: 0,
    lost: 0,
  }
  for (const row of input.contactRequests) {
    if (row.status in contactRequestsByStatus) {
      contactRequestsByStatus[row.status as ContactRequestStatusKey] += 1
    }
  }

  return {
    months: keys.map((key) => {
      const bucket = buckets.get(key) as NonNullable<
        ReturnType<typeof buckets.get>
      >
      return { month: key, label: monthLabel(key), ...bucket }
    }),
    revenueHt,
    paidReservations,
    averageBasketHt: paidReservations > 0 ? revenueHt / paidReservations : 0,
    accountsCreated,
    stockRequestConversion: conversion(
      input.stockRequests.filter((r) => r.status === 'converted').length,
      input.stockRequests.length,
    ),
    partnerDealConversion: conversion(
      input.partnerDeals.filter((r) => r.status === 'won').length,
      input.partnerDeals.length,
    ),
    contactRequestsByStatus,
    contactRequestsTotal: input.contactRequests.length,
  }
}

// --- Lecture paginée -------------------------------------------------------

interface BusinessQuery<Row> extends PromiseLike<RowsResult<Row>> {
  in: (column: string, values: ReadonlyArray<string>) => BusinessQuery<Row>
  gte: (column: string, value: string) => BusinessQuery<Row>
  order: (
    column: string,
    options: { readonly ascending: boolean },
  ) => BusinessQuery<Row>
  range: (from: number, to: number) => BusinessQuery<Row>
}

export interface AdminBusinessClient {
  from: (table: string) => {
    select: (columns: string) => BusinessQuery<Record<string, unknown>>
  }
}

export const BUSINESS_PAGE_SIZE = 1000

async function pages<Row>(
  build: () => BusinessQuery<Record<string, unknown>>,
  label: string,
): Promise<ReadonlyArray<Row>> {
  const all: Row[] = []
  for (let offset = 0; ; offset += BUSINESS_PAGE_SIZE) {
    // Ordre stable (date puis id) : sans lui, PostgREST peut renvoyer une
    // même ligne sur deux pages et en oublier une autre.
    const { data, error } = await build()
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + BUSINESS_PAGE_SIZE - 1)
    if (error) throw new Error(`${label}: ${error.message}`)
    const page = (data ?? []) as unknown as ReadonlyArray<Row>
    all.push(...page)
    if (page.length < BUSINESS_PAGE_SIZE) break
  }
  return all
}

export async function loadAdminBusiness(
  client: AdminBusinessClient,
  options: { readonly now?: Date } = {},
): Promise<AdminBusinessKpis> {
  const now = options.now ?? new Date()
  const since = businessWindowStart(now).toISOString()

  const [reservations, profiles, stockRequests, partnerDeals, contactRequests] =
    await Promise.all([
      pages<PaidReservationRow>(
        () =>
          client
            .from('reservations')
            .select('total_ht,status,reserved_at,created_at')
            .in('status', PAID_RESERVATION_STATUSES)
            .gte('created_at', since),
        'reservations',
      ),
      pages<CreatedAtRow>(
        () =>
          client
            .from('users_profile')
            .select('created_at')
            .gte('created_at', since),
        'users_profile',
      ),
      pages<StatusCreatedRow>(
        () => client.from('stock_requests').select('status,created_at'),
        'stock_requests',
      ),
      pages<StatusRow>(
        () => client.from('partner_deals').select('status'),
        'partner_deals',
      ),
      pages<StatusCreatedRow>(
        () => client.from('contact_requests').select('status,created_at'),
        'contact_requests',
      ),
    ])

  return summarizeBusiness(
    { reservations, profiles, stockRequests, partnerDeals, contactRequests },
    { now },
  )
}
