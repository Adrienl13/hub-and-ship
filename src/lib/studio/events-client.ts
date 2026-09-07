// Traqueur d'événements Studio côté navigateur (lot 2).
//
// File d'attente en mémoire, envoi groupé (debounce) vers POST
// /api/studio/events, `keepalive` pour survivre à une navigation. Un échec
// réseau ou serveur est silencieux : la mesure ne casse JAMAIS le parcours.
// Aucune donnée personnelle n'est envoyée.

import { ALGORITHM_VERSION, type AlgorithmVersion } from './engine/v0'
import {
  MAX_EVENTS_PER_BATCH,
  type StudioEvent,
  type StudioEventPayload,
  type StudioEventType,
  type StudioEventsBatch,
} from './events'

export const STUDIO_EVENTS_ENDPOINT = '/api/studio/events'

export interface StudioEventSendOptions {
  /** Vidage à la fermeture de page : la requête doit survivre au déchargement. */
  readonly keepalive?: boolean
}

export type StudioEventSender = (batch: StudioEventsBatch, options?: StudioEventSendOptions) => Promise<void>

export interface StudioEventTrackerOptions {
  readonly sessionId: string
  readonly entry?: StudioEventsBatch['entry']
  readonly algorithmVersion?: AlgorithmVersion
  readonly send?: StudioEventSender
  /** Délai de regroupement (ms). 0 = envoi immédiat (tests). */
  readonly debounceMs?: number
  readonly now?: () => Date
}

export interface StudioEventTracker {
  readonly track: (
    type: StudioEventType,
    details?: { productId?: string; variantId?: string; payload?: StudioEventPayload },
  ) => void
  readonly flush: (options?: StudioEventSendOptions) => Promise<void>
  readonly pending: () => number
}

export async function sendStudioEventsBatch(
  batch: StudioEventsBatch,
  options: StudioEventSendOptions = {},
): Promise<void> {
  if (typeof fetch !== 'function') return
  await fetch(STUDIO_EVENTS_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(batch),
    ...(options.keepalive ? { keepalive: true } : {}),
    credentials: 'same-origin',
  })
}

export function createStudioEventTracker(options: StudioEventTrackerOptions): StudioEventTracker {
  const send = options.send ?? sendStudioEventsBatch
  const debounceMs = options.debounceMs ?? 800
  const now = options.now ?? (() => new Date())
  const queue: StudioEvent[] = []
  let timer: ReturnType<typeof setTimeout> | null = null
  let inFlight: Promise<void> = Promise.resolve()

  const flush = async (sendOptions: StudioEventSendOptions = {}): Promise<void> => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    if (queue.length === 0) return inFlight
    const chunks: StudioEvent[][] = []
    while (queue.length > 0) chunks.push(queue.splice(0, MAX_EVENTS_PER_BATCH))
    const work = async () => {
      for (const events of chunks) {
        try {
          await send(
            {
              sessionId: options.sessionId,
              algorithmVersion: options.algorithmVersion ?? ALGORITHM_VERSION,
              ...(options.entry ? { entry: options.entry } : {}),
              events,
            },
            sendOptions,
          )
        } catch {
          // La mesure ne casse jamais le parcours : on abandonne ce lot.
        }
      }
    }
    inFlight = inFlight.then(work, work)
    await inFlight
  }

  return {
    track: (type, details) => {
      queue.push({
        type,
        ...(details?.productId ? { productId: details.productId } : {}),
        ...(details?.variantId ? { variantId: details.variantId } : {}),
        ...(details?.payload && Object.keys(details.payload).length > 0
          ? { payload: details.payload }
          : {}),
        clientTs: now().toISOString(),
      })
      if (debounceMs <= 0) {
        void flush()
        return
      }
      if (!timer) {
        timer = setTimeout(() => {
          void flush()
        }, debounceMs)
      }
    },
    flush,
    pending: () => queue.length,
  }
}
