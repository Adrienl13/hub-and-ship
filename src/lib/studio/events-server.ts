// Écriture des événements Studio (lot 2) — SERVEUR uniquement.
//
// Client structurel injecté (le client admin service_role en production,
// un faux client en test). La session est créée ou rafraîchie, puis les
// événements sont insérés. Aucune donnée personnelle n'est écrite.

import type { StudioEventsBatch } from './events'

interface WriteResult {
  readonly error: { readonly message: string } | null
}

export interface StudioSessionUpsert {
  readonly id: string
  readonly algorithm_version: string
  readonly entry: string | null
  readonly last_seen_at: string
}

export interface StudioEventInsert {
  readonly session_id: string
  readonly event_type: string
  readonly product_id: string | null
  readonly variant_id: string | null
  readonly algorithm_version: string
  readonly payload: Record<string, unknown>
  readonly client_ts: string | null
}

export interface StudioEventsClient {
  from(table: 'studio_sessions'): {
    upsert(values: StudioSessionUpsert, options: { onConflict: 'id' }): PromiseLike<WriteResult>
  }
  from(table: 'studio_events'): {
    insert(values: ReadonlyArray<StudioEventInsert>): PromiseLike<WriteResult>
  }
}

export function buildStudioEventRows(
  batch: StudioEventsBatch,
): ReadonlyArray<StudioEventInsert> {
  return batch.events.map((event) => ({
    session_id: batch.sessionId,
    event_type: event.type,
    product_id: event.productId ?? null,
    variant_id: event.variantId ?? null,
    algorithm_version: batch.algorithmVersion,
    payload: event.payload ?? {},
    client_ts: event.clientTs ?? null,
  }))
}

export interface RecordStudioEventsResult {
  readonly ok: boolean
  readonly inserted: number
  readonly error?: string
}

export async function recordStudioEvents(
  client: StudioEventsClient,
  batch: StudioEventsBatch,
  now: Date = new Date(),
): Promise<RecordStudioEventsResult> {
  const session = await client.from('studio_sessions').upsert(
    {
      id: batch.sessionId,
      algorithm_version: batch.algorithmVersion,
      entry: batch.entry ?? null,
      last_seen_at: now.toISOString(),
    },
    { onConflict: 'id' },
  )
  if (session.error) return { ok: false, inserted: 0, error: session.error.message }

  const rows = buildStudioEventRows(batch)
  const inserted = await client.from('studio_events').insert(rows)
  if (inserted.error) return { ok: false, inserted: 0, error: inserted.error.message }
  return { ok: true, inserted: rows.length }
}
