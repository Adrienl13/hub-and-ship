// Fiche client 360 (onglet Utilisateurs) : tout ce qu'un contact a laissé
// chez Terrassea, réuni sous une ligne utilisateur.
//
// La lecture passe par le client navigateur authentifié : les politiques RLS
// admin de chaque table font foi (contact_requests, reservations,
// stock_requests, partner_applications, admin_follow_ups). Le rapprochement se
// fait par l'identifiant du compte pour les réservations et par l'email,
// insensible à la casse, pour tout le reste — un prospect a souvent écrit
// avant de créer son compte. Les réservations sont cherchées des deux façons
// et dédoublonnées : le client a pu réserver sans être connecté puis
// s'inscrire, ou réserver avec un autre email de contact.
//
// L'assemblage (chronologie datée et typée, résumé) est pur et testé ; le
// chargement ne fait que des SELECT minimaux.

import { PAID_RESERVATION_STATUSES } from '@/lib/admin/overview'
import {
  CONTACT_REQUEST_STATUS_LABEL,
  contactTopicLabel,
} from '@/lib/contact-requests/admin-repository'
import { PARTNER_APPLICATION_STATUS_LABEL } from '@/lib/partners/types'
import { STOCK_REQUEST_STATUS_LABEL } from '@/lib/stock-requests'
import type {
  ContactRequestStatus,
  PartnerApplicationStatus,
  ReservationStatus,
  SalesChannel,
  StockRequestStatus,
} from '@/lib/supabase/types'

// --- Lignes minimales lues en base --------------------------------------

export interface CustomerContactRequestRow {
  readonly id: string
  readonly status: string
  readonly topic: string
  readonly created_at: string
}

export interface CustomerReservationRow {
  readonly id: string
  readonly reference: string
  readonly status: string
  readonly total_ht: number | string | null
  readonly total_ttc: number | string | null
  readonly created_at: string
  readonly container_id: string | null
}

export interface CustomerStockRequestRow {
  readonly id: string
  readonly status: string
  readonly product_name: string
  readonly requested_quantity: number | null
  readonly created_at: string
}

export interface CustomerPartnerApplicationRow {
  readonly id: string
  readonly status: string
  readonly company_name: string
  readonly created_at: string
}

export interface CustomerFollowUpRow {
  readonly id: string
  readonly target_kind: string
  readonly target_id: string
  readonly subject: string
  readonly template: string
  readonly sent_at: string
}

/** Sous-ensemble du profil déjà chargé par l'onglet Utilisateurs. */
export interface CustomerProfile {
  readonly email: string
  readonly firstName: string | null
  readonly lastName: string | null
  readonly phone: string | null
  readonly createdAt: string
  readonly lastLoginAt: string | null
  readonly marketingConsent: boolean
  readonly marketingConsentAt: string | null
  readonly company: {
    readonly legalName: string
    readonly tradingName: string | null
    readonly channel: SalesChannel
  } | null
}

export interface CustomerFileData {
  readonly contactRequests: ReadonlyArray<CustomerContactRequestRow>
  /** Peut contenir des doublons (compte + email) : l'assemblage les retire. */
  readonly reservations: ReadonlyArray<CustomerReservationRow>
  readonly stockRequests: ReadonlyArray<CustomerStockRequestRow>
  readonly partnerApplications: ReadonlyArray<CustomerPartnerApplicationRow>
  readonly followUps: ReadonlyArray<CustomerFollowUpRow>
}

// --- Chronologie et résumé (purs) ----------------------------------------

export type CustomerEventKind =
  | 'contact_request'
  | 'reservation'
  | 'stock_request'
  | 'partner_application'
  | 'follow_up'
  | 'signup'
  | 'last_login'

/** Onglets admin vers lesquels un événement renvoie (paramètre ?tab=). */
export type CustomerEventTab =
  'demandes' | 'reservations' | 'stock-requests' | 'partners'

export interface CustomerTimelineEvent {
  /** Clé unique (type + identifiant). */
  readonly key: string
  readonly kind: CustomerEventKind
  readonly at: string
  readonly label: string
  readonly detail: string | null
  readonly tab: CustomerEventTab | null
}

