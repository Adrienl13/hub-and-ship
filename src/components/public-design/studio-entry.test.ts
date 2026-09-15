import { describe, it, expect } from 'vitest'
import { studioEntryMarkup } from './studio-entry'
describe('Studio entry links', () => {
  const markup =
    '<a href="#contact" data-studio-entry="">Créer mon projet</a><a href="#studio">Voir la section</a><a href="/contact">Contact</a>'
  it('opens only designated entry links with the public flag', () => {
    expect(studioEntryMarkup(markup, true)).toBe(
      '<a href="/studio" data-studio-entry="">Créer mon projet</a><a href="#studio">Voir la section</a><a href="/contact">Contact</a>',
    )
  })
  it('preserves working contact links when the Studio is closed', () => {
    expect(studioEntryMarkup(markup, false)).toBe(markup)
  })
})
