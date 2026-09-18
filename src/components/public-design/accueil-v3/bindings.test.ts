// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { bind } from './bindings.js'

function render(html: string, scope: Record<string, unknown>) {
  const host = document.createElement('div')
  host.innerHTML = html
  bind(host)(scope)
  return host
}

describe('moteur de gabarits', () => {
  it('substitue AUSSI les attributs d’un nœud qui porte data-bound-text', () => {
    // Le piège : `data-bound-text` interrompait la visite du nœud avant la
    // boucle des attributs. Le texte se rendait, le style restait littéral —
    // en silence. Les libellés de la jauge de remise se superposaient tous au
    // même endroit parce que leur `left` valait « {{ m.left }} ».
    const host = render(
      '<span style="left:{{ pos }};color:{{ teinte }}" data-bound-text="{{ texte }}"></span>',
      { pos: '66.7%', teinte: 'red', texte: '100 · −6 %' },
    )
    const span = host.querySelector('span')!
    expect(span.textContent).toBe('100 · −6 %')
    expect(span.getAttribute('style')).toBe('left:66.7%;color:red')
  })

  it('garde son gabarit de texte d’une mise à jour à l’autre', () => {
    // Si `data-bound-text` était lui-même substitué, il serait écrasé par sa
    // première valeur et le nœud se figerait.
    const host = document.createElement('div')
    host.innerHTML =
      '<span style="left:{{ pos }}" data-bound-text="{{ texte }}"></span>'
    const update = bind(host)
    update({ pos: '10%', texte: 'un' })
    update({ pos: '90%', texte: 'deux' })
    const span = host.querySelector('span')!
    expect(span.textContent).toBe('deux')
    expect(span.getAttribute('style')).toBe('left:90%')
    expect(span.getAttribute('data-bound-text')).toBe('{{ texte }}')
  })

  it('ne visite pas les enfants d’un nœud dont le texte est piloté', () => {
    const host = render(
      '<p data-bound-text="{{ texte }}"><span>{{ ignore }}</span></p>',
      { texte: 'remplacé', ignore: 'jamais' },
    )
    expect(host.querySelector('p')!.textContent).toBe('remplacé')
    expect(host.querySelector('span')).toBeNull()
  })
})
