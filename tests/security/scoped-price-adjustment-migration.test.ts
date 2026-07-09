import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260709120000_scoped_price_adjustment.sql',
  ),
  'utf8',
)

describe('scoped price adjustment migration', () => {
  it('guards both RPCs behind is_admin() and revokes anon', () => {
    for (const fn of [
      'admin_preview_price_adjustment',
      'admin_apply_price_adjustment',
    ]) {
      const body = migration.slice(migration.indexOf(`function public.${fn}`))
      expect(body, fn).toMatch(/if not public\.is_admin\(\) then/)
      expect(migration).toContain(
        `revoke execute on function public.${fn}(jsonb) from public, anon`,
      )
    }
    expect(migration).not.toMatch(
      /grant execute on function public\.admin_\w+_price_adjustment[\s\S]{0,40}to[^;]*anon/,
    )
  })

  it('bounds the adjustment and scopes by category / sku prefix only', () => {
    expect(
      migration.match(/percent must be between -50 and 100/g)?.length,
    ).toBe(2)
    expect(
      migration.match(
        /v_category is null or p\.category::text = v_category/g,
      )?.length,
    ).toBe(2)
    expect(
      migration.match(
        /v_sku_prefix is null or upper\(p\.sku\) like upper\(v_sku_prefix\) \|\| '%'/g,
      )?.length,
    ).toBe(2)
    // Only active products, only base_price_ht is written.
    expect(migration).toMatch(
      /update public\.products p\s+set base_price_ht = round\(p\.base_price_ht \* \(1 \+ v_percent \/ 100\), 2\)/,
    )
  })

  it('flags below-floor prices in the preview when real costs exist', () => {
    expect(migration).toMatch(/min_margin_floor/)
    expect(migration).toMatch(
      /ppi\.fob_usd is not null and ppi\.qty_per_container is not null/,
    )
  })
})
