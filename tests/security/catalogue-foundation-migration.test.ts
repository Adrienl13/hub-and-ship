import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260518120000_catalogue_container_foundation.sql',
  ),
  'utf8',
)

describe('catalogue/container foundation migration', () => {
  it('creates the missing catalogue and container tables before later policies', () => {
    expect(migration).toContain('create type public.product_category')
    expect(migration).toContain('create type public.container_status')
    expect(migration).toContain('create table if not exists public.containers')
    expect(migration).toContain('create table if not exists public.products')
    expect(migration).toContain(
      'create table if not exists public.product_variants',
    )
    expect(migration).toContain(
      'create table if not exists public.container_seed_commitments',
    )
  })

  it('creates professionals and helpers needed by older security migrations', () => {
    expect(migration).toContain('create table if not exists public.professionals')
    expect(migration).toContain(
      'create or replace function public.handle_new_professional',
    )
    expect(migration).toContain('create or replace function public.is_admin')
  })

  it('enables RLS and grants only the expected API surface', () => {
    expect(migration).toContain(
      'alter table public.products enable row level security',
    )
    expect(migration).toContain(
      'alter table public.container_seed_commitments enable row level security',
    )
    expect(migration).toContain(
      'grant select on public.products to anon, authenticated',
    )
    expect(migration).toContain(
      'grant insert, update, delete on public.products to authenticated',
    )
  })
})
