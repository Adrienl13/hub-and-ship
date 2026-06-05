import { useEffect } from 'react'

import { useCatalogStore } from '@/stores/catalog.store'

/**
 * Returns the active catalogue. Triggers a DB load on the first mount;
 * subsequent components share the cached store value.
 *
 * Always returns a usable `products` + `currentContainer` — when the DB is
 * unreachable or unconfigured, falls back to the static mock so the UI
 * never renders an empty catalogue.
 */
export function useCatalog() {
  const ensureLoaded = useCatalogStore((state) => state.ensureLoaded)
  const status = useCatalogStore((state) => state.status)
  const source = useCatalogStore((state) => state.source)
  const products = useCatalogStore((state) => state.products)
  const currentContainer = useCatalogStore((state) => state.currentContainer)
  const error = useCatalogStore((state) => state.error)

  useEffect(() => {
    void ensureLoaded()
  }, [ensureLoaded])

  // Keep the catalogue fresh without a full browser reload: refetch whenever
  // the tab regains focus / becomes visible. This is what makes an admin edit
  // show up when switching back to the site tab — the store is otherwise a
  // permanent in-session cache (it only loads once on first mount).
  useEffect(() => {
    function refetchIfVisible() {
      const store = useCatalogStore.getState()
      if (document.visibilityState !== 'visible') return
      if (store.status === 'loading') return
      void store.reload()
    }
    window.addEventListener('focus', refetchIfVisible)
    document.addEventListener('visibilitychange', refetchIfVisible)
    return () => {
      window.removeEventListener('focus', refetchIfVisible)
      document.removeEventListener('visibilitychange', refetchIfVisible)
    }
  }, [])

  return {
    status,
    source,
    products,
    currentContainer,
    error,
    isLoading: status === 'loading' || status === 'idle',
  }
}