export interface CustomerSummary {
  /** Demandes de contact ni gagnées ni perdues. */
  readonly openContactRequests: number
  /** Réservations distinctes, tous statuts. */
  readonly reservations: number
  /** CA HT des réservations dont les frais sont payés (PAID_RESERVATION_STATUSES). */
  readonly paidRevenueHt: number
  /** Date de l'événement le plus récent, null sans aucun. */
  readonly lastInteractionAt: string | null
}

export interface CustomerFile {
  readonly timeline: ReadonlyArray<CustomerTimelineEvent>
  readonly summary: CustomerSummary
}

export const CUSTOMER_EVENT_KIND_LABEL: Record<CustomerEventKind, string> = {
  contact_request: 'Demande',
  reservation: 'Réservation',
  stock_request: 'Demande stock 24h',
  partner_application: 'Candidature partenaire',
  follow_up: 'Relance',
  signup: 'Inscription',
  last_login: 'Dernière connexion',
}

export const CUSTOMER_TAB_LABEL: Record<CustomerEventTab, string> = {
  demandes: 'Demandes',
  reservations: 'Réservations',
  'stock-requests': 'Stock 24h',
  partners: 'Partenaires',
}

/** Lien vers l'onglet admin (paramètre de recherche validé par la route). */
export function customerTabHref(tab: CustomerEventTab): string {
  return `/admin?tab=${tab}`
}

// Libellés des statuts de réservation : ceux de admin.tsx (locaux à la route,
// donc non importables) repris à l'identique.
const RESERVATION_STATUS_LABEL: Record<ReservationStatus, string> = {
  draft: 'Brouillon',
  pending_reservation_fee: 'Frais réservation',
  reserved: 'Réservée',
  deposit_called: 'Acompte appelé',
  deposit_paid: 'Acompte payé',
  in_production: 'En production',
  in_transit: 'En transit',
  delivered: 'Livrée',
  cancelled: 'Annulée',
}

const FOLLOW_UP_TARGET_TAB: Record<string, CustomerEventTab> = {
  contact_request: 'demandes',
  reservation: 'reservations',
  stock_request: 'stock-requests',
  partner_application: 'partners',
}

const FOLLOW_UP_TARGET_LABEL: Record<string, string> = {
  contact_request: 'demande',
  reservation: 'réservation',
  stock_request: 'demande stock',
  partner_application: 'candidature',
}

const OPEN_CONTACT_REQUEST_STATUSES: ReadonlySet<string> = new Set([
  'new',
  'contacted',
  'quoted',
])

function statusLabel<Key extends string>(
  labels: Readonly<Record<Key, string>>,
  status: string,
): string {
  return (labels as Readonly<Record<string, string>>)[status] ?? status
}

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function timestamp(iso: string): number {
  const value = new Date(iso).getTime()
  // Une date illisible coule au fond de la chronologie.
  return Number.isNaN(value) ? 0 : value
}

/** Réservations uniques par identifiant, la première occurrence gagne. */
export function dedupeReservations(
  rows: ReadonlyArray<CustomerReservationRow>,
): ReadonlyArray<CustomerReservationRow> {
  const seen = new Set<string>()
  const unique: CustomerReservationRow[] = []
  for (const row of rows) {
    if (seen.has(row.id)) continue
    seen.add(row.id)
    unique.push(row)
  }
  return unique
}

