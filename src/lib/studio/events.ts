// Événements Studio (lot 2) — contrat PARTAGÉ client / serveur.
//
// Un événement décrit une interaction de découverte ou de projet. Il porte
// toujours la version d'algorithme en vigueur, un identifiant de session
// anonyme et un payload MINIMAL strictement validé (zod, clés connues
// seulement). Aucune PII : pas d'email, pas de nom, pas d'adresse.
// Les écritures passent uniquement par POST /api/studio/events (serveur,
// client admin) ; le navigateur n'a aucun droit sur studio_events.

import { z } from 'zod'
import { ALGORITHM_VERSIONS } from './engine/versions'

export const LOT_2_EVENT_TYPES = [
  'studio_started',
  'card_liked',
  'card_disliked',
  'card_passed',
  'undo',
  'favorite_added',
  'favorite_removed',
  'finalists_viewed',
  'seat_selected',
  'quantity_changed',
  /** Réservé : aucun état « projet terminé » n'existe au lot 2, jamais émis. */
  'project_completed',
] as const
export const LOT_3_EVENT_TYPES = [
  ...LOT_2_EVENT_TYPES,
  'convergence_ready',
  'convergence_stalled',
  'convergence_prompt_viewed',
  'convergence_accepted',
  'exploration_continued',
] as const
export const STUDIO_EVENT_TYPES = [
  ...LOT_3_EVENT_TYPES,
  'studio_tables_started',
  'tabletop_selected',
  'table_quantity_changed',
  'base_selected',
  'compatibility_verification_requested',
  'custom_tabletop_requested',
] as const
export type StudioEventType = (typeof STUDIO_EVENT_TYPES)[number]

export const MAX_EVENTS_PER_BATCH = 20

/** Identifiant de session : UUID ou identifiant de repli du store. */
export const studioSessionIdSchema = z
  .string()
  .trim()
  .min(8)
  .max(64)
  .regex(/^[A-Za-z0-9-]+$/)

export const algorithmVersionSchema = z.enum(ALGORITHM_VERSIONS)

/** Payload minimal : uniquement des clés connues, toutes optionnelles. */
export const studioEventPayloadSchema = z
  .object({
    quantity: z.number().int().positive().max(100_000).optional(),
    position: z.number().int().nonnegative().max(100_000).optional(),
    reason: z.enum(['initial', 'score', 'exploration']).optional(),
    entry: z.enum(['full_project', 'seats', 'tables']).optional(),
    undone: z.string().max(40).optional(),
    set: z.string().max(40).optional(),
    finalists: z.number().int().nonnegative().max(3).optional(),
  })
  .strict()
export type StudioEventPayload = z.infer<typeof studioEventPayloadSchema>

export const studioEventSchema = z
  .object({
    type: z.enum(STUDIO_EVENT_TYPES),
    productId: z.string().trim().min(1).max(64).optional(),
    variantId: z.string().trim().min(1).max(64).optional(),
    clientTs: z.string().datetime({ offset: true }).optional(),
    payload: studioEventPayloadSchema.optional(),
  })
  .strict()
export type StudioEvent = z.infer<typeof studioEventSchema>

export const studioEventsBatchSchema = z
  .object({
    sessionId: studioSessionIdSchema,
    algorithmVersion: algorithmVersionSchema,
    entry: z.enum(['full_project', 'seats', 'tables']).optional(),
    events: z.array(studioEventSchema).min(1).max(MAX_EVENTS_PER_BATCH),
  })
  .strict()
export type StudioEventsBatch = z.infer<typeof studioEventsBatchSchema>

export interface StudioEventsParse {
  readonly ok: boolean
  readonly batch?: StudioEventsBatch
  readonly error?: string
}

export function parseStudioEventsBatch(input: unknown): StudioEventsParse {
  const result = studioEventsBatchSchema.safeParse(input)
  if (!result.success) {
    const issue = result.error.issues[0]
    return {
      ok: false,
      error: issue
        ? `${issue.path.join('.') || 'body'}: ${issue.message}`
        : 'invalid',
    }
  }
  return { ok: true, batch: result.data }
}
