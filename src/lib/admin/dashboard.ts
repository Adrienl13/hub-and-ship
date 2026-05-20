import {
  ACCOUNT_RESERVATIONS,
  calculateAccountReservationKpis,
  type AccountReservation,
} from '@/lib/account/reservations'
import { CURRENT_CONTAINER, PRODUCTS } from '@/lib/products'
import {
  calculateStockKpis,
  getAvailableStockLines,
  type StockLine,
} from '@/lib/stock'
import {
  buildStockRequestDraft,
  type StockRequestDraft,
} from '@/lib/stock-requests'

export interface AdminDashboardSnapshot {
  readonly reservations: ReadonlyArray<AccountReservation>
  readonly stockLines: ReadonlyArray<StockLine>
  readonly stockRequests: ReadonlyArray<StockRequestDraft>
  readonly kpis: {
    readonly activeReservations: number
    readonly revenueHt: number
    readonly reservedCbm: number
    readonly fillPercent: number
    readonly stockAvailableUnits: number
    readonly newStockRequests: number
    readonly productReferences: number
  }
}

function requireStockRequest(
  result: ReturnType<typeof buildStockRequestDraft>,
) {
  if (!result.ok) {
    throw new Error(
      result.issues[0]?.message ?? 'Invalid stock request fixture',
    )
  }

  return result.draft
}

const stockLines = getAvailableStockLines()

export const ADMIN_DEMO_STOCK_REQUESTS: ReadonlyArray<StockRequestDraft> = [
  requireStockRequest(
    buildStockRequestDraft({
      line: stockLines[0]!,
      companyName: 'Plage Miramar',
      contactEmail: 'direction@plage-miramar.fr',
      contactPhone: '+33 4 91 00 00 01',
      requestedQuantity: 36,
      customerNote: 'Besoin avant ouverture du week-end.',
      now: new Date('2026-05-18T08:30:00.000Z'),
    }),
  ),
  requireStockRequest(
    buildStockRequestDraft({
      line: stockLines[2]!,
      companyName: 'Brasserie du Port',
      contactEmail: 'achat@brasserie-port.fr',
      contactPhone: '+33 4 91 00 00 02',
      requestedQuantity: 12,
      customerNote: 'Tables à mixer avec chaises existantes.',
      now: new Date('2026-05-18T11:15:00.000Z'),
    }),
  ),
] as const

export function createAdminDashboardSnapshot({
  reservations = ACCOUNT_RESERVATIONS,
  stockRequests = ADMIN_DEMO_STOCK_REQUESTS,
  stock = stockLines,
}: {
  readonly reservations?: ReadonlyArray<AccountReservation>
  readonly stockRequests?: ReadonlyArray<StockRequestDraft>
  readonly stock?: ReadonlyArray<StockLine>
} = {}): AdminDashboardSnapshot {
  const reservationKpis = calculateAccountReservationKpis(reservations)
  const stockKpis = calculateStockKpis(stock)

  return {
    reservations,
    stockLines: stock,
    stockRequests,
    kpis: {
      activeReservations: reservationKpis.activeCount,
      revenueHt: reservationKpis.totalCommittedHt,
      reservedCbm: reservationKpis.totalCbm,
      fillPercent: Math.min(
        100,
        (reservationKpis.totalCbm / CURRENT_CONTAINER.capacityCbm) * 100,
      ),
      stockAvailableUnits: stockKpis.availableUnits,
      newStockRequests: stockRequests.filter(
        (request) => request.status === 'new',
      ).length,
      productReferences: PRODUCTS.length,
    },
  }
}
