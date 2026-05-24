import type { Database } from '@/lib/supabase/types'
import type { ReservationDraft } from './draft'
import {
  toReservationInsertPayload,
  toReservationItemInsertPayloads,
  type ReservationInsertPayload,
  type ReservationItemInsertPayload,
} from './persistence'

interface RepositoryResult<T> {
  readonly data: T | null
  readonly error: { readonly message: string } | null
}

export interface ReservationRepositoryClient {
  from: {
    (table: 'reservations'): {
      insert: (
        payload: ReservationInsertPayload,
      ) => PromiseLike<RepositoryResult<null>>
    }
    (table: 'reservation_items'): {
      insert: (
        payload: ReadonlyArray<ReservationItemInsertPayload>,
      ) => PromiseLike<RepositoryResult<null>>
    }
  }
}

export interface CreateReservationResult {
  readonly id: string
  readonly reference: string
}

export async function createReservationInSupabase({
  client,
  draft,
}: {
  readonly client: ReservationRepositoryClient
  readonly draft: ReservationDraft
}): Promise<CreateReservationResult> {
  // The reservations table is write-only for anon: no SELECT policy, so we
  // cannot ".select()" the row back after insert. The id and reference are
  // generated client-side (see draft.ts) and used to attach items in the
  // second insert below.
  const reservationResult = await client
    .from('reservations')
    .insert(toReservationInsertPayload(draft))

  if (reservationResult.error) {
    throw new Error(reservationResult.error.message)
  }

  const itemResult = await client.from('reservation_items').insert(
    toReservationItemInsertPayloads({
      draft,
      reservationId: draft.id,
    }),
  )

  if (itemResult.error) {
    throw new Error(itemResult.error.message)
  }

  return { id: draft.id, reference: draft.reference }
}

// ---------------------------------------------------------------------------
// Authenticated reads — used by /account/reservations to list the signed-in
// user's reservations. RLS filters to user_id = auth.uid() or company match.
// ---------------------------------------------------------------------------

export type ReservationRow = Database['public']['Tables']['reservations']['Row']
export type ReservationItemRow =
  Database['public']['Tables']['reservation_items']['Row']

export interface MyReservation {
  readonly row: ReservationRow
  readonly items: ReadonlyArray<ReservationItemRow>
}

type AnyPromiseLike<T> = T | PromiseLike<T>

export interface ListReservationsClient {
  from: {
    (table: 'reservations'): {
      select: (columns: '*') => {
        order: (
          column: 'created_at',
          options: { ascending: boolean },
        ) => AnyPromiseLike<RepositoryResult<ReadonlyArray<ReservationRow>>>
      }
    }
    (table: 'reservation_items'): {
      select: (columns: '*') => {
        in: (
          column: 'reservation_id',
          values: ReadonlyArray<string>,
        ) => AnyPromiseLike<
          RepositoryResult<ReadonlyArray<ReservationItemRow>>
        >
      }
    }
  }
}

export async function listMyReservationsFromSupabase(
  client: ListReservationsClient,
): Promise<ReadonlyArray<MyReservation>> {
  const reservationsResult = await client
    .from('reservations')
    .select('*')
    .order('created_at', { ascending: false })

  if (reservationsResult.error) {
    throw new Error(reservationsResult.error.message)
  }

  const reservations = reservationsResult.data ?? []
  if (reservations.length === 0) return []

  const itemsResult = await client
    .from('reservation_items')
    .select('*')
    .in(
      'reservation_id',
      reservations.map((r) => r.id),
    )

  if (itemsResult.error) {
    throw new Error(itemsResult.error.message)
  }

  const items = itemsResult.data ?? []
  const itemsByReservation = new Map<string, ReservationItemRow[]>()
  for (const item of items) {
    const bucket = itemsByReservation.get(item.reservation_id) ?? []
    bucket.push(item)
    itemsByReservation.set(item.reservation_id, bucket)
  }

  return reservations.map((row) => ({
    row,
    items: itemsByReservation.get(row.id) ?? [],
  }))
}
