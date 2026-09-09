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
  'min_length_cm',
  'min_width_cm',
] as const
export const BASE_PROFILE_PUBLIC_COLUMNS = ['base_id', 'base_type_id'] as const
/** Paired bounds rotate together; a single length/width bounds the long/short side. */
export function normalizedBounds(
  length: number | null,
  width: number | null,
): [number | null, number | null] {
  return length !== null && width !== null
    ? [Math.max(length, width), Math.min(length, width)]
    : [length, width]
}
export function validTableDimensions(r: {
  shape: string | null
  min_length_cm: number | null
  min_width_cm: number | null
  max_length_cm: number | null
  max_width_cm: number | null
}): boolean {
  const values = [
    r.min_length_cm,
    r.min_width_cm,
    r.max_length_cm,
    r.max_width_cm,
  ]
  if (
    values.some(
      (v) => v !== null && (!Number.isFinite(v) || v <= 0 || v >= 10000),
    )
  )
    return false
  const [minL, minW] = normalizedBounds(r.min_length_cm, r.min_width_cm)
  const [maxL, maxW] = normalizedBounds(r.max_length_cm, r.max_width_cm)
  if (r.shape === 'round') {
    if (minL !== null && minW !== null && minL !== minW) return false
    if (maxL !== null && maxW !== null && maxL !== maxW) return false
    return (
      Math.max(minL ?? 0, minW ?? 0) <=
      Math.min(maxL ?? Infinity, maxW ?? Infinity)
    )
  }
  return (
    (minL ?? 0) <= (maxL ?? Infinity) &&
    (minW ?? 0) <= (maxW ?? Infinity) &&
    (minW ?? 0) <= (maxL ?? Infinity)
  )
}
export const tableRuleSchema = z
  .object({
    id: z.string().min(1),
    base_id: z.string().nullable(),
    tabletop_id: z.string().nullable(),
    base_type_id: z.string().nullable(),
    shape: z.enum(['round', 'rectangular']).nullable(),
    max_length_cm: z.number().positive().lt(10000).finite().nullable(),
    max_width_cm: z.number().positive().lt(10000).finite().nullable(),
    min_length_cm: z.number().positive().lt(10000).finite().nullable(),
    min_width_cm: z.number().positive().lt(10000).finite().nullable(),
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
        r.max_width_cm === null &&
        r.min_length_cm === null &&
        r.min_width_cm === null &&
        r.base_id !== r.tabletop_id,
      ) || Boolean(!r.base_id && !r.tabletop_id && r.base_type_id && r.shape),
  )
  .refine(validTableDimensions)
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
    (r) =>
      r.base_type_id &&
      r.base_type_id === membership[0]?.base_type_id &&
      r.shape === shape,
  )
  if (general.length) {
    // A type+shape has one rule in SQL. Conflicting duplicate data must fail closed.
    const outcomes = general.map((r) => {
      if (!tableRuleSchema.safeParse(r).success)
        return result('requires_confirmation', 'invalid_rule')
      const [minL, minW] = normalizedBounds(r.min_length_cm, r.min_width_cm)
      const [maxL, maxW] = normalizedBounds(r.max_length_cm, r.max_width_cm)
      if (Math.max(l, w) < (minL ?? 0) || Math.min(l, w) < (minW ?? 0))
        return result('denied', 'minimum_dimensions_not_reached', r.id)
      if (
        Math.max(l, w) > (maxL ?? Infinity) ||
        Math.min(l, w) > (maxW ?? Infinity)
      )
        return result('denied', 'maximum_dimensions_exceeded', r.id)
      return result(r.verdict, 'verified_type_rule', r.id)
    })
    if (
      general.some((r) => r.verdict !== general[0]!.verdict) ||
      outcomes.some(
        (r) =>
          r.verdict !== outcomes[0]!.verdict ||
          r.reason !== outcomes[0]!.reason,
      )
    )
      return result('requires_confirmation', 'conflicting_rules')
    return outcomes[0]!
  }
  if (base.compatibleTopShapes?.length)
    return result(
      isCompatibleTop(base, top) ? 'allowed' : 'denied',
      'catalogue_explicit_shapes',
    )
  return result('requires_confirmation', 'compatibility_unconfirmed')
}
