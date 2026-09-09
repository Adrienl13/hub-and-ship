// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { it, expect } from 'vitest'

it('replays both reservation vocabularies before the recovered legacy schema', async () => {
  const foundation = readFileSync(
    'supabase/migrations/20260518162000_reservation_foundation.sql',
    'utf8',
  )
  const legacy = readFileSync(
    'supabase/migrations/20260520101823_rattrapage_schema.sql',
    'utf8',
  )
  const db = new PGlite()
  try {
    // Run the real enum declarations as a completed earlier migration.
    await db.exec(
      foundation.slice(
        0,
        foundation.indexOf('create table if not exists public.reservations'),
      ),
    )
    const statuses = [
      'draft',
      'pending_reservation_fee',
      'reserved',
      'deposit_called',
      'deposit_paid',
      'in_production',
      'in_transit',
      'delivered',
      'cancelled',
      'pending_payment',
      'confirmed',
    ]
    expect(
      (
        await db.query<{ value: string }>(
          'select unnest(enum_range(null::public.reservation_status))::text as value',
        )
      ).rows.map((r) => r.value),
    ).toEqual(statuses)
    await db.exec(`create table containers(id uuid primary key); create table professionals(id uuid primary key);
      create table products(id text primary key,cbm_per_unit numeric);create table product_variants(id text primary key,product_id text);
      insert into containers values ('00000000-0000-0000-0000-000000000001');insert into professionals values ('00000000-0000-0000-0000-000000000002');
      insert into products values ('p',.1);insert into product_variants values ('v','p');`)
    for (const table of [
      'container_reservations',
      'container_reservation_items',
      'container_seed_commitments',
    ]) {
      const start = legacy.indexOf(
        `create table if not exists public.${table} (`,
      )
      expect(start).toBeGreaterThan(0)
      await db.exec(legacy.slice(start, legacy.indexOf('\n);', start) + 4))
    }
    const viewStart = legacy.indexOf(
      'create or replace view public.container_variant_commitments as',
    )
    await db.exec(legacy.slice(viewStart, legacy.indexOf(';', viewStart) + 1))
    await db.exec(`insert into container_reservations(id,container_id,professional_id,subtotal_ht,reservation_fee) values ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',10,1);
      insert into container_reservation_items(reservation_id,product_id,variant_id,quantity,unit_price_ht,cbm_per_unit) values ('00000000-0000-0000-0000-000000000003','p','v',4,10,.1);`)
    expect(
      (await db.query('select status::text from container_reservations')).rows,
    ).toEqual([{ status: 'pending_payment' }])
    for (const status of ['pending_payment', 'confirmed']) {
      await db.query(
        'update container_reservations set status=$1::public.reservation_status',
        [status],
      )
      expect(
        (
          await db.query(
            'select units_committed from container_variant_commitments',
          )
        ).rows,
      ).toEqual([{ units_committed: 4 }])
    }
    await db.exec("update container_reservations set status='cancelled'")
    expect(
      (await db.query('select * from container_variant_commitments')).rows,
    ).toEqual([])
    // Every literal cast in the untouched recovered migration must resolve.
    for (const [, value] of legacy.matchAll(
      /'([^']+)'::public\.reservation_status/g,
    ))
      await db.query('select $1::public.reservation_status', [value])
  } finally {
    await db.close()
  }
}, 30000)

it('stock fixture seed tolerates an empty catalogue and preserves matching historical rows', async () => {
  const db = new PGlite()
  try {
    await db.exec(`create role authenticated;create table products(id text primary key);create table product_variants(id text primary key,product_id text);
      create function public.is_admin() returns boolean language sql as $$select false$$;
      create function public.set_updated_at() returns trigger language plpgsql as $$begin new.updated_at=now();return new;end$$;`)
    const sql = readFileSync(
      'supabase/migrations/20260601090000_stock_lines.sql',
      'utf8',
    )
    await db.exec(sql)
    expect((await db.query('select * from stock_lines')).rows).toEqual([])
    await db.exec(
      "insert into products values ('p1');insert into product_variants values ('v1a','p1')",
    )
    const seed = sql.slice(sql.indexOf('insert into public.stock_lines'))
    await db.exec(seed)
    await db.exec(seed)
    expect(
      (
        await db.query(
          'select id,product_id,variant_id,available_units,reserved_units,stock_price_ht::text,condition::text from stock_lines',
        )
      ).rows,
    ).toEqual([
      {
        id: 'stock-cannes-noir',
        product_id: 'p1',
        variant_id: 'v1a',
        available_units: 86,
        reserved_units: 12,
        stock_price_ht: '109.00',
        condition: 'new',
      },
    ])
  } finally {
    await db.close()
  }
}, 30000)

it('restores the original pricing enum before downstream function signatures', async () => {
  const db = new PGlite()
  try {
    const bridge = readFileSync(
      'supabase/migrations/20260705090000_pricing_engine_bridge.sql',
      'utf8',
    )
    const declaration = bridge.slice(0, bridge.indexOf('end $$;') + 7)
    await db.exec(declaration)
    await db.exec(declaration)
    expect(
      (
        await db.query<{ value: string }>(
          'select unnest(enum_range(null::public.pricing_channel))::text as value',
        )
      ).rows.map((r) => r.value),
    ).toEqual(['direct', 'reseller', 'distributor', 'admin'])
  } finally {
    await db.close()
  }
}, 30000)
