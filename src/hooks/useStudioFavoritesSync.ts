// Miroir des favoris Studio vers product_favorites (lot 2) pour un
// utilisateur CONNECTÉ, via les fonctions existantes du repository de
// favoris. Un anonyme garde ses favoris locaux (store) sans aucune invite.
// Aucun échec ici ne bloque le parcours.

import { useCallback } from 'react'

import { enqueueStudioFavorite } from '@/lib/studio/favorites-sync'
import { useAuth } from '@/hooks/useAuth'
import { addFavorite, removeFavorite, type FavoritesClient } from '@/lib/favorites/repository'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'

export interface StudioFavoritesSync {
  readonly isAuthenticated: boolean
  /** Reflète (ajout ou retrait) un favori Studio côté compte, si connecté. */
  readonly mirror: (productId: string, favorite: boolean) => void
}

export function useStudioFavoritesSync(): StudioFavoritesSync {
  const { status, user } = useAuth()
  const isAuthenticated = status === 'authenticated' && Boolean(user)

  const mirror = useCallback(
    (productId: string, favorite: boolean) => {
      if (!isAuthenticated || !user) return
      const config = getSupabasePublicConfig()
      if (!config.isConfigured) return
      const client = createSupabaseBrowserClient(config) as unknown as FavoritesClient
      void enqueueStudioFavorite(user.id, productId, () =>
        favorite ? addFavorite(client, user.id, productId) : removeFavorite(client, user.id, productId),
      )
    },
    [isAuthenticated, user],
  )

  return { isAuthenticated, mirror }
}
