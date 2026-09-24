// Dépôt admin des réservations. Liste TOUTES les réservations d'une période
// (500 max) et applique les transitions de statut via UPDATE. La politique RLS
// « Admins full access reservations » réserve ces appels aux profils admin /
// super_admin.

import { describeOrigin } from '@/lib/admin/origin'
import type { SupabaseBrowserClient } from '@/lib/supabase/client'
import type {
  ContainerType,
  Database,
  DeliveryMode,
  ReservationStatus,
} from '@/lib/supabase/types'

export type AdminReservationsClient = SupabaseBrowserClient

type ReservationRow = Database['public']['Tables']['reservations']['Row']
type ReservationUpdate = Database['public']['Tables']['reservations']['Update']
type ReservationItemRow =
  Database['public']['Tables']['reservation_items']['Row']

/** Libellés admin des modes de livraison (mêmes mots que l'email client). */
export const ADMIN_DELIVERY_MODE_LABEL: Record<DeliveryMode, string> = {
  door_delivery: "Livraison jusqu'à la terrasse",
  pickup_at_port: 'Enlèvement en zone de stockage',
  self_arranged: 'Transporteur du client',
  partner_carrier_needed: 'Transporteur à trouver',
}

export function deliveryModeLabel(mode: DeliveryMode | null): string {
  if (!mode) return '—'
  return ADMIN_DELIVERY_MODE_LABEL[mode] ?? mode
}

/** Périodes proposées dans l'admin : nombre de jours, `null` = tout. */
export type ReservationPeriodDays = 30 | 90 | 365 | null

export const RESERVATION_PERIOD_OPTIONS: ReadonlyArray<{
  readonly value: ReservationPeriodDays
  readonly label: string
}> = [
  { value: 30, label: '30 derniers jours' },
  { value: 90, label: '90 derniers jours' },
  { value: 365, label: '12 derniers mois' },
  { value: null, label: 'Tout' },
]

/** Borne basse ISO d'une période, ou `null` quand on veut tout. */
export function reservationPeriodSince(
  days: ReservationPeriodDays,
  now: Date = new Date(),
): string | null {
  if (days === null) return null
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
}

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
  readonly totalTtc: number
  readonly totalCbm: number
  readonly reservationFee: number
  readonly depositAmount: number
  readonly balanceAmount: number
  readonly deliveryMode: DeliveryMode | null
  readonly deliveryNote: string | null
  readonly referralCode: string | null
  readonly utmSource: string | null
  readonly utmMedium: string | null
  readonly utmCampaign: string | null
  readonly partnerRef: string | null
  readonly paymentReminderCount: number
  readonly paymentReminderLastAt: string | null
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

/** Ligne produit d'une réservation, chargée à la demande au dépliage. */
export interface AdminReservationItemRow {
  readonly id: string
  readonly sku: string
  readonly productName: string
  readonly category: string
  readonly variantName: string
  readonly quantity: number
  readonly unitPriceHt: number
  readonly subtotalHt: number
  readonly ecoContributionTotal: number
  readonly cbmTotal: number
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
      typeof obj.protected_until === 'string' ? obj.protected_until : undefined,
  }
}

function toNumber(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function toNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

export function toAdminReservationRow(
  row: ReservationRow,
): AdminReservationRow {
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
    totalHt: toNumber(row.total_ht),
    totalTtc: toNumber(row.total_ttc),
    totalCbm: toNumber(row.total_cbm),
    reservationFee: toNumber(row.reservation_fee),
    depositAmount: toNumber(row.deposit_amount),
    balanceAmount: toNumber(row.balance_amount),
    deliveryMode: row.delivery_mode ?? null,
    deliveryNote: toNullableString(row.delivery_note),
    referralCode: toNullableString(row.referral_code),
    utmSource: toNullableString(row.utm_source),
    utmMedium: toNullableString(row.utm_medium),
    utmCampaign: toNullableString(row.utm_campaign),
    partnerRef: toNullableString(row.partner_ref),
    paymentReminderCount: toNumber(row.payment_reminder_count),
    paymentReminderLastAt: row.payment_reminder_last_at ?? null,
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
    partnerAttributionProtectedUntil: partnerAttribution.protectedUntil ?? null,
    partnerLinkSlug: partnerLink.slug ?? null,
    partnerLinkDisplayName: partnerLink.displayName ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    requestedContainerType: row.requested_container_type,
  }
}

export function toAdminReservationItemRow(
  row: ReservationItemRow,
): AdminReservationItemRow {
  return {
    id: row.id,
    sku: row.sku,
    productName: row.product_name,
    category: row.category,
    variantName: row.variant_name,
    quantity: toNumber(row.quantity),
    unitPriceHt: toNumber(row.unit_price_ht),
    subtotalHt: toNumber(row.subtotal_ht),
    ecoContributionTotal: toNumber(row.eco_contribution_total),
    cbmTotal: toNumber(row.cbm_total),
  }
}

/**
 * Origine lisible d'une réservation : partenaire (?ref=), puis UTM, sinon
 * « Direct » (helper commun lib/admin/origin.ts). Sert à la ligne admin et au
 * CSV.
 */
export function describeReservationOrigin(
  row: Pick<
    AdminReservationRow,
    'utmSource' | 'utmMedium' | 'utmCampaign' | 'partnerRef'
  >,
): string {
  return describeOrigin({
    partnerRef: row.partnerRef,
    utmSource: row.utmSource,
    utmMedium: row.utmMedium,
    utmCampaign: row.utmCampaign,
  })
}

export interface ListAllReservationsOptions {
  /** Période glissante en jours ; `null` ou absent = toutes les réservations. */
  readonly periodDays?: ReservationPeriodDays
  readonly now?: Date
}

export const ADMIN_RESERVATIONS_LIMIT = 500

export async function listAllReservations(
  client: AdminReservationsClient,
  options: ListAllReservationsOptions = {},
): Promise<ReadonlyArray<AdminReservationRow>> {
  const since = reservationPeriodSince(options.periodDays ?? null, options.now)
  let query = client
    .from('reservations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(ADMIN_RESERVATIONS_LIMIT)
  if (since) {
    query = query.gte('created_at', since)
  }
  const { data, error } = await query

  if (error) throw new Error(error.message)
  return ((data ?? []) as ReadonlyArray<ReservationRow>).map(
    toAdminReservationRow,
  )
}

/** Lignes produits d'une réservation, chargées au dépliage d'une ligne admin. */
export async function listReservationItems(
  client: AdminReservationsClient,
  reservationId: string,
): Promise<ReadonlyArray<AdminReservationItemRow>> {
  const { data, error } = await client
    .from('reservation_items')
    .select('*')
    .eq('reservation_id', reservationId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  return ((data ?? []) as ReadonlyArray<ReservationItemRow>).map(
    toAdminReservationItemRow,
  )
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
