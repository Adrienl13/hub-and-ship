// @vitest-environment node
//
// Les paliers de remise volume sont définis PAR FAMILLE : une chaise à 82 € et
// un salon à 1 367 € ne déclenchent pas un volume au même seuil. Le calcul
// vit à deux endroits — `calculateOrder` pour ce que voit l'acheteur, et
// `create_reservation_with_items` qui revalide tout au centime près au moment
// d'enregistrer. S'ils divergent, la réservation est refusée au dernier clic.
//
// Ce test rejoue les migrations 48 et 49 sur une doublure de la fonction dont
// les lignes d'ancrage sont recopiées VERBATIM de la définition de production
// (vérifié anchor par anchor avant écriture), puis compare les deux calculs.
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import { calculateOrder, type CartItem } from '@/lib/order'
import type { DesignVariant, Product, ProductCategory } from '@/lib/products'
import {
  resetActiveSalesChannel,
  setActiveSalesChannel,
} from '@/lib/pricing/channel-state'
import {
  resetPublicPricingRules,
  setPublicPricingRules,
} from '@/lib/pricing/public-rules'
import type { SalesChannel } from '@/lib/supabase/types'

let db: PGlite

const SCHEMA = `
create role anon;
create role authenticated;

create type public.sales_channel as enum
  ('direct','revendeur','distributeur','grand_compte');

create table public.pricing_parameters (
  is_active boolean not null default true,
  effective_from timestamptz not null default now(),
  tier2_qty int not null default 100,
  tier2_discount numeric not null default 0.06,
  tier3_qty int not null default 150,
  tier3_discount numeric not null default 0.10,
  -- colonnes lues par get_public_pricing_rules(), que la migration recrée
  reservation_fee_rate numeric not null default 0.03,
  reservation_fee_min numeric not null default 150,
  reservation_fee_max numeric not null default 500,
  distributor_min_order_cbm numeric
);
insert into public.pricing_parameters default values;

create table public.products (
  id text primary key,
  base_price_ht numeric not null,
  eco_contribution numeric not null default 0,
  cbm_per_unit numeric not null default 0,
  category text not null,
  is_active boolean not null default true
);
`

// Doublure du RPC : mêmes noms de variables et mêmes lignes d'ancrage que la
// fonction de production, réduite à l'arithmétique testée ici.
const STUB = `
create or replace function public.create_reservation_with_items(payload jsonb)
returns jsonb language plpgsql as $function$
declare
  v_item jsonb;
  v_qty int;
  v_product_id text;
  v_db_price numeric;
  v_db_eco numeric;
  v_db_cbm numeric;
  v_line_subtotal numeric;
  v_subtotal_sum numeric := 0;
  v_units_sum int := 0;
  v_channel public.sales_channel;
  v_tier2_qty int;
  v_tier2_discount numeric;
  v_tier3_qty int;
  v_tier3 numeric;
  v_volume_rate numeric := 0;
  v_line_subtotals numeric[] := '{}';
  v_line_net numeric;
  v_net_subtotal numeric;
  v_volume_discount numeric := 0;
  v_vat_rate numeric;
  v_vat numeric;
begin
  v_channel := coalesce((payload ->> 'channel')::public.sales_channel, 'direct');

  select p.tier2_qty, p.tier2_discount, p.tier3_qty, p.tier3_discount
    into v_tier2_qty, v_tier2_discount, v_tier3_qty, v_tier3
  from public.pricing_parameters p
  where p.is_active
  order by p.effective_from desc
  limit 1;

  for v_item in select value from jsonb_array_elements(payload -> 'items')
  loop
    v_qty := (v_item ->> 'quantity')::int;
    v_product_id := v_item ->> 'product_id';
    select base_price_ht, eco_contribution, cbm_per_unit
      into v_db_price, v_db_eco, v_db_cbm
      from public.products
      where id = v_product_id and is_active;
    v_line_subtotal := round(v_db_price * v_qty, 2);
    v_subtotal_sum := v_subtotal_sum + v_line_subtotal;
    v_line_subtotals := v_line_subtotals || v_line_subtotal;
    v_units_sum := v_units_sum + v_qty;
  end loop;

  if v_channel = 'direct' then
    if v_units_sum >= coalesce(v_tier3_qty, 150) then
      v_volume_rate := coalesce(v_tier3, 0.10);
    elsif v_units_sum >= coalesce(v_tier2_qty, 100) then
      v_volume_rate := coalesce(v_tier2_discount, 0.06);
    end if;
  end if;
  -- Total HT = somme des lignes remisées, pas un pourcentage du sous-total.
  v_net_subtotal := 0;
  foreach v_line_net in array v_line_subtotals loop
    v_net_subtotal := v_net_subtotal + round(v_line_net * (1 - v_volume_rate), 2);
  end loop;
  v_volume_discount := round(v_subtotal_sum - v_net_subtotal, 2);

  v_vat_rate := 20.00; -- taux serveur : jamais repris du payload client
  v_vat := 0;
  foreach v_line_net in array v_line_subtotals loop
    v_vat := v_vat + round(round(v_line_net * (1 - v_volume_rate), 2) * v_vat_rate / 100, 2);
  end loop;

  return jsonb_build_object(
    'subtotal_ht', v_subtotal_sum,
    'volume_discount', v_volume_discount,
    'total_ht', v_net_subtotal,
    'vat_amount', v_vat,
    'total_ttc', v_net_subtotal + v_vat
  );
end;
$function$;
`

