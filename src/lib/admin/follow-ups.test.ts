import { describe, expect, it } from 'vitest'

import {
  FOLLOW_UP_BODY_MAX,
  FOLLOW_UP_SUBJECT_MAX,
  FOLLOW_UP_TEMPLATE_IDS,
  absoluteFollowUpUrl,
  buildFollowUpDraft,
  describeFollowUps,
  isInternalFollowUpUrl,
  isValidFollowUpEmail,
  reservationFollowUpTemplate,
  validateFollowUp,
} from './follow-ups'

const CONTEXT = {
  name: 'Camille Test',
  company: 'Brasserie Test',
  reference: 'TR-2026-0001',
  productName: 'Chaise CANNES',
  quantity: 40,
  priceLabel: '60 € HT',
}

describe('buildFollowUpDraft', () => {
  it('prefills the quote template with product, quantity, company and price', () => {
    const draft = buildFollowUpDraft('devis', CONTEXT)
    expect(draft.subject).toBe('Votre devis Terrassea — TR-2026-0001')
    expect(draft.body).toContain(
      'demande de devis pour Chaise CANNES (40 unités) pour Brasserie Test.',
    )
    expect(draft.body).toContain('sur la base de 60 € HT')
    // Le gabarit d'email ajoute la salutation : le corps ne la répète pas.
    expect(draft.body).not.toMatch(/^Bonjour/)
  })

  it('falls back to the bare subject and sentence when the context is thin', () => {
    const draft = buildFollowUpDraft('devis', { name: 'Camille' })
    expect(draft.subject).toBe('Votre devis Terrassea')
    expect(draft.body).toContain('votre demande de devis.')
    expect(draft.body).not.toContain('sur la base de')
  })

  it('prefills the information template', () => {
    expect(buildFollowUpDraft('informations', CONTEXT).subject).toBe(
      'Votre demande Terrassea',
    )
    expect(buildFollowUpDraft('informations', CONTEXT).body).toContain(
      'concernant Chaise CANNES',
    )
    expect(
      buildFollowUpDraft('informations', {
        name: 'Camille',
        reference: 'TR-1',
      }).body,
    ).toContain('(référence TR-1)')
  })

  it('prefills the payment template with reference and amount', () => {
    const draft = buildFollowUpDraft('paiement', {
      name: 'Camille',
      reference: 'TR-2026-0001',
      priceLabel: '150,00 €',
    })
    expect(draft.subject).toBe(
      'Votre réservation Terrassea : règlement en attente',
    )
    expect(draft.body).toContain('Votre réservation TR-2026-0001')
    expect(draft.body).toContain('les frais de réservation (150,00 €)')
  })

  it('leaves the free template empty for the admin to write', () => {
    const draft = buildFollowUpDraft('libre', CONTEXT)
    expect(draft.subject).toBe('Terrassea — TR-2026-0001')
    expect(draft.body).toBe('')
    expect(buildFollowUpDraft('libre', { name: 'X' }).subject).toBe(
      'Un message de Terrassea',
    )
  })

  it('never exceeds the subject limit', () => {
    for (const template of FOLLOW_UP_TEMPLATE_IDS) {
      const draft = buildFollowUpDraft(template, {
        ...CONTEXT,
        reference: 'R'.repeat(300),
      })
      expect(draft.subject.length).toBeLessThanOrEqual(FOLLOW_UP_SUBJECT_MAX)
    }
  })
})

describe('reservationFollowUpTemplate', () => {
  it('suggests payment when money is expected, information otherwise', () => {
    expect(reservationFollowUpTemplate('pending_reservation_fee')).toBe(
      'paiement',
    )
    expect(reservationFollowUpTemplate('deposit_called')).toBe('acompte')
    expect(
      buildFollowUpDraft('acompte', {
        name: 'Camille',
        reference: 'TR-2026-0001',
        priceLabel: '3 000,00 €',
      }).body,
    ).toContain('votre acompte (3 000,00 €) est maintenant attendu')
    expect(reservationFollowUpTemplate('reserved')).toBe('informations')
    expect(reservationFollowUpTemplate('in_production')).toBe('informations')
  })
})

