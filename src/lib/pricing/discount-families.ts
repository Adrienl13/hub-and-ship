// Familles de remise volume.
//
// Une chaise vaut 82 € en moyenne, un salon de jardin 1 367 € : exiger le même
// nombre de pièces pour déclencher la remise n'a aucun sens commercial. Cent
// chaises, c'est un projet de 8 000 € ; cent salons, 137 000 € — le palier
// serait inatteignable, et le client qui commande dix salons ne serait jamais
// récompensé de son volume. Les paliers sont donc définis PAR FAMILLE, et
// chaque famille est comptée séparément dans le panier.
//
// Le découpage suit la logique d'achat et de production, pas le libellé du
// catalogue : un plateau et un piètement partent du même atelier et se
// commandent ensemble, ils comptent donc dans la même famille « tables ».

import type { ProductCategory } from '@/lib/products'

export type DiscountFamily = 'assises' | 'tables' | 'salons' | 'autres'

export const DISCOUNT_FAMILIES: ReadonlyArray<DiscountFamily> = [
  'assises',
  'tables',
  'salons',
  'autres',
]

export const DISCOUNT_FAMILY_LABEL: Record<DiscountFamily, string> = {
  assises: 'Assises',
  tables: 'Tables',
  salons: 'Salons de jardin',
  autres: 'Autres pièces',
}

/** Libellé au singulier de l'unité comptée, pour les messages de progression. */
export const DISCOUNT_FAMILY_UNIT: Record<DiscountFamily, string> = {
  assises: 'assise',
  tables: 'pièce',
  salons: 'salon',
  autres: 'pièce',
}

// Exhaustif sur ProductCategory : ajouter une catégorie sans lui donner de
// famille ne compile pas.
const CATEGORY_FAMILY: Record<ProductCategory, DiscountFamily> = {
  chair: 'assises',
  armchair: 'assises',
  bench: 'assises',
  table: 'tables',
  table_base: 'tables',
  table_top: 'tables',
  lounge: 'salons',
}

/**
 * Famille d'un produit. Le paramètre est un `string` et non un
 * `ProductCategory` à dessein : les fiches viennent de la base, une catégorie
 * ajoutée en production avant que le type ne soit mis à jour ne doit pas
 * planter le panier. Elle tombe alors dans « autres », dont la grille est la
 * grille historique — jamais plus généreuse par accident.
 */
export function resolveDiscountFamily(category: string): DiscountFamily {
  return CATEGORY_FAMILY[category as ProductCategory] ?? 'autres'
}

/**
 * Plafond de sécurité d'une remise volume configurable, en %.
 *
 * Au-delà, un client direct paierait moins cher qu'un revendeur : c'est la
 * « règle d'or » du multi-canal, l'invariant que rien ne doit franchir. Le
 * revendeur paie 73,68 % du prix de base, la marge disponible est donc de
 * 26,32 % — on s'arrête à 25 %. Une saisie aberrante (0,9 au lieu de 0,09)
 * est refusée en bloc, côté client comme côté serveur.
 *
 * Un test vérifie que cette constante reste sous les coefficients canal.
 */
export const MAX_VOLUME_DISCOUNT_PERCENT = 25

/** Compte les pièces de chaque famille présente dans une liste de lignes. */
export function countUnitsByFamily(
  lines: ReadonlyArray<{ readonly category: string; readonly quantity: number }>,
): Record<DiscountFamily, number> {
  const counts: Record<DiscountFamily, number> = {
    assises: 0,
    tables: 0,
    salons: 0,
    autres: 0,
  }
  for (const line of lines) {
    counts[resolveDiscountFamily(line.category)] += Math.max(
      0,
      Math.trunc(line.quantity),
    )
  }
  return counts
}
