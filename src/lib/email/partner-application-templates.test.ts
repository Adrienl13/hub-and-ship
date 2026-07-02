import { describe, expect, it } from 'vitest'

import {
  buildPartnerApplicationAckToUser,
  buildPartnerApplicationNotificationToAdmin,
  type PartnerApplicationEmailInput,
} from './templates'

const baseInput: PartnerApplicationEmailInput = {
  reference: '00000000-0000-4000-8000-0000000000aa',
  companyName: 'Distri Boissons Provence',
  siret: '55208131701750',
  siretVerified: false,
  contactName: 'Marie Martin',
  email: 'contact@distri-provence.fr',
  phone: '06 12 34 56 78',
  activityProfileLabel: 'Distributeur boissons / brasseur',
  targetStatusLabel: 'AP-08 · Apporteur d’affaires',
  zone: 'Bouches-du-Rhône',
  estimatedVolume: '120 clients',
  message: 'On livre déjà 120 terrasses.',
  partnerRef: 'DBP-13',
  utmSource: 'partner',
  adminUrl: 'https://prosimport.com/admin?tab=partner-applications',
}

describe('partner application email templates', () => {
  it('renders the admin notification with company, siret, target + attribution', () => {
    const { subject, html, text } =
      buildPartnerApplicationNotificationToAdmin(baseInput)
    expect(subject).toContain('Distri Boissons Provence')
    expect(html).toContain('55208131701750')
    expect(html).toContain('contact@distri-provence.fr')
    expect(html).toContain('AP-08')
    expect(html).toContain('DBP-13')
    expect(html).toContain('admin?tab=partner-applications')
    expect(text).toContain('à vérifier')
  })

  it('renders the candidate acknowledgement with the 48h promise', () => {
    const { subject, html, text } = buildPartnerApplicationAckToUser(baseInput)
    expect(subject).toContain('Candidature partenaire reçue')
    expect(html).toContain('Marie Martin')
    expect(html).toContain('Distri Boissons Provence')
    expect(html).toContain('48 h')
    expect(text).toContain('sous 48 h')
  })

  it('escapes user-provided strings to prevent HTML injection', () => {
    const { html } = buildPartnerApplicationNotificationToAdmin({
      ...baseInput,
      companyName: '<script>alert(1)</script>',
      message: '"><img src=x onerror=alert(1)>',
    })
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).not.toContain('<img src=x onerror=alert(1)>')
  })

  it('omits the attribution block when there is no ref/utm', () => {
    const { html } = buildPartnerApplicationNotificationToAdmin({
      ...baseInput,
      partnerRef: null,
      utmSource: null,
    })
    expect(html).not.toContain('Code partenaire')
  })
})
