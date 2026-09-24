// @vitest-environment node
//
// « Demander un devis pour ce modèle » envoyait sur la page contact : la
// fiche se fermait, le modèle était perdu. Le formulaire se déplie
// maintenant dans le tiroir, et part par /api/contact avec le modèle, le
// design et la quantité déjà écrits.

import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

import { adaptCatalogue, minimum, type AdaptedProduct } from './data.js'
import { CatalogueModel } from './model.js'

const TEMPLATE = readFileSync(
  'src/components/public-design/catalogue/template.html',
  'utf8',
)

/** Le modèle pur, avec ce que l'application (app.js) lui fournit. */
class TestModel extends CatalogueModel {
  override setState(change: unknown) {
    Object.assign(
      this.state,
      typeof change === 'function' ? change(this.state) : change,
    )
  }
  override minimum(p: AdaptedProduct, i: number) {
    return minimum(p, i) ?? 0
  }
  override isStocked() {
    return false
  }
  override totalLabel(_rows: unknown, n: number) {
    return this.eur(n)
  }
  override sheetQuantity(p: AdaptedProduct, i: number, n: number) {
    const min = this.minimum(p, i)
    return Math.max(min, Number(n) || min)
  }
}

function monter() {
  const products = adaptCatalogue({
    products: [
      {
        id: 'p1',
        sku: 'BIS-061',
        name: 'Fauteuil de bistrot MONTMARTRE - cannage rouge / crème',
        category: 'armchair',
        base_price_ht: 83.26,
        moq_units: 50,
        main_image_url: '/a.webp',
        gallery_urls: [],
        features: [],
        visibility: 'public',
        sort_order: 1,
        dim_length_cm: null,
        dim_width_cm: null,
        dim_height_cm: null,
        weight_kg: null,
        table_shape: null,
        composition: null,
      },
    ],
    variants: [],
    stock: [],
  })
  const model = new TestModel()
  model.products = products
  model.state.sheet = 'BIS-061'
  model.state.qty = 50
  const deliver = vi.fn().mockResolvedValue(undefined)
  model.deliverQuote = deliver
  return { model, deliver, vals: () => model.renderVals() }
}

