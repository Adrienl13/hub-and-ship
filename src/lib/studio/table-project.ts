import { z } from 'zod'
import {
  resolveTableCompatibility,
  type TableCompatibilityData,
} from './compatibility'
import { computeReadiness } from './readiness'
import { resolveFulfillment } from './fulfillment'
import { computeProjectState } from './project-state'
import type {
  FulfillmentContext,
  StudioProduct,
  StudioProjectItem,
} from './types'
const ref = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1),
})
export const customTabletopSchema = z.object({
  shape: z.enum(['rectangular', 'round']),
  length: z.number().finite().positive().max(9999),
  width: z.number().finite().positive().max(9999),
  finish: z.string().trim().max(160),
})
export type CustomTabletopRequest = z.infer<typeof customTabletopSchema>
export const tableConfigurationSchema = z
  .object({
    id: z.string().min(1).max(80),
    top: ref.nullable(),
    base: ref.nullable(),
    quantity: z
      .number()
      .finite()
      .transform((n) => Math.max(1, Math.trunc(n))),
    quantityEdited: z.boolean(),
    custom: customTabletopSchema.nullable(),
    verificationRequested: z.boolean(),
    baseInvalidated: z.boolean(),
  })
  .refine((c) => (c.top !== null) !== (c.custom !== null))
export type TableConfiguration = z.infer<typeof tableConfigurationSchema>
export function sanitizeTables(value: unknown): TableConfiguration[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  return value.flatMap((row) => {
    const parsed = tableConfigurationSchema.safeParse(row)
    if (!parsed.success || seen.has(parsed.data.id)) return []
    seen.add(parsed.data.id)
    return [parsed.data]
  })
}
export function configurationProducts(
  config: TableConfiguration,
  products: ReadonlyMap<string, StudioProduct>,
) {
  const top = config.top ? products.get(config.top.productId) : undefined
  const base = config.base ? products.get(config.base.productId) : undefined
  const topVariant = top?.variants.find((v) => v.id === config.top?.variantId)
  const baseVariant = base?.variants.find(
    (v) => v.id === config.base?.variantId,
  )
  return { top, base, topVariant, baseVariant }
}
export function reconcileTable(
  config: TableConfiguration,
  products: ReadonlyArray<StudioProduct>,
  data: TableCompatibilityData,
): TableConfiguration {
  if (!config.base) return config
  const { top, base, topVariant, baseVariant } = configurationProducts(
    config,
    new Map(products.map((p) => [p.id, p])),
  )
  if (
    config.custom ||
    !topVariant ||
    !baseVariant ||
    resolveTableCompatibility(top, base, data).verdict !== 'allowed'
  )
    return {
      ...config,
      base: null,
      baseInvalidated: true,
      verificationRequested: false,
    }
  return { ...config, baseInvalidated: false }
}
/** Re-evaluate using current data; persisted configuration never certifies itself. */
export function evaluateTable(
  config: TableConfiguration,
  products: ReadonlyMap<string, StudioProduct>,
  data: TableCompatibilityData,
  context: FulfillmentContext,
) {
  const { top, base, topVariant, baseVariant } = configurationProducts(
    config,
    products,
  )
  const compatible =
    !config.custom &&
    Boolean(topVariant && baseVariant) &&
    resolveTableCompatibility(top, base, data).verdict === 'allowed'
  const lines: StudioProjectItem[] = []
  if (top && topVariant)
    lines.push({
      productId: top.id,
      variantId: topVariant.id,
      role: 'tabletop',
      requestedQuantity: config.quantity,
    })
  if (compatible && base && baseVariant)
    lines.push({
      productId: base.id,
      variantId: baseVariant.id,
      role: 'base',
      requestedQuantity: config.quantity,
    })
  const result = computeProjectState(
    lines.map((item) => {
      const product = products.get(item.productId)!
      return {
        item,
        readiness: computeReadiness(product, context, item.variantId),
        fulfillment: resolveFulfillment(item, product, context),
      }
    }),
  )
  const reason = config.custom
    ? 'custom_tabletop_requested'
    : !compatible
      ? 'compatibility_unconfirmed'
      : null
  const priced =
    compatible &&
    lines.every((l) => {
      const p = products.get(l.productId)!
      return (
        p.basePriceHt > 0 &&
        computeReadiness(p, context, l.variantId).quote.ready
      )
    })
  return {
    compatible,
    lines,
    state: reason ? ('manual_quote_required' as const) : result.state,
    reasons: reason ? [reason] : result.reasons,
    total: priced
      ? lines.reduce(
          (n, l) =>
            n + products.get(l.productId)!.basePriceHt * l.requestedQuantity,
          0,
        )
      : null,
  }
}
