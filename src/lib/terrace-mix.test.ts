import { describe, expect, it } from 'vitest'

import { PRODUCTS } from '@/lib/products'
import {
  buildTerraceMix,
  coversPerTable,
  pickDefaultChair,
  pickDefaultTable,
} from '@/lib/terrace-mix'

const chair = PRODUCTS.find((p) => p.category === 'chair')!
const tables = PRODUCTS.filter((p) => p.category === 'table')
const smallTable = tables.find((t) => t.dimensions.l < 140)!
const largeTable = tables.find((t) => t.dimensions.l >= 140)!

describe('coversPerTable', () => {
  it('reads the real table dimensions: bistro formats seat 4, 140cm+ seats 6', () => {
    expect(coversPerTable(smallTable)).toBe(4)
    expect(coversPerTable(largeTable)).toBe(6)
  })
})

describe('buildTerraceMix', () => {
  it('rounds chairs up to the series minimum (40 couverts → 50 chaises)', () => {
    const mix = buildTerraceMix({ covers: 40, chair, table: smallTable })!

    expect(mix.chairUnits).toBe(50)
    expect(mix.chairAdjusted).toBe(true)
    expect(mix.tableUnits).toBe(10)
  })

  it('respects the +10 chair step above the minimum (72 couverts → 80 chaises)', () => {
    const mix = buildTerraceMix({ covers: 72, chair, table: largeTable })!

    expect(mix.chairUnits).toBe(80)
    expect(mix.tableUnits).toBe(12)
    expect(mix.coversPerTable).toBe(6)
  })

  it('prices the mix through calculateOrder with the retail comparison', () => {
    const mix = buildTerraceMix({ covers: 40, chair, table: smallTable })!

    expect(mix.totals.subtotalHt).toBeGreaterThan(0)
    expect(mix.totals.retailReference).toBeGreaterThan(mix.totals.subtotalHt)
    expect(mix.totals.savings).toBe(
      mix.totals.retailReference - mix.totals.subtotalHt,
    )
  })

  it('clamps absurd inputs into the supported range', () => {
    const tiny = buildTerraceMix({ covers: 1, chair, table: smallTable })!
    expect(tiny.covers).toBe(10)

    const huge = buildTerraceMix({ covers: 9999, chair, table: smallTable })!
    expect(huge.covers).toBe(400)
  })
})

describe('default product picks', () => {
  it('picks the cheapest chair and table from the live list', () => {
    const cheapChair = pickDefaultChair(PRODUCTS)!
    const cheapTable = pickDefaultTable(PRODUCTS)!

    for (const p of PRODUCTS) {
      if (p.category === 'chair') {
        expect(cheapChair.basePriceHt).toBeLessThanOrEqual(p.basePriceHt)
      }
      if (p.category === 'table') {
        expect(cheapTable.basePriceHt).toBeLessThanOrEqual(p.basePriceHt)
      }
    }
  })

  it('returns null when the catalogue has no chair or table', () => {
    expect(pickDefaultChair([])).toBeNull()
    expect(pickDefaultTable([])).toBeNull()
  })
})
