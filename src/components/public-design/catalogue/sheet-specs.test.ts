// @vitest-environment node
//
// Le tiroir du catalogue affichait « Usage » et « Empilable ». Faute d'une
// caractéristique nommée ainsi sur les fiches, les deux lignes répétaient
// « À préciser » sur presque tout le catalogue — deux lignes qui ne
// disaient rien, à l'endroit le plus lu de la fiche.
//
// Elles sont remplacées par les cotes et le poids : ce que l'acheteur
// vérifie avant d'engager cinquante pièces.

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { adaptCatalogue } from './data.js'

const TEMPLATE = readFileSync(
  'src/components/public-design/catalogue/template.html',
  'utf8',
)
const READ = readFileSync(
  'src/components/public-design/catalogue/read.js',
  'utf8',
)

function catalogue(overrides: Record<string, unknown> = {}) {
  const [first] = adaptCatalogue({
    products: [
      {
        id: 'p1',
        sku: 'BIS-001',
        name: 'Chaise de bistrot RIVOLI - chevron blanc / gris',
        category: 'chair',
        base_price_ht: 80,
        moq_units: 50,
        main_image_url: '/a.webp',
        gallery_urls: [],
        features: [],
        visibility: 'public',
        sort_order: 1,
        dim_length_cm: 48,
        dim_width_cm: 56,
        dim_height_cm: 86,
        weight_kg: 4.3,
        table_shape: null,
        composition: null,
        ...overrides,
      },
    ],
    variants: [],
    stock: [],
  })
  if (!first) throw new Error('adaptCatalogue n’a rendu aucune fiche')
  return first
}

describe('cotes et poids du tiroir catalogue', () => {
  it('affiche les cotes et le poids d’une fiche complète', () => {
    const p = catalogue()
    expect(p.dimensions).toBe('48 × 56 × 86 cm')
    expect(p.weight).toBe('4.3 kg')
  })

  it('n’écrit pas « 4.0 kg » pour un poids entier', () => {
    expect(catalogue({ weight_kg: 5 }).weight).toBe('5 kg')
  })

  it('annonce le nombre de meubles d’un ensemble, pas les cotes d’un seul', () => {
    // Les 15 fiches lounge portent 180 × 78 × 78 : les cotes du canapé.
    // Le tiroir doit dire la même chose que la fiche produit.
    const p = catalogue({
      category: 'lounge',
      dim_length_cm: 180,
      dim_width_cm: 78,
      dim_height_cm: 78,
      composition: [
        { label: 'Canapé 3 places', qty: 1, l: 180, w: 80, h: 70 },
        { label: 'Fauteuil', qty: 2, l: 70, w: 70, h: 70 },
        { label: 'Table basse', qty: 1, l: 90, w: 50, h: 40 },
      ],
    })
    expect(p.dimensions).toBe('Ensemble 4 pièces')
  })

  it('rend le diamètre d’un plateau rond', () => {
    const p = catalogue({
      category: 'table_top',
      table_shape: 'round',
      dim_length_cm: 80,
      dim_width_cm: 80,
      dim_height_cm: 4,
    })
    expect(p.dimensions).toBe('Ø 80 × H 4 cm')
  })

  it('dit « À préciser » plutôt que de laisser une ligne vide', () => {
    // Une ligne vide se lirait comme un bug d'affichage, alors que c'est
    // une fiche à compléter — 7 fiches actives sont dans ce cas.
    const p = catalogue({
      dim_length_cm: 0,
      dim_width_cm: 0,
      dim_height_cm: 0,
      weight_kg: 0,
    })
    expect(p.dimensions).toBe('À préciser')
    expect(p.weight).toBe('À préciser')
  })

  it('ignore une composition à moitié saisie', () => {
    // Tout ou rien : on retombe sur les cotes plutôt que d'annoncer un
    // nombre de pièces tiré d'une donnée incomplète.
    const p = catalogue({
      composition: [{ label: 'Canapé', qty: 1, l: 180, w: 80 }],
    })
    expect(p.dimensions).toBe('48 × 56 × 86 cm')
  })

  it('le gabarit lit bien ces deux champs, et plus Usage ni Empilable', () => {
    expect(TEMPLATE).toContain('{{ sheet.dimensions }}')
    expect(TEMPLATE).toContain('{{ sheet.weight }}')
    expect(TEMPLATE).not.toContain('{{ sheet.usage }}')
    expect(TEMPLATE).not.toContain('{{ sheet.stack }}')
  })

  it('le flux public demande les colonnes nécessaires', () => {
    // Sans elles, les deux lignes afficheraient « À préciser » partout —
    // et personne ne saurait que c'est la requête qui est incomplète.
    for (const col of [
      'dim_length_cm',
      'dim_width_cm',
      'dim_height_cm',
      'weight_kg',
      'table_shape',
      'composition',
    ]) {
      expect(READ).toContain(col)
    }
  })
})
