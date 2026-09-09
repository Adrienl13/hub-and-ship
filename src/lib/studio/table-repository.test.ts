import { it, expect, vi } from 'vitest'
import {
  fetchTableCompatibility,
  type TableRulesClient,
} from './table-repository'
import { pair } from './table.test-helpers'
function client(failed = false, malformed = false) {
  const from = vi.fn((table: string) => ({
    select: vi.fn((columns: string) => {
      expect(columns).not.toContain('*')
      const q = {
        order: () => q,
        range: async () => ({
          data: table.endsWith('rules_public')
            ? [malformed ? { ...pair, verdict: 'anything' } : pair]
            : [],
          error: failed ? { message: 'missing migration' } : null,
        }),
      }
      return q
    }),
  }))
  return { from } as unknown as TableRulesClient
}
it('lit exclusivement les projections minimales', async () =>
  expect(await fetchTableCompatibility(client())).toMatchObject({
    available: true,
    rules: [pair],
  }))
it('échec ou règle malformée ne supprime jamais silencieusement une exception', async () => {
  expect((await fetchTableCompatibility(client(true))).available).toBe(false)
  expect((await fetchTableCompatibility(client(false, true))).available).toBe(
    false,
  )
})
