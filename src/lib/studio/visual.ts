import { z } from 'zod'

export const VISUAL_MEDIA_COLUMNS = ['product_id', 'role', 'url'] as const
export const VISUAL_NEIGHBOR_COLUMNS = [
  'product_id',
  'neighbor_product_id',
  'rank',
  'similarity',
  'model_version',
] as const
export const ALGORITHM_PUBLIC_COLUMNS = [
  'version',
  'engine',
  'model_version',
  'status',
] as const
export const neighborSchema = z
  .object({
    product_id: z.string().min(1),
    neighbor_product_id: z.string().min(1),
    rank: z.number().int().min(1).max(12),
    similarity: z.number().finite().min(0).max(1),
    model_version: z.string().min(1),
  })
  .refine((n) => n.product_id !== n.neighbor_product_id)
export type VisualNeighbor = z.infer<typeof neighborSchema>
export interface StudioVisualData {
  readonly neighbors: ReadonlyArray<VisualNeighbor>
  readonly versions: ReadonlyArray<{
    version: string
    engine: string
    model_version: string | null
    status: string
  }>
}
export const EMPTY_VISUAL_DATA: StudioVisualData = {
  neighbors: [],
  versions: [],
}
