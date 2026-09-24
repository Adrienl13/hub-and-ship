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
    const csv = toCsv([{ name: 'Chaise', qty: 12, note: 'ok' }], columns)
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

  it('neutralise une cellule commençant par =', () => {
    const csv = toCsv(
      [{ name: '=HYPERLINK("http://x")', qty: -3, note: '+1' }],
      columns,
    )
    expect(csv).toContain('"\'=HYPERLINK(""http://x"")"')
    // Un nombre négatif reste un nombre, pas une formule.
    expect(csv).toContain(',-3,')
    expect(csv).toContain('"\'+1"')
  })

  it('neutralise aussi -, @, tabulation et retour chariot en tête de cellule', () => {
    const csv = toCsv(
      [
        { name: '-cmd', qty: 1, note: '@SUM(1)' },
        { name: '\tx', qty: 1, note: '\ry' },
      ],
      columns,
    )
    expect(csv).toContain('"\'-cmd"')
    expect(csv).toContain('"\'@SUM(1)"')
    expect(csv).toContain('"\'\tx"')
    expect(csv).toContain('"\'\ry"')
  })
})
