import type {
  PartnerApplicationInsertPayload,
  PartnerApplicationRow,
  PartnerApplicationStatus,
  PartnerDealInsertPayload,
  PartnerDealRow,
  PartnerDealStatus,
} from '@/lib/partners/types'
import type { PartnerSubmissionDraft } from '@/lib/partners/submission'
import { normalizePartnerSlug } from '@/lib/partners/link'

interface RepositoryResult<T> {
  readonly data: T | null
  readonly error: { readonly message: string } | null
}

interface RepositoryListResult<T> {
  readonly data: T[] | null
  readonly error: { readonly message: string } | null
}

interface InsertBuilder<TPayload, TRow> {
  insert: (payload: TPayload) => {
    select: (columns: string) => {
      single: () => PromiseLike<RepositoryResult<TRow>>
    }
  }
}

interface SelectBuilder<TRow> {
  select: (columns: '*') => {
    order: (
      column: 'created_at',
      options: { readonly ascending: boolean },
    ) => PromiseLike<RepositoryListResult<TRow>>
  }
}

interface UpdateBuilder<TPayload> {
  update: (payload: TPayload) => {
    eq: (column: 'id', value: string) => PromiseLike<RepositoryResult<null>>
  }
}

export interface PartnerSubmissionRepositoryClient {
  from: {
    (
      table: 'partner_applications',
    ): InsertBuilder<
      PartnerApplicationInsertPayload,
      Pick<PartnerApplicationRow, 'id' | 'status'>
    >
    (
      table: 'partner_deals',
    ): InsertBuilder<
      PartnerDealInsertPayload,
      Pick<PartnerDealRow, 'id' | 'status'>
    >
  }
}

export interface PartnerAdminRepositoryClient {
  from: {
    (
      table: 'partner_applications',
    ): SelectBuilder<PartnerApplicationRow> &
      UpdateBuilder<Partial<PartnerApplicationRow>>
    (
      table: 'partner_deals',
    ): SelectBuilder<PartnerDealRow> & UpdateBuilder<Partial<PartnerDealRow>>
  }
}

export interface CreatePartnerSubmissionResult {
  readonly application: Pick<PartnerApplicationRow, 'id' | 'status'>
  readonly deal: Pick<PartnerDealRow, 'id' | 'status'> | null
}

