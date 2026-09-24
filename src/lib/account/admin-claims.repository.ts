// Dépôt admin SAV : liste toutes les réclamations (100 dernières) avec le
// contexte de la réservation (référence, SIRET, contact) et met à jour statut /
// réponse. La politique RLS « Admins full access claims » réserve ces appels
// aux profils admin / super_admin.

import type { SupabaseBrowserClient } from '@/lib/supabase/client'
import type {
  ReservationClaimCategory,
  ReservationClaimStatus,
} from '@/lib/account/claims'

export type AdminClaimsClient = SupabaseBrowserClient

export interface AdminClaimRow {
  readonly id: string
  readonly reservationId: string
  readonly reservationReference: string | null
  readonly reservationSiret: string | null
  /** Contact figé dans la réservation (contact_snapshot). */
  readonly companyName: string | null
  readonly contactName: string | null
  readonly contactEmail: string | null
  readonly contactPhone: string | null
  readonly category: ReservationClaimCategory
  readonly status: ReservationClaimStatus
  readonly quantity: number | null
  readonly message: string
  readonly adminResponse: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

interface RawClaimReservation {
  readonly reference?: string | null
  readonly siret?: string | null
  readonly contact_snapshot?: unknown
}

interface RawClaimRow {
  readonly id: string
  readonly reservation_id: string
  readonly category: ReservationClaimCategory
  readonly status: ReservationClaimStatus
  readonly quantity: number | null
  readonly message: string
  readonly admin_response: string | null
  readonly created_at: string
  readonly updated_at: string
  readonly reservations?: RawClaimReservation | RawClaimReservation[] | null
}

function reservationOf(row: RawClaimRow): RawClaimReservation | null {
  const rel = row.reservations
  if (!rel) return null
  return (Array.isArray(rel) ? rel[0] : rel) ?? null
}

function snapshotField(snapshot: unknown, key: string): string | null {
  if (!snapshot || typeof snapshot !== 'object') return null
  const value = (snapshot as Record<string, unknown>)[key]
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

export function toAdminClaimRow(row: RawClaimRow): AdminClaimRow {
  const reservation = reservationOf(row)
  const snapshot = reservation?.contact_snapshot
  return {
    id: row.id,
    reservationId: row.reservation_id,
    reservationReference: reservation?.reference ?? null,
    reservationSiret: reservation?.siret ?? null,
    companyName: snapshotField(snapshot, 'company'),
    contactName: snapshotField(snapshot, 'name'),
    contactEmail: snapshotField(snapshot, 'email'),
    contactPhone: snapshotField(snapshot, 'phone'),
    category: row.category,
    status: row.status,
    quantity: row.quantity,
    message: row.message,
    adminResponse: row.admin_response,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export const ADMIN_CLAIMS_SELECT =
  '*, reservations(reference, siret, contact_snapshot)'

export async function listAllClaims(
  client: AdminClaimsClient,
): Promise<ReadonlyArray<AdminClaimRow>> {
  const { data, error } = await client
    .from('reservation_claims')
    .select(ADMIN_CLAIMS_SELECT)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) throw new Error(error.message)
  return ((data ?? []) as unknown as RawClaimRow[]).map(toAdminClaimRow)
}

export interface UpdateClaimInput {
  readonly status?: ReservationClaimStatus
  readonly adminResponse?: string | null
}

export async function updateClaim(
  client: AdminClaimsClient,
  id: string,
  input: UpdateClaimInput,
): Promise<void> {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (input.status !== undefined) payload.status = input.status
  if (input.adminResponse !== undefined) {
    const trimmed = input.adminResponse?.trim() ?? ''
    payload.admin_response = trimmed === '' ? null : trimmed
  }

  const { error } = await client
    .from('reservation_claims')
    .update(payload as never)
    .eq('id', id)

  if (error) throw new Error(error.message)
}
