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
import {
  DISCOUNT_FAMILIES,
  MAX_VOLUME_DISCOUNT_PERCENT,
  type DiscountFamily,
} from './discount-families'

/** Grille de paliers par famille, ou `null` = grille unique historique. */
export type VolumeFamilyTiers = Readonly<
  Record<DiscountFamily, ReadonlyArray<CustomerDiscountTier>>
>

export interface PublicPricingRules {
  readonly tier2Qty: number
  /** Remise en fraction (0.06 = 6 %). */
  readonly tier2Discount: number
  readonly tier3Qty: number
  readonly tier3Discount: number
  /**
   * Paliers volume PAR FAMILLE (assises, tables, salons, autres). `null` tant
   * que rien n'est configuré : on applique alors la grille unique ci-dessus,
   * sur le nombre total de pièces du panier — comportement historique, à
   * l'identique. Le RPC de réservation lit la même colonne et bascule sur la
   * même condition : les deux côtés changent de régime ensemble.
   */
  readonly volumeFamilies: VolumeFamilyTiers | null
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
  volumeFamilies: null,
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
 * Lit la grille par famille. Tout ou rien : une grille à moitié valide est
 * refusée en bloc et on garde la grille unique, plutôt que d'appliquer une
 * remise à une famille et pas à l'autre sans que personne ne le voie.
 *
 * Refusé : une famille manquante, une liste vide, un palier dont le seuil ou
 * la remise ne progresse pas, une remise négative ou au-dessus du plafond de
 * sécurité (règle d'or du multi-canal).
 */
export function parseVolumeFamilyTiers(raw: unknown): VolumeFamilyTiers | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const record = raw as Record<string, unknown>
  const parsed: Partial<Record<DiscountFamily, CustomerDiscountTier[]>> = {}

  for (const family of DISCOUNT_FAMILIES) {
    const list = record[family]
    if (!Array.isArray(list) || list.length === 0) return null

    const tiers: CustomerDiscountTier[] = []
    for (const entry of list) {
      if (typeof entry !== 'object' || entry === null) return null
      const row = entry as Record<string, unknown>
      const minUnits = Math.round(finiteOr(row.min_units, Number.NaN))
      // La remise est stockée en fraction (0.06), affichée en pourcentage.
      const discount = finiteOr(row.discount, Number.NaN)
      if (!Number.isFinite(minUnits) || !Number.isFinite(discount)) return null
      if (minUnits < 1) return null
      if (discount <= 0 || discount * 100 > MAX_VOLUME_DISCOUNT_PERCENT) {
        return null
      }
      const previous = tiers[tiers.length - 1]
      if (
        previous &&
        (minUnits <= previous.minUnits ||
          discount * 100 <= previous.discountPercent)
      ) {
        return null
      }
      tiers.push({
        minUnits,
        discountPercent: Math.round(discount * 10000) / 100,
      })
    }
    parsed[family] = tiers
  }

  return parsed as VolumeFamilyTiers
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
    volumeFamilies: parseVolumeFamilyTiers(record.volume_discount_families),
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

/**
 * Paliers actifs d'une famille. Tant qu'aucune grille par famille n'est
 * configurée, toutes les familles partagent la grille unique historique — et
 * le comptage reste global (cf. `calculateOrder`).
 */
export function getFamilyDiscountTiers(
  family: DiscountFamily,
): ReadonlyArray<CustomerDiscountTier> {
  return currentRules.volumeFamilies?.[family] ?? getActiveCustomerDiscountTiers()
}

/** `null` = régime historique (grille unique, comptage global). */
export function getVolumeFamilyTiers(): VolumeFamilyTiers | null {
  return currentRules.volumeFamilies
}

/**
 * Retour au format stocké (remise en fraction). Utilisé quand l'admin
 * restaure une ancienne version de paramètres : sans ça, la restauration
 * perdrait la grille de cette version-là.
 */
export function toVolumeFamiliesJson(
  tiers: VolumeFamilyTiers | null,
): Record<
  string,
  ReadonlyArray<{ readonly min_units: number; readonly discount: number }>
> | null {
  if (!tiers) return null
  const json: Record<
    string,
    ReadonlyArray<{ readonly min_units: number; readonly discount: number }>
  > = {}
  for (const family of DISCOUNT_FAMILIES) {
    json[family] = tiers[family].map((tier) => ({
      min_units: tier.minUnits,
      discount: Math.round(tier.discountPercent * 100) / 10000,
    }))
  }
  return json
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