// Doublure d'admin_save_pricing_parameters() réduite à ce qui nous intéresse :
// la liste de colonnes explicite. C'est elle qui perdrait la grille à chaque
// enregistrement si la migration ne la reportait pas.
const ADMIN_SAVE_STUB = `
create or replace function public.admin_save_pricing_parameters(payload jsonb)
returns jsonb language plpgsql as $function$
declare
  v_active public.pricing_parameters%rowtype;
  v_new public.pricing_parameters%rowtype;
begin
  select * into v_active
  from public.pricing_parameters
  where is_active
  order by effective_from desc
  limit 1;

  update public.pricing_parameters set is_active = false where is_active;

  insert into public.pricing_parameters (
    is_active, effective_from,
    tier2_qty, tier2_discount, tier3_qty, tier3_discount,
    reservation_fee_rate
  )
  select
    true, now(),
    coalesce((payload ->> 'tier2_qty')::int, v_active.tier2_qty),
    coalesce((payload ->> 'tier2_discount')::numeric, v_active.tier2_discount),
    coalesce((payload ->> 'tier3_qty')::int, v_active.tier3_qty),
    coalesce((payload ->> 'tier3_discount')::numeric, v_active.tier3_discount),
    coalesce((payload ->> 'reservation_fee_rate')::numeric, v_active.reservation_fee_rate)
  returning * into v_new;

  return to_jsonb(v_new);
end;
$function$;
`

const MIGRATION = readFileSync(
  'supabase/migrations/20260918120000_volume_discount_families.sql',
  'utf8',
)

// Grille d'essai — des chiffres de TEST, pas une proposition commerciale :
// ce qui est vérifié ici, c'est que chaque famille suit SA grille.
const GRID = {
  assises: [
    { min_units: 100, discount: 0.06 },
    { min_units: 150, discount: 0.1 },
  ],
  tables: [
    { min_units: 20, discount: 0.05 },
    { min_units: 40, discount: 0.08 },
  ],
  salons: [
    { min_units: 5, discount: 0.04 },
    { min_units: 10, discount: 0.07 },
  ],
  autres: [
    { min_units: 100, discount: 0.06 },
    { min_units: 150, discount: 0.1 },
  ],
}

type Line = {
  readonly id: string
  readonly category: ProductCategory
  readonly price: number
  readonly qty: number
}

const CATALOGUE: ReadonlyArray<Omit<Line, 'qty'>> = [
  { id: 'CHAISE', category: 'chair', price: 89.9 },
  { id: 'FAUTEUIL', category: 'armchair', price: 141.33 },
  { id: 'PLATEAU', category: 'table_top', price: 73.85 },
  { id: 'PIETEMENT', category: 'table_base', price: 61.11 },
  { id: 'SALON', category: 'lounge', price: 1367.32 },
]

beforeAll(async () => {
  db = new PGlite()
  await db.exec(SCHEMA)
  await db.exec(STUB)
  await db.exec(ADMIN_SAVE_STUB)
  await db.exec(MIGRATION)
  for (const row of CATALOGUE) {
    await db.query(
      'insert into public.products (id, base_price_ht, category) values ($1, $2, $3)',
      [row.id, row.price, row.category],
    )
  }
}, 30000)

