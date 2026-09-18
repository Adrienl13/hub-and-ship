// La jauge de remise du tiroir catalogue, rendue par le vrai gabarit.
//
// Ce test existe parce que le défaut précédent n'était pas dans le calcul mais
// dans le CÂBLAGE : la piste se remplissait selon le palier suivant, les
// libellés se répartissaient à intervalles réguliers et un trait était figé à
// 66,6 %. Trois repères, trois échelles, sur une barre de six pixels. À
// 50 assises, le remplissage atteignait pile le libellé « −6 % ».
//
// On extrait le bloc du gabarit RÉEL pour que le test ne puisse pas dériver.
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'

import { bind } from '@/components/public-design/accueil-v3/bindings.js'
import {
  resetPublicPricingRules,
  setPublicPricingRules,
} from '@/lib/pricing/public-rules'
import { buildVolumeScales } from '@/lib/pricing/volume-progress'

const TEMPLATE = readFileSync(
  'src/components/public-design/catalogue/template.html',
  'utf8',
)

const GRID = {
  assises: [
    { min_units: 100, discount: 0.06 },
    { min_units: 150, discount: 0.1 },
  ],
  tables: [
    { min_units: 80, discount: 0.05 },
    { min_units: 160, discount: 0.08 },
  ],
  salons: [
    { min_units: 10, discount: 0.06 },
    { min_units: 20, discount: 0.1 },
  ],
  autres: [
    { min_units: 100, discount: 0.06 },
    { min_units: 150, discount: 0.1 },
  ],
}

/** Le bloc de la jauge, découpé du gabarit de production. Les `<template>`
 *  sont imbriqués : on compte les ouvertures et les fermetures. */
function gaugeMarkup(): string {
  const start = TEMPLATE.indexOf('<template data-list="tierScales" data-as="s">')
  expect(start, 'bloc de jauge introuvable dans le gabarit').toBeGreaterThan(0)
  let depth = 0
  const re = /<\/?template\b/g
  re.lastIndex = start
  for (let m = re.exec(TEMPLATE); m; m = re.exec(TEMPLATE)) {
    depth += m[0].startsWith('</') ? -1 : 1
    if (depth === 0) return TEMPLATE.slice(start, m.index + '</template>'.length)
  }
  throw new Error('bloc de jauge non refermé')
}

function render(lines: ReadonlyArray<{ category: string; quantity: number }>) {
  const host = document.createElement('div')
  host.innerHTML = gaugeMarkup()
  const update = bind(host)
  update({ tierScales: buildVolumeScales(lines) })
  const fill = [...host.querySelectorAll('div[style*="width:"]')].find(
    (b) => !(b.getAttribute('style') || '').includes('{{'),
  )
  // Le gabarit d'origine reste dans l'arbre à côté des lignes rendues : on
  // écarte tout ce qui porte encore un jeton non substitué.
  const labels = [...host.querySelectorAll('span[style*="transform"]')].filter(
    (l) => !(l.getAttribute('style') || '').includes('{{'),
  )
  return {
    fillWidth: (fill?.getAttribute('style') || '').match(/width:([^;]+)/)?.[1] ?? null,
    labels: labels.map((l) => ({
      texte: l.textContent,
      left: (l.getAttribute('style') || '').match(/left:([^;]+)/)?.[1] ?? null,
    })),
  }
}

afterEach(() => {
  resetPublicPricingRules()
})

describe('jauge de remise du tiroir catalogue', () => {
  it('n’amène pas la piste jusqu’au palier −6 % à 50 assises', () => {
    setPublicPricingRules({ volume_discount_families: GRID })
    const { fillWidth, labels } = render([{ category: 'chair', quantity: 50 }])

    // Le défaut signalé : la piste se remplissait à 50 %, pile sous « −6 % ».
    expect(fillWidth).toBe('33.3%')
    expect(labels).toEqual([
      { texte: '100 · −6 %', left: '66.7%' },
      { texte: '150 · −10 %', left: '100%' },
    ])
    // Le remplissage reste bien EN DEÇÀ du premier palier.
    expect(parseFloat(fillWidth!)).toBeLessThan(parseFloat(labels[0]!.left!))
  })

  it('amène la piste exactement sur le palier quand il tombe', () => {
    setPublicPricingRules({ volume_discount_families: GRID })
    const { fillWidth, labels } = render([{ category: 'chair', quantity: 100 }])
    expect(fillWidth).toBe('66.7%')
    expect(fillWidth).toBe(labels[0]!.left)
  })

  it('affiche les paliers de la famille au panier, pas une échelle figée', () => {
    setPublicPricingRules({ volume_discount_families: GRID })
    const { fillWidth, labels } = render([{ category: 'lounge', quantity: 10 }])
    expect(labels.map((l) => l.texte)).toEqual(['10 · −6 %', '20 · −10 %'])
    expect(fillWidth).toBe('50%')
  })

  it('ne rend rien sur un panier vide', () => {
    const host = document.createElement('div')
    host.innerHTML = gaugeMarkup()
    bind(host)({ tierScales: [] })
    expect(
      [...host.querySelectorAll('span[style*="transform"]')].filter(
        (l) => !(l.getAttribute('style') || '').includes('{{'),
      ),
    ).toHaveLength(0)
  })
})

describe('panier à plusieurs familles', () => {
  it('rend une piste par famille, chacune à sa propre échelle', () => {
    setPublicPricingRules({ volume_discount_families: GRID })
    const host = document.createElement('div')
    host.innerHTML = gaugeMarkup()
    bind(host)({
      tierScales: buildVolumeScales([
        { category: 'chair', quantity: 120 },
        { category: 'lounge', quantity: 6 },
      ]),
    })
    const rendu = (sel: string) =>
      [...host.querySelectorAll(sel)].filter(
        (n) => !(n.getAttribute('style') || '').includes('{{'),
      )

    // Deux pistes, deux remplissages distincts : 120/150 et 6/20.
    const remplissages = rendu('div[style*="width:"]').map(
      (d) => (d.getAttribute('style') || '').match(/width:([^;]+)/)?.[1],
    )
    expect(remplissages).toEqual(['80%', '30%'])

    // Les paliers des assises et ceux des salons cohabitent sans se mélanger.
    expect(rendu('span[style*="transform"]').map((n) => n.textContent)).toEqual([
      '100 · −6 %',
      '150 · −10 %',
      '10 · −6 %',
      '20 · −10 %',
    ])

    const texte = host.textContent!.replace(/\s+/g, ' ')
    // Les deux libellés sont deux éléments voisins d'un flex : pas d'espace
    // entre eux dans le texte brut, ils sont écartés par la mise en page.
    expect(texte).toContain('Assises120 assises')
    expect(texte).toContain('−6 % acquis · encore 30 assises pour −10 %')
    expect(texte).toContain('Salons de jardin6 salons')
    expect(texte).toContain('encore 4 salons pour −6 %')
  })
})