export function assembleCustomerTimeline(
  data: CustomerFileData,
  profile: Pick<CustomerProfile, 'createdAt' | 'lastLoginAt'>,
): ReadonlyArray<CustomerTimelineEvent> {
  const events: CustomerTimelineEvent[] = []

  for (const row of data.contactRequests) {
    events.push({
      key: `contact_request:${row.id}`,
      kind: 'contact_request',
      at: row.created_at,
      label: contactTopicLabel(row.topic),
      detail: statusLabel<ContactRequestStatus>(
        CONTACT_REQUEST_STATUS_LABEL,
        row.status,
      ),
      tab: 'demandes',
    })
  }

  for (const row of dedupeReservations(data.reservations)) {
    events.push({
      key: `reservation:${row.id}`,
      kind: 'reservation',
      at: row.created_at,
      label: `Réservation ${row.reference}`,
      detail: `${statusLabel<ReservationStatus>(RESERVATION_STATUS_LABEL, row.status)} · ${formatHt(toNumber(row.total_ht))}`,
      tab: 'reservations',
    })
  }

  for (const row of data.stockRequests) {
    const quantity =
      row.requested_quantity !== null && row.requested_quantity > 0
        ? ` × ${row.requested_quantity}`
        : ''
    events.push({
      key: `stock_request:${row.id}`,
      kind: 'stock_request',
      at: row.created_at,
      label: `${row.product_name}${quantity}`,
      detail: statusLabel<StockRequestStatus>(
        STOCK_REQUEST_STATUS_LABEL,
        row.status,
      ),
      tab: 'stock-requests',
    })
  }

  for (const row of data.partnerApplications) {
    events.push({
      key: `partner_application:${row.id}`,
      kind: 'partner_application',
      at: row.created_at,
      label: row.company_name,
      detail: statusLabel<PartnerApplicationStatus>(
        PARTNER_APPLICATION_STATUS_LABEL,
        row.status,
      ),
      tab: 'partners',
    })
  }

  for (const row of data.followUps) {
    const target = FOLLOW_UP_TARGET_LABEL[row.target_kind]
    events.push({
      key: `follow_up:${row.id}`,
      kind: 'follow_up',
      at: row.sent_at,
      label: row.subject,
      detail: target
        ? `Modèle ${row.template} · sur ${target}`
        : `Modèle ${row.template}`,
      tab: FOLLOW_UP_TARGET_TAB[row.target_kind] ?? null,
    })
  }

  events.push({
    key: 'signup',
    kind: 'signup',
    at: profile.createdAt,
    label: 'Compte créé',
    detail: null,
    tab: null,
  })

  if (profile.lastLoginAt) {
    events.push({
      key: 'last_login',
      kind: 'last_login',
      at: profile.lastLoginAt,
      label: 'Connexion à l’espace client',
      detail: null,
      tab: null,
    })
  }

  // Du plus récent au plus ancien ; à date égale, l'ordre d'insertion puis la
  // clé gardent un rendu stable entre deux chargements.
  return events
    .map((event, index) => ({ event, index }))
    .sort((a, b) => {
      const delta = timestamp(b.event.at) - timestamp(a.event.at)
      if (delta !== 0) return delta
      return a.index - b.index
    })
    .map(({ event }) => event)
}

/** Événements de compte (inscription, connexion) : présents dans la chronologie, mais pas des interactions. */
const ACCOUNT_EVENT_KINDS: ReadonlySet<CustomerTimelineEvent['kind']> = new Set(
  ['signup', 'last_login'],
)

/** Une interaction est un échange métier : demande, réservation, relance… */
export function isBusinessInteraction(event: CustomerTimelineEvent): boolean {
  return !ACCOUNT_EVENT_KINDS.has(event.kind)
}

export function summarizeCustomer(
  data: CustomerFileData,
  timeline: ReadonlyArray<CustomerTimelineEvent>,
): CustomerSummary {
  const reservations = dedupeReservations(data.reservations)
  return {
    openContactRequests: data.contactRequests.filter((row) =>
      OPEN_CONTACT_REQUEST_STATUSES.has(row.status),
    ).length,
    reservations: reservations.length,
    paidRevenueHt: reservations
      .filter((row) => PAID_RESERVATION_STATUSES.includes(row.status))
      .reduce((sum, row) => sum + toNumber(row.total_ht), 0),
    lastInteractionAt: timeline.find(isBusinessInteraction)?.at ?? null,
  }
}

export function buildCustomerFile(
  data: CustomerFileData,
  profile: Pick<CustomerProfile, 'createdAt' | 'lastLoginAt'>,
): CustomerFile {
  const timeline = assembleCustomerTimeline(data, profile)
  return { timeline, summary: summarizeCustomer(data, timeline) }
}

/** « 1 234 € HT », sans décimales : le back-office lit des ordres de grandeur. */
export function formatHt(amount: number): string {
  return `${new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount)} HT`
}

// --- Chargement --------------------------------------------------------------

interface RowsResult<Row> {
  readonly data: ReadonlyArray<Row> | null
  readonly error: { readonly message: string } | null
}

