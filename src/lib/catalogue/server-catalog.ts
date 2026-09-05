// Shared catalogue fetch for SSR surfaces (product pages, product sitemap).
// Same resolution order as the client store: DB when Supabase is configured,
// static mock catalogue as the dev fallback. Never throws — SEO surfaces must
// render even when the DB blips.

import { fetchCatalogFromDb } from '@/lib/catalogue/db'
import { PRODUCTS, type Product } from '@/lib/products'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'

// Sur un site configuré, JAMAIS le catalogue mock : une panne DB donne une
// liste vide (fiche → 404, page catégorie vide) plutôt que des produits
// fictifs servis à de vrais visiteurs et aux crawlers (cache 1 h).
export async function loadCatalogProducts(): Promise<ReadonlyArray<Product>> {
  if (!getSupabasePublicConfig().isConfigured) return PRODUCTS
  return (await loadLiveCatalogProducts()) ?? []
}

// Variante stricte pour les surfaces marchandes (feed Merchant, sitemap) :
// null ⇒ la route répond 503 (retenter plus tard) au lieu d'annoncer des
// offres inexistantes à Google/Bing.
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

/** Fiche annonçable aux moteurs : une photo principale est indispensable
 *  (Merchant refuse un item sans image, Google ignore un Product sans photo). */
export function hasPublicImage(product: Product): boolean {
  return Boolean(product.mainImageUrl)
}
