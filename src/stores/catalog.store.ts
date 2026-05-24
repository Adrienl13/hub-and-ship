// Singleton store that holds the active catalogue (DB-first with a mock
// fallback). Lives outside React so multiple consumers share the same fetch
// rather than each route triggering its own round-trip.
//
// The store starts in `idle` and is bootstrapped lazily — the first
// `ensureLoaded()` call (typically from useCatalog on mount) kicks off the
// network request. Subsequent mounts read the cached value.

import { create } from 'zustand'

import {
  fetchCatalogFromDb,
  type DbCatalog,
  type DbCurrentContainer,
} from '@/lib/catalogue/db'
import { CURRENT_CONTAINER, PRODUCTS, type Product } from '@/lib/products'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'

export type CatalogSource = 'db' | 'fallback'

export interface CatalogState {
  readonly status: 'idle' | 'loading' | 'ready' | 'error'
  readonly source: CatalogSource
  readonly products: ReadonlyArray<Product>
  readonly currentContainer: DbCurrentContainer | typeof CURRENT_CONTAINER
  readonly error: string | null
  readonly ensureLoaded: () => Promise<void>
  readonly reload: () => Promise<void>
}

function pickCatalog(db: DbCatalog | null): {
  source: CatalogSource
  products: ReadonlyArray<Product>
  currentContainer: DbCurrentContainer | typeof CURRENT_CONTAINER
} {
  if (db && db.currentContainer && db.products.length > 0) {
    return {
      source: 'db',
      products: db.products,
      currentContainer: db.currentContainer,
    }
  }
  return {
    source: 'fallback',
    products: PRODUCTS,
    currentContainer: CURRENT_CONTAINER,
  }
}

const FALLBACK = pickCatalog(null)

let inFlight: Promise<void> | null = null

export const useCatalogStore = create<CatalogState>()((set, get) => ({
  status: 'idle',
  source: FALLBACK.source,
  products: FALLBACK.products,
  currentContainer: FALLBACK.currentContainer,
  error: null,
  ensureLoaded: async () => {
    const current = get()
    if (current.status === 'ready' || current.status === 'loading') {
      // Already cached or a fetch is already running — just wait on it.
      if (inFlight) await inFlight
      return
    }
    await get().reload()
  },
  reload: async () => {
    const config = getSupabasePublicConfig()
    if (!config.isConfigured) {
      set({
        status: 'ready',
        source: 'fallback',
        products: PRODUCTS,
        currentContainer: CURRENT_CONTAINER,
        error: null,
      })
      return
    }

    set({ status: 'loading', error: null })
    const promise = (async () => {
      try {
        const client = createSupabaseBrowserClient(config)
        const db = await fetchCatalogFromDb(
          client as unknown as Parameters<typeof fetchCatalogFromDb>[0],
        )
        const pick = pickCatalog(db)
        set({
          status: 'ready',
          source: pick.source,
          products: pick.products,
          currentContainer: pick.currentContainer,
          error: null,
        })
      } catch (error) {
        // On error, fall through to the mock so the UI keeps working —
        // surfacing a broken catalogue would hurt more than degrading to
        // the static one.
        console.error('useCatalog: DB fetch failed, falling back', error)
        set({
          status: 'ready',
          source: 'fallback',
          products: PRODUCTS,
          currentContainer: CURRENT_CONTAINER,
          error: error instanceof Error ? error.message : 'unknown_error',
        })
      } finally {
        inFlight = null
      }
    })()
    inFlight = promise
    await promise
  },
}))
