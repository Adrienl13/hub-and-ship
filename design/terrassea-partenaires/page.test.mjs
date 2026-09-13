/* global document, window, URL */
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'
import { PartnersPage } from './app.js'
import { config } from './config.js'
const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8')
let dom, page, motion
beforeEach(() => {
  dom = new JSDOM(html, { url: 'http://localhost:5192/partenaires/' })
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
  page = new PartnersPage(document.getElementById('partners-page'))
})
afterEach(() => {
  page.destroy()
  dom.window.close()
  delete globalThis.document
  delete globalThis.window
  delete globalThis.IntersectionObserver
})
const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
}
for (const [profile, tab] of [
  [0, 0],
  [1, 1],
  [2, 1],
  [3, 1],
  [4, 2],
  [5, 0],
  [6, 3],
])
  test(`profile ${profile} synchronizes recommendation, tab, comparison and form`, async () => {
    document.querySelectorAll('[data-onclick="p.pick"]')[profile].click()
    await flush()
    const vals = page.renderVals()
    assert.equal(page.state.tab, tab)
    assert.equal(vals.reco.code, page.defs[tab].code)
    assert.equal(
      document.querySelector('select[name=profile]').value,
      page.profileDefs[profile].label,
    )
    assert.equal(
      document.querySelector('select[name=status]').value,
      page.defs[tab].id,
    )
    assert.equal(
      document.querySelectorAll('[role=tab][aria-selected=true]').length,
      1,
    )
    assert.ok(vals.compare.every((r) => r.cells[tab].w === 600))
    assert.equal(document.querySelectorAll('.tbl tbody tr').length, 8)
  })
test('reclicking the active profile closes recommendation and clears form choices', async () => {
  page.renderVals().profiles[1].pick()
  await flush()
  page.renderVals().profiles[1].pick()
  await flush()
  assert.equal(page.state.profile, null)
  assert.equal(page.renderVals().recoMax, '0px')
  assert.equal(document.querySelector('select[name=status]').value, '')
})
for (let tab = 0; tab < 4; tab++)
  test(`tab ${tab} changes panel, column and form status`, async () => {
    document.querySelectorAll('[role=tab]')[tab].click()
    await flush()
    assert.equal(
      document.querySelector('#statut-panel h3').textContent.trim(),
      page.defs[tab].name,
    )
    assert.equal(
      document.querySelector('select[name=status]').value,
      page.defs[tab].id,
    )
    assert.equal(page.renderVals().cur.headline, page.defs[tab].headline)
    page.renderVals().cur.apply()
    assert.equal(page.state.formStatus, page.defs[tab].id)
  })
test('depot CTA targets apporteur after selecting another status', async () => {
  page.setState({ tab: 3 })
  await flush()
  page.renderVals().applyAP()
  await flush()
  assert.equal(page.state.tab, 0)
  assert.equal(document.querySelector('select[name=status]').value, 'apporteur')
})
test('keyboard navigation exposes a single active tab and synchronizes panel', async () => {
  const tabs = document.querySelectorAll('[role=tab]')
  tabs[0].dispatchEvent(
    new window.KeyboardEvent('keydown', { key: 'End', bubbles: true }),
  )
  await flush()
  assert.equal(page.state.tab, 3)
  assert.equal(document.activeElement, tabs[3])
  assert.equal(tabs[3].tabIndex, 0)
})
test('required fields and exact fourteen-digit SIRET validation', () => {
  const form = document.querySelector('[data-form=application]')
  assert.equal(form.checkValidity(), false)
  const siret = form.elements.siret
  for (const v of ['123', '1234567890123a', '123456789012345']) {
    siret.value = v
    assert.equal(siret.checkValidity(), false)
  }
  siret.value = '12345678901234'
  assert.equal(siret.checkValidity(), true)
})
function fill() {
  const form = document.querySelector('[data-form=application]')
  for (const [name, value] of Object.entries({
    company: 'Test',
    siret: '12345678901234',
    contact: 'Test',
    email: 'test@example.com',
  }))
    form.elements[name].value = value
  return form
}
test('local application preserves inputs and never falsely reports a real submission', async () => {
  const form = fill()
  await page.send({ preventDefault() {}, currentTarget: form }, 'application')
  assert.equal(page.state.sent, false)
  assert.match(page.feedback.application, /aucune candidature envoyée/)
  assert.equal(form.elements.company.value, 'Test')
})
test('unconfigured CRM is unavailable and retains the application', async () => {
  page.settings = { ...config, demo: false }
  const form = fill()
  await page.send({ preventDefault() {}, currentTarget: form }, 'application')
  assert.equal(page.state.sent, false)
  assert.match(page.feedback.application, /indisponible/)
  assert.equal(form.elements.email.value, 'test@example.com')
})
test('newsletter stays separate from the application', async () => {
  const form = document.querySelector('[data-form=newsletter]')
  form.elements.email.value = 'test@example.com'
  await page.send({ preventDefault() {}, currentTarget: form }, 'newsletter')
  assert.equal(page.state.sub, false)
  assert.match(page.feedback.newsletter, /aucune inscription envoyée/)
  assert.equal(page.state.sent, false)
})
test('FAQ keeps only one expanded answer', async () => {
  const b = document.querySelectorAll('[data-onclick="q.toggle"]')
  b[2].click()
  await flush()
  assert.equal(
    [...b].filter((x) => x.getAttribute('aria-expanded') === 'true').length,
    1,
  )
  assert.equal(b[2].getAttribute('aria-expanded'), 'true')
})
test('mobile floating CTA visibility follows scroll and is inert when hidden', async () => {
  assert.equal(document.querySelector('.fab').inert, true)
  Object.defineProperty(window, 'scrollY', { value: 701, configurable: true })
  page.onScroll()
  await flush()
  assert.equal(document.querySelector('.fab').inert, false)
  Object.defineProperty(window, 'scrollY', { value: 0, configurable: true })
  page.onScroll()
  await flush()
  assert.equal(document.querySelector('.fab').inert, true)
})
test('reduced motion reveals content and no DC runtime or unfinished phone link is delivered', () => {
  motion.matches = true
  page.onMotion()
  assert.equal(document.querySelectorAll('.rv:not(.in)').length, 0)
  assert.equal(
    document.querySelectorAll(
      'x-dc,sc-for,sc-if,[style-hover],a[href="tel:+33"]',
    ).length,
    0,
  )
})
