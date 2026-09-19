// Ce qui manque encore sur une fiche, et pourquoi ça compte.
//
// Le relevé du 18/09 comptait « 17 fiches sans poids, 10 sans dimensions ».
// Deux nombres exacts, et inexploitables : pour savoir LESQUELLES, il fallait
// requêter la base. La checklist en a dressé la liste à la main, qui sera
// périmée à la première saisie.
//
// Ces manques ne sont pas cosmétiques :
//   - sans poids, le devis annonce « 10 chaises de 0 kg » et le transporteur
//     ne peut pas chiffrer ;
//   - sans dimensions, la fiche n'affiche aucune cote — l'acheteur d'une
//     terrasse ne peut pas vérifier que la chaise passe entre deux tables ;
//   - un salon sans composition annonce les cotes de son canapé pour quatre
//     meubles (migration 53) ;
//   - sans photo principale, la carte catalogue est un cadre vide.
//
// Le catalogue admin sait déjà tout cela, fiche par fiche. Il suffit de le
// dire à l'écran, et de pouvoir filtrer dessus.

import type { AdminProduct } from './types'

export type ProductGap = 'photo' | 'dimensions' | 'weight' | 'composition'

export const PRODUCT_GAP_LABEL: Record<ProductGap, string> = {
  photo: 'Photo',
  dimensions: 'Dimensions',
  weight: 'Poids',
  composition: 'Composition',
}

/** Ce que l'admin lit sur la ligne : « Manque : poids, dimensions ». */
export const PRODUCT_GAP_SHORT: Record<ProductGap, string> = {
  photo: 'photo',
  dimensions: 'dimensions',
  weight: 'poids',
  composition: 'composition',
}

type Completable = Pick<
  AdminProduct,
  'category' | 'composition' | 'dimensions' | 'mainImageUrl' | 'tableShape' | 'weightKg'
>

/**
 * Les manques d'une fiche, dans l'ordre où ils sautent aux yeux.
 *
 * Une fiche complète rend un tableau vide — c'est le cas normal, et c'est ce
 * qui permet de compter les autres.
 */
export function productGaps(product: Completable): ReadonlyArray<ProductGap> {
  const gaps: ProductGap[] = []

  if (!product.mainImageUrl.trim()) gaps.push('photo')

  // Un ensemble n'a pas de cotes propres : ce sont celles de ses pièces qui
  // font foi, et la composition est exigée à part. Réclamer un L × l × H sur
  // un salon reviendrait à redemander ce qui a justement été jugé trompeur.
  const hasComposition = (product.composition?.length ?? 0) > 0
  if (!hasComposition) {
    const { l, w, h } = product.dimensions
    // Plateau rond : la largeur EST le diamètre, une seule cote est saisie.
    const missing =
      product.tableShape === 'round' ? l <= 0 || h <= 0 : l <= 0 || w <= 0 || h <= 0
    if (missing) gaps.push('dimensions')
  }

  if (product.weightKg <= 0) gaps.push('weight')

  // Les salons sont vendus comme des ensembles : sans composition, leur fiche
  // annonce les cotes d'un seul meuble sur quatre.
  if (product.category === 'lounge' && !hasComposition) gaps.push('composition')

  return gaps
}

export function isProductComplete(product: Completable): boolean {
  return productGaps(product).length === 0
}

/** Les quatre manques, dans l'ordre d'affichage des puces de filtre. */
export const PRODUCT_GAPS: ReadonlyArray<ProductGap> = [
  'photo',
  'dimensions',
  'weight',
  'composition',
]

/** Clé de la puce « À compléter » : 'any' = au moins un manque. */
export type GapFilter = 'all' | 'any' | ProductGap

export interface GapTally {
  /** Manques par fiche, pour l'étiquette « Manque : … » de chaque ligne. */
  readonly byProduct: ReadonlyMap<string, ReadonlyArray<ProductGap>>
  /** Compteur affiché sur chaque puce. */
  readonly counts: Readonly<Record<GapFilter, number>>
}

/**
 * Compte les manques du catalogue en UN seul parcours.
 *
 * Une fiche à laquelle il manque le poids ET les dimensions compte dans les
 * deux puces, mais une seule fois dans « Incomplètes » — sinon le total
 * dépasserait le nombre de fiches et ne voudrait plus rien dire.
 */
export function tallyGaps(
  rows: ReadonlyArray<Completable & { readonly id: string }>,
): GapTally {
  const byProduct = new Map<string, ReadonlyArray<ProductGap>>()
  const counts: Record<GapFilter, number> = {
    all: rows.length,
    any: 0,
    photo: 0,
    dimensions: 0,
    weight: 0,
    composition: 0,
  }
  for (const row of rows) {
    const gaps = productGaps(row)
    byProduct.set(row.id, gaps)
    if (gaps.length > 0) counts.any += 1
    for (const gap of gaps) counts[gap] += 1
  }
  return { byProduct, counts }
}

/** La fiche passe-t-elle la puce sélectionnée ? */
export function matchesGapFilter(
  gaps: ReadonlyArray<ProductGap>,
  filter: GapFilter,
): boolean {
  if (filter === 'all') return true
  if (filter === 'any') return gaps.length > 0
  return gaps.includes(filter)
}
