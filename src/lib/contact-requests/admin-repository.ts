// Dépôt admin des demandes de contact (table public.contact_requests,
// migration 56). Liste, transitions de statut et note interne : la politique
// RLS « Admins full access contact requests » réserve ces appels aux profils
// admin / super_admin — le site n'insère que des demandes neuves.
//
// Le client Supabase du navigateur n'est pas typé pour cette table : on décrit
// la surface étroite utilisée et on caste à l'appel
// (`as unknown as ContactRequestAdminClient`), comme les autres dépôts admin.

import {
  CONTACT_SOURCE_LABEL,
  CONTACT_TOPIC_LABEL,
  type ContactSource,
  type ContactTopic,
} from '@/lib/contact'

export const CONTACT_REQUEST_STATUSES = [
  'new',
  'contacted',
  'quoted',
  'won',
  'lost',
] as const
export type ContactRequestStatus = (typeof CONTACT_REQUEST_STATUSES)[number]

export const CONTACT_REQUEST_STATUS_LABEL: Record<
  ContactRequestStatus,
  string
> = {
  new: 'Nouvelle',
  contacted: 'Contactée',
  quoted: 'Devis envoyé',
  won: 'Gagnée',
  lost: 'Perdue',
}

// Points de capture connus : le lexique unique vit dans '@/lib/contact'
// (colonne source, texte libre côté base pour ne jamais refuser un lead) :
// libellé lisible, la valeur brute sinon.
export function contactSourceLabel(source: string): string {
  const labels = CONTACT_SOURCE_LABEL as Record<string, string>
  return labels[source as ContactSource] ?? source
}

export function contactTopicLabel(topic: string): string {
  const labels = CONTACT_TOPIC_LABEL as Record<string, string>
  return labels[topic as ContactTopic] ?? topic
}

// Transitions proposées à l'admin : new → contacted → quoted → won / lost,
// et réouverture d'une demande close.
export function nextContactRequestStatuses(
  status: ContactRequestStatus,
): ReadonlyArray<{
  readonly label: string
  readonly target: ContactRequestStatus
}> {
  switch (status) {
    case 'new':
      return [
        { label: 'Contactée', target: 'contacted' },
        { label: 'Devis envoyé', target: 'quoted' },
        { label: 'Perdue', target: 'lost' },
      ]
    case 'contacted':
      return [
        { label: 'Devis envoyé', target: 'quoted' },
        { label: 'Gagnée', target: 'won' },
        { label: 'Perdue', target: 'lost' },
      ]
    case 'quoted':
      return [
        { label: 'Gagnée', target: 'won' },
        { label: 'Perdue', target: 'lost' },
      ]
    case 'won':
    case 'lost':
      return [{ label: 'Rouvrir', target: 'new' }]
  }
}

export interface ContactRequestRow {
  readonly id: string
  readonly status: ContactRequestStatus
  readonly topic: string
  readonly source: string
  readonly name: string
  readonly email: string
  readonly company: string | null
  readonly phone: string | null
  readonly message: string
  readonly product_sku: string | null
  readonly product_name: string | null
  readonly product_design: string | null
  readonly quantity: number | null
  readonly price_label: string | null
  readonly studio_brief: string | null
  readonly utm_source: string | null
  readonly utm_medium: string | null
  readonly utm_campaign: string | null
  readonly partner_ref: string | null
  readonly internal_note: string | null
  readonly created_at: string
  readonly updated_at: string
}

