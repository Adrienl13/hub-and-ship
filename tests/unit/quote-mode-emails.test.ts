import { describe, expect, it } from 'vitest'

import {
  buildReservationCreatedEmailToAdmin,
  buildReservationCreatedEmailToUser,
  type ReservationEmailInput,
} from '@/lib/email/templates'
import { RESERVATION_MODE, isQuoteMode } from '@/lib/reservations/mode'

const BASE: ReservationEmailInput = {
  reference: 'TRS-2026-0042',
  contactName: 'Camille Roux',
  contactCompany: 'Hôtel du Port',
  contactEmail: 'camille@hotelduport.fr',
  contactPhone: '06 12 34 56 78',
  siret: '98826998100011',
  containerReference: 'CC-2026-002',
  subtotalHt: 12000,
  volumeDiscount: 720,
  totalHt: 11280,
  totalTtc: 13536,
  payNow: 338.4,
  lines: [
    {
      productName: 'Chaise de bistrot CABOURG',
      variantName: 'Bleu marine / écru',
      quantity: 60,
      subtotalHt: 7200,
    },
  ],
  accountUrl: 'https://terrassea.com/account/reservations/abc',
}

const QUOTE: ReservationEmailInput = {
  ...BASE,
  quoteMode: true,
  deliveryLabel: "Livraison jusqu'à la terrasse",
  deliveryNote: 'Marseille 8e, camion 12 t maximum.',
  totalCbm: 18.4,
  referralCode: 'APP-2026',
}

describe('mode du tunnel', () => {
  it("s'ouvre en mode devis : aucun encaissement sur le site", () => {
    expect(RESERVATION_MODE).toBe('quote')
    expect(isQuoteMode()).toBe(true)
    expect(isQuoteMode('payment')).toBe(false)
  })
})

describe('email au client', () => {
  it('parle de devis et ne réclame aucun paiement', () => {
    const mail = buildReservationCreatedEmailToUser(QUOTE)
    expect(mail.subject).toBe('Votre devis Terrassea — TRS-2026-0042')
    expect(mail.html).toContain('Les prix sont fermes')
    expect(mail.html).toContain('Voir mon devis')
    expect(mail.html).not.toContain('À régler maintenant')
    expect(mail.text).not.toContain('À régler :')
    expect(mail.text).toContain('Voir votre devis')
  })

  it('garde le ton paiement quand le mode devis est coupé', () => {
    const mail = buildReservationCreatedEmailToUser(BASE)
    expect(mail.subject).toBe('Réservation enregistrée — TRS-2026-0042')
    expect(mail.html).toContain('À régler maintenant')
    expect(mail.html).toContain('Voir ma réservation')
  })
})

describe('email à Terrassea', () => {
  it('porte tout ce qu’il faut pour rappeler le client', () => {
    const mail = buildReservationCreatedEmailToAdmin(QUOTE)
    // Intl.NumberFormat('fr-FR') sépare le montant du symbole par une espace
    // insécable étroite (U+202F) : on compare sur la forme normalisée.
    expect(mail.subject.replace(/\s/g, ' ')).toBe(
      '[Terrassea] Devis TRS-2026-0042 — Hôtel du Port — 11 280,00 € HT',
    )
    for (const expected of [
      'À rappeler sous 24 h ouvrées',
      'Hôtel du Port',
      '98826998100011',
      'camille@hotelduport.fr',
      'tel:0612345678',
      "Livraison jusqu'à la terrasse",
      'Marseille 8e, camion 12 t maximum.',
      '18.40 m³',
      'APP-2026',
      'Chaise de bistrot CABOURG',
    ]) {
      expect(mail.html).toContain(expected)
    }
    expect(mail.text).toContain('Volume : 18.40 m³')
    expect(mail.text).toContain('Code apporteur : APP-2026')
  })

  it('omet proprement les champs absents', () => {
    const mail = buildReservationCreatedEmailToAdmin({
      ...BASE,
      quoteMode: true,
    })
    expect(mail.html).not.toContain('Note client')
    expect(mail.html).not.toContain('Code apporteur')
    expect(mail.html).not.toContain('undefined')
    expect(mail.text).not.toContain('undefined')
  })
})
