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

  return {
    status,
    source,
    products,
    currentContainer,
    error,
    isLoading: status === 'loading' || status === 'idle',
  }
}