describe('demande de devis dans le tiroir', () => {
  it('est repliée à l’ouverture, se déplie et se replie', () => {
    const { model, vals } = monter()
    expect(vals().quote.open).toBe(false)
    vals().quote.toggle()
    expect(vals().quote.open).toBe(true)
    expect(vals().quote.summary).toContain('MONTMARTRE')
    expect(vals().quote.summary).toContain('50 pièces')
    vals().quote.cancel()
    expect(vals().quote.open).toBe(false)
    expect(model.state.quoteStatus).toBe('idle')
  })

  it('suit la quantité saisie dans le tiroir', () => {
    const { vals } = monter()
    vals().setQty({ target: { value: '80' } })
    vals().quote.toggle()
    expect(vals().quote.summary).toContain('80 pièces')
  })

  it('envoie la quantité saisie dans les champs structurés', async () => {
    const { vals, deliver } = monter()
    vals().setQty({ target: { value: '80' } })
    vals().quote.toggle()
    vals().quote.setName({ target: { value: 'Camille Roux' } })
    vals().quote.setEmail({ target: { value: 'camille@hoteldespins.fr' } })
    await vals().quote.submit({ preventDefault() {} })
    const payload = deliver.mock.calls[0]![0]
    expect(payload.product.quantity).toBe(80)
    expect(payload.message).toContain('Quantité : 80 pièces')
  })

  it('refuse d’envoyer sans email, sans appel réseau', async () => {
    const { vals, deliver } = monter()
    vals().quote.toggle()
    vals().quote.setName({ target: { value: 'Camille Roux' } })
    const event = { preventDefault: vi.fn() }
    await vals().quote.submit(event)
    expect(event.preventDefault).toHaveBeenCalled()
    expect(deliver).not.toHaveBeenCalled()
    expect(vals().quote.failed).toBe(true)
    expect(vals().quote.error).toContain('email')
  })

  it('envoie le modèle, le design et la quantité sous le sujet « devis »', async () => {
    const { vals, deliver } = monter()
    vals().quote.toggle()
    vals().quote.setName({ target: { value: 'Camille Roux' } })
    vals().quote.setCompany({ target: { value: 'Hôtel des Pins' } })
    vals().quote.setEmail({ target: { value: 'camille@hoteldespins.fr' } })
    vals().quote.setPhone({ target: { value: '06 12 34 56 78' } })
    vals().quote.setNote({ target: { value: 'Avant le 15 mars.' } })
    await vals().quote.submit({ preventDefault() {} })

    expect(deliver).toHaveBeenCalledOnce()
    const payload = deliver.mock.calls[0]![0]
    expect(payload).toMatchObject({
      name: 'Camille Roux',
      company: 'Hôtel des Pins',
      email: 'camille@hoteldespins.fr',
      phone: '06 12 34 56 78',
      topic: 'devis',
      source: 'catalogue_quick_quote',
    })
    // Le produit part aussi structuré : la table contact_requests compte
    // les devis par modèle sans relire l'email.
    expect(payload.product).toEqual({
      sku: 'BIS-061',
      name: 'Fauteuil de bistrot MONTMARTRE - cannage rouge / crème',
      design: 'Design catalogue',
      quantity: 50,
      priceLabel: '83,26 €',
    })
    expect(payload.message).toContain('cannage rouge / crème (BIS-061)')
    expect(payload.message).toContain('Design : Design catalogue')
    expect(payload.message).toContain('Quantité : 50 pièces')
    expect(payload.message).toContain('83,26 € HT / pièce, dès 50 pièces')
    expect(payload.message).toContain('Avant le 15 mars.')

    expect(vals().quote.sent).toBe(true)
    expect(vals().quote.open).toBe(false)
  })

  it('affiche l’erreur du serveur et laisse réessayer', async () => {
    const { vals, deliver } = monter()
    deliver.mockRejectedValueOnce(new Error('Trop de tentatives.'))
    vals().quote.toggle()
    vals().quote.setName({ target: { value: 'Camille Roux' } })
    vals().quote.setEmail({ target: { value: 'camille@hoteldespins.fr' } })
    await vals().quote.submit({ preventDefault() {} })
    expect(vals().quote.failed).toBe(true)
    expect(vals().quote.error).toBe('Trop de tentatives.')
    expect(vals().quote.open).toBe(true)
  })

  it('garde l’identité mais remet l’état à zéro d’une fiche à l’autre', async () => {
    const { model, vals } = monter()
    vals().quote.toggle()
    vals().quote.setName({ target: { value: 'Camille Roux' } })
    vals().quote.setEmail({ target: { value: 'camille@hoteldespins.fr' } })
    await vals().quote.submit({ preventDefault() {} })
    expect(vals().quote.sent).toBe(true)
    vals().closeSheet()
    model.state.sheet = 'BIS-061'
    expect(vals().quote.sent).toBe(false)
    expect(vals().quote.open).toBe(false)
    expect(vals().quote.name).toBe('Camille Roux')
    expect(vals().quote.email).toBe('camille@hoteldespins.fr')
  })
})

describe('gabarit du tiroir', () => {
  it('ne renvoie plus vers la page contact', () => {
    const sheet = TEMPLATE.slice(
      TEMPLATE.indexOf('data-if="sheetOpen"'),
      TEMPLATE.indexOf('<aside'),
    )
    expect(sheet).not.toContain('href="/#contact"')
    expect(sheet).toContain('data-onclick="quote.toggle"')
    expect(sheet).toContain('data-if="quote.open"')
    expect(sheet).toContain('data-onsubmit="quote.submit"')
    expect(sheet).toContain('data-if="quote.sent"')
    // Le second chemin reste à portée : ajouter au projet pour un devis complet.
    expect(sheet).toContain('data-onclick="sheet.add"')
  })
})
