// Zod schemas guarding the shape of JSONB columns written by the admin
// editors. RLS only checks `is_admin()`, so a malformed payload would
// happily land in the DB and crash the public renderer (e.g. /livres
// reading `containers.timeline` or `containers.gallery`).
//
// Each schema mirrors the TS interfaces in `lib/delivered-containers/types.ts`
// and `lib/quality-reports/types.ts`. They are intentionally permissive on
// strings (any text the admin types is allowed) but strict on shape and
// enums so a typo in the editor cannot poison the public surface.

import { z } from 'zod'

const productCategorySchema = z.enum(['chair', 'armchair', 'table', 'bench'])

export const timelineStepSchema = z.object({
  date: z.string().min(1, 'Date requise'),
  label: z.string().min(1, 'Label requis'),
  description: z.string(),
  status: z.enum(['done', 'delay']),
})

export const productBreakdownSchema = z.object({
  category: productCategorySchema,
  units: z.number().int().min(0),
  modelLabel: z.string(),
})

export const galleryItemSchema = z.object({
  url: z.string().url('URL invalide'),
  caption: z.string(),
})

export const qualityHighlightSchema = z.object({
  label: z.string().min(1, 'Label requis'),
  value: z.string().min(1, 'Valeur requise'),
})

export const timelineArraySchema = z.array(timelineStepSchema)
export const productBreakdownArraySchema = z.array(productBreakdownSchema)
export const galleryArraySchema = z.array(galleryItemSchema)
export const qualityHighlightsArraySchema = z.array(qualityHighlightSchema)
export const certificationsArraySchema = z.array(z.string().min(1))

/**
 * Validate a JSONB payload and return either the parsed value or a
 * human-readable error message suitable for surfacing in the editor.
 */
export function validateJsonb<T>(
  schema: z.ZodType<T>,
  value: unknown,
  fieldLabel: string,
): { ok: true; data: T } | { ok: false; message: string } {
  const result = schema.safeParse(value)
  if (result.success) return { ok: true, data: result.data }
  const first = result.error.issues[0]
  const path = first?.path.length
    ? `${fieldLabel}[${first.path.join('.')}]`
    : fieldLabel
  return {
    ok: false,
    message: `${path} : ${first?.message ?? 'format invalide'}`,
  }
}
