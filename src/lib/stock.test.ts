import { describe, expect, it } from 'vitest'

import {
  calculateStockKpis,
  filterAndSortStockLines,
  getAvailableStockLines,
  getStockCategoryCounts,
} from './stock'

describe('available stock catalogue', () => {
  it('resolves stock lines with product and variant snapshots', () => {
    const lines = getAvailableStockLines()

    expect(lines).toHaveLength(5)
    expect(lines[0]?.product.name).toBe('Chaise Cannes Empilable')
    expect(lines[0]?.variant.name).toBe('Noir charbon')
  })

  it('calculates stock kpis for the urgent page', () => {
    const kpis = calculateStockKpis(getAvailableStockLines())

    expect(kpis).toEqual({
      references: 5,
      availableUnits: 199,
      reservedUnits: 18,
      totalValueHt: 29201,
    })
  })

  it('filters by category and free text search', () => {
    const lines = getAvailableStockLines()
    const filtered = filterAndSortStockLines({
      lines,
      filter: 'chair',
      search: 'anthracite',
      sort: 'priority',
    })

    expect(filtered.map((line) => line.id)).toEqual(['stock-monaco-anthracite'])
  })

  it('sorts by available stock descending', () => {
    const lines = filterAndSortStockLines({
      lines: getAvailableStockLines(),
      filter: 'all',
      search: '',
      sort: 'available-desc',
    })

    expect(lines.map((line) => line.availableUnits)).toEqual([
      86, 64, 22, 18, 9,
    ])
  })

  it('counts stocked references by product category', () => {
    expect(getStockCategoryCounts(getAvailableStockLines())).toEqual({
      all: 5,
      chair: 2,
      armchair: 1,
      table: 2,
      bench: 0,
    })
  })
})
