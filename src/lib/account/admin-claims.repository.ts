// Admin SAV repository — lists all reservation claims (latest 100) with their
// reservation context and updates status/response. RLS policy
// "Admins full access claims" restricts these calls to admin / super_admin.

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
  readonly category: ReservationClaimCategory
  readonly status: ReservationClaimStatus
  readonly quantity: number | null
  readonly message: string
  readonly adminResponse: string | null
  readonly createdAt: string
  readonly updatedAt: string
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
  readonly reservations?:
    | { readonly reference?: string; readonly siret?: string }
    | Array<{ readonly reference?: string; readonly siret?: string }>
    | null
}

function reservationField(
  row: RawClaimRow,
  key: 'reference' | 'siret',
): string | null {
  const rel = row.reservations
  if (!rel) return null
  const obj = Array.isArray(rel) ? rel[0] : rel
  return obj?.[key] ?? null
}

function toAdminClaimRow(row: RawClaimRow): AdminClaimRow {
  return {
    id: row.id,
    reservationId: row.reservation_id,
    reservationReference: reservationField(row, 'reference'),
    reservationSiret: reservationField(row, 'siret'),
    category: row.category,
    status: row.status,
    quantity: row.quantity,
    message: row.message,
    adminResponse: row.admin_response,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listAllClaims(
  client: AdminClaimsClient,
): Promise<ReadonlyArray<AdminClaimRow>> {
  const { data, error } = await client
    .from('reservation_claims')
    .select('*, reservations(reference, siret)')
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