export interface AdminContactRequestRow {
  readonly id: string
  readonly status: ContactRequestStatus
  readonly topic: string
  readonly topicLabel: string
  readonly source: string
  readonly sourceLabel: string
  readonly name: string
  readonly email: string
  readonly company: string | null
  readonly phone: string | null
  readonly message: string
  readonly productSku: string | null
  readonly productName: string | null
  readonly productDesign: string | null
  readonly quantity: number | null
  readonly priceLabel: string | null
  readonly studioBrief: string | null
  readonly utmSource: string | null
  readonly utmMedium: string | null
  readonly utmCampaign: string | null
  readonly partnerRef: string | null
  readonly internalNote: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

interface QueryResult<T> {
  readonly data: T
  readonly error: { readonly message: string } | null
}

export interface ContactRequestListQuery extends PromiseLike<
  QueryResult<ReadonlyArray<ContactRequestRow> | null>
> {
  eq: (column: 'status' | 'topic', value: string) => ContactRequestListQuery
  order: (
    column: 'created_at',
    options: { readonly ascending: boolean },
  ) => ContactRequestListQuery
  limit: (count: number) => ContactRequestListQuery
}

export interface ContactRequestUpdate {
  readonly status?: ContactRequestStatus
  readonly internal_note?: string | null
  readonly updated_at: string
}

export interface ContactRequestAdminClient {
  from: (table: 'contact_requests') => {
    select: (columns: '*') => ContactRequestListQuery
    update: (values: ContactRequestUpdate) => {
      eq: (column: 'id', value: string) => PromiseLike<QueryResult<null>>
    }
  }
}

export interface AdminListContactRequestsOptions {
  readonly status?: ContactRequestStatus
  readonly topic?: string
  readonly limit?: number
}

export const CONTACT_REQUESTS_DEFAULT_LIMIT = 500

export function toAdminContactRequestRow(
  row: ContactRequestRow,
): AdminContactRequestRow {
  return {
    id: row.id,
    status: row.status,
    topic: row.topic,
    topicLabel: contactTopicLabel(row.topic),
    source: row.source,
    sourceLabel: contactSourceLabel(row.source),
    name: row.name,
    email: row.email,
    company: row.company,
    phone: row.phone,
    message: row.message,
    productSku: row.product_sku,
    productName: row.product_name,
    productDesign: row.product_design,
    quantity: row.quantity,
    priceLabel: row.price_label,
    studioBrief: row.studio_brief,
    utmSource: row.utm_source,
    utmMedium: row.utm_medium,
    utmCampaign: row.utm_campaign,
    partnerRef: row.partner_ref,
    internalNote: row.internal_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function adminListContactRequests(
  client: ContactRequestAdminClient,
  options: AdminListContactRequestsOptions = {},
): Promise<ReadonlyArray<AdminContactRequestRow>> {
  let query = client
    .from('contact_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(options.limit ?? CONTACT_REQUESTS_DEFAULT_LIMIT)
  if (options.status) query = query.eq('status', options.status)
  if (options.topic) query = query.eq('topic', options.topic)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map(toAdminContactRequestRow)
}

export async function adminUpdateContactRequestStatus(
  client: ContactRequestAdminClient,
  id: string,
  status: ContactRequestStatus,
): Promise<void> {
  const { error } = await client
    .from('contact_requests')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function adminUpdateContactRequestNote(
  client: ContactRequestAdminClient,
  id: string,
  internalNote: string | null,
): Promise<void> {
  const trimmed = internalNote?.trim() ?? ''
  const { error } = await client
    .from('contact_requests')
    .update({
      internal_note: trimmed === '' ? null : trimmed,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

// Compteurs par statut pour l'en-tête de l'onglet (toujours les cinq clés).
export function countContactRequestsByStatus(
  rows: ReadonlyArray<AdminContactRequestRow>,
): Record<ContactRequestStatus, number> {
  const counts: Record<ContactRequestStatus, number> = {
    new: 0,
    contacted: 0,
    quoted: 0,
    won: 0,
    lost: 0,
  }
  for (const row of rows) counts[row.status] += 1
  return counts
}

// Recherche plein texte côté client : nom, email, société, produit (nom, SKU,
// design). Insensible à la casse, vide = tout.
export function matchesContactRequestSearch(
  row: AdminContactRequestRow,
  needle: string,
): boolean {
  const query = needle.trim().toLowerCase()
  if (!query) return true
  return [
    row.name,
    row.email,
    row.company ?? '',
    row.productName ?? '',
    row.productSku ?? '',
    row.productDesign ?? '',
  ]
    .join(' ')
    .toLowerCase()
    .includes(query)
}
