import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260615150000_product_favorites.sql',
  ),
  'utf8',
)

describe('product favourites migration', () => {
  it('creates the favourites table with ownership constraints', () => {
    expect(migration).toContain(
      'create table if not exists public.product_favorites',
    )
    expect(migration).toContain('primary key (user_id, product_id)')
    expect(migration).toContain('references public.products(id)')
  })

  it('enables RLS for own-row access only', () => {
    expect(migration).toContain(
      'alter table public.product_favorites enable row level security',
    )
    expect(migration).toContain('create policy "Users read own favourites"')
    expect(migration).toContain('create policy "Users add own active favourites"')
    expect(migration).toContain('create policy "Users remove own favourites"')
    expect(migration).toContain('user_id = auth.uid()')
  })
})
