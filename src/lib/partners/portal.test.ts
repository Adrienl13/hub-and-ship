import { describe, expect, it } from 'vitest'

import {
  filterAttributedReservations,
  partnerDealInsertPayload,
} from './portal'
import type { Database } from '@/lib/supabase/types'

type ReservationRow = Database['public']['Tables']['reservations']['Row']

function reservation(
  partial: Partial<ReservationRow> & { id: string },
): ReservationRow {
  return {
    partner_application_id: null,
    partner_deal_id: null,
    ...partial,
  } as ReservationRow
}

describe('filterAttributedReservations', () => {
  const appIds = new Set(['app-1'])
  const dealIds = new Set(['deal-1'])

  it('keeps reservations attributed by application id', () => {
    const rows = [reservation({ id: 'r1', partner_application_id: 'app-1' })]
    expect(filterAttributedReservations(rows, appIds, dealIds)).toHaveLength(1)
  })

  it('keeps reservations attributed by deal id', () => {
    const rows = [reservation({ id: 'r1', partner_deal_id: 'deal-1' })]
    expect(filterAttributedReservations(rows, appIds, dealIds)).toHaveLength(1)
  })

  it('drops reservations belonging to another partner or to the buyer only', () => {
    const rows = [
      reservation({ id: 'r1', partner_application_id: 'other-app' }),
      reservation({ id: 'r2', partner_deal_id: 'other-deal' }),
      reservation({ id: 'r3' }), // own buyer reservation, no attribution
    ]
    expect(filterAttributedReservations(rows, appIds, dealIds)).toHaveLength(0)
  })
})

describe('partnerDealInsertPayload', () => {
  const base = {
    applicationId: 'app-1',
    partnerCompanyName: 'CHR Conseil',
    partnerContactEmail: 'a@chr.fr',
    clientCompanyName: 'Restaurant Test',
    clientSiret: null,
    clientEmail: null,
    projectType: 'terrasse',
    projectCity: null,
    expectedBudgetHt: null,
    expectedPurchaseWindow: null,
    productInterest: null,
    message: null,
  }

  it('forces the submitted status and portal source (no self-protection)', () => {
    const payload = partnerDealInsertPayload(base)
    expect(payload.status).toBe('submitted')
    expect(payload.source).toBe('partner_portal')
    expect(payload.application_id).toBe('app-1')
    // A partner cannot smuggle a protection window into the insert.
    expect(payload).not.toHaveProperty('protected_until')
    expect(payload).not.toHaveProperty('protection_days')
  })
})
