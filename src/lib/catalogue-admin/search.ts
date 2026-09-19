// Retrouver une fiche parmi deux cents, en tapant ce qu'on a en tête.
//
// La recherche du catalogue admin comparait la requête brute au nom, au SKU
// et à la description concaténés. Trois choses la rendaient inutilisable sur
// ce catalogue-là :
//
//   1. les accents. Les fiches s'appellent « Piètement de table VENTOUX »,
//      « Chaise de terrasse ATHÈNES » : taper « pietement » ne trouvait rien,
//      et personne ne compose un accent dans un champ de recherche ;
//   2. l'ordre des mots. Les noms sont longs et composés — « Salon de terrasse
//      cordage MENERBES - cordage bordeaux, coussins rose poudré ». Chercher
//      « menerbes salon » ne rendait rien, parce que la sous-chaîne exacte
//      n'existe nulle part ;
//   3. le classement. Taper un SKU exact remontait la fiche quelque part au
//      milieu de la liste, au même rang qu'une fiche dont la description
//      mentionne ce SKU en passant.
//
// On normalise donc (minuscules sans accents), on coupe la requête en mots
// dont CHACUN doit se retrouver quelque part dans la fiche, et on classe par
// ce qui a été touché — le SKU d'abord, la description en dernier.

import type { Product } from '@/lib/products'

/** Minuscules sans accents : « Piètement » et « pietement » se rejoignent. */
export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/** Champs d'une fiche sur lesquels porte la recherche. */
export interface SearchableProduct {
  readonly sku: string
  readonly name: string
  readonly description: string
  readonly category: Product['category']
}

/**
 * Score d'une fiche pour une requête, ou `null` si elle ne correspond pas.
 * Plus le score est HAUT, plus la fiche est pertinente.
 *
 * Chaque mot de la requête doit être trouvé quelque part : « menerbes rose »
 * ne remonte que la fiche qui porte les deux, et l'ordre est indifférent.
 * Le score retenu pour un mot est celui du champ le plus fort qu'il touche,
 * et le score de la fiche est la somme — deux mots dans le SKU valent mieux
 * qu'un seul.
 */
export function scoreProductMatch(
  product: SearchableProduct,
  query: string,
  categoryLabel: string,
): number | null {
  const terms = normalizeSearchText(query).split(/\s+/).filter(Boolean)
  if (terms.length === 0) return 0

  const sku = normalizeSearchText(product.sku)
  const name = normalizeSearchText(product.name)
  const description = normalizeSearchText(product.description)
  const category = normalizeSearchText(categoryLabel)

  let total = 0
  for (const term of terms) {
    // Un SKU tapé en entier est une désignation, pas un mot-clé : il passe
    // devant tout le reste. Un début de SKU (« rop-0 ») suit.
    const score =
      sku === term
        ? 1000
        : sku.startsWith(term)
          ? 500
          : sku.includes(term)
            ? 200
            : // Un mot entier du nom (« MENERBES ») vaut mieux qu'un fragment
              // (« ener »), qui reste utile pour rattraper une faute de frappe.
              wordMatch(name, term)
              ? 100
              : name.includes(term)
                ? 50
                : category.includes(term)
                  ? 20
                  : description.includes(term)
                    ? 10
                    : 0
    // Un seul mot introuvable suffit à écarter la fiche : c'est ce qui rend
    // la recherche utile à mesure qu'on précise, au lieu de l'élargir.
    if (score === 0) return null
    total += score
  }
  return total
}

/** Le terme apparaît-il comme mot entier (et non au milieu d'un autre) ? */
function wordMatch(haystack: string, term: string): boolean {
  let from = 0
  for (;;) {
    const at = haystack.indexOf(term, from)
    if (at < 0) return false
    const before = at === 0 ? ' ' : haystack[at - 1]!
    const after = haystack[at + term.length] ?? ' '
    if (!/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after)) return true
    from = at + 1
  }
}

/**
 * Trie les fiches correspondantes, la plus pertinente en tête. À score égal
 * l'ordre d'entrée est conservé : la liste ne se réarrange pas sous les yeux
 * pour des fiches également pertinentes.
 */
export function sortByRelevance<T>(
  rows: ReadonlyArray<T>,
  scoreOf: (row: T) => number,
): T[] {
  return rows
    .map((row, index) => ({ row, index, score: scoreOf(row) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.row)
}
