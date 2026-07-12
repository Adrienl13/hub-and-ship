// Registre produits partagé — permet au store panier (hors React) de résoudre
// N'IMPORTE QUEL produit du catalogue live, pas seulement les 6 produits de
// démo du mock. Le catalog store l'alimente à chaque chargement ; `setQty`
// s'appuie dessus, avec le mock `PRODUCTS` en filet (dev local sans DB).
//
// Module neutre (aucun import de store) pour éviter tout cycle : cart.store et
// catalog.store en dépendent tous les deux.

import { PRODUCTS, type Product } from '@/lib/products'

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
 * Résout un produit par id : catalogue live d'abord, mock en secours. Le mock
 * ne couvre que p1…p6, d'où le bug historique où tout produit DB (ex.
 * `bistro-bis-001`) ou créé par l'admin était introuvable → non ajoutable.
 */
export function resolveCatalogueProduct(
  productId: string,
): Product | undefined {
  return registry.get(productId) ?? PRODUCTS.find((p) => p.id === productId)
}

/** Réservé aux tests. */
export function clearCatalogueRegistry(): void {
  registry.clear()
}