export interface PartnerApplicationAdminRow {
  readonly id: string
  readonly status: PartnerApplicationStatus
  readonly partnerKind: PartnerApplicationRow['partner_kind']
  readonly companyName: string
  readonly contactName: string
  readonly contactEmail: string
  readonly contactPhone: string
  readonly siret: string | null
  readonly territory: string | null
  readonly networkDescription: string | null
  readonly expectedMonthlyVolume: string | null
  readonly message: string | null
  readonly internalNote: string | null
  readonly partnerReferralSlug: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export interface PartnerDealAdminRow {
  readonly id: string
  readonly applicationId: string | null
  readonly status: PartnerDealStatus
  readonly partnerCompanyName: string
  readonly partnerContactEmail: string
  readonly clientCompanyName: string
  readonly clientSiret: string | null
  readonly clientEmail: string | null
  readonly projectCity: string | null
  readonly projectType: string
  readonly expectedBudgetHt: number | null
  readonly expectedPurchaseWindow: string | null
  readonly productInterest: string | null
  readonly protectionDays: number
  readonly protectedUntil: string | null
  readonly message: string | null
  readonly internalNote: string | null
  readonly partnerReferralSlug: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

function toApplicationAdminRow(
  row: PartnerApplicationRow,
): PartnerApplicationAdminRow {
  return {
    id: row.id,
    status: row.status,
    partnerKind: row.partner_kind,
    companyName: row.company_name,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    siret: row.siret,
    territory: row.territory,
    networkDescription: row.network_description,
    expectedMonthlyVolume: row.expected_monthly_volume,
    message: row.message,
    internalNote: row.internal_note,
    partnerReferralSlug: row.partner_referral_slug,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toDealAdminRow(row: PartnerDealRow): PartnerDealAdminRow {
  return {
    id: row.id,
    applicationId: row.application_id,
    status: row.status,
    partnerCompanyName: row.partner_company_name,
    partnerContactEmail: row.partner_contact_email,
    clientCompanyName: row.client_company_name,
    clientSiret: row.client_siret,
    clientEmail: row.client_email,
    projectCity: row.project_city,
    projectType: row.project_type,
    expectedBudgetHt:
      row.expected_budget_ht === null ? null : Number(row.expected_budget_ht),
    expectedPurchaseWindow: row.expected_purchase_window,
    productInterest: row.product_interest,
    protectionDays: row.protection_days,
    protectedUntil: row.protected_until,
    message: row.message,
    internalNote: row.internal_note,
    partnerReferralSlug: row.partner_referral_slug,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function createPartnerSubmissionInSupabase({
  client,
  draft,
}: {
  readonly client: PartnerSubmissionRepositoryClient
  readonly draft: PartnerSubmissionDraft
}): Promise<CreatePartnerSubmissionResult> {
  const appResult = await client
    .from('partner_applications')
    .insert(draft.application)
    .select('id, status')
    .single()

  if (appResult.error || !appResult.data) {
    throw new Error(
      appResult.error?.message ?? 'Partner application insert failed',
    )
  }

  if (!draft.deal) {
    return { application: appResult.data, deal: null }
  }

  const dealResult = await client
    .from('partner_deals')
    .insert({
      ...draft.deal,
      application_id: appResult.data.id,
    })
    .select('id, status')
    .single()

  if (dealResult.error || !dealResult.data) {
    throw new Error(dealResult.error?.message ?? 'Partner deal insert failed')
  }

  return {
    application: appResult.data,
    deal: dealResult.data,
  }
}

export async function listPartnerApplications(
  client: PartnerAdminRepositoryClient,
): Promise<ReadonlyArray<PartnerApplicationAdminRow>> {
  const { data, error } = await client
    .from('partner_applications')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return ((data ?? []) as PartnerApplicationRow[]).map(toApplicationAdminRow)
}

export async function listPartnerDeals(
  client: PartnerAdminRepositoryClient,
): Promise<ReadonlyArray<PartnerDealAdminRow>> {
  const { data, error } = await client
    .from('partner_deals')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return ((data ?? []) as PartnerDealRow[]).map(toDealAdminRow)
}

export async function updatePartnerApplicationStatus(
  client: PartnerAdminRepositoryClient,
  id: string,
  status: PartnerApplicationStatus,
  internalNote?: string | null,
): Promise<void> {
  const payload: Partial<PartnerApplicationRow> = {
    status,
    updated_at: new Date().toISOString(),
  }
  if (internalNote !== undefined) payload.internal_note = internalNote

  const { error } = await client
    .from('partner_applications')
    .update(payload)
    .eq('id', id)

  if (error) throw new Error(error.message)
}

export async function updatePartnerDealStatus(
  client: PartnerAdminRepositoryClient,
  id: string,
  status: PartnerDealStatus,
  internalNote?: string | null,
): Promise<void> {
  const now = new Date()
  const payload: Partial<PartnerDealRow> = {
    status,
    updated_at: now.toISOString(),
  }
  if (status === 'protected') {
    payload.protected_until = new Date(
      now.getTime() + 120 * 24 * 60 * 60 * 1000,
    ).toISOString()
  }
  if (internalNote !== undefined) payload.internal_note = internalNote

  const { error } = await client
    .from('partner_deals')
    .update(payload)
    .eq('id', id)

  if (error) throw new Error(error.message)
}

// ---------------------------------------------------------------------------
// Referral slug management — powers the admin "shareable link" action. The
// `/p/{slug}` page is fully static, so the slug only needs to be stored here so
// that the reservation attribution trigger can match a buyer back to this
// partner. An empty value clears the slug; anything else must normalize to a
// valid slug (matching the DB `normalize_partner_slug` CHECK constraint).
// ---------------------------------------------------------------------------

function toSlugUpdateValue(rawSlug: string | null): string | null {
  if (rawSlug === null) return null
  const trimmed = rawSlug.trim()
  if (trimmed === '') return null

  const normalized = normalizePartnerSlug(trimmed)
  if (!normalized) {
    throw new Error(
      'Slug invalide : utilisez lettres, chiffres et tirets (ex. chr-conseil).',
    )
  }
  return normalized
}

export async function updatePartnerApplicationSlug(
  client: PartnerAdminRepositoryClient,
  id: string,
  rawSlug: string | null,
): Promise<string | null> {
  const slug = toSlugUpdateValue(rawSlug)

  const { error } = await client
    .from('partner_applications')
    .update({
      partner_referral_slug: slug,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) throw new Error(error.message)
  return slug
}

export async function updatePartnerDealSlug(
  client: PartnerAdminRepositoryClient,
  id: string,
  rawSlug: string | null,
): Promise<string | null> {
  const slug = toSlugUpdateValue(rawSlug)

  const { error } = await client
    .from('partner_deals')
    .update({
      partner_referral_slug: slug,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) throw new Error(error.message)
  return slug
}
