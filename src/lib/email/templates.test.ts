import { describe, expect, it } from 'vitest'

import {
  buildReservationCreatedEmailToAdmin,
  buildReservationCreatedEmailToUser,
  type ReservationEmailInput,
} from './templates'

const baseInput: ReservationEmailInput = {
  reference: 'CC-2026-001-20260518-0001',
  contactName: 'Adrien Laniez',
  contactCompany: 'Hotel Demo',
  contactEmail: 'direction@hotel-demo.fr',
  contactPhone: '+33 6 12 34 56 78',
  siret: '55208131701750',
  containerReference: 'CC-2026-001',
  subtotalHt: 4450,
  volumeDiscount: 0,
  totalHt: 4450,
  totalTtc: 5340,
  payNow: 150,
  lines: [
    {
      productName: 'Chaise Cannes Empilable',
      variantName: 'Sable',
      quantity: 50,
      subtotalHt: 4450,
    },
  ],
  accountUrl: 'https://container-club.fr/account/reservations/abc',
}

describe('reservation email templates', () => {
  it('renders the user email with reference, totals, account URL', () => {
    const { subject, html, text } =
      buildReservationCreatedEmailToUser(baseInput)
    expect(subject).toBe('Réservation enregistrée — CC-2026-001-20260518-0001')
    expect(html).toContain('CC-2026-001-20260518-0001')
    expect(html).toContain('Chaise Cannes Empilable')
    expect(html).toContain('https://container-club.fr/account/reservations/abc')
    expect(text).toContain('CC-2026-001-20260518-0001')
    expect(text).toContain('Total HT : 4 450,00')
  })

  it('shows the volume discount line when a discount applies (net ≠ brut)', () => {
    const discounted: ReservationEmailInput = {
      ...baseInput,
      subtotalHt: 10000,
      volumeDiscount: 1000,
      totalHt: 9000,
      totalTtc: 10800,
    }
    // Intl fr-FR insère des espaces insécables dans les montants.
    const discountLine = /Remise volume : −1[\s\u00A0\u202F]000,00/
    const netLine = /Total HT : 9[\s\u00A0\u202F]000,00/
    const user = buildReservationCreatedEmailToUser(discounted)
    expect(user.text).toMatch(discountLine)
    expect(user.text).toMatch(netLine)
    const admin = buildReservationCreatedEmailToAdmin(discounted)
    expect(admin.text).toMatch(discountLine)
    expect(admin.text).toMatch(netLine)
  })

  it('renders the admin email with contact + siret + financials', () => {
    const { subject, html, text } =
      buildReservationCreatedEmailToAdmin(baseInput)
    expect(subject).toContain('Hotel Demo')
    expect(html).toContain('55208131701750')
    expect(html).toContain('direction@hotel-demo.fr')
    expect(text).toContain('55208131701750')
    expect(text).toContain('Frais à appeler')
  })

  it('escapes user-provided strings to prevent HTML injection (user email)', () => {
    const malicious = {
      ...baseInput,
      contactName: '<script>alert(1)</script>',
    }
    const { html } = buildReservationCreatedEmailToUser(malicious)
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('escapes user-provided strings to prevent HTML injection (admin email)', () => {
    const malicious = {
      ...baseInput,
      contactCompany: '"><img src=x onerror=alert(1)>',
    }
    const { html } = buildReservationCreatedEmailToAdmin(malicious)
    expect(html).not.toContain('"><img src=x onerror=alert(1)>')
    expect(html).toContain('&quot;&gt;&lt;img')
  })
})