describe('validateFollowUp', () => {
  it('accepts a trimmed, well-formed follow-up', () => {
    const result = validateFollowUp({
      subject: '  Votre devis  ',
      body: '  Un message suffisamment long pour partir.  ',
      email: ' Camille@Exemple.test ',
    })
    expect(result).toEqual({
      ok: true,
      value: {
        subject: 'Votre devis',
        body: 'Un message suffisamment long pour partir.',
        email: 'Camille@Exemple.test',
      },
    })
  })

  it('reports each field independently', () => {
    const result = validateFollowUp({
      subject: '',
      body: 'trop court',
      email: 'pas-un-email',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.subject).toMatch(/obligatoire/)
    expect(result.errors.body).toMatch(/au moins 20/)
    expect(result.errors.email).toMatch(/invalide/)
  })

  it('enforces the database bounds', () => {
    const tooLong = validateFollowUp({
      subject: 's'.repeat(FOLLOW_UP_SUBJECT_MAX + 1),
      body: 'b'.repeat(FOLLOW_UP_BODY_MAX + 1),
      email: 'camille@exemple.test',
    })
    expect(tooLong.ok).toBe(false)
    if (tooLong.ok) return
    expect(tooLong.errors.subject).toMatch(/200/)
    expect(tooLong.errors.body).toMatch(/6000/)
    expect(tooLong.errors.email).toBeUndefined()
  })
})

describe('isValidFollowUpEmail', () => {
  it('accepts ordinary addresses and rejects obvious garbage', () => {
    expect(isValidFollowUpEmail('camille@exemple.test')).toBe(true)
    expect(isValidFollowUpEmail('prenom.nom+tag@sous.domaine.fr')).toBe(true)
    expect(isValidFollowUpEmail('')).toBe(false)
    expect(isValidFollowUpEmail('sans-arobase')).toBe(false)
    expect(isValidFollowUpEmail('a@b')).toBe(false)
    expect(isValidFollowUpEmail('a b@c.fr')).toBe(false)
    expect(isValidFollowUpEmail('<a@b.fr>')).toBe(false)
    expect(isValidFollowUpEmail(`${'a'.repeat(250)}@b.fr`)).toBe(false)
  })
})

describe('internal follow-up links', () => {
  it('only accepts site paths and terrassea.com URLs', () => {
    expect(isInternalFollowUpUrl('/account/reservations/abc')).toBe(true)
    expect(isInternalFollowUpUrl('/catalogue')).toBe(true)
    expect(isInternalFollowUpUrl('https://terrassea.com/prix')).toBe(true)
    expect(isInternalFollowUpUrl('https://terrassea.com')).toBe(true)
    expect(isInternalFollowUpUrl('')).toBe(false)
    expect(isInternalFollowUpUrl('//evil.test/x')).toBe(false)
    expect(isInternalFollowUpUrl('https://evil.test/terrassea.com')).toBe(false)
    expect(isInternalFollowUpUrl('https://terrassea.com.evil.test/')).toBe(
      false,
    )
    expect(isInternalFollowUpUrl('http://terrassea.com/')).toBe(false)
    expect(isInternalFollowUpUrl('javascript:alert(1)')).toBe(false)
    expect(isInternalFollowUpUrl('/chemin avec espace')).toBe(false)
  })

  it('makes paths absolute and leaves absolute URLs alone', () => {
    expect(absoluteFollowUpUrl('/account')).toBe(
      'https://terrassea.com/account',
    )
    expect(absoluteFollowUpUrl('https://terrassea.com/prix')).toBe(
      'https://terrassea.com/prix',
    )
  })
})

describe('describeFollowUps', () => {
  it('returns null without follow-ups', () => {
    expect(describeFollowUps([])).toBeNull()
  })

  it('shows the latest date (Paris time) and the count', () => {
    expect(
      describeFollowUps([
        { sentAt: '2026-09-01T10:00:00.000Z' },
        { sentAt: '2026-09-24T23:30:00.000Z' },
        { sentAt: '2026-09-10T10:00:00.000Z' },
      ]),
    ).toBe('Relancé le 25/09/2026 (3)')
  })
})
