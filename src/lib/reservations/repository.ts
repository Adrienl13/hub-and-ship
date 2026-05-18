import type { Database } from '@/lib/supabase/types'
import type { ReservationDraft } from './draft'
import {
  toReservationInsertPayload,
  toReservationItemInsertPayloads,
  type ReservationInsertPayload,
  type ReservationItemInsertPayload,
} from './persistence'

type ReservationCreatedRow = Pick<
  Database['public']['Tables']['reservations']['Row'],
  'id' | 'reference'
>

interface RepositoryResult<T> {
  readonly data: T | null
  readonly error: { readonly message: string } | null
}

export interface ReservationRepositoryClient {
  from: {
    (table: 'reservations'): {
      insert: (payload: ReservationInsertPayload) => {
        select: (columns: 'id, reference') => {
          single: () => PromiseLike<RepositoryResult<ReservationCreatedRow>>
        }
      }
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
  const reservationResult = await client
    .from('reservations')
    .insert(toReservationInsertPayload(draft))
    .select('id, reference')
    .single()

  if (reservationResult.error || !reservationResult.data) {
    throw new Error(
      reservationResult.error?.message ?? 'Reservation insert failed',
    )
  }

  const itemResult = await client.from('reservation_items').insert(
    toReservationItemInsertPayloads({
      draft,
      reservationId: reservationResult.data.id,
    }),
  )

  if (itemResult.error) {
    throw new Error(itemResult.error.message)
  }

  return reservationResult.data
}