afterAll(async () => {
  await db?.close()
})

afterEach(() => {
  resetPublicPricingRules()
  resetActiveSalesChannel()
})

async function useGrid(grid: unknown | null): Promise<void> {
  await db.query('update public.pricing_parameters set volume_discount_families = $1', [
    grid === null ? null : JSON.stringify(grid),
  ])
  setPublicPricingRules({ volume_discount_families: grid })
}

function cart(lines: ReadonlyArray<Line>): CartItem[] {
  return lines.map((line) => {
    const variant = { id: `${line.id}-v`, name: 'Standard' } as DesignVariant
    const product = {
      id: line.id,
      category: line.category,
      basePriceHt: line.price,
      ecoContribution: 0,
      cbmPerUnit: 0,
      retailPriceRef: 0,
      variants: [variant],
    } as unknown as Product
    return { product, variant, quantity: line.qty }
  })
}

async function serverTotals(
  lines: ReadonlyArray<Line>,
  channel: SalesChannel = 'direct',
) {
  const payload = {
    channel,
    items: lines.map((line) => ({
      product_id: line.id,
      quantity: line.qty,
    })),
  }
  const result = await db.query<{ out: Record<string, string> }>(
    'select public.create_reservation_with_items($1::jsonb) as out',
    [JSON.stringify(payload)],
  )
  const out = result.rows[0]!.out
  return {
    subtotalHt: Number(out.subtotal_ht),
    volumeDiscountAmount: Number(out.volume_discount),
    totalHt: Number(out.total_ht),
    vat: Number(out.vat_amount),
    totalTtc: Number(out.total_ttc),
  }
}

function line(id: string, qty: number): Line {
  const row = CATALOGUE.find((entry) => entry.id === id)!
  return { ...row, qty }
}

async function expectAgreement(
  lines: ReadonlyArray<Line>,
  channel: SalesChannel = 'direct',
) {
  if (channel !== 'direct') setActiveSalesChannel(channel)
  const client = calculateOrder(cart(lines))
  const server = await serverTotals(lines, channel)
  expect(server.subtotalHt).toBe(client.subtotalHt)
  expect(server.totalHt).toBe(client.totalHt)
  expect(server.vat).toBe(client.vat)
  expect(server.totalTtc).toBe(client.totalTtc)
  expect(server.volumeDiscountAmount).toBe(client.volumeDiscountAmount)
  return client
}

describe('sans grille par famille — rien ne change', () => {
  it('compte toutes les pièces ensemble et applique la grille unique', async () => {
    await useGrid(null)
    // 60 chaises + 60 plateaux = 120 pièces : sous l'ancien régime, −6 % sur
    // tout. C'est exactement ce que le site fait aujourd'hui.
    const totals = await expectAgreement([line('CHAISE', 60), line('PLATEAU', 60)])
    expect(totals.volumeDiscountPercent).toBe(6)
    expect(totals.volumeDiscountLines).toHaveLength(2)
  })

  it('ne remise rien sous le premier palier', async () => {
    await useGrid(null)
    const totals = await expectAgreement([line('CHAISE', 40)])
    expect(totals.volumeDiscountAmount).toBe(0)
    expect(totals.volumeDiscountLines).toHaveLength(0)
  })
})

