/* global document, window, URL */
import { test, beforeEach, afterEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { JSDOM } from 'jsdom'
import { Page } from './app.js'
import { config } from './config.js'
const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8')
let dom, page, observers, calls
const flush = async () => {
  await Promise.resolve()
  await Promise.resolve()
}
const make = (settings = config) => {
  page = new Page(document.getElementById('page'), settings)
  return page
}
beforeEach(() => {
  dom = new JSDOM(html, { url: 'http://localhost:5192/' })
  observers = []
  calls = []
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    FormData: dom.window.FormData,
    IntersectionObserver: class {
      constructor(callback, options) {
        this.callback = callback
        this.options = options
        this.elements = new Set()
        observers.push(this)
      }
      observe(e) {
        this.elements.add(e)
      }
      unobserve(e) {
        this.elements.delete(e)
      }
      disconnect() {
        this.elements.clear()
      }
    },
  })
  window.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  })
  window.HTMLMediaElement.prototype.pause = () => {}
  window.HTMLMediaElement.prototype.load = () => {}
  window.HTMLMediaElement.prototype.play = () => Promise.resolve()
  mock.method(globalThis, 'fetch', async (...args) => {
    calls.push(args)
    return { ok: true }
  })
  mock.timers.enable({ apis: ['setTimeout', 'setInterval'] })
})
afterEach(() => {
  page?.destroy()
  page = null
  dom.window.close()
  mock.restoreAll()
  mock.timers.reset()
  delete globalThis.document
  delete globalThis.window
})
test('16 tiles appear then crossfade, always four distinct current references per family', async () => {
  make()
  mock.timers.tick(80)
  await flush()
  assert.equal(document.querySelectorAll('.g-fam button').length, 16)
  assert.equal(document.querySelector('.g-fam button').style.opacity, '1')
  const before = JSON.stringify(page.state.tiles)
  mock.timers.tick(1500)
  await flush()
  assert.notEqual(JSON.stringify(page.state.tiles), before)
  for (let i = 0; i < 100; i++) page.swapTile(i % 4, Math.floor(i / 4) % 4)
  for (const col of page.state.tiles)
    assert.equal(new Set(col.map((t) => (t.showB ? t.b : t.a))).size, 4)
})
test('range updates all three comparisons, including repeated updates', async () => {
  make()
  const ranges = [...document.querySelectorAll('input[type=range]')]
  for (const value of ['72', '19']) {
    ranges[1].value = value
    ranges[1].dispatchEvent(new window.Event('input'))
    await flush()
    assert.deepEqual(
      ranges.map((r) => r.value),
      [value, value, value],
    )
    assert.ok(
      document
        .querySelector('img[alt="Fréjus, coloris personnalisé"]')
        .style.clipPath.includes(value + '%'),
    )
  }
})
test('category changes update photos and labels without replacing form inputs', async () => {
  make()
  const email = document.querySelector('[name=email]')
  email.value = 'test@example.test'
  const tabs = [...document.querySelectorAll('#mobilier button')]
  tabs[2].click()
  await flush()
  assert.match(document.querySelector('#mobilier .g4').textContent, /Louvres/)
  tabs[3].click()
  await flush()
  assert.match(document.querySelector('#mobilier .g4').textContent, /Cannes/)
  assert.equal(document.querySelector('[name=email]'), email)
  assert.equal(email.value, 'test@example.test')
})
test('partner profile and multi-select needs are independent', async () => {
  make()
  document.querySelector('[data-onclick=pickPartner]').click()
  await flush()
  assert.equal(page.state.kind, 'Revendeur / partenaire')
  const needs = document.querySelectorAll('[data-onclick="n.pick"]')
  needs[2].click()
  await flush()
  assert.deepEqual(page.state.needs, ['Chaises', 'Tables'])
  needs[0].click()
  await flush()
  assert.deepEqual(page.state.needs, ['Tables'])
})
test('texture and blue card animations share the 3.2s counter; manual selection synchronizes', async () => {
  make()
  mock.timers.tick(3200)
  await flush()
  assert.equal(page.state.tex, 1)
  assert.equal(page.state.swap, 1)
  document.querySelectorAll('[data-onclick="t.pick"]')[18].click()
  await flush()
  assert.equal(page.state.tex, 2)
  assert.equal(page.state.swap, 2)
})
test('replay cancels auto-advance and stale replays, then resumes after the last stage', async () => {
  make()
  mock.timers.tick(4000)
  page.replayContainer()
  mock.timers.tick(1500)
  assert.equal(page.state.ship, 0)
  mock.timers.tick(100)
  assert.equal(page.state.ship, 1)
  page.replayContainer()
  mock.timers.tick(2000)
  assert.equal(page.state.ship, 1)
  mock.timers.tick(1600)
  assert.equal(page.state.ship, 2)
  mock.timers.tick(4499)
  assert.equal(page.state.ship, 2)
  mock.timers.tick(1)
  assert.equal(page.state.ship, 0)
})
test('manual container selection cancels a replay in progress', () => {
  make()
  page.replayContainer()
  mock.timers.tick(1000)
  page.selectShip(2)
  mock.timers.tick(2600)
  assert.equal(page.state.ship, 2)
})
test('reduced motion disables automated state changes and reveals content', async () => {
  window.matchMedia = () => ({
    matches: true,
    addEventListener() {},
    removeEventListener() {},
  })
  make()
  mock.timers.tick(20000)
  await flush()
  assert.equal(page.state.tex, 0)
  assert.equal(page.state.ship, 0)
  assert.equal(page.state.tiles[0][0].showB, false)
  assert.equal(document.querySelectorAll('.rv:not(.in)').length, 0)
})
test('dispose clears intervals, replay timeouts and intersection observers', async () => {
  make()
  page.replayContainer()
  page.destroy()
  const before = JSON.stringify(page.state)
  mock.timers.tick(30000)
  await flush()
  assert.equal(JSON.stringify(page.state), before)
  assert.ok(observers.every((o) => o.elements.size === 0))
})
test('configured videos have no src until near intersection', async () => {
  make({
    ...config,
    reels: [
      {
        url: '/example.mp4',
        name: 'Exemple fourni',
        href: 'https://www.instagram.com/terrassea_france',
      },
      ...config.reels.slice(1),
    ],
  })
  const video = document.querySelector('video')
  assert.equal(video.getAttribute('src'), null)
  observers[1].callback([{ target: video, isIntersecting: true }])
  assert.equal(video.getAttribute('src'), '/example.mp4')
})
test('demo lead and newsletter retain exact success labels but explicitly simulate and never fetch', async () => {
  make()
  for (const [type, flag] of [
    ['project', 'sent'],
    ['newsletter', 'sub'],
  ]) {
    const form = document.querySelector(`[data-form=${type}]`)
    form.querySelector('[name=email]').value = 'test@example.test'
    await page.submitForm({ preventDefault() {}, currentTarget: form }, type)
    await flush()
    assert.equal(page.state[flag], true)
    assert.match(
      form.querySelector('.form-status').textContent,
      /aucune donnée transmise/,
    )
  }
  assert.equal(calls.length, 0)
})
test('unconfigured or failing transport never confirms submission, preserves lead fields', async () => {
  make({ ...config, demo: false })
  const form = document.querySelector('[data-form=project]')
  form.querySelector('[name=email]').value = 'test@example.test'
  const event = { preventDefault() {}, currentTarget: form }
  await page.submitForm(event, 'project')
  assert.equal(page.state.sent, false)
  assert.equal(calls.length, 0)
  page.config = { ...page.config, projectEndpoint: '/lead' }
  mock.method(globalThis, 'fetch', async () => ({ ok: false }))
  await page.submitForm(event, 'project')
  assert.equal(page.state.sent, false)
  assert.match(form.querySelector('.form-status').textContent, /impossible/)
  assert.equal(form.querySelector('[name=email]').value, 'test@example.test')
})
test('validated same-origin endpoint receives exact form selections and only success acknowledges', async () => {
  make({ ...config, demo: false, projectEndpoint: '/lead' })
  const form = document.querySelector('[data-form=project]')
  form.querySelector('[name=email]').value = 'test@example.test'
  await page.submitForm({ preventDefault() {}, currentTarget: form }, 'project')
  assert.equal(page.state.sent, true)
  assert.equal(calls.length, 1)
  const payload = JSON.parse(calls[0][1].body)
  assert.equal(payload.profile, 'Restaurant')
  assert.deepEqual(payload.needs, ['Chaises'])
  assert.equal(payload.email, 'test@example.test')
})
test('media slots use explicit supplied configuration, missing exact pairs stay blank', () => {
  make({
    ...config,
    univers: [
      { url: '/approved.jpg', name: 'Approved', href: '#contact' },
      config.univers[1],
    ],
  })
  assert.equal(
    document.querySelector('[data-media-slot="0"] img').getAttribute('src'),
    '/approved.jpg',
  )
  assert.equal(
    document
      .querySelector('img[alt="Fréjus, coloris personnalisé"]')
      .getAttribute('src'),
    null,
  )
  assert.match(page.texDefs[1].caption, /à raccorder/)
  assert.doesNotMatch(page.texDefs[1].caption, /réel/)
})
test('all local catalogue paths exist and delivery contains no editor dependencies', () => {
  make()
  for (const family of page.famDefs)
    for (const [, path] of family.pool)
      if (!path.startsWith('S:'))
        assert.ok(
          readFileSync(
            new URL('../../public/catalogue/' + path, import.meta.url),
          ).length,
        )
  assert.doesNotMatch(
    html,
    /support\.js|<x-dc|<sc-for|<sc-if|style-hover|text\/x-dc/,
  )
  for (const id of ['top', 'studio', 'mobilier', 'reel', 'contact'])
    assert.ok(document.getElementById(id))
})

test('resuming motion also resumes an intersecting configured video', () => {
  const play = mock.method(window.HTMLMediaElement.prototype, 'play', () =>
    Promise.resolve(),
  )
  make({
    ...config,
    reels: [{ url: '/example.mp4' }, ...config.reels.slice(1)],
  })
  const video = document.querySelector('video')
  observers[1].callback([{ target: video, isIntersecting: true }])
  const count = play.mock.callCount()
  page.paused = true
  page.startTimers()
  page.paused = false
  page.startTimers()
  assert.equal(play.mock.callCount(), count + 1)
})
