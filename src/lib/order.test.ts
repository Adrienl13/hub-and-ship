import { afterEach, describe, expect, it } from 'vitest'

import { calculateOrder, type CartItem } from '@/lib/order'
import { PRODUCTS } from '@/lib/products'
import {
  resetActiveSalesChannel,
  setActiveSalesChannel,
} from '@/lib/pricing/channel-state'
import {
  resetPublicPricingRules,
  setPublicPricingRules,
} from '@/lib/pricing/public-rules'

const table = PRODUCTS.find((p) => p.category === 'table')!

function tableItem(quantity: number): CartItem {
  return {
    product: table,
    variant: table.variants[0]!,
    quantity,
  }
}

afterEach(() => {
  resetPublicPricingRules()
  resetActiveSalesChannel()
})

describe('calculateOrder — volume discount (C3)', () => {
  it('applies no discount below the first tier', () => {
    const totals = calculateOrder([tableItem(50)])
    expect(totals.volumeDiscountPercent).toBe(0)
    expect(totals.volumeDiscountAmount).toBe(0)
    expect(totals.totalHt).toBeCloseTo(totals.subtotalHt, 2)
  })

  it('applies −6% from 100 units and −10% from 150 units', () => {
    const at100 = calculateOrder([tableItem(100)])
    expect(at100.volumeDiscountPercent).toBe(6)
    expect(at100.volumeDiscountAmount).toBeCloseTo(at100.subtotalHt * 0.06, 2)
    expect(at100.totalHt).toBeCloseTo(at100.subtotalHt * 0.94, 2)

    const at150 = calculateOrder([tableItem(150)])
    expect(at150.volumeDiscountPercent).toBe(10)
    expect(at150.totalHt).toBeCloseTo(at150.subtotalHt * 0.9, 2)
  })

  it('derives fee, VAT, deposit and balance from the NET subtotal', () => {
    const totals = calculateOrder([tableItem(150)])
    // Toutes les dérivées se calent sur le total net, pas sur le brut.
    expect(totals.vat).toBeCloseTo(totals.totalHt * 0.2, 2)
    expect(totals.totalTtc).toBeCloseTo(totals.totalHt * 1.2, 2)
    // Invariant d'encaissement : frais + acompte + solde == total net.
    expect(
      totals.reservationFee + totals.payAt80Percent + totals.payBeforeShipping,
    ).toBeCloseTo(totals.totalHt, 2)
  })

  it('never discounts partner channels — mirrors the RPC direct-only rule', () => {
    setActiveSalesChannel('revendeur')
    const totals = calculateOrder([tableItem(150)])
    expect(totals.volumeDiscountPercent).toBe(0)
    expect(totals.totalHt).toBeCloseTo(totals.subtotalHt, 2)
  })

  it('follows the active tiers when the admin changes them', () => {
    setPublicPricingRules({ tier2_qty: 80, tier2_discount: 0.05 })
    const totals = calculateOrder([tableItem(80)])
    expect(totals.volumeDiscountPercent).toBe(5)
    expect(totals.totalHt).toBeCloseTo(totals.subtotalHt * 0.95, 2)
  })
})
