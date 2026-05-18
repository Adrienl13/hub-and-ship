import { describe, expect, it } from 'vitest'

import {
  callbackRequestSchema,
  reservationCheckoutSchema,
  siretInputSchema,
} from './schemas'

const validSiret = '55208131701750'

describe('validation schemas', () => {
  it('normalizes and validates SIRET input', () => {
    expect(siretInputSchema.parse('552 081 317 01750')).toBe(validSiret)
    expect(() => siretInputSchema.parse('123')).toThrow('14 chiffres')
  })

  it('validates and normalizes a reservation checkout payload', () => {
    const result = reservationCheckoutSchema.parse({
      siret: validSiret,
      contact: {
        name: 'Marc Test',
        company: 'Restaurant Test',
        email: 'MARC@restaurant-test.fr',
        phone: '+33 6 12 34 56 78',
      },
      delivery: {
        deliveryMode: 'partner_carrier_needed',
        deliveryNote: 'Besoin de hayon',
      },
      referralCode: ' container pierre x7k9 2026 ',
      cgvAccepted: true,
    })

    expect(result.contact.email).toBe('marc@restaurant-test.fr')
    expect(result.referralCode).toBe('CONTAINER-PIERRE-X7K9-2026')
  })

  it('rejects checkout without accepted B2B terms', () => {
    expect(() =>
      reservationCheckoutSchema.parse({
        siret: validSiret,
        contact: {
          name: 'Marc Test',
          company: 'Restaurant Test',
          email: 'marc@restaurant-test.fr',
          phone: '0612345678',
        },
        delivery: {
          deliveryMode: 'pickup_at_port',
        },
        cgvAccepted: false,
      }),
    ).toThrow('CGV obligatoires')
  })

  it('rejects invalid delivery modes and phone numbers', () => {
    expect(() =>
      reservationCheckoutSchema.parse({
        siret: validSiret,
        contact: {
          name: 'Marc Test',
          company: 'Restaurant Test',
          email: 'marc@restaurant-test.fr',
          phone: 'not a phone',
        },
        delivery: {
          deliveryMode: 'home_delivery',
        },
        cgvAccepted: true,
      }),
    ).toThrow()
  })

  it('validates callback requests and requires a date for custom slots', () => {
    expect(
      callbackRequestSchema.parse({
        siret: validSiret,
        name: 'Sophie Test',
        company: 'Hotel Test',
        email: 'contact@hotel-test.fr',
        phone: '0499000000',
        slot: 'tomorrow_morning',
        subject: 'quote_help',
      }).slot,
    ).toBe('tomorrow_morning')

    expect(() =>
      callbackRequestSchema.parse({
        siret: validSiret,
        name: 'Sophie Test',
        company: 'Hotel Test',
        email: 'contact@hotel-test.fr',
        phone: '0499000000',
        slot: 'custom',
        subject: 'quote_help',
      }),
    ).toThrow('Creneau personnalise requis')
  })
})
