import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import {
  CATALOGUE_INDEX_MARKER,
  catalogueIndexMarkup,
  withCatalogueIndex,
} from './catalogue-index'

const TEMPLATE = readFileSync(
  'src/components/public-design/catalogue/template.html',
  'utf8',
)
const START = readFileSync(
  'src/components/public-design/start.js',
  'utf8',
)

const ITEMS = [
  {
    name: 'Chaise de bistrot RIVOLI - chevron blanc / gris',
    path: '/catalogue/p/chaise-de-bistrot-rivoli-chevron-blanc-gris-bis-001',
    price: '80,00 € HT',
  },
  {
    name: 'Fauteuil de terrasse SANARY - cordage vertical gris perle',
    path: '/catalogue/p/fauteuil-de-terrasse-sanary-sku-500',
    price: '',
  },
]

describe('index du catalogue lisible par les robots', () => {
  it('rend un lien par fiche, avec son prix quand il existe', () => {
    const html = catalogueIndexMarkup(ITEMS)
    expect(html).toContain(
      'href="/catalogue/p/chaise-de-bistrot-rivoli-chevron-blanc-gris-bis-001"',
    )
    expect(html).toContain('Chaise de bistrot RIVOLI')
    expect(html).toContain('80,00 € HT')
    // Prix absent : pas de tiret orphelin en fin de libellé.
    expect(html).toContain('SANARY - cordage vertical gris perle</a>')
  })

  it('échappe les noms venus de la base', () => {
    // Le HTML est injecté par dangerouslySetInnerHTML : un nom de produit
    // est une donnée saisie en admin, jamais du balisage.
    const html = catalogueIndexMarkup([
      {
        name: 'Chaise <script>alert(1)</script> "X" & Cie',
        path: '/catalogue/p/x"><img src=x>',
        price: '',
      },
    ])
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&quot;X&quot; &amp; Cie')
    expect(html).not.toContain('<img src=x>')
  })

  it('ne rend rien du tout sur une liste vide', () => {
    // Une base injoignable ne doit pas produire une section « Tous nos
    // modèles » sans modèle : les robots la liraient comme un catalogue vide.
    expect(catalogueIndexMarkup([])).toBe('')
    expect(withCatalogueIndex(TEMPLATE, [])).not.toContain(
      'catalogue-ssr-index"',
    )
  })

  it('remplace le marqueur du gabarit', () => {
    expect(TEMPLATE).toContain(CATALOGUE_INDEX_MARKER)
    const html = withCatalogueIndex(TEMPLATE, ITEMS)
    expect(html).not.toContain(CATALOGUE_INDEX_MARKER)
    expect(html).toContain('id="catalogue-ssr-index"')
    expect(html).toContain('Chaise de bistrot RIVOLI')
  })

  it('laisse intact un gabarit sans marqueur', () => {
    expect(withCatalogueIndex('<main>rien</main>', ITEMS)).toBe(
      '<main>rien</main>',
    )
  })

  it('le script client retire l’index avant de peupler la grille', () => {
    // Le binder INSÈRE ses cartes sans effacer ce qui précède : laisser
    // l'index donnerait deux listes l'une sous l'autre.
    expect(START).toContain("querySelector('#catalogue-ssr-index')?.remove()")
  })
})
