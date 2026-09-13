/* global document, window, localStorage, URL */
import { test, beforeEach, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'
import { Catalogue } from './app.js'
import { adaptCatalogue, sanitizeCart, estimate } from './data.js'
import { validateProject } from '../terrassea-accueil-v3/project.js'
const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8')
const data = {
  products: [
    {
      id: 'a',
      sku: 'A',
      name: 'Chaise test',
      category: 'chair',
      base_price_ht: 12.35,
      moq_units: 50,
      main_image_url: '/a.webp',
      gallery_urls: ['/amb.webp'],
      features: [],
      visibility: 'public',
    },
    {
      id: 'b',
      sku: 'B',
      name: 'Table test',
      category: 'table_top',
      base_price_ht: 40,
      moq_units: 20,
      main_image_url: '/b.webp',
      gallery_urls: [],
      features: [],
      visibility: 'public',
    },
  ],
  variants: [
    ...Array.from({ length: 6 }, (_, i) => ({
      id: 'a' + i,
      product_id: 'a',
      name: 'Design ' + i,
      image_url: '/a' + i + '.webp',
      min_order_units: i === 5 ? 70 : null,
    })),
    { id: 'b0', product_id: 'b', name: 'Principal', image_url: '/b.webp' },
  ],
  stock: [{ product_id: 'a', variant_id: 'a0', available_units: 2 }],
  prices: [{ product_id: 'a', unit_price_ht: 12.45 }],
}
let dom, page
const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
}
const create = () => {
  page = new Catalogue(
    document.getElementById('catalogue-page'),
    adaptCatalogue(data),
  )
  return page
}
beforeEach(() => {
  dom = new JSDOM(html, { url: 'http://localhost:5192/catalogue/' })
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    localStorage: dom.window.localStorage,
    IntersectionObserver: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  })
  window.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  })
  mock.timers.enable({ apis: ['setInterval'] })
})
afterEach(() => {
  page?.destroy()
  page = null
  dom.window.close()
  mock.timers.reset()
  delete globalThis.document
  delete globalThis.window
  delete globalThis.localStorage
})
test('adapter uses only canonical photos, prices and variants, never the prototype product list', () => {
  const ps = adaptCatalogue(data)
  assert.equal(ps[0].price, 12.45)
  assert.equal(ps[0].variants[1][2], '/a1.webp')
  assert.equal(ps[0].material, 'Famille à préciser')
  assert.equal(ps[0].isNew, false)
  assert.equal(ps[0].tag, null)
  assert.equal(ps[1].cat, 'Table')
})
test('API on-request products stay excluded and null price stays unknown', () => {
  const ps = adaptCatalogue({
    ...data,
    products: [
      { ...data.products[0], visibility: 'on_request' },
      { ...data.products[1], base_price_ht: null },
    ],
    prices: [],
  })
  assert.equal(ps.length, 1)
  assert.equal(ps[0].price, null)
})
test('category AND stock, sort, intro and clearing filters', () => {
  create()
  page.state.cat = 'Table'
  page.state.stockOnly = true
  assert.equal(page.renderVals().items.length, 0)
  page.state.stockOnly = false
  assert.equal(page.renderVals().items.length, 1)
  assert.match(page.renderVals().introLead, /Piètements/)
  page.renderVals().clearFilters()
  page.state.sort = 'desc'
  assert.equal(page.renderVals().items[0].ref, 'B')
})
test('four designs have no +N; six show selected plus two and +3', () => {
  create()
  let item = page.renderVals().items[0]
  assert.equal(item.hasMore, true)
  assert.equal(item.moreLabel, '+3')
  assert.equal(item.designs.length, 3)
  page.state.cardVar = { A: 4 }
  item = page.renderVals().items[0]
  assert.equal(item.designs[0].name, 'Design 4')
  page.products[0].variants.length = 4
  page.state.cardVar = {}
  assert.equal(page.renderVals().items[0].hasMore, false)
})
test('card design = modal design = added design and drawer thumbnail', async () => {
  create()
  page.state.cardVar = { A: 2 }
  page.renderVals().items[0].open()
  await flush()
  assert.equal(page.renderVals().sheet.variantName, 'Design 2')
  page.renderVals().sheet.add()
  await flush()
  assert.equal(page.state.cart[0].varIdx, 2)
  assert.equal(page.renderVals().cart[0].img, '/a2.webp')
  assert.equal(page.state.cartOpen, true)
  assert.equal(page.renderVals().cartCount, '50')
})
test('different designs create different lines and card counter sums both', () => {
  create()
  page.addToCart(page.products[0], 0, 50)
  page.addToCart(page.products[0], 1, 50)
  assert.equal(page.state.cart.length, 2)
  assert.equal(page.renderVals().items[0].qtyLabel, '100 pcs')
  assert.equal(page.renderVals().cartTitle, '1 modèle sélectionné')
  assert.equal(page.renderVals().cartCount, '100')
})
test('card decrement below MOQ removes line; drawer decrement keeps MOQ', () => {
  create()
  page.addToCart(page.products[0], 0, 50)
  page.renderVals().cart[0].dec()
  assert.equal(page.state.cart[0].qty, 50)
  page.renderVals().items[0].dec()
  assert.equal(page.state.cart.length, 0)
})
test('variant MOQ is honored by first increment, sheet quantity and sanitization', () => {
  create()
  page.addToCart(page.products[0], 5, 10)
  assert.equal(page.state.cart[0].qty, 70)
  assert.equal(page.sheetQuantity(page.products[0], 5, 71), 80)
  assert.equal(
    sanitizeCart([{ key: 'A:5', ref: 'A', varIdx: 5, qty: 50 }], page.products)
      .length,
    0,
  )
})
for (const [qty, rate] of [
  [99, 0],
  [100, 0.06],
  [150, 0.1],
])
  test(`discount boundary ${qty} pieces`, () => {
    const p = adaptCatalogue(data)
    const e = estimate([{ ref: 'A', qty }], p)
    assert.equal(e.rate, rate)
    assert.equal(e.total, Math.round(qty * 12.45 * (1 - rate) * 100) / 100)
  })
