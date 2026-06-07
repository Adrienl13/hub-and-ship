// Partner portal data access — authenticated, RLS-scoped reads for the partner
// dashboard. Every query relies on the partner RLS policies
// (20260607160000_partner_portal_access.sql) so a partner only ever receives
// their own application, deals and attributed reservations. Net partner pricing
// is never stored on these rows, so nothing private is exposed here.

import type { Database } from '@/lib/supabase/types'

type ApplicationRow = Database['public']['Tables']['partner_applications']['Row']
type DealRow = Database['public']['Tables']['partner_deals']['Row']
type ReservationRow = Database['public']['Tables']['reservations']['Row']

interface RepositoryResult<T> {
  readonly data: T | null
  readonly error: { readonly message: string } | null
}

interface RpcResult<T> {
  readonly data: T | null
  readonly error: { readonly message: string } | null
}

interface OrderedSelect<TRow> {
  select: (columns: string) => {
    order: (
      column: 'created_at',
      options: { readonly ascending: boolean },
    ) => PromiseLike<RepositoryResult<ReadonlyArray<TRow>>> & {
      limit: (
        count: number,
      ) => PromiseLike<RepositoryResult<ReadonlyArray<TRow>>>
    }
  }
}

export interface PartnerPortalClient {
  rpc: (fn: 'claim_partner_access') => PromiseLike<RpcResult<string[]>>
  from: {
    (table: 'partner_applications'): OrderedSelect<ApplicationRow>
    (table: 'partner_deals'): OrderedSelect<DealRow>
    (table: 'reservations'): OrderedSelect<ReservationRow>
  }
}

export interface PartnerWorkspaceApplication {
  readonly id: string
  readonly companyName: string
  readonly status: ApplicationRow['status']
  readonly contactEmail: string
  readonly referralSlug: string | null
}

export interface PartnerWorkspaceDeal {
  readonly id: string
  readonly clientCompanyName: string
  readonly projectType: string
  readonly projectCity: string | null
  readonly status: DealRow['status']
  readonly protectedUntil: string | null
  readonly referralSlug: string | null
}

export interface PartnerWorkspaceReservation {
  readonly id: string
  readonly reference: string
  readonly status: ReservationRow['status']
  readonly totalHt: number
  readonly attributionReason: string | null
  readonly createdAt: string
}

export interface PartnerWorkspace {
  readonly applications: ReadonlyArray<PartnerWorkspaceApplication>
  readonly deals: ReadonlyArray<PartnerWorkspaceDeal>
  readonly reservations: ReadonlyArray<PartnerWorkspaceReservation>
}

/**
 * Keep only the reservations genuinely attributed to this partner. RLS also
 * returns a signed-in partner's own *buyer* reservations (user_id match), so we
 * defensively filter to the partner's application/deal ids before display.
 */
export function filterAttributedReservations(
  reservations: ReadonlyArray<ReservationRow>,
  applicationIds: ReadonlySet<string>,
  dealIds: ReadonlySet<string>,
): ReadonlyArray<ReservationRow> {
  return reservations.filter(
    (row) =>
      (row.partner_application_id !== null &&
        applicationIds.has(row.partner_application_id)) ||
      (row.partner_deal_id !== null && dealIds.has(row.partner_deal_id)),
  )
}

export async function claimPartnerAccess(
  client: PartnerPortalClient,
): Promise<ReadonlyArray<string>> {
  const { data, error } = await client.rpc('claim_partner_access')
  if (error) throw new Error(error.message)
  return data ?? []
}

// ---------------------------------------------------------------------------
// Self-service deal registration — a partner declares an opportunity from the
// portal. Status is forced to 'submitted'; protection stays an admin decision
// (enforced by the RLS WITH CHECK in 20260607200000_partner_self_service_deals).
// ---------------------------------------------------------------------------

export interface CreatePartnerDealInput {
  readonly applicationId: string
  readonly partnerCompanyName: string
  readonly partnerContactEmail: string
  readonly clientCompanyName: string
  readonly clientSiret: string | null
  readonly clientEmail: string | null
  readonly projectType: string
  readonly projectCity: string | null
  readonly expectedBudgetHt: number | null
  readonly expectedPurchaseWindow: string | null
  readonly productInterest: string | null
  readonly message: string | null
}

export interface PartnerDealInsertClient {
  from: (table: 'partner_deals') => {
    insert: (
      payload: unknown,
    ) => PromiseLike<{ readonly error: { readonly message: string } | null }>
  }
}

/** Builds the insert payload, forcing the safe status and portal source. */
export function partnerDealInsertPayload(input: CreatePartnerDealInput) {
  return {
    application_id: input.applicationId,
    status: 'submitted' as const,
    source: 'partner_portal',
    partner_company_name: input.partnerCompanyName,
    partner_contact_email: input.partnerContactEmail,
    client_company_name: input.clientCompanyName,
    client_siret: input.clientSiret,
    client_email: input.clientEmail,
    project_type: input.projectType,
    project_city: input.projectCity,
    expected_budget_ht: input.expectedBudgetHt,
    expected_purchase_window: input.expectedPurchaseWindow,
    product_interest: input.productInterest,
    message: input.message,
  }
}

export async function createPartnerDeal(
  client: PartnerDealInsertClient,
  input: CreatePartnerDealInput,
): Promise<void> {
  const { error } = await client
    .from('partner_deals')
    .insert(partnerDealInsertPayload(input))
  if (error) throw new Error(error.message)
}

export async function loadPartnerWorkspace(
  client: PartnerPortalClient,
): Promise<PartnerWorkspace> {
  const applicationsResult = await client
    .from('partner_applications')
    .select('*')
    .order('created_at', { ascending: false })
  if (applicationsResult.error) throw new Error(applicationsResult.error.message)
  const applications = (applicationsResult.data ?? []) as ApplicationRow[]

  const dealsResult = await client
    .from('partner_deals')
    .select('*')
    .order('created_at', { ascending: false })
  if (dealsResult.error) throw new Error(dealsResult.error.message)
  const deals = (dealsResult.data ?? []) as DealRow[]

  const reservationsResult = await client
    .from('reservations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)
  if (reservationsResult.error) throw new Error(reservationsResult.error.message)
  const reservationRows = (reservationsResult.data ?? []) as ReservationRow[]

  const applicationIds = new Set(applications.map((a) => a.id))
  const dealIds = new Set(deals.map((d) => d.id))
  const attributed = filterAttributedReservations(
    reservationRows,
    applicationIds,
    dealIds,
  )

  return {
    applications: applications.map((row) => ({
      id: row.id,
      companyName: row.company_name,
      status: row.status,
      contactEmail: row.contact_email,
      referralSlug: row.partner_referral_slug,
    })),
    deals: deals.map((row) => ({
      id: row.id,
      clientCompanyName: row.client_company_name,
      projectType: row.project_type,
      projectCity: row.project_city,
      status: row.status,
      protectedUntil: row.protected_until,
      referralSlug: row.partner_referral_slug,
    })),
    reservations: attributed.map((row) => ({
      id: row.id,
      reference: row.reference,
      status: row.status,
      totalHt: Number(row.total_ht),
      attributionReason: row.partner_attribution_reason,
      createdAt: row.created_at,
    })),
  }
}
