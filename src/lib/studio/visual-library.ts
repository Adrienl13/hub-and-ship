import { z } from 'zod'
export const visualRefSchema = z.string().regex(/^PI-[A-Z]{2}-\d{3,6}$/)
const localImage = z
  .string()
  .regex(/^\/studio\/materials\/pi-[a-z]{2}-\d{3,6}(?:-detail)?\.webp$/)
export const libraryItemSchema = z
  .object({
    public_ref: visualRefSchema,
    family: z.string().regex(/^[a-z_]+$/),
    label: z.string().max(80),
    thumbnail: localImage,
    image: localImage,
    tag: z.string().max(40),
    active: z.boolean(),
    color_customization: z.enum([
      'verified',
      'on_request',
      'unavailable',
      'unknown',
    ]),
    color_zones: z.number().int().min(1).max(8).nullable(),
  })
  .strict()
export type VisualLibraryItem = z.infer<typeof libraryItemSchema>
export const visualSelectionSchema = z.object({
  public_ref: visualRefSchema,
  weave_colors: z.array(z.string().trim().min(1).max(80)).max(4).default([]),
})
export const visualAssociationSchema = z.object({
  product_id: z.string(),
  public_ref: visualRefSchema,
  status: z.enum(['verified', 'on_request', 'unavailable', 'unknown']),
  palette_refs: z.array(visualRefSchema),
})
export type VisualAssociation = z.infer<typeof visualAssociationSchema>
export const VISUAL_LIBRARY_COLUMNS = [
  'public_ref',
  'family',
  'label',
  'thumbnail',
  'image',
  'tag',
  'active',
  'color_customization',
  'color_zones',
] as const
export const VISUAL_ASSOCIATION_COLUMNS = [
  'product_id',
  'public_ref',
  'status',
  'palette_refs',
] as const
export function visualAssociationStatus(
  productId: string | null,
  ref: string,
  associations: ReadonlyArray<VisualAssociation>,
) {
  const rows = associations.filter(
    (a) => a.product_id === productId && a.public_ref === ref,
  )
  return rows.length === 1 ? rows[0]!.status : 'unknown'
}
/** A palette suggestion is never a recoloring or an approved colorway. */
const VISUAL_KINDS = {
  weave: 'weave_pattern',
  rope: 'rope_color',
  textilene: 'textilene_color',
} as const
export function visualKind(family: string) {
  return Object.hasOwn(VISUAL_KINDS, family)
    ? VISUAL_KINDS[family as keyof typeof VISUAL_KINDS]
    : undefined
}
