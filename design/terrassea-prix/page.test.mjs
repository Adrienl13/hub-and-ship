/* global document, window, URL */
import { test, beforeEach, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'
import { PricePage } from './app.js'
import { config } from './config.js'
const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8')
let dom, page, motion
beforeEach(() => {
  dom = new JSDOM(html, { url: 'http://localhost:5192/prix/' })
  motion = { matches: false, addEventListener() {}, removeEventListener() {} }
  Object.assign(globalThis, {
    document: dom.window.document,
    window: dom.window,
    IntersectionObserver: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  })
  window.matchMedia = () => motion
  Object.defineProperty(document, 'hidden', {
    value: false,
    configurable: true,
  })
  mock.timers.enable({ apis: ['setInterval', 'Date'], now: 0 })
  page = new PricePage(document.getElementById('prix-page'))
})
afterEach(() => {
  page.destroy()
  dom.window.close()
  mock.timers.reset()
  delete globalThis.document
  delete globalThis.window
  delete globalThis.IntersectionObserver
})
const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
}
const fixture = (price = 73.55) => ({
  products: [
    {
      id: config.quiberonId,
      sku: 'SKU-785',
      name: 'QUIBERON',
      category: 'chair',
      visibility: 'public',
      base_price_ht: price,
      moq_units: 50,
      main_image_url: '/real-quiberon.webp',
      features: [],
    },
  ],
  variants: [],
  stock: null,
  prices: [],
})
test('missing price never falls back to mock 89 and missing media never create empty videos', () => {
  assert.equal(page.renderVals().tier.unit, 'À confirmer')
  assert.equal(document.querySelectorAll('video').length, 0)
  assert.equal(document.querySelectorAll('x-dc,sc-for,sc-if').length, 0)
})
test('canonical product supplies photo, price and exact catalogue deep link', () => {
  page.loadCatalogue(fixture())
  const v = page.renderVals()
  assert.equal(v.productImage, '/real-quiberon.webp')
  assert.equal(v.tier.unit, '73,55 €')
  assert.equal(v.productHref, '/catalogue/#produit-SKU-785')
})
for (const [tier, unit, base] of [
  [0, '73,55 €', ''],
  [1, '69,14 €', '73,55 €'],
  [2, '66,20 €', '73,55 €'],
])
  test(`tier ${tier} uses actual unit price without total or savings`, () => {
    page.loadCatalogue(fixture())
    page.state.tier = tier
    const v = page.renderVals().tier
    assert.equal(v.unit, unit)
    assert.equal(v.base, base)
    assert.equal(v.total, undefined)
    assert.equal(v.saving, undefined)
  })
test('a different product named Quiberon cannot replace the configured canonical identity', () => {
  const data = fixture()
  data.products[0].id = 'wrong'
  page.loadCatalogue(data)
  assert.equal(page.price, null)
})
test('animation loops, pauses eight seconds after selection, and resumes following the route', async () => {
  mock.timers.tick(1600)
  await flush()
  assert.equal(page.state.step, 1)
  page.renderVals().routes[1].nodes[1].pick()
  mock.timers.tick(6400)
  await flush()
  assert.equal(page.state.step, 1)
  assert.equal(page.state.focus, 'terrassea')
  mock.timers.tick(1600)
  await flush()
  assert.equal(page.state.step, 2)
  assert.equal(page.state.focus, null)
  mock.timers.tick(8000)
  await flush()
  assert.equal(page.state.step, 0)
})
test('reduced motion stops autoplay, retains manual controls, and cleanup stops timers', async () => {
  motion.matches = true
  page.onMotion()
  mock.timers.tick(16000)
  await flush()
  assert.equal(page.state.step, 0)
  page.renderVals().routes[0].nodes[3].pick()
  await flush()
  assert.equal(page.state.step, 3)
  page.destroy()
  mock.timers.tick(16000)
  assert.equal(page.state.step, 3)
})
test('payment segments total 100 and final 30 percent remains gold', () => {
  const p = page.renderVals().pays
  assert.equal(
    p.reduce((s, x) => s + parseInt(x.w), 0),
    100,
  )
  assert.equal(p.at(-1).bg, '#b8924a')
  assert.equal(p.at(-1).pct, '30 %')
})
test('FAQ buttons keep only one answer expanded', async () => {
  const buttons = document.querySelectorAll('[data-onclick="q.toggle"]')
  buttons[2].click()
  await flush()
  assert.equal(
    [...buttons].filter((b) => b.getAttribute('aria-expanded') === 'true')
      .length,
    1,
  )
  assert.equal(buttons[2].getAttribute('aria-expanded'), 'true')
  buttons[2].click()
  await flush()
  assert.equal(
    [...buttons].filter((b) => b.getAttribute('aria-expanded') === 'true')
      .length,
    0,
  )
})
test('local newsletter does not falsely confirm a real subscription or send an email', async () => {
  const form = document.querySelector('form')
  form.querySelector('input').value = 'test@example.com'
  await page.subscribe({ preventDefault() {}, currentTarget: form })
  assert.equal(page.state.sub, false)
  assert.match(page.formStatus, /aucune inscription envoyée/)
})
test('missing CRM endpoint preserves input and reports unavailable', async () => {
  page.settings = { ...config, demo: false }
  const form = document.querySelector('form')
  form.querySelector('input').value = 'test@example.com'
  await page.subscribe({ preventDefault() {}, currentTarget: form })
  assert.match(page.formStatus, /indisponible/)
  assert.equal(form.querySelector('input').value, 'test@example.com')
})
