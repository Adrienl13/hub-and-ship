import { CONTAINER_USABLE_CBM } from '@/lib/container/pricing'
import type { SalesChannel } from '@/lib/supabase/types'

// Minimum de commande distributeur (règle métier 08/2026) : les prix
// distributeur ne sont viables qu'au volume — une commande doit remplir au
// moins un 20' GP utile. La valeur de référence côté serveur vit dans
// pricing_parameters.distributor_min_order_cbm (trigger bloquant à l'insert
// de la réservation) ; ce module porte le miroir d'affichage côté client.

/** Défaut commercial : volume utile d'un 20' GP (= 20' Dry Van). */
export const DISTRIBUTOR_MIN_ORDER_CBM_DEFAULT = CONTAINER_USABLE_CBM['20_dv']

export interface DistributorMinimumStatus {
  /** true quand la règle s'applique au canal ET que le volume est insuffisant. */
  readonly blocked: boolean
  readonly minCbm: number
  readonly missingCbm: number
}

export function getDistributorMinimumStatus({
  channel,
  usedCbm,
  minCbm = DISTRIBUTOR_MIN_ORDER_CBM_DEFAULT,
}: {
  readonly channel: SalesChannel
  readonly usedCbm: number
  /** Seuil actif (m³). null = règle désactivée côté admin. */
  readonly minCbm?: number | null
}): DistributorMinimumStatus {
  const effectiveMin = minCbm ?? 0
  const applies = channel === 'distributeur' && effectiveMin > 0
  const missing = applies ? Math.max(0, effectiveMin - usedCbm) : 0
  return {
    blocked: applies && missing > 0,
    minCbm: effectiveMin,
    missingCbm: Math.round(missing * 100) / 100,
  }
}
