import type { SalesChannel } from '@/lib/supabase/types'

// Minimum de commande distributeur (règle métier 08/2026) : les prix
// distributeur ne sont viables qu'au volume — une commande doit remplir au
// moins un 20' GP utile (valeur pilotée par l'admin). La source de vérité est
// pricing_parameters.distributor_min_order_cbm : trigger SQL bloquant à
// l'insert de la réservation côté serveur, et get_public_pricing_rules() côté
// client. AUCUNE constante codée en dur ici : un seuil que l'UI ne connaît
// pas (null) ne bloque rien — le trigger reste le seul garde.

export interface DistributorMinimumStatus {
  /** true quand la règle s'applique au canal ET que le volume est insuffisant. */
  readonly blocked: boolean
  readonly minCbm: number
  readonly missingCbm: number
}

export function getDistributorMinimumStatus({
  channel,
  usedCbm,
  minCbm,
}: {
  readonly channel: SalesChannel
  readonly usedCbm: number
  /** Seuil actif (m³) depuis les règles publiques — null = règle désactivée. */
  readonly minCbm: number | null
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
