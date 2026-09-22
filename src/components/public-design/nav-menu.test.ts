// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'

import { startNavMenu } from './nav-menu.js'

const PAGES = ['accueil-v3', 'catalogue', 'prix', 'partenaires', 'livres']
const SHELL = readFileSync(
  'src/components/public-design/shell.css',
  'utf8',
)

let stop: (() => void) | null = null
afterEach(() => {
  stop?.()
  stop = null
  document.body.innerHTML = ''
})

function monter() {
  document.body.innerHTML = `
    <nav class="nav">
      <a href="#top">logo</a>
      <button type="button" class="nav-toggle" aria-expanded="false"
              aria-controls="nav-links"><span class="nav-toggle-bars"></span>Menu</button>
      <div class="nav-links" id="nav-links">
        <a href="/catalogue/">Le mobilier</a>
        <a href="#contact">Contact</a>
      </div>
    </nav>
    <main><p>dehors</p></main>`
  const root = document.body
  stop = startNavMenu(root)
  return {
    toggle: root.querySelector<HTMLButtonElement>('.nav-toggle')!,
    links: root.querySelector<HTMLElement>('.nav-links')!,
    dehors: root.querySelector<HTMLElement>('main p')!,
  }
}

const ouvert = (t: HTMLButtonElement) =>
  t.getAttribute('aria-expanded') === 'true'

describe('menu déroulant mobile', () => {
  it('démarre fermé et bascule au clic', () => {
    const { toggle } = monter()
    expect(ouvert(toggle)).toBe(false)
    toggle.click()
    expect(ouvert(toggle)).toBe(true)
    toggle.click()
    expect(ouvert(toggle)).toBe(false)
  })

  it('se referme quand on suit un lien', () => {
    // Sur une ancre (#contact), la navigation reste dans le document :
    // sans cela le menu resterait ouvert par-dessus la section visée.
    const { toggle, links } = monter()
    toggle.click()
    links.querySelector<HTMLAnchorElement>('a[href="#contact"]')!.click()
    expect(ouvert(toggle)).toBe(false)
  })

  it('se referme sur Échap et rend le focus au bouton', () => {
    // Sans le retour de focus, il resterait sur un lien devenu invisible et
    // la tabulation suivante repartirait du haut du document.
    const { toggle } = monter()
    toggle.click()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(ouvert(toggle)).toBe(false)
    expect(document.activeElement).toBe(toggle)
  })

  it('se referme au toucher en dehors, pas au toucher dedans', () => {
    const { toggle, links, dehors } = monter()
    toggle.click()

    links.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(ouvert(toggle)).toBe(true)

    dehors.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    expect(ouvert(toggle)).toBe(false)
  })

  it('ne casse rien si la barre n’a pas de bouton', () => {
    document.body.innerHTML = '<nav class="nav"></nav>'
    expect(() => startNavMenu(document.body)()).not.toThrow()
  })

  it('retire ses écouteurs au démontage', () => {
    const { toggle } = monter()
    toggle.click()
    stop!()
    stop = null
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    // Plus d'écouteur : l'état ne bouge plus.
    expect(ouvert(toggle)).toBe(true)
  })
})

describe('gabarits et styles', () => {
  it.each(PAGES)('%s porte le bouton et des liens identifiés', (page) => {
    const html = readFileSync(
      `src/components/public-design/${page}/template.html`,
      'utf8',
    )
    expect(html).toContain('class="nav-toggle"')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('aria-controls="nav-links"')
    expect(html).toContain('class="nav-links" id="nav-links"')
  })

  it('le bouton n’apparaît qu’en dessous de 760 px', () => {
    // Au-dessus, la barre reste exactement celle d'avant.
    expect(SHELL).toMatch(/\.public-design \.nav-toggle \{\s*display: none;/)
    expect(SHELL).toContain('@media (max-width: 760px)')
  })

  it('le repli est piloté par aria-expanded, en CSS', () => {
    // L'état visuel et l'état annoncé aux lecteurs d'écran ne peuvent donc
    // pas diverger — et les liens restent dans le HTML pour les robots.
    expect(SHELL).toContain(
      ".nav:has(.nav-toggle[aria-expanded='false']) .nav-links",
    )
    expect(SHELL).toContain(
      ".nav:has(.nav-toggle[aria-expanded='true']) .nav-links",
    )
  })
})
