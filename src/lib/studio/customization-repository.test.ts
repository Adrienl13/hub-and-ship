import { it, expect, vi } from 'vitest'
import {
  fetchCustomizationCapabilities,
  CAPABILITY_PUBLIC_COLUMNS,
} from './customization-repository'
import type { TableRulesClient } from './table-repository'
const row = {
  id: 'c',
  product_id: 'p',
  scope: 'seat',
  kind: 'structure_color',
  status: 'verified',
  values: ['Bleu'],
  allows_free_text: false,
  requires_review: false,
  min_quantity: null,
  max_quantity: null,
}
function client(data: unknown[] | null, error: unknown = null) {
  const select = vi.fn(() => {
    const q = { order: () => q, range: async () => ({ data, error }) }
    return q
  })
  return {
    client: { from: () => ({ select }) } as unknown as TableRulesClient,
    select,
  }
}
it('projection minimale, données valides uniquement', async () => {
  const c = client([row])
  expect(await fetchCustomizationCapabilities(c.client)).toEqual({
    available: true,
    capabilities: [row],
  })
  expect(c.select).toHaveBeenCalledWith(CAPABILITY_PUBLIC_COLUMNS.join(','))
  expect(CAPABILITY_PUBLIC_COLUMNS).not.toContain('provenance')
})
it('surface absente ou malformée : aucune option certifiée', async () => {
  for (const c of [
    client(null, 'missing'),
    client([{ ...row, min_quantity: 50, max_quantity: 10 }]),
    client([{ ...row, status: 'estimated' }]),
  ])
    expect((await fetchCustomizationCapabilities(c.client)).available).toBe(
      false,
    )
})
