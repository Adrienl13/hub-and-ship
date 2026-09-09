import { z } from 'zod'
import { isCompatibleTop } from '@/lib/table-composer'
import type { StudioProduct } from './types'

export const COMPATIBILITY_VERDICTS = [
  'allowed',
  'denied',
  'requires_confirmation',
] as const
export type CompatibilityVerdict = (typeof COMPATIBILITY_VERDICTS)[number]
export const TABLE_RULE_PUBLIC_COLUMNS = [
  'id',
  'base_id',
  'tabletop_id',
  'base_type_id',
  'shape',
  'max_length_cm',
  'max_width_cm',
  'verdict',
] as const
export const BASE_PROFILE_PUBLIC_COLUMNS = ['base_id', 'base_type_id'] as const
export const tableRuleSchema = z
  .object({
    id: z.string().min(1),
    base_id: z.string().nullable(),
    tabletop_id: z.string().nullable(),
    base_type_id: z.string().nullable(),
    shape: z.enum(['round', 'rectangular']).nullable(),
    max_length_cm: z.number().positive().finite().nullable(),
    max_width_cm: z.number().positive().finite().nullable(),
    verdict: z.enum(COMPATIBILITY_VERDICTS),
  })
  .refine(
    (r) =>
      Boolean(
        r.base_id &&
        r.tabletop_id &&
        !r.base_type_id &&
        !r.shape &&
        r.max_length_cm === null &&
        r.max_width_cm === null,
      ) ||
      Boolean(
        !r.base_id &&
        !r.tabletop_id &&
        r.base_type_id &&
        r.shape &&
        r.max_length_cm &&
        r.max_width_cm,
      ),
  )
export type TableCompatibilityRule = z.infer<typeof tableRuleSchema>
export interface TableCompatibilityData {
  readonly rules: ReadonlyArray<TableCompatibilityRule>
  readonly baseProfiles: ReadonlyArray<{
    base_id: string
    base_type_id: string
  }>
  /** false on a missing/failed surface: do not bypass unavailable exceptions. */
  readonly available: boolean
}
export const EMPTY_COMPATIBILITY: TableCompatibilityData = {
  rules: [],
  baseProfiles: [],
  available: false,
}
export interface CompatibilityResult {
  readonly verdict: CompatibilityVerdict
  readonly reason: string
  readonly ruleId?: string
}

/** Public rules and memberships are projected ONLY after human verification.
 * No names, SKU, price or visual model participate in this decision. */
export function resolveTableCompatibility(
  top: StudioProduct | null | undefined,
  base: StudioProduct | null | undefined,
  data: TableCompatibilityData,
): CompatibilityResult {
  const result = (
    verdict: CompatibilityVerdict,
    reason: string,
    ruleId?: string,
  ) => ({ verdict, reason, ...(ruleId ? { ruleId } : {}) })
  if (!top || !base) return result('requires_confirmation', 'missing_product')
  if (
    !top.isActive ||
    !base.isActive ||
    top.studio.studioRole !== 'tabletop' ||
    base.studio.studioRole !== 'base' ||
    top.category !== 'table_top' ||
    base.category !== 'table_base'
  )
    return result('denied', 'inactive_or_wrong_role')
  if (!data.available)
    return result('requires_confirmation', 'rules_unavailable')
  const pair = data.rules.filter(
    (r) => r.base_id === base.id && r.tabletop_id === top.id,
  )
  if (pair.length) {
    if (pair.some((r) => r.verdict !== pair[0]!.verdict))
      return result('requires_confirmation', 'conflicting_rules')
    return result(pair[0]!.verdict, 'verified_pair', pair[0]!.id)
  }
  const shape = top.tableShape
  const { l, w } = top.dimensions
  if (!shape || !Number.isFinite(l) || !Number.isFinite(w) || l <= 0 || w <= 0)
    return result('requires_confirmation', 'missing_shape_or_dimensions')
  const membership = data.baseProfiles.filter((p) => p.base_id === base.id)
  if (membership.length > 1)
    return result('requires_confirmation', 'conflicting_types')
  const general = data.rules.filter(
    (r) => r.base_type_id && r.base_type_id === membership[0]?.base_type_id,
  )
  if (general.length) {
    const shaped = general.filter((r) => r.shape === shape)
    if (!shaped.length) return result('denied', 'shape_not_supported')
    const matching = shaped.filter(
      (r) =>
        Math.max(l, w) <= Math.max(r.max_length_cm!, r.max_width_cm!) &&
        Math.min(l, w) <= Math.min(r.max_length_cm!, r.max_width_cm!),
    )
    if (!matching.length) return result('denied', 'maximum_dimensions_exceeded')
    if (matching.some((r) => r.verdict !== matching[0]!.verdict))
      return result('requires_confirmation', 'conflicting_rules')
    return result(matching[0]!.verdict, 'verified_type_rule', matching[0]!.id)
  }
  if (base.compatibleTopShapes?.length)
    return result(
      isCompatibleTop(base, top) ? 'allowed' : 'denied',
      'catalogue_explicit_shapes',
    )
  return result('requires_confirmation', 'compatibility_unconfirmed')
}
