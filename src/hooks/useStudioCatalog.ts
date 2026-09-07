// Chargement du catalogue Studio (lot 2) : une seule requête partagée par
// tous les composants d'une page, côté navigateur uniquement (pas de SSR :
// la découverte est une expérience interactive, jamais indexée).

import { useEffect, useState } from 'react'

import { loadStudioCatalog, type StudioCatalog } from '@/lib/studio/repository'

export type StudioCatalogStatus = 'loading' | 'ready' | 'error'

export interface StudioCatalogState {
  readonly status: StudioCatalogStatus
  readonly catalog: StudioCatalog | null
  readonly error: string | null
}

let cache: { promise: Promise<StudioCatalog>; value: StudioCatalog | null } | null = null

function ensureCatalog(): Promise<StudioCatalog> {
  if (!cache) {
    const promise = loadStudioCatalog().then((value) => {
      if (cache) cache.value = value
      return value
    })
    cache = { promise, value: null }
    promise.catch(() => {
      cache = null
    })
  }
  return cache.promise
}

/** Réservé aux tests : vide le cache module. */
export function resetStudioCatalogCache(): void {
  cache = null
}

export function useStudioCatalog(): StudioCatalogState {
  const [state, setState] = useState<StudioCatalogState>(() =>
    cache?.value
      ? { status: 'ready', catalog: cache.value, error: null }
      : { status: 'loading', catalog: null, error: null },
  )

  useEffect(() => {
    let cancelled = false
    if (cache?.value) {
      setState({ status: 'ready', catalog: cache.value, error: null })
      return () => {
        cancelled = true
      }
    }
    ensureCatalog()
      .then((catalog) => {
        if (!cancelled) setState({ status: 'ready', catalog, error: null })
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            catalog: null,
            error: error instanceof Error ? error.message : 'unknown_error',
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  return state
}
