import { describe, expect, it } from 'vitest'

import {
  ADMIN_DEMO_STOCK_REQUESTS,
  createAdminDashboardSnapshot,
} from './dashboard'

describe('admin dashboard snapshot', () => {
  it('zeros out reservation KPIs when no reservations are passed in', () => {
    const snapshot = createAdminDashboardSnapshot()

    expect(snapshot.kpis).toMatchObject({
      activeReservations: 0,
      revenueHt: 0,
      reservedCbm: 0,
      stockAvailableUnits: 199,
      newStockRequests: 2,
      productReferences: 6,
    })
    expect(snapshot.kpis.fillPercent).toBe(0)
  })

  it('exposes deterministic demo stock requests for the admin page', () => {
    expect(ADMIN_DEMO_STOCK_REQUESTS[0]?.companyName).toBe('Plage Miramar')
    expect(ADMIN_DEMO_STOCK_REQUESTS[1]?.productName).toBe(
      'Table Lyon Pied Central',
    )
  })
})
