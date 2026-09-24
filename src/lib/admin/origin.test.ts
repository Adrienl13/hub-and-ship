import { describe, expect, it } from 'vitest'

import {
  describeOrigin,
  partnerSourceLabel,
  stockRequestSourceLabel,
} from './origin'

describe('describeOrigin', () => {
  it('combine le partenaire et les UTM présents', () => {
    expect(
      describeOrigin({
        partnerRef: 'abc',
        utmSource: 'src',
        utmMedium: 'med',
        utmCampaign: 'camp',
        sourceLabel: 'Page contact',
      }),
    ).toBe('Partenaire abc · src / med / camp')
  })

  it('n’affiche que les UTM renseignés, dans l’ordre source / medium / campagne', () => {
    expect(
      describeOrigin({ utmSource: 'google', utmCampaign: 'terrasse-2026' }),
    ).toBe('google / terrasse-2026')
    expect(describeOrigin({ partnerRef: 'REF-42', utmMedium: '  ' })).toBe(
      'Partenaire REF-42',
    )
  })

  it('retombe sur le libellé de source, puis sur « Direct »', () => {
    expect(
      describeOrigin({
        partnerRef: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        sourceLabel: 'Page stock 24h',
      }),
    ).toBe('Page stock 24h')
    expect(describeOrigin({ sourceLabel: '' })).toBe('Direct')
    expect(describeOrigin({})).toBe('Direct')
  })
})

describe('lexiques de source', () => {
  it('traduit les sources connues et conserve la valeur brute sinon', () => {
    expect(stockRequestSourceLabel('stock_24h_page')).toBe('Page stock 24h')
    expect(stockRequestSourceLabel('landing_x')).toBe('landing_x')
    expect(stockRequestSourceLabel('')).toBe('')
    expect(stockRequestSourceLabel(null)).toBe('')

    expect(partnerSourceLabel('partners_page')).toBe('Page partenaires')
    expect(partnerSourceLabel('partners_deal_form')).toBe(
      'Formulaire opportunité',
    )
    expect(partnerSourceLabel('partner_space')).toBe('Espace partenaire')
    expect(partnerSourceLabel('autre')).toBe('autre')
    expect(partnerSourceLabel(undefined)).toBe('')
  })
})
