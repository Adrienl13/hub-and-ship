// @vitest-environment jsdom
//
// Les paliers de remise se lisent maintenant à SIX endroits : le tiroir du
// catalogue, la vignette « Remise quantité » de /panier et de la colonne de
// commande, le récapitulatif de /panier, le devis PDF, la fiche produit et la
// FAQ de /prix. Une modification de paramètre doit les bouger TOUS ou aucun.
//
// Ce test verrouille l'invariant : sur un même panier, les surfaces décrivent
// les mêmes familles, les mêmes montants et les mêmes paliers.
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'

import { bind } from '@/components/public-design/accueil-v3/bindings.js'
import {
  calculateOrderLines,
  describeVolumeDiscounts,
  type OrderLineInput,
} from '@/lib/order'
import {
  PUBLISHED_VOLUME_TIERS,
  describeFamilyTiers,
  resolveDiscountFamily,
} from '@/lib/pricing/discount-families'
import {
  getFamilyDiscountTiers,
  resetPublicPricingRules,
  setPublicPricingRules,
} from '@/lib/pricing/public-rules'
import { buildVolumeScales } from '@/lib/pricing/volume-progress'

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

// Panier mixte : une famille remisée, une qui n'atteint pas son palier, une
// qui plafonne. C'est le cas où des surfaces désynchronisées se voient.
const PANIER: OrderLineInput[] = [
  { basePriceHt: 89.9, ecoContribution: 0, retailPriceRef: 0, category: 'chair', quantity: 120 },
  { basePriceHt: 73.85, ecoContribution: 0, retailPriceRef: 0, category: 'table_top', quantity: 30 },
  { basePriceHt: 1225, ecoContribution: 0, retailPriceRef: 0, category: 'lounge', quantity: 20 },
]

const LIGNES = PANIER.map((l) => ({ category: l.category, quantity: l.quantity }))

afterEach(() => {
  resetPublicPricingRules()
})

describe('cohérence des paliers entre surfaces', () => {
  it('le récapitulatif et les jauges parlent des mêmes familles', () => {
    setPublicPricingRules({ volume_discount_families: GRID })
    const totals = calculateOrderLines(PANIER, { channel: 'direct' })

    // Récapitulatif (/panier, devis, tiroir, dialogue de réservation).
    const remises = describeVolumeDiscounts(totals)
    // Jauges (tiroir catalogue et vignette « Remise quantité »).
    const scales = buildVolumeScales(LIGNES)

    // Les tables n'atteignent pas leur palier : pas de remise, mais une jauge
    // qui montre le chemin restant. C'est voulu, et c'est la seule différence
    // admissible entre les deux listes.
    expect(remises.map((r) => r.key)).toEqual(['assises', 'salons'])
    expect(scales.map((s) => s.family)).toEqual(['assises', 'tables', 'salons'])
    expect(scales.filter((s) => s.hasDiscount).map((s) => s.family)).toEqual([
      'assises',
      'salons',
    ])

    // Le taux annoncé par la jauge est celui qui a servi à calculer la remise.
    for (const scale of scales.filter((s) => s.hasDiscount)) {
      const ligne = remises.find((r) => r.key === scale.family)!
      expect(ligne.label).toContain(`−${scale.discountPercent} %`)
    }
  })

  it('la vignette React et le tiroir catalogue affichent des valeurs identiques', () => {
    setPublicPricingRules({ volume_discount_families: GRID })
    // Les deux surfaces passent par buildVolumeScales : même entrée, même
    // sortie. Ce test échoue si l'une repasse un jour à un calcul maison.
    const viaReact = buildVolumeScales(LIGNES)

    const TEMPLATE = readFileSync(
      'src/components/public-design/catalogue/template.html',
      'utf8',
    )
    const start = TEMPLATE.indexOf('<template data-list="tierScales" data-as="s">')
    expect(start, 'jauge introuvable dans le gabarit catalogue').toBeGreaterThan(0)
    let depth = 0
    let end = -1
    const re = /<\/?template\b/g
    re.lastIndex = start
    for (let m = re.exec(TEMPLATE); m; m = re.exec(TEMPLATE)) {
      depth += m[0].startsWith('</') ? -1 : 1
      if (depth === 0) {
        end = m.index + '</template>'.length
        break
      }
    }
    const host = document.createElement('div')
    host.innerHTML = TEMPLATE.slice(start, end)
    bind(host)({ tierScales: viaReact })

    const rendu = (sel: string) =>
      [...host.querySelectorAll(sel)].filter(
        (n) => !(n.getAttribute('style') || '').includes('{{'),
      )
    expect(
      rendu('div[style*="width:"]').map(
        (d) => (d.getAttribute('style') || '').match(/width:([^;]+)/)?.[1],
      ),
    ).toEqual(viaReact.map((s) => s.fill))
    expect(rendu('span[style*="transform"]').map((n) => n.textContent)).toEqual(
      viaReact.flatMap((s) => s.marks.map((m) => m.label)),
    )
  })

  it('les pages qui ÉCRIVENT les paliers annoncent ceux qui s’appliquent', () => {
    setPublicPricingRules({ volume_discount_families: GRID })
    // Fiche produit, FAQ de /prix, pages SEO : elles se rendent côté serveur
    // sans hydrater les règles, donc elles lisent PUBLISHED_VOLUME_TIERS.
    // Si la grille active s'en écarte, elles promettent une remise qui ne
    // s'applique pas.
    for (const family of ['assises', 'tables', 'salons'] as const) {
      expect(PUBLISHED_VOLUME_TIERS[family], family).toEqual(
        getFamilyDiscountTiers(family),
      )
    }
    // Et la fiche produit décrit bien la famille du produit qu'elle porte.
    expect(resolveDiscountFamily('lounge')).toBe('salons')
    expect(describeFamilyTiers('salons')).toBe('−6 % dès 10 pièces, −10 % dès 20')
  })

  it('aucune surface n’annonce de remise hors du canal direct', () => {
    setPublicPricingRules({ volume_discount_families: GRID })
    const totals = calculateOrderLines(PANIER, { channel: 'revendeur' })
    expect(describeVolumeDiscounts(totals)).toEqual([])
    expect(totals.volumeDiscountAmount).toBe(0)
  })
})