test('no estimate when a unit price is unknown', () => {
  const p = adaptCatalogue({
    ...data,
    prices: [],
    products: [{ ...data.products[0], base_price_ht: null }],
  })
  assert.equal(estimate([{ ref: 'A', qty: 100 }], p).total, null)
})
test('reloading restores project and delivery; corrupted identities are rejected', () => {
  create()
  page.addToCart(page.products[0], 1, 50)
  page.setState({ delivery: 'depot' })
  const saved = localStorage.getItem('terrassea-projet')
  assert.equal(JSON.parse(saved)[0].key, 'A:1')
  assert.equal(
    sanitizeCart(JSON.parse(saved), page.products, { 'A:1': 'other-id' })
      .length,
    0,
  )
  page.destroy()
  document.body.innerHTML = new JSDOM(html).window.document.body.innerHTML
  create()
  assert.equal(page.state.cart[0].varIdx, 1)
  assert.equal(page.state.delivery, 'depot')
})
test('malformed cart entries do not affect badge or totals', () => {
  create()
  assert.deepEqual(
    sanitizeCart(
      [
        null,
        { key: 'A:99', ref: 'A', varIdx: 99, qty: 50 },
        { key: 'A:0', ref: 'A', varIdx: 0, qty: -5 },
        { key: 'A:0', ref: 'A', varIdx: 0, qty: Infinity },
      ],
      page.products,
    ),
    [],
  )
})
test('Escape closes dialogs and drawer is inert while hidden', async () => {
  create()
  assert.equal(document.querySelector('.drawer').inert, true)
  page.setState({ sheet: 'A', qty: 50 })
  await flush()
  assert.ok(document.querySelector('.sheet'))
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }))
  await flush()
  assert.equal(document.querySelector('.sheet'), null)
  page.setState({ cartOpen: true })
  await flush()
  assert.equal(document.querySelector('.drawer').inert, false)
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }))
  await flush()
  assert.equal(document.querySelector('.drawer').inert, true)
})
test('handoff includes canonical selection and reception, never prices', () => {
  create()
  page.addToCart(page.products[0], 1, 50)
  page.state.delivery = 'depot'
  page.prepareHandoff()
  const input = JSON.parse(localStorage.getItem('terrassea-projet-transfert'))
  assert.deepEqual(validateProject(input, data), {
    lines: [{ ref: 'A', designId: 'a1', design: 'Design 1', qty: 50 }],
    delivery: 'depot',
  })
  assert.ok(!JSON.stringify(input).includes('price'))
  assert.equal(
    validateProject(
      { lines: [{ ref: 'A', designId: 'forged', qty: 50 }] },
      data,
    ),
    null,
  )
})
test('stock badge is exact-design aware', () => {
  create()
  assert.equal(page.renderVals().items[0].inStock, true)
  page.state.cardVar = { A: 1 }
  assert.equal(page.renderVals().items[0].inStock, false)
})
test('all Studio links retain their anchor', () => {
  create()
  const links = [
    ...document.querySelectorAll('a[title="Personnaliser ce modèle"]'),
  ]
  assert.ok(links.length)
  assert.ok(links.every((a) => a.getAttribute('href') === '/#studio'))
})

test('unknown prices sort last and never become a zero-euro line', () => {
  create()
  page.products[0].price = null
  page.addToCart(page.products[0], 0, 50)
  for (const sort of ['asc', 'desc']) {
    page.state.sort = sort
    assert.equal(page.renderVals().items.at(-1).ref, 'A')
  }
  assert.equal(page.renderVals().cart[0].lineTotal, 'À confirmer')
  assert.equal(page.renderVals().cartTotal, 'À confirmer')
})
test('modal gallery follows the exact variant and stays limited to five views', () => {
  create()
  page.products[0].variantGalleries[1] = Array.from(
    { length: 8 },
    (_, i) => '/variant-view-' + i + '.webp',
  )
  page.setState({ sheet: 'A', sheetVar: 1, sheetImg: 1 })
  const sheet = page.renderVals().sheet
  assert.equal(sheet.img, '/variant-view-0.webp')
  assert.equal(sheet.gallery.length, 5)
  assert.ok(!sheet.gallery.some((v) => v.img === '/amb.webp'))
})

test('editing a project invalidates its previous form handoff', () => {
  create()
  page.addToCart(page.products[0], 0, 50)
  page.prepareHandoff()
  assert.ok(localStorage.getItem('terrassea-projet-transfert'))
  page.saveCart([])
  assert.equal(localStorage.getItem('terrassea-projet-transfert'), null)
})

test('outside click closes both dialogs, inside click preserves the sheet', async () => {
  create()
  page.setState({ sheet: 'A', qty: 50 })
  await flush()
  document.querySelector('.sheet-card').click()
  await flush()
  assert.ok(document.querySelector('.sheet'))
  document.querySelector('.sheet').click()
  await flush()
  assert.equal(document.querySelector('.sheet'), null)
  page.setState({ cartOpen: true })
  await flush()
  document.querySelector('div[data-onclick="closeCart"]').click()
  await flush()
  assert.equal(page.state.cartOpen, false)
})
