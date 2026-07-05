// Client after-sales claims (SAV) on a reservation. RLS scopes a client to
// their own claims and to reservations they own, so this repository just needs
// to send the reservation id, category, optional quantity and message — the
// status ('open') and user_id (auth.uid()) are set/forced server-side.

export type ReservationClaimCategory =
  | 'damaged'
  | 'missing'
  | 'wrong_item'
  | 'delay'
  | 'other'

export type ReservationClaimStatus =
  | 'open'
  | 'in_review'
  | 'resolved'
  | 'rejected'

export const CLAIM_CATEGORY_LABEL: Record<ReservationClaimCategory, string> = {
  damaged: 'Produit endommagé',
  missing: 'Pièce manquante',
  wrong_item: 'Erreur de référence',
  delay: 'Retard de livraison',
  other: 'Autre',
}

export const CLAIM_STATUS_LABEL: Record<ReservationClaimStatus, string> = {
  open: 'Ouverte',
  in_review: 'En traitement',
  resolved: 'Résolue',
  rejected: 'Refusée',
}

export interface ReservationClaim {
  readonly id: string
  readonly reservationId: string
  readonly category: ReservationClaimCategory
  readonly status: ReservationClaimStatus
  readonly quantity: number | null
  readonly message: string
  readonly adminResponse: string | null
  readonly createdAt: string
}

export interface CreateClaimInput {
  readonly reservationId: string
  readonly category: ReservationClaimCategory
  readonly quantity: number | null
  readonly message: string
}

interface Result<T> {
  readonly data: T | null
  readonly error: { readonly message: string } | null
}

interface ClaimRow {
  readonly id: string
  readonly reservation_id: string
  readonly category: ReservationClaimCategory
  readonly status: ReservationClaimStatus
  readonly quantity: number | null
  readonly message: string
  readonly admin_response: string | null
  readonly created_at: string
}

export interface ReservationClaimsClient {
  from: (table: 'reservation_claims') => {
    select: (columns: string) => {
      eq: (
        column: 'reservation_id',
        value: string,
      ) => {
        order: (
          column: 'created_at',
          options: { readonly ascending: boolean },
        ) => PromiseLike<Result<ReadonlyArray<ClaimRow>>>
      }
    }
    insert: (payload: unknown) => PromiseLike<Result<null>>
  }
}

function toClaim(row: ClaimRow): ReservationClaim {
  return {
    id: row.id,
    reservationId: row.reservation_id,
    category: row.category,
    status: row.status,
    quantity: row.quantity,
    message: row.message,
    adminResponse: row.admin_response,
    createdAt: row.created_at,
  }
}

/** Builds the insert payload, forcing the safe initial status. */
export function buildClaimInsert(input: CreateClaimInput) {
  const message = input.message.trim()
  if (message.length < 5) {
    throw new Error('Décrivez le problème en quelques mots.')
  }
  return {
    reservation_id: input.reservationId,
    category: input.category,
    quantity:
      input.quantity !== null && input.quantity > 0 ? input.quantity : null,
    message,
    status: 'open' as const,
  }
}

export async function createReservationClaim(
  client: ReservationClaimsClient,
  input: CreateClaimInput,
): Promise<void> {
  const { error } = await client
    .from('reservation_claims')
    .insert(buildClaimInsert(input))
  if (error) throw new Error(error.message)
}

export async function listClaimsForReservation(
  client: ReservationClaimsClient,
  reservationId: string,
): Promise<ReadonlyArray<ReservationClaim>> {
  const { data, error } = await client
    .from('reservation_claims')
    .select('*')
    .eq('reservation_id', reservationId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(toClaim)
}
