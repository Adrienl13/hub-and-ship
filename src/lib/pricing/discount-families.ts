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
 * Grille PUBLIÉE — la seule source des chiffres écrits en toutes lettres sur
 * les pages publiques (FAQ, fiches produit, pages SEO, catalogue).
 *
 * Pourquoi une constante plutôt que les règles actives : ces pages sont
 * rendues côté serveur ou par les modèles « public-design », sans hydrater
 * `get_public_pricing_rules()`. Elles afficheraient donc la grille par défaut
 * — c'est-à-dire l'ancienne — et annonceraient au visiteur une remise qui
 * n'est plus celle qu'il obtiendra.
 *
 * ELLE DOIT RESTER IDENTIQUE À LA GRILLE EN BASE
 * (`pricing_parameters.volume_discount_families`, migration 50). Un test
 * d'intégration compare les deux et tombe si l'une bouge sans l'autre.
 */
export const PUBLISHED_VOLUME_TIERS: Record<
  DiscountFamily,
  ReadonlyArray<{ readonly minUnits: number; readonly discountPercent: number }>
> = {
  assises: [
    { minUnits: 100, discountPercent: 6 },
    { minUnits: 150, discountPercent: 10 },
  ],
  tables: [
    { minUnits: 80, discountPercent: 5 },
    { minUnits: 160, discountPercent: 8 },
  ],
  salons: [
    { minUnits: 10, discountPercent: 6 },
    { minUnits: 20, discountPercent: 10 },
  ],
  autres: [
    { minUnits: 100, discountPercent: 6 },
    { minUnits: 150, discountPercent: 10 },
  ],
}

/** « −6 % dès 100 pièces, −10 % dès 150 ». */
export function describeFamilyTiers(family: DiscountFamily): string {
  const tiers = PUBLISHED_VOLUME_TIERS[family]
  return tiers
    .map((tier, index) =>
      index === 0
        ? `−${tier.discountPercent} % dès ${tier.minUnits} pièces`
        : `−${tier.discountPercent} % dès ${tier.minUnits}`,
    )
    .join(', ')
}

/** « Salons de jardin : −6 % dès 10 pièces, −10 % dès 20 ». */
export function describeFamilyTiersWithLabel(family: DiscountFamily): string {
  return `${DISCOUNT_FAMILY_LABEL[family]} : ${describeFamilyTiers(family)}`
}

/** Les trois familles du catalogue, dans l'ordre d'affichage public. */
export const PUBLIC_DISCOUNT_FAMILIES: ReadonlyArray<DiscountFamily> = [
  'assises',
  'tables',
  'salons',
]

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
