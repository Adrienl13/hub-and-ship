// Composition d'une table : un piètement (table_base) + un plateau
// (table_top), commandés en quantités égales. Logique pure, testée ; le
// dialogue TableComposerDialog s'appuie dessus.
//
// Règles métier (décision 09/2026) :
// - un piètement liste les formes de plateau qu'il accepte
//   (compatibleTopShapes) ; vide = tous les plateaux ;
// - certains coloris de plateau imposent un minimum de commande propre
//   (variant.minOrderUnits) : la quantité de l'ensemble démarre au plus
//   contraignant des deux minimums.

import {
  isPubliclyListed,
  type DesignVariant,
  type Product,
  type TableTopShape,
} from '@/lib/products'
import { getQuantityRule, type QuantityRule } from '@/lib/quantity'

export const TABLE_TOP_SHAPE_LABEL: Record<TableTopShape, string> = {
  rectangular: 'Rectangulaire / carré',
  round: 'Rond',
}

export function isTableBase(product: Product): boolean {
  return product.category === 'table_base'
}

export function isTableTop(product: Product): boolean {
  return product.category === 'table_top'
}

/** Un produit qui se compose (piètement ou plateau). */
export function isComposable(product: Product): boolean {
  return isTableBase(product) || isTableTop(product)
}

export function topShapeOf(top: Product): TableTopShape {
  return top.tableShape === 'round' ? 'round' : 'rectangular'
}

/** Le plateau convient-il au piètement ? */
export function isCompatibleTop(base: Product, top: Product): boolean {
  if (!isTableTop(top)) return false
  const accepted = base.compatibleTopShapes ?? []
  if (accepted.length === 0) return true
  return accepted.includes(topShapeOf(top))
}

// Les produits « sur demande » (plateaux découpés pour un projet) ne sont
// jamais proposés dans les listes : ils arrivent par lien direct.
export function compatibleTops(
  base: Product,
  products: ReadonlyArray<Product>,
): Product[] {
  return products.filter(
    (candidate) =>
      isPubliclyListed(candidate) && isCompatibleTop(base, candidate),
  )
}

export function compatibleBases(
  top: Product,
  products: ReadonlyArray<Product>,
): Product[] {
  return products.filter(
    (candidate) =>
      isPubliclyListed(candidate) &&
      isTableBase(candidate) &&
      isCompatibleTop(candidate, top),
  )
}

/** Règle de quantité de l'ensemble : le minimum le plus exigeant des deux
 *  lignes, ajout à l'unité ensuite (les deux lignes restent égales). */
export function composedQuantityRule({
  base,
  baseVariant,
  top,
  topVariant,
}: {
  readonly base: Product
  readonly baseVariant: DesignVariant
  readonly top: Product
  readonly topVariant: DesignVariant
}): QuantityRule {
  const baseRule = getQuantityRule(base, baseVariant)
  const topRule = getQuantityRule(top, topVariant)
  const minimum = Math.max(baseRule.minimum, topRule.minimum, 1)
  const constrainedByTop = topRule.minimum > baseRule.minimum
  return {
    minimum,
    step: 1,
    label:
      minimum > 1
        ? constrainedByTop
          ? `Min. ${minimum} (coloris du plateau), puis à l'unité`
          : `Min. ${minimum}, puis à l'unité`
        : "Ajout à l'unité",
  }
}

/** Les deux lignes de panier à écrire pour N tables composées. */
export function composedCartLines({
  base,
  baseVariant,
  top,
  topVariant,
  quantity,
}: {
  readonly base: Product
  readonly baseVariant: DesignVariant
  readonly top: Product
  readonly topVariant: DesignVariant
  readonly quantity: number
}): ReadonlyArray<{
  readonly productId: string
  readonly variantId: string
  readonly quantity: number
}> {
  const rule = composedQuantityRule({ base, baseVariant, top, topVariant })
  const qty = Math.max(rule.minimum, Math.trunc(quantity))
  return [
    { productId: base.id, variantId: baseVariant.id, quantity: qty },
    { productId: top.id, variantId: topVariant.id, quantity: qty },
  ]
}
