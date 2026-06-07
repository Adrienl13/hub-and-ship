import { describe, expect, it } from 'vitest'

import { filterAttributedReservations } from './portal'
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
