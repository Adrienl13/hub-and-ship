import { describe, expect, it } from 'vitest'

import { buildPartnerLink, buildQrSvg } from './qr'

describe('buildPartnerLink', () => {
  it('builds a LOT 2 tagged link for the partner code', () => {
    const link = buildPartnerLink('DBP-13', 'https://prosimport.com')
    expect(link).toBe(
      'https://prosimport.com/?ref=DBP-13&utm_source=partner&utm_medium=qr&utm_campaign=corner_depot',
    )
  })

  it('url-encodes the code', () => {
    expect(buildPartnerLink('A B/1', 'https://x.fr')).toContain('ref=A+B%2F1')
  })
})

describe('buildQrSvg', () => {
  it('produces a self-contained SVG encoding the text', () => {
    const svg = buildQrSvg(buildPartnerLink('DBP-13', 'https://prosimport.com'))
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('</svg>')
    // no external references — fully inline
    expect(svg).not.toContain('http://www.w3.org/1999/xlink')
  })
})
