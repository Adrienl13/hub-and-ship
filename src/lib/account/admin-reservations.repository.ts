// Admin-grade reservations repository. Lists ALL reservations (latest 100)
// and performs status transitions via UPDATE. RLS policy
// `Admins full access reservations` restricts these calls to admin /
// super_admin profiles.

import type { SupabaseBrowserClient } from '@/lib/supabase/client'
import type {
  ContainerType,
  Database,
  ReservationStatus,
} from '@/lib/supabase/types'

export type AdminReservationsClient = SupabaseBrowserClient

type ReservationRow = Database['public']['Tables']['reservations']['Row']
type ReservationUpdate = Database['public']['Tables']['reservations']['Update']

export interface AdminReservationRow {
  readonly id: string
  readonly reference: string
  readonly containerReference: string
  readonly siret: string
  readonly companyLegalName: string | null
  readonly contactName: string | null
  readonly contactEmail: string | null
  readonly contactPhone: string | null
  readonly status: ReservationStatus
  readonly totalHt: number
  readonly totalCbm: number
  readonly reservationFee: number
  readonly depositAmount: number
  readonly balanceAmount: number
  readonly reservedAt: string | null
  readonly cancelledAt: string | null
  readonly cancellationReason: string | null
  readonly adminNotes: string | null
  readonly stripePaymentIntentId: string | null
  readonly paidReservationFeeAt: string | null
  readonly partnerDealId: string | null
  readonly partnerApplicationId: string | null
  readonly partnerAttributionReason: string | null
  readonly partnerAttributionPartnerCompany: string | null
  readonly partnerAttributionPartnerEmail: string | null
  readonly partnerAttributionMatchedValue: string | null
  readonly partnerAttributionProtectedUntil: string | null
  readonly partnerLinkSlug: string | null
  readonly partnerLinkDisplayName: string | null
  readonly createdAt: string
  readonly updatedAt: string
  readonly requestedContainerType: ContainerType | null
}

interface ContactSnapshot {
  readonly name?: string
  readonly company?: string
  readonly email?: string
  readonly phone?: string
}

interface PartnerAttributionSnapshot {
  readonly partnerCompanyName?: string
  readonly partnerContactEmail?: string
  readonly matchedValue?: string
  readonly protectedUntil?: string
}

interface PartnerLinkSnapshot {
  readonly slug?: string
  readonly displayName?: string
}

function extractContact(snapshot: unknown): ContactSnapshot {
  if (!snapshot || typeof snapshot !== 'object') return {}
  const obj = snapshot as Record<string, unknown>
  return {
    name: typeof obj.name === 'string' ? obj.name : undefined,
    company: typeof obj.company === 'string' ? obj.company : undefined,
    email: typeof obj.email === 'string' ? obj.email : undefined,
    phone: typeof obj.phone === 'string' ? obj.phone : undefined,
  }
}

function extractPartnerLink(snapshot: unknown): PartnerLinkSnapshot {
  if (!snapshot || typeof snapshot !== 'object') return {}
  const obj = snapshot as Record<string, unknown>
  const partnerContext = obj.partner_context
  if (!partnerContext || typeof partnerContext !== 'object') return {}
  const partnerObj = partnerContext as Record<string, unknown>
  return {
    slug: typeof partnerObj.slug === 'string' ? partnerObj.slug : undefined,
    displayName:
      typeof partnerObj.display_name === 'string'
        ? partnerObj.display_name
        : undefined,
  }
}

function extractPartnerAttribution(
  snapshot: unknown,
): PartnerAttributionSnapshot {
  if (!snapshot || typeof snapshot !== 'object') return {}
  const obj = snapshot as Record<string, unknown>
  return {
    partnerCompanyName:
      typeof obj.partner_company_name === 'string'
        ? obj.partner_company_name
        : undefined,
    partnerContactEmail:
      typeof obj.partner_contact_email === 'string'
        ? obj.partner_contact_email
        : undefined,
    matchedValue:
      typeof obj.matched_value === 'string' ? obj.matched_value : undefined,
    protectedUntil:
      typeof obj.protected_until === 'string'
        ? obj.protected_until
        : undefined,
  }
}

function toAdminRow(row: ReservationRow): AdminReservationRow {
  const contact = extractContact(row.contact_snapshot)
  const partnerLink = extractPartnerLink(row.contact_snapshot)
  const partnerAttribution = extractPartnerAttribution(
    row.partner_attribution_snapshot,
  )
  return {
    id: row.id,
    reference: row.reference,
    containerReference: row.container_reference,
    siret: row.siret,
    companyLegalName: contact.company ?? null,
    contactName: contact.name ?? null,
    contactEmail: contact.email ?? null,
    contactPhone: contact.phone ?? null,
    status: row.status,
    totalHt: Number(row.total_ht),
    totalCbm: Number(row.total_cbm),
    reservationFee: Number(row.reservation_fee),
    depositAmount: Number(row.deposit_amount),
    balanceAmount: Number(row.balance_amount),
    reservedAt: row.reserved_at,
    cancelledAt: row.cancelled_at,
    cancellationReason: row.cancellation_reason,
    adminNotes: row.admin_notes,
    stripePaymentIntentId: row.stripe_payment_intent_id,
    paidReservationFeeAt: row.paid_reservation_fee_at,
    partnerDealId: row.partner_deal_id,
    partnerApplicationId: row.partner_application_id,
    partnerAttributionReason: row.partner_attribution_reason,
    partnerAttributionPartnerCompany:
      partnerAttribution.partnerCompanyName ?? null,
    partnerAttributionPartnerEmail:
      partnerAttribution.partnerContactEmail ?? null,
    partnerAttributionMatchedValue: partnerAttribution.matchedValue ?? null,
    partnerAttributionProtectedUntil:
      partnerAttribution.protectedUntil ?? null,
    partnerLinkSlug: partnerLink.slug ?? null,
    partnerLinkDisplayName: partnerLink.displayName ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    requestedContainerType: row.requested_container_type,
  }
}

export async function listAllReservations(
  client: AdminReservationsClient,
): Promise<ReadonlyArray<AdminReservationRow>> {
  const { data, error } = await client
    .from('reservations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) throw new Error(error.message)
  return ((data ?? []) as ReadonlyArray<ReservationRow>).map(toAdminRow)
}

export interface UpdateReservationStatusInput {
  readonly status: ReservationStatus
  readonly adminNote?: string | null
  readonly cancellationReason?: string | null
}

export async function updateReservationStatus(
  client: AdminReservationsClient,
  id: string,
  input: UpdateReservationStatusInput,
): Promise<void> {
  const now = new Date().toISOString()
  const payload: ReservationUpdate = {
    status: input.status,
    updated_at: now,
  }
  if (input.adminNote !== undefined) {
    payload.admin_notes = input.adminNote
  }
  if (input.status === 'reserved') {
    payload.reserved_at = now
  }
  if (input.status === 'cancelled') {
    payload.cancelled_at = now
    if (input.cancellationReason !== undefined) {
      payload.cancellation_reason = input.cancellationReason
    }
  }

  const { error } = await client
    .from('reservations')
    .update(payload as never)
    .eq('id', id)

  if (error) throw new Error(error.message)
}

export async function updateReservationAdminNote(
  client: AdminReservationsClient,
  id: string,
  adminNote: string | null,
): Promise<void> {
  const { error } = await client
    .from('reservations')
    .update({
      admin_notes: adminNote,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', id)

  if (error) throw new Error(error.message)
}
