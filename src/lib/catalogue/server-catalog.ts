// Shared catalogue fetch for SSR surfaces (product pages, product sitemap).
// Same resolution order as the client store: DB when Supabase is configured,
// static mock catalogue as the dev fallback. Never throws — SEO surfaces must
// render even when the DB blips (they fall back to the static list).

import { fetchCatalogFromDb } from '@/lib/catalogue/db'
import { PRODUCTS, type Product } from '@/lib/products'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'

export async function loadCatalogProducts(): Promise<ReadonlyArray<Product>> {
  return (await loadLiveCatalogProducts()) ?? PRODUCTS
}

// Variante stricte pour les surfaces marchandes (feed Merchant) : jamais le
// catalogue mock — un feed servi avec des produits fictifs ferait annoncer
// des offres inexistantes à Google/Bing. null ⇒ la route répond 503.
export async function loadLiveCatalogProducts(): Promise<ReadonlyArray<Product> | null> {
  const config = getSupabasePublicConfig()
  if (!config.isConfigured) return null

  try {
    const client = createSupabaseBrowserClient(config)
    const db = await fetchCatalogFromDb(
      client as unknown as Parameters<typeof fetchCatalogFromDb>[0],
    )
    return db.products.length > 0 ? db.products : null
  } catch (error) {
    console.error('server catalog: DB fetch failed', error)
    return null
  }
}
