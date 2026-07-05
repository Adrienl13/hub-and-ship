import type { SalesChannel } from '@/lib/supabase/types'
import { CUSTOMER_QUANTITY_DISCOUNT_TIERS } from './customer-discounts'

/**
 * Multi-channel pricing foundation (LOT 4).
 *
 * The sales channel is an admin-attributed account attribute (decision #2 —
 * never self-service). Prices resolve server-side per channel via the
 * `get_catalogue_prices()` RPC so a client only ever receives THEIR channel's
 * prices (decision #4). This module holds the pure resolution logic mirrored on
 * the client for display, and the permanent "golden rule" guard.
 */

export type { SalesChannel }

export const SALES_CHANNELS: ReadonlyArray<SalesChannel> = [
  'direct',
  'revendeur',
  'distributeur',
  'grand_compte',
]

export const SALES_CHANNEL_LABEL: Record<SalesChannel, string> = {
  direct: 'Direct',
  revendeur: 'Revendeur',
  distributeur: 'Distributeur',
  grand_compte: 'Grand compte',
}

/**
 * Default markup-on-cost margins — mirror of the ACTIVE `pricing_parameters`
 * row (direct_margin_rate / reseller_margin_rate / distributor_margin_rate).
 * The server RPC derives its coefficients from the live row; these values are
 * the client-side display mirror and the seed defaults.
 */
export const CHANNEL_MARGIN_RATES = {
  direct: 0.9,
  revendeur: 0.4,
  distributeur: 0.28,
} as const

/**
 * Coefficient applied to the public direct price for a given channel margin:
 * (1 + channel margin) / (1 + direct margin), rounded to 4 decimals — the
 * exact formula used by `get_catalogue_prices()`.
 */
export function channelCoefficientFromMargins(
  directMarginRate: number,
  channelMarginRate: number,
): number {
  return (
    Math.round(((1 + channelMarginRate) / (1 + directMarginRate)) * 10_000) /
    10_000
  )
}

/**
 * Channel coefficients, derived from the markup-on-cost grid
 * (direct +90%, revendeur +40%, distributeur +28%). These MUST match the
 * defaults of the `pricing_parameters` engine (see the coherence unit test)
 * and the `channel_coefficients` fallback seed in the migration.
 *
 * grand_compte stays 1.0000 here — its advantage (best direct tier, −10%
 * guaranteed) is applied in logic below, not via the coefficient.
 */
export const CHANNEL_COEFFICIENTS: Record<SalesChannel, number> = {
  direct: 1.0,
  revendeur: 0.7368,
  distributeur: 0.6737,
  grand_compte: 1.0,
}

/** Max direct volume discount (single source of truth = the v2 grid top tier). */
export const MAX_DIRECT_DISCOUNT_PERCENT = Math.max(
  ...CUSTOMER_QUANTITY_DISCOUNT_TIERS.map((tier) => tier.discountPercent),
)

/**
 * The "worst" (lowest) achievable direct price factor: full max volume discount
 * applied. This is the price the golden rule protects — no reseller price may
 * ever reach it.
 */
export const WORST_DIRECT_PRICE_FACTOR = 1 - MAX_DIRECT_DISCOUNT_PERCENT / 100

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/** Only the direct channel gets the volume-discount ladder + loss leaders. */
export function channelAllowsVolumeDiscounts(channel: SalesChannel): boolean {
  return channel === 'direct'
}

export function channelAllowsLossLeaders(channel: SalesChannel): boolean {
  return channel === 'direct'
}

/**
 * Resolve a unit price for a channel. Strict order:
 *   1. explicit `channel_price_overrides` (if a positive value is provided)
 *   2. `base_price_ht × coefficient(channel)`  — for revendeur/distributeur
 *      (no volume discount; RFA replaces it) and direct (coefficient 1.0)
 *   3. `grand_compte`: direct price with the max tier (−10%) applied d'office,
 *      without any quantity condition.
 *
 * The direct channel returns the base price; its volume discounts are applied
 * separately at the cart level (`customer-discounts.ts`).
 */
export function resolveChannelUnitPrice({
  basePriceHt,
  channel,
  overrideHt,
}: {
  readonly basePriceHt: number
  readonly channel: SalesChannel
  readonly overrideHt?: number | null
}): number {
  if (overrideHt != null && overrideHt > 0) {
    return round2(overrideHt)
  }
  if (channel === 'grand_compte') {
    return round2(basePriceHt * WORST_DIRECT_PRICE_FACTOR)
  }
  return round2(basePriceHt * CHANNEL_COEFFICIENTS[channel])
}

/** The worst (lowest) direct price for a product — the golden-rule threshold. */
export function worstDirectUnitPrice(basePriceHt: number): number {
  return round2(basePriceHt * WORST_DIRECT_PRICE_FACTOR)
}

/**
 * Golden rule (decision #1, permanent invariant): the worst direct price
 * (max volume discount) must stay STRICTLY greater than any reseller price.
 * Returns true when a channel/price combination VIOLATES the rule.
 *
 * Only reseller channels (revendeur, distributeur) are constrained — direct and
 * grand_compte are direct-channel deals by definition.
 */
export function violatesGoldenRule({
  basePriceHt,
  channel,
  overrideHt,
}: {
  readonly basePriceHt: number
  readonly channel: SalesChannel
  readonly overrideHt?: number | null
}): boolean {
  if (channel !== 'revendeur' && channel !== 'distributeur') return false
  const resolved = resolveChannelUnitPrice({ basePriceHt, channel, overrideHt })
  return !(worstDirectUnitPrice(basePriceHt) > resolved)
}
