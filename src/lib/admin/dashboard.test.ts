import { describe, expect, it } from 'vitest'

import {
  ADMIN_DEMO_STOCK_REQUESTS,
  createAdminDashboardSnapshot,
} from './dashboard'

describe('admin dashboard snapshot', () => {
  it('combines reservations, stock and stock requests KPIs', () => {
    const snapshot = createAdminDashboardSnapshot()

    expect(snapshot.kpis).toMatchObject({
      activeReservations: 2,
      revenueHt: 20480,
      reservedCbm: 26.5,
      stockAvailableUnits: 199,
      newStockRequests: 2,
      productReferences: 6,
    })
    expect(snapshot.kpis.fillPercent).toBeCloseTo(94.64, 1)
  })

  it('exposes deterministic demo stock requests for the admin page', () => {
    expect(ADMIN_DEMO_STOCK_REQUESTS[0]?.companyName).toBe('Plage Miramar')
    expect(ADMIN_DEMO_STOCK_REQUESTS[1]?.productName).toBe(
      'Table Lyon Pied Central',
    )
  })
})