interface CustomerFileQuery extends PromiseLike<RowsResult<unknown>> {
  eq: (column: string, value: string) => CustomerFileQuery
  ilike: (column: string, pattern: string) => CustomerFileQuery
  order: (
    column: string,
    options: { readonly ascending: boolean },
  ) => CustomerFileQuery
  limit: (count: number) => CustomerFileQuery
}

/** Surface étroite du client navigateur ; on caste à l'appel comme les autres
 * dépôts admin (les colonnes JSON et admin_follow_ups ne sont pas typées). */
export interface CustomerFileClient {
  from: (table: string) => { select: (columns: string) => CustomerFileQuery }
}

/** Plafond par table : une fiche n'a pas vocation à paginer. */
export const CUSTOMER_FILE_LIMIT = 200

/** Motif `ilike` qui ne matche que l'email lui-même, casse ignorée : les
 * jokers `%` et `_` (fréquent dans les adresses) sont échappés. */
export function emailPattern(email: string): string {
  return email.trim().replace(/[\\%_]/g, (char) => `\\${char}`)
}

async function rows<Row>(
  query: CustomerFileQuery,
  label: string,
): Promise<ReadonlyArray<Row>> {
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(CUSTOMER_FILE_LIMIT)
  if (error) throw new Error(`${label} : ${error.message}`)
  return (data ?? []) as ReadonlyArray<Row>
}

const RESERVATION_COLUMNS =
  'id,reference,status,total_ht,total_ttc,created_at,container_id'

export async function loadCustomerFile(
  client: CustomerFileClient,
  target: { readonly userId: string; readonly email: string },
): Promise<CustomerFileData> {
  const pattern = emailPattern(target.email)
  const hasEmail = pattern !== ''
  const none: ReadonlyArray<never> = []

  const [
    contactRequests,
    reservationsByUser,
    reservationsByEmail,
    stockRequests,
    partnerApplications,
    followUps,
  ] = await Promise.all([
    hasEmail
      ? rows<CustomerContactRequestRow>(
          client
            .from('contact_requests')
            .select('id,status,topic,created_at')
            .ilike('email', pattern),
          'Demandes de contact',
        )
      : none,
    rows<CustomerReservationRow>(
      client
        .from('reservations')
        .select(RESERVATION_COLUMNS)
        .eq('user_id', target.userId),
      'Réservations',
    ),
    hasEmail
      ? rows<CustomerReservationRow>(
          client
            .from('reservations')
            .select(RESERVATION_COLUMNS)
            .ilike('contact_snapshot->>email', pattern),
          'Réservations (email)',
        )
      : none,
    hasEmail
      ? rows<CustomerStockRequestRow>(
          client
            .from('stock_requests')
            .select('id,status,product_name,requested_quantity,created_at')
            .ilike('contact_email', pattern),
          'Demandes stock 24h',
        )
      : none,
    hasEmail
      ? rows<CustomerPartnerApplicationRow>(
          client
            .from('partner_applications')
            .select('id,status,company_name,created_at')
            .ilike('contact_email', pattern),
          'Candidatures partenaires',
        )
      : none,
    hasEmail
      ? loadFollowUps(client, pattern)
      : Promise.resolve(none as ReadonlyArray<CustomerFollowUpRow>),
  ])

  return {
    contactRequests,
    reservations: dedupeReservations([
      ...reservationsByUser,
      ...reservationsByEmail,
    ]),
    stockRequests,
    partnerApplications,
    followUps,
  }
}

// admin_follow_ups n'a pas de created_at : tri sur sent_at.
async function loadFollowUps(
  client: CustomerFileClient,
  pattern: string,
): Promise<ReadonlyArray<CustomerFollowUpRow>> {
  const { data, error } = await client
    .from('admin_follow_ups')
    .select('id,target_kind,target_id,subject,template,sent_at')
    .ilike('recipient_email', pattern)
    .order('sent_at', { ascending: false })
    .limit(CUSTOMER_FILE_LIMIT)
  if (error) throw new Error(`Relances : ${error.message}`)
  return (data ?? []) as ReadonlyArray<CustomerFollowUpRow>
}
