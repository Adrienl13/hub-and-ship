import { describe, expect, it } from 'vitest'

import { toCsv, type CsvColumn } from './csv'

interface Row {
  name: string
  qty: number
  note: string | null
}

const columns: ReadonlyArray<CsvColumn<Row>> = [
  { header: 'Nom', value: (r) => r.name },
  { header: 'Quantité', value: (r) => r.qty },
  { header: 'Note', value: (r) => r.note },
]

describe('toCsv', () => {
  it('writes a header and one row per record', () => {
    const csv = toCsv(
      [{ name: 'Chaise', qty: 12, note: 'ok' }],
      columns,
    )
    expect(csv).toBe('Nom,Quantité,Note\r\nChaise,12,ok')
  })

  it('quotes cells containing commas, quotes or newlines', () => {
    const csv = toCsv(
      [{ name: 'Table, ronde', qty: 1, note: 'dit "urgent"\nligne2' }],
      columns,
    )
    expect(csv).toContain('"Table, ronde"')
    expect(csv).toContain('"dit ""urgent""\nligne2"')
  })

  it('renders null/undefined as empty cells', () => {
    const csv = toCsv([{ name: 'X', qty: 0, note: null }], columns)
    expect(csv).toBe('Nom,Quantité,Note\r\nX,0,')
  })

  it('returns just the header for an empty list', () => {
    expect(toCsv([], columns)).toBe('Nom,Quantité,Note')
  })
})
