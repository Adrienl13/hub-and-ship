import {
  EMPTY_ATTRIBUTION,
  type AttributionFields,
} from '@/lib/analytics/attribution'
import type { Database, Json } from '@/lib/supabase/types'
import type { ReservationDraft } from './draft'
import {
  toReservationInsertPayload,
  toReservationItemInsertPayloads,
  type ReservationInsertPayload,
  type ReservationItemInsertPayload,
} from './persistence'

interface RepositoryResult<T> {
  readonly data: T | null
  readonly error: {
    readonly message: string
    readonly code?: string
    readonly details?: string | null
    readonly hint?: string | null
  } | null
}

export interface ReservationRepositoryClient {
  rpc?: (
    fn: 'create_reservation_with_items',
    args: { readonly payload: Json },
  ) => PromiseLike<RepositoryResult<Json>>
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

function buildCreateReservationRpcPayload(
  draft: ReservationDraft,
  attribution: AttributionFields,
): Json {
  // First-touch attribution (utm_* / partner_ref) rides along in the payload;
  // the RPC persists it once the partner-attribution migration lands, and the
  // legacy insert path writes it directly.
  return {
    reservation: {
      ...toReservationInsertPayload(draft),
      ...attribution,
    } as unknown as Json,
    items: toReservationItemInsertPayloads({
      draft,
      reservationId: draft.id,
    }) as Json,
  }
}

function isJsonRecord(
  value: Json | null,
): value is { readonly [key: string]: Json | undefined } {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isCreateReservationResult(
  value: Json | null,
): value is { readonly id: string; readonly reference: string } {
  return (
    isJsonRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.reference === 'string'
  )
}

function parseCreateReservationResult(
  data: Json | null,
): CreateReservationResult {
  if (!isCreateReservationResult(data)) {
    throw new Error('create_reservation_with_items returned invalid payload')
  }

  return {
    id: data.id,
    reference: data.reference,
  }
}

function isMissingRpcError(error: RepositoryResult<Json>['error']): boolean {
  if (!error) return false
  const message = error.message.toLowerCase()
  return (
    error.code === 'PGRST202' ||
    message.includes('could not find the function') ||
    message.includes('function public.create_reservation_with_items')
  )
}

async function createReservationWithLegacyInserts({
  client,
  draft,
  attribution = EMPTY_ATTRIBUTION,
}: {
  readonly client: ReservationRepositoryClient
  readonly draft: ReservationDraft
  readonly attribution?: AttributionFields
}): Promise<CreateReservationResult> {
  // Legacy compatibility path for environments where the RPC migration has
  // not landed yet. Once `create_reservation_with_items` exists, the normal
  // path below writes reservation + items atomically.
  const reservationResult = await client
    .from('reservations')
    .insert({ ...toReservationInsertPayload(draft), ...attribution })

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

export async function createReservationInSupabase({
  client,
  draft,
  attribution = EMPTY_ATTRIBUTION,
}: {
  readonly client: ReservationRepositoryClient
  readonly draft: ReservationDraft
  readonly attribution?: AttributionFields
}): Promise<CreateReservationResult> {
  if (client.rpc) {
    const result = await client.rpc('create_reservation_with_items', {
      payload: buildCreateReservationRpcPayload(draft, attribution),
    })

    if (!result.error) {
      return parseCreateReservationResult(result.data)
    }

    if (!isMissingRpcError(result.error)) {
      throw new Error(result.error.message)
    }
  }

  return createReservationWithLegacyInserts({ client, draft, attribution })
}

// ---------------------------------------------------------------------------
// Account recovery — adopt anonymous reservations made with the signed-in
// user's email so they become visible under RLS (cross-device). Best-effort:
// callers ignore failures and still attempt the list.
// ---------------------------------------------------------------------------

export interface ClaimReservationsClient {
  rpc: (
    fn: 'claim_my_reservations',
  ) => PromiseLike<RepositoryResult<number | null>>
}

export async function claimMyReservationsInSupabase(
  client: ClaimReservationsClient,
): Promise<number> {
  const result = await client.rpc('claim_my_reservations')
  if (result.error) {
    throw new Error(result.error.message)
  }
  return typeof result.data === 'number' ? result.data : 0
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
        ) => AnyPromiseLike<RepositoryResult<ReadonlyArray<ReservationItemRow>>>
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