describe('avec la grille par famille', () => {
  it('donne à chaque famille le palier de SES pièces', async () => {
    await useGrid(GRID)
    // 120 assises → −6 % ; 30 pièces de table → −5 % ; 6 salons → −4 %.
    const totals = await expectAgreement([
      line('CHAISE', 100),
      line('FAUTEUIL', 20),
      line('PLATEAU', 15),
      line('PIETEMENT', 15),
      line('SALON', 6),
    ])

    const byFamily = new Map(
      totals.volumeDiscountLines.map((entry) => [entry.family, entry]),
    )
    expect(byFamily.get('assises')).toMatchObject({
      units: 120,
      discountPercent: 6,
    })
    expect(byFamily.get('tables')).toMatchObject({
      units: 30,
      discountPercent: 5,
    })
    expect(byFamily.get('salons')).toMatchObject({
      units: 6,
      discountPercent: 4,
    })
  })

  it('récompense enfin le volume sur les salons', async () => {
    await useGrid(GRID)
    // Le cas qui motive tout : dix salons, c'est 13 673 € — sous l'ancienne
    // grille (100 pièces), zéro remise.
    const totals = await expectAgreement([line('SALON', 10)])
    expect(totals.volumeDiscountPercent).toBe(7)

    await useGrid(null)
    const ancien = calculateOrder(cart([line('SALON', 10)]))
    expect(ancien.volumeDiscountAmount).toBe(0)
  })

  it('ne remise pas une famille qui n’atteint pas son propre palier', async () => {
    await useGrid(GRID)
    // 150 assises (−10 %) mais 3 salons seulement : le salon reste plein tarif,
    // alors que l'ancien comptage global lui aurait offert −10 %.
    const totals = await expectAgreement([line('CHAISE', 150), line('SALON', 3)])
    expect(totals.volumeDiscountLines).toHaveLength(1)
    expect(totals.volumeDiscountLines[0]).toMatchObject({
      family: 'assises',
      discountPercent: 10,
    })
  })

  it('ne donne aucune remise volume à un revendeur', async () => {
    await useGrid(GRID)
    const totals = await expectAgreement(
      [line('CHAISE', 200), line('SALON', 20)],
      'revendeur',
    )
    expect(totals.volumeDiscountAmount).toBe(0)
  })
})

describe('la grille refuse ce qui est incohérent', () => {
  async function accepted(grid: unknown): Promise<boolean> {
    const result = await db.query<{ ok: boolean }>(
      'select public.volume_discount_families_are_valid($1::jsonb) as ok',
      [JSON.stringify(grid)],
    )
    return result.rows[0]!.ok
  }

  it('accepte une grille complète et croissante', async () => {
    expect(await accepted(GRID)).toBe(true)
  })

  it('refuse une famille manquante', async () => {
    const partial: Record<string, unknown> = { ...GRID }
    delete partial.salons
    expect(await accepted(partial)).toBe(false)
  })

  it('refuse des paliers qui ne progressent pas', async () => {
    expect(
      await accepted({
        ...GRID,
        tables: [
          { min_units: 40, discount: 0.08 },
          { min_units: 20, discount: 0.05 },
        ],
      }),
    ).toBe(false)
  })

  it('refuse une remise au-delà du plafond de la règle d’or', async () => {
    // 0,9 au lieu de 0,09 : le client direct passerait sous le prix revendeur.
    expect(
      await accepted({ ...GRID, salons: [{ min_units: 5, discount: 0.9 }] }),
    ).toBe(false)
  })

  it('la contrainte de table refuse une grille invalide', async () => {
    await expect(
      db.query('update public.pricing_parameters set volume_discount_families = $1', [
        JSON.stringify({ assises: [] }),
      ]),
    ).rejects.toThrow()
    await useGrid(null)
  })
})

describe('la grille survit à un enregistrement des paramètres', () => {
  it('n’est pas perdue quand l’admin modifie un paramètre sans rapport', async () => {
    await useGrid(GRID)
    // L'admin change les frais de réservation : la nouvelle version de
    // paramètres doit REPORTER la grille, sinon toutes les remises
    // repasseraient au comptage global sans que personne ne l'ait demandé.
    await db.query(
      "select public.admin_save_pricing_parameters('{\"reservation_fee_rate\":0.04}'::jsonb)",
    )
    const result = await db.query<{ grid: unknown }>(
      'select volume_discount_families as grid from public.pricing_parameters where is_active',
    )
    expect(result.rows[0]!.grid).toEqual(GRID)

    // Et le calcul suit toujours les paliers par famille.
    const totals = await expectAgreement([line('SALON', 10)])
    expect(totals.volumeDiscountPercent).toBe(7)

    await db.query('delete from public.pricing_parameters where not is_active')
    await useGrid(null)
  })
})

it('n’est pas appelable directement par anon', async () => {
  const result = await db.query<{ anon: boolean; auth: boolean }>(`
    select
      has_function_privilege('anon',
        'public.volume_discount_rate(text,int,int,public.sales_channel)','EXECUTE') as anon,
      has_function_privilege('authenticated',
        'public.volume_discount_rate(text,int,int,public.sales_channel)','EXECUTE') as auth
  `)
  expect(result.rows[0]).toEqual({ anon: false, auth: false })
})
