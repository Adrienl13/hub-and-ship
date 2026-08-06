// Règles de prix PUBLIQUES — paliers volume et frais de réservation.
//
// Source serveur : la RPC anonyme `get_public_pricing_rules()` (migration
// 20260709090000), qui n'expose QUE des faits déjà affichés sur /prix et au
// checkout — jamais une marge ni un coût. Ce module garde une copie en
// mémoire, initialisée avec la grille historique : le SSR et le premier paint
// utilisent ces défauts, puis le chargement du catalogue (`fetchCatalogFromDb`)
// hydrate les valeurs actives. Tant que l'admin ne touche pas aux paramètres,
// défauts et valeurs serveur sont identiques — le comportement ne change pas.
//
// Le RPC de réservation (`create_reservation_with_items` v4) lit la même
// table : client et serveur restent synchrones (tolérance 0,05 € du RPC).

import type { CustomerDiscountTier } from './customer-discounts'

export interface PublicPricingRules {
  readonly tier2Qty: number
  /** Remise en fraction (0.06 = 6 %). */
  readonly tier2Discount: number
  readonly tier3Qty: number
  readonly tier3Discount: number
  /** Frais de réservation en fraction du sous-total HT. */
  readonly reservationFeeRate: number
  readonly reservationFeeMin: number
  readonly reservationFeeMax: number
  /** Volume minimum d'une commande distributeur (m³) — null = pas de règle.
   *  MIROIR VIVANT du trigger SQL : jamais de constante codée en dur ici. */
  readonly distributorMinOrderCbm: number | null
}

// Grille historique — doit rester alignée avec le fallback SQL de
// get_public_pricing_rules() et de create_reservation_with_items v4.
export const DEFAULT_PUBLIC_PRICING_RULES: PublicPricingRules = {
  tier2Qty: 100,
  tier2Discount: 0.06,
  tier3Qty: 150,
  tier3Discount: 0.1,
  reservationFeeRate: 0.03,
  reservationFeeMin: 150,
  reservationFeeMax: 500,
  // null tant que le serveur n'a pas hydraté : le trigger SQL reste le seul
  // garde — l'UI ne doit jamais bloquer sur une valeur qu'elle ne connaît pas.
  distributorMinOrderCbm: null,
}

let currentRules: PublicPricingRules = DEFAULT_PUBLIC_PRICING_RULES

function finiteOr(value: unknown, fallback: number): number {
  const parsed = typeof value === 'string' ? Number(value) : value
  return typeof parsed === 'number' && Number.isFinite(parsed)
    ? parsed
    : fallback
}

/**
 * Hydrate les règles depuis le JSON de `get_public_pricing_rules()`.
 * Chaque champ invalide ou manquant retombe individuellement sur le défaut ;
 * un payload incohérent (palier 3 ≤ palier 2, min > max…) est rejeté en bloc.
 */
export function setPublicPricingRules(raw: unknown): PublicPricingRules {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return currentRules
  }
  const record = raw as Record<string, unknown>
  const defaults = DEFAULT_PUBLIC_PRICING_RULES
  const next: PublicPricingRules = {
    tier2Qty: Math.max(1, Math.round(finiteOr(record.tier2_qty, defaults.tier2Qty))),
    tier2Discount: finiteOr(record.tier2_discount, defaults.tier2Discount),
    tier3Qty: Math.max(1, Math.round(finiteOr(record.tier3_qty, defaults.tier3Qty))),
    tier3Discount: finiteOr(record.tier3_discount, defaults.tier3Discount),
    reservationFeeRate: finiteOr(
      record.reservation_fee_rate,
      defaults.reservationFeeRate,
    ),
    reservationFeeMin: finiteOr(
      record.reservation_fee_min,
      defaults.reservationFeeMin,
    ),
    reservationFeeMax: finiteOr(
      record.reservation_fee_max,
      defaults.reservationFeeMax,
    ),
    distributorMinOrderCbm: (() => {
      const parsed = finiteOr(record.distributor_min_order_cbm, -1)
      return parsed >= 0 ? parsed : null
    })(),
  }

  const coherent =
    next.tier3Qty > next.tier2Qty &&
    next.tier2Discount >= 0 &&
    next.tier2Discount < 1 &&
    next.tier3Discount >= next.tier2Discount &&
    next.tier3Discount < 1 &&
    next.reservationFeeRate >= 0 &&
    next.reservationFeeRate < 1 &&
    next.reservationFeeMin >= 0 &&
    next.reservationFeeMax >= next.reservationFeeMin

  if (!coherent) return currentRules

  currentRules = next
  return next
}

export function getPublicPricingRules(): PublicPricingRules {
  return currentRules
}

/** Réservé aux tests : revient à la grille historique. */
export function resetPublicPricingRules(): void {
  currentRules = DEFAULT_PUBLIC_PRICING_RULES
}

/**
 * Re-fetch des règles actives juste avant un moment critique (checkout) : le
 * RPC de réservation valide contre les paramètres LIVE, un cache hydraté au
 * chargement du catalogue peut être périmé si l'admin a modifié les paliers ou
 * les frais en cours de session. Échec silencieux = on garde le cache.
 */
export async function refreshPublicPricingRules(): Promise<void> {
  try {
    const { getSupabasePublicConfig } = await import('@/lib/supabase/env')
    const config = getSupabasePublicConfig()
    if (!config.isConfigured) return
    const { createSupabaseBrowserClient } = await import(
      '@/lib/supabase/client'
    )
    const client = createSupabaseBrowserClient(config)
    const { data, error } = await client.rpc('get_public_pricing_rules')
    if (!error && data != null) setPublicPricingRules(data)
  } catch {
    // Réseau/RLS indisponible : le cache actuel reste la meilleure estimation.
  }
}

/** Paliers volume actifs au format d'affichage client (remise en %). */
export function getActiveCustomerDiscountTiers(): ReadonlyArray<CustomerDiscountTier> {
  return [
    {
      minUnits: currentRules.tier2Qty,
      discountPercent: currentRules.tier2Discount * 100,
    },
    {
      minUnits: currentRules.tier3Qty,
      discountPercent: currentRules.tier3Discount * 100,
    },
  ]
}
