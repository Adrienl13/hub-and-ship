import { describe, expect, it } from 'vitest'

import {
  LOCAL_PARTNER_SUBMISSIONS_KEY,
  buildPartnerSubmissionDraft,
  readLocalPartnerSubmissions,
  savePartnerSubmissionToLocalHistory,
  type PartnerSubmissionStorage,
} from './submission'

function createStorage(): PartnerSubmissionStorage & {
  readonly entries: Map<string, string>
} {
  const entries = new Map<string, string>()
  return {
    entries,
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
  }
}

const baseInput = {
  partnerKind: 'reseller',
  companyName: 'CHR Conseil',
  contactName: 'Claire Martin',
  contactEmail: 'CLAIRE@CHR-CONSEIL.FR',
  contactPhone: '+33 6 00 00 00 00',
  siret: '12345678900011',
  website: '',
  territory: 'Bretagne',
  networkDescription: 'Réseau de restaurateurs côtiers',
  expectedMonthlyVolume: '1 container par trimestre',
  message: 'Premier contact depuis le réseau CHR.',
  now: '2026-06-06T10:00:00.000Z',
} as const

describe('partner submission draft builder', () => {
  it('normalizes and maps a partner application', () => {
    const result = buildPartnerSubmissionDraft({
      mode: 'application',
      ...baseInput,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.draft.localId).toBe(
      'partner-application-chr-conseil-20260606100000',
    )
    expect(result.draft.deal).toBeNull()
    expect(result.draft.application).toMatchObject({
      status: 'new',
      partner_kind: 'reseller',
      company_name: 'CHR Conseil',
      contact_email: 'claire@chr-conseil.fr',
      source: 'partners_page',
      website: null,
      territory: 'Bretagne',
      created_at: '2026-06-06T10:00:00.000Z',
    })
  })

  it('builds a protected opportunity draft with the default 120 day rule', () => {
    const result = buildPartnerSubmissionDraft({
      mode: 'deal',
      ...baseInput,
      clientCompanyName: 'Restaurant Atlantique',
      clientSiret: '55208131701750',
      clientEmail: '',
      projectCity: 'Nantes',
      projectType: 'Terrasse 120 places',
      expectedBudgetHt: 18000,
      expectedPurchaseWindow: 'Juillet',
      productInterest: 'Chaises empilables et tables compactes',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.draft.application.source).toBe('partners_deal_form')
    expect(result.draft.deal).toMatchObject({
      status: 'submitted',
      partner_company_name: 'CHR Conseil',
      partner_contact_email: 'claire@chr-conseil.fr',
      client_company_name: 'Restaurant Atlantique',
      client_siret: '55208131701750',
      client_email: null,
      project_type: 'Terrasse 120 places',
      expected_budget_ht: 18000,
      protection_days: 120,
      protected_until: null,
      source: 'partners_deal_form',
    })
  })

  it('requires a client identifier for deal registration', () => {
    const result = buildPartnerSubmissionDraft({
      mode: 'deal',
      ...baseInput,
      clientCompanyName: 'Restaurant Atlantique',
      projectType: 'Terrasse 120 places',
    })

    expect(result).toEqual({
      ok: false,
      error: 'Ajoutez au moins un SIRET client ou un email client',
    })
  })

  it('keeps a deduplicated local fallback history', () => {
    const storage = createStorage()
    const first = buildPartnerSubmissionDraft({
      mode: 'application',
      ...baseInput,
    })
    const second = buildPartnerSubmissionDraft({
      mode: 'application',
      ...baseInput,
      message: 'Message mis à jour.',
    })

    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    if (!first.ok || !second.ok) return

    savePartnerSubmissionToLocalHistory({ storage, draft: first.draft })
    savePartnerSubmissionToLocalHistory({ storage, draft: second.draft })

    expect(storage.entries.has(LOCAL_PARTNER_SUBMISSIONS_KEY)).toBe(true)
    expect(readLocalPartnerSubmissions(storage)).toEqual([second.draft])
  })
})
