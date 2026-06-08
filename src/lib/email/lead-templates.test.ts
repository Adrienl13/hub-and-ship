import { describe, expect, it } from 'vitest'

import {
  buildPartnerRequestAdminEmail,
  buildPartnerRequestConfirmationEmail,
  buildStockRequestAdminEmail,
  buildStockRequestConfirmationEmail,
  type PartnerRequestEmailInput,
  type StockRequestEmailInput,
} from './templates'

const partner: PartnerRequestEmailInput = {
  isDeal: false,
  companyName: 'CHR Conseil',
  contactName: 'Claire Martin',
  contactEmail: 'claire@chr-conseil.fr',
  contactPhone: '+33 6 00 00 00 00',
  partnerKindLabel: 'Revendeur',
  territory: 'Bretagne',
  expectedMonthlyVolume: '1 container / trimestre',
  message: 'Premier contact.',
  clientCompanyName: null,
  projectType: null,
  adminUrl: 'https://prosimport.com/admin?tab=partners',
}

const stock: StockRequestEmailInput = {
  companyName: 'Restaurant Test',
  contactEmail: 'achat@resto.fr',
  contactPhone: '+33 6 00 00 00 00',
  productName: 'Chaise Cannes',
  requestedQuantity: 24,
  estimatedTotalHt: 2136,
  customerNote: 'Besoin terrasse urgent.',
  adminUrl: 'https://prosimport.com/admin?tab=stock-requests',
}

describe('partner request emails', () => {
  it('admin email carries company, contact and an admin link', () => {
    const email = buildPartnerRequestAdminEmail(partner)
    expect(email.subject).toContain('CHR Conseil')
    expect(email.html).toContain('claire@chr-conseil.fr')
    expect(email.html).toContain('admin?tab=partners')
    expect(email.text).toContain('Revendeur')
  })

  it('labels a deal differently from an application', () => {
    expect(buildPartnerRequestAdminEmail({ ...partner, isDeal: true }).subject).toMatch(
      /Opportunité/,
    )
    expect(buildPartnerRequestAdminEmail(partner).subject).toMatch(/Candidature/)
  })

  it('confirmation email greets the contact', () => {
    const email = buildPartnerRequestConfirmationEmail(partner)
    expect(email.html).toContain('Claire Martin')
    expect(email.subject).toMatch(/reçue/i)
  })

  it('escapes HTML in the message', () => {
    const email = buildPartnerRequestAdminEmail({
      ...partner,
      message: '<script>alert(1)</script>',
    })
    expect(email.html).not.toContain('<script>alert(1)</script>')
    expect(email.html).toContain('&lt;script&gt;')
  })
})

describe('stock request emails', () => {
  it('admin email carries product, quantity and estimate', () => {
    const email = buildStockRequestAdminEmail(stock)
    expect(email.subject).toContain('Chaise Cannes')
    expect(email.subject).toContain('24')
    expect(email.html).toContain('achat@resto.fr')
    expect(email.html).toContain('admin?tab=stock-requests')
  })

  it('confirmation email references the product', () => {
    const email = buildStockRequestConfirmationEmail(stock)
    expect(email.html).toContain('Chaise Cannes')
    expect(email.subject).toMatch(/reçue/i)
  })
})
