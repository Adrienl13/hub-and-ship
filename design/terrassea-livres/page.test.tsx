import { test, expect, beforeEach, afterEach } from 'bun:test'
import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'
import { renderToStaticMarkup } from 'react-dom/server'
import { DeliveredContainerCard } from '../../src/components/DeliveredContainerCard'
import { RegistryPage } from './app.js'
const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8')
let dom: JSDOM, page: InstanceType<typeof RegistryPage>
beforeEach(() => {
  dom = new JSDOM(html, { url: 'http://localhost:5192/livres/' })
  Object.assign(globalThis, {
    document: dom.window.document,
    window: dom.window,
    IntersectionObserver: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  })
  dom.window.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  })
  page = new RegistryPage(dom.window.document.querySelector('main'))
})
afterEach(() => {
  page.destroy()
  dom.window.close()
})
const item = (
  id: string,
  status = 'delivered',
  pros = 2,
  items = 100,
  saving = 30,
) => ({
  id,
  reference: id,
  slug: id,
  port: 'Test port',
  status,
  publishedAt: '2026-08-01',
  deliveredAt: '2026-08-01',
  professionalsServed: pros,
  totalItems: items,
  savingsPercent: saving,
  savingsTotalEur: null,
  photoUrl: null,
  gallery: [],
  productBreakdown: [],
  testimonial: { quote: null },
  plannedDays: null,
  actualDays: null,
})
function load(containers: ReturnType<typeof item>[]) {
  page.load({
    containers,
    sgsIds: [],
    cards: containers.map((c) => ({
      id: c.id,
      html: renderToStaticMarkup(
        <DeliveredContainerCard
          container={c}
          registry={{ hasSgs: false, latestDelivered: true, sequence: 1 }}
        />,
      ),
    })),
  })
}
test('totals use only delivered containers and average known percentages', () => {
  load([
    item('one'),
    item('two', 'delivered', 3, 50, 20),
    item('sea', 'shipping', 99, 999, 90),
  ])
  const text = dom.window.document.querySelector(
    '[data-screen-label=Hero]',
  ).textContent
  expect(text).toContain('2')
  expect(text).toContain('1 en transit')
  expect(text).toContain('150')
  expect(text).toContain('25 %')
  expect(text).not.toContain('999')
})
test('empty database has zero totals and no demo or unproven SGS percentage', () => {
  load([])
  expect(dom.window.document.querySelectorAll('.registry-card').length).toBe(0)
  expect(
    dom.window.document.querySelector('#registry-status').textContent,
  ).toContain('Aucun container')
  expect(dom.window.document.body.textContent).not.toContain('100 %')
  expect(dom.window.document.body.textContent).not.toContain('TRS-05')
})
test('filter selects first matching card and accordion is exclusive', () => {
  load([item('one'), item('two'), item('sea', 'shipping')])
  const buttons = dom.window.document.querySelectorAll('.registry-toggle')
  buttons[1].click()
  expect(buttons[0].getAttribute('aria-expanded')).toBe('false')
  expect(buttons[1].getAttribute('aria-expanded')).toBe('true')
  dom.window.document.querySelectorAll('[data-onclick="f.pick"]')[1].click()
  expect(page.open).toBe('sea')
  expect(
    dom.window.document.querySelectorAll('.registry-card:not([hidden])').length,
  ).toBe(1)
  buttons[2].click()
  expect(page.open).toBeNull()
})
test('missing fields and gallery images are not invented', () => {
  load([
    {
      ...item('one'),
      professionalsServed: null,
      totalItems: null,
      savingsPercent: null,
    },
  ])
  const card = dom.window.document.querySelector('.registry-card')
  expect(card.querySelectorAll('img').length).toBe(0)
  expect(card.textContent).not.toContain('Pros servis')
  expect(card.textContent).not.toContain('Contrôle SGS validé')
})
test('image failure falls back to the real placeholder', () => {
  load([{ ...item('one'), photoUrl: 'https://example.com/fail.jpg' }])
  const img = dom.window.document.querySelector('.registry-photo img')
  img.dispatchEvent(new dom.window.Event('error'))
  expect(dom.window.document.querySelector('.registry-photo img')).toBeNull()
  expect(
    dom.window.document.querySelector('.registry-photo').textContent,
  ).toContain('Photo à venir')
})
test('read failure never becomes a false zero-history claim', () => {
  page.failed = true
  page.render()
  expect(
    dom.window.document.querySelector('#registry-status').textContent,
  ).toContain('indisponible')
  expect(
    dom.window.document.querySelectorAll('[data-screen-label=Hero] .g-kpi>div')
      .length,
  ).toBe(0)
})
test('existing subscription repository is used with a disabled local transport', async () => {
  const form = dom.window.document.querySelector('form')
  form.elements.email.value = 'test@example.com'
  await page.subscribe({ preventDefault() {}, currentTarget: form })
  expect(page.feedback).toContain('aucune inscription envoyée')
  expect(form.elements.email.value).toBe('test@example.com')
})
