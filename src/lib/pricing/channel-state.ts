// Canal de vente actif côté client — même pattern module que public-rules :
// hydraté par useChannel() (RPC current_channel), défaut 'direct' (anonymes).
//
// Consommé par calculateOrder : la remise volume publique ne s'applique QU'AU
// canal direct, exactement comme le RPC de réservation v5 côté serveur. Sans
// cette synchronisation, le panier d'un revendeur afficherait une remise que
// le serveur refuserait (« derived monetary fields are inconsistent »).

import type { SalesChannel } from '@/lib/supabase/types'

let activeChannel: SalesChannel = 'direct'

export function setActiveSalesChannel(channel: SalesChannel): void {
  activeChannel = channel
}

export function getActiveSalesChannel(): SalesChannel {
  return activeChannel
}

/** Réservé aux tests. */
export function resetActiveSalesChannel(): void {
  activeChannel = 'direct'
}
