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

// The static mock (PRODUCTS) carries seed prices/names that drift from the
// live DB. It must NEVER be shown to real visitors of a configured site — it
// is only a local-dev convenience when Supabase isn't configured at all. On a
// configured site we show real DB data, an empty list, or the last good data,
// but never fake products.
const INITIAL_CONFIGURED = getSupabasePublicConfig().isConfigured

let inFlight: Promise<void> | null = null

export const useCatalogStore = create<CatalogState>()((set, get) => ({
  status: 'idle',
  source: INITIAL_CONFIGURED ? 'db' : 'fallback',
  // Start empty when configured (real data arrives on first load) instead of
  // flashing the mock products before the DB responds.
  products: INITIAL_CONFIGURED ? [] : PRODUCTS,
  currentContainer: CURRENT_CONTAINER,
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
      // No Supabase at all (local dev): the static mock is the only data.
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
        const db: DbCatalog = await fetchCatalogFromDb(
          client as unknown as Parameters<typeof fetchCatalogFromDb>[0],
        )
        // Real DB data wins — even an empty list. A missing open container
        // falls back only for the capacity default, never for products.
        set({
          status: 'ready',
          source: 'db',
          products: db.products,
          currentContainer: db.currentContainer ?? CURRENT_CONTAINER,
          error: null,
        })
      } catch (error) {
        // Keep the last good data instead of swapping to fake mock products
        // (which would show stale seed prices to real customers).
        console.error('useCatalog: DB fetch failed, keeping last good data', error)
        set({
          status: 'error',
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
