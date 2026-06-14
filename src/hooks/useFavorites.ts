import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

import { useAuth } from '@/hooks/useAuth'
import {
  addFavorite,
  fetchMyFavoriteIds,
  removeFavorite,
  type FavoritesClient,
} from '@/lib/favorites/repository'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'

export interface UseFavoritesResult {
  readonly ids: ReadonlySet<string>
  readonly isFavorite: (productId: string) => boolean
  readonly toggle: (productId: string) => void
  readonly isAuthenticated: boolean
  readonly loading: boolean
}

/**
 * Loads the signed-in user's favourite product ids and exposes an optimistic
 * toggle. Anonymous users get a gentle "sign in to save" prompt.
 */
export function useFavorites(): UseFavoritesResult {
  const { status, user } = useAuth()
  const [ids, setIds] = useState<ReadonlySet<string>>(new Set())
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (status !== 'authenticated' || !user) {
      setIds(new Set())
      return
    }
    const config = getSupabasePublicConfig()
    if (!config.isConfigured) return
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const client = createSupabaseBrowserClient(
          config,
        ) as unknown as FavoritesClient
        const list = await fetchMyFavoriteIds(client, user.id)
        if (!cancelled) setIds(new Set(list))
      } catch {
        // non-blocking
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [status, user])

  const toggle = useCallback(
    (productId: string) => {
      if (status !== 'authenticated' || !user) {
        toast.message('Connectez-vous pour enregistrer vos favoris', {
          description: 'Vos coups de cœur vous suivent dans votre espace.',
        })
        return
      }
      const config = getSupabasePublicConfig()
      if (!config.isConfigured) return
      const client = createSupabaseBrowserClient(
        config,
      ) as unknown as FavoritesClient
      const wasFavorite = ids.has(productId)

      // Optimistic update.
      setIds((prev) => {
        const next = new Set(prev)
        if (wasFavorite) next.delete(productId)
        else next.add(productId)
        return next
      })

      void (async () => {
        try {
          if (wasFavorite) await removeFavorite(client, user.id, productId)
          else await addFavorite(client, user.id, productId)
        } catch {
          // Revert on failure.
          setIds((prev) => {
            const next = new Set(prev)
            if (wasFavorite) next.add(productId)
            else next.delete(productId)
            return next
          })
          toast.error('Favori non enregistré, réessayez.')
        }
      })()
    },
    [ids, status, user],
  )

  return {
    ids,
    isFavorite: (productId: string) => ids.has(productId),
    toggle,
    isAuthenticated: status === 'authenticated',
    loading,
  }
}
