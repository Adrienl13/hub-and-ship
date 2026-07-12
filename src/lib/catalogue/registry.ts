// Registre produits partagé — permet au store panier (hors React) de résoudre
// N'IMPORTE QUEL produit du catalogue live, pas seulement les 6 produits de
// démo du mock. Le catalog store l'alimente à chaque chargement ; `setQty`
// s'appuie dessus, avec le mock `PRODUCTS` en filet (dev local sans DB).
//
// Module neutre (aucun import de store) pour éviter tout cycle : cart.store et
// catalog.store en dépendent tous les deux.

import { PRODUCTS, type Product } from '@/lib/products'
import { getSupabasePublicConfig } from '@/lib/supabase/env'

const registry = new Map<string, Product>()

/** Remplace le registre par le catalogue live (appelé au chargement du store). */
export function registerCatalogueProducts(
  products: ReadonlyArray<Product>,
): void {
  registry.clear()
  for (const product of products) {
    registry.set(product.id, product)
  }
}

/**
 * Résout un produit par id : catalogue live d'abord ; le mock ne sert de
 * secours QUE sur un site non configuré (dev local). Sur un site configuré,
 * un id absent du registre est absent tout court — sinon un produit désactivé
 * par l'admin ressusciterait avec ses prix seed périmés (les ids mock p1…p6
 * sont aussi de vrais ids DB).
 */
export function resolveCatalogueProduct(
  productId: string,
): Product | undefined {
  const live = registry.get(productId)
  if (live) return live
  if (getSupabasePublicConfig().isConfigured && registry.size > 0) {
    return undefined
  }
  return PRODUCTS.find((p) => p.id === productId)
}

/** Réservé aux tests. */
export function clearCatalogueRegistry(): void {
  registry.clear()
}
