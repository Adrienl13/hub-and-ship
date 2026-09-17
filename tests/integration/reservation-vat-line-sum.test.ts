// @vitest-environment node
//
// Le devis affiche la TVA produit par produit. Pour que le pied de page soit
// exactement la somme de ce que l'acheteur additionne des yeux, le client
// somme les lignes — et le serveur DOIT sommer les mêmes lignes de la même
// façon, sinon le contrôle d'entête du RPC (tolérance 0,05 €) finit par
// refuser une réservation légitime sur un panier à beaucoup de lignes.
//
// Ce test rejoue la migration 48 sur une doublure de la fonction dont les
// quatre lignes d'ancrage sont recopiées VERBATIM de la définition de
// production, puis compare centime par centime le résultat SQL au résultat de
// calculateOrder(). Si quelqu'un modifie un seul des deux calculs, ce test
// tombe.
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { afterAll, afterEach, beforeAll, expect, it } from 'vitest'

import { calculateOrder, type CartItem } from '@/lib/order'
import type { DesignVariant, Product } from '@/lib/products'
import { resetActiveSalesChannel } from '@/lib/pricing/channel-state'
import { resetPublicPricingRules } from '@/lib/pricing/public-rules'

let db: PGlite

// Doublure : mêmes noms de variables, mêmes lignes d'ancrage, même grille de
// paliers que la fonction en production (100 → −6 %, 150 → −10 %). Tout le
// reste (contrôles de payload, re-validation des prix, insertions) n'a aucune
// incidence sur l'arithmétique testée ici.
const STUB = `
create or replace function public.create_reservation_with_items(payload jsonb)
returns jsonb language plpgsql as $function$
declare
  v_item jsonb;
  v_qty int;
  v_line_subtotal numeric;
  v_subtotal_sum numeric := 0;
  v_units_sum int := 0;
  v_volume_rate numeric := 0;
  v_net_subtotal numeric;
  v_volume_discount numeric := 0;
  v_vat_rate numeric;
  v_vat numeric;
begin
  for v_item in select value from jsonb_array_elements(payload -> 'items')
  loop
    v_qty := (v_item ->> 'quantity')::int;
    v_line_subtotal := round((v_item ->> 'unit_price_ht')::numeric * v_qty, 2);
    v_subtotal_sum := v_subtotal_sum + v_line_subtotal;
    v_units_sum := v_units_sum + v_qty;
  end loop;

  if v_units_sum >= 150 then
    v_volume_rate := 0.10;
  elsif v_units_sum >= 100 then
    v_volume_rate := 0.06;
  end if;
  v_net_subtotal := round(v_subtotal_sum * (1 - v_volume_rate), 2);
  v_volume_discount := round(v_subtotal_sum - v_net_subtotal, 2);

  -- Derived monetary fields recomputed from the authoritative NET subtotal.
  v_vat_rate := 20.00; -- taux serveur : jamais repris du payload client
  v_vat := round(v_net_subtotal * v_vat_rate / 100, 2);

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

const MIGRATION = readFileSync(
  'supabase/migrations/20260918110000_reservation_vat_line_sum.sql',
  'utf8',
)

beforeAll(async () => {
  db = new PGlite()
  await db.exec(STUB)
  await db.exec(MIGRATION)
}, 30000)

afterAll(async () => {
  await db?.close()
})

afterEach(() => {
  resetPublicPricingRules()
  resetActiveSalesChannel()
})

type Line = { readonly price: number; readonly qty: number }

function cart(lines: ReadonlyArray<Line>): CartItem[] {
  return lines.map((line, index) => {
    const variant = { id: `v${index}`, name: 'Standard' } as DesignVariant
    const product = {
      id: `p${index}`,
      basePriceHt: line.price,
      ecoContribution: 0,
      cbmPerUnit: 0,
      retailPriceRef: 0,
      category: 'table',
      variants: [variant],
    } as unknown as Product
    return { product, variant, quantity: line.qty }
  })
}

async function serverTotals(lines: ReadonlyArray<Line>) {
  const payload = {
    items: lines.map((line) => ({
      unit_price_ht: line.price,
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

// Les prix sont ceux qui font apparaître les écarts d'arrondi : des centimes
// impairs, des quantités qui franchissent les paliers.
const CARTS: ReadonlyArray<{ label: string; lines: Line[] }> = [
  {
    label: 'sans remise',
    lines: [
      { price: 89.9, qty: 12 },
      { price: 73.85, qty: 20 },
      { price: 141.33, qty: 6 },
    ],
  },
  {
    label: '−6 % sur 12 lignes',
    lines: Array.from({ length: 12 }, (_, i) => ({
      price: 61.11 + i * 3.37,
      qty: 9,
    })),
  },
  {
    label: '−10 % sur 20 lignes',
    lines: Array.from({ length: 20 }, (_, i) => ({
      price: 47.03 + i * 7.91,
      qty: 8,
    })),
  },
  {
    label: 'une seule ligne au palier haut',
    lines: [{ price: 233.33, qty: 150 }],
  },
]

it.each(CARTS)(
  'client et serveur tombent au centime près — $label',
  async ({ lines }) => {
    const client = calculateOrder(cart(lines))
    const server = await serverTotals(lines)

    expect(server.subtotalHt).toBe(client.subtotalHt)
    expect(server.totalHt).toBe(client.totalHt)
    expect(server.vat).toBe(client.vat)
    expect(server.totalTtc).toBe(client.totalTtc)
    expect(server.volumeDiscountAmount).toBe(client.volumeDiscountAmount)
  },
)

// L'ancienne méthode, celle qu'on remplace : un pourcentage appliqué au total.
function rateOnTotal(lines: ReadonlyArray<Line>, rate: number) {
  const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100
  const gross = lines
    .map((line) => round2(line.price * line.qty))
    .reduce((sum, line) => sum + line, 0)
  const net = round2(gross * (1 - rate))
  return { totalHt: net, vat: round2(net * 0.2) }
}

it('le correctif change VRAIMENT le résultat : 2 centimes de total HT', async () => {
  // 12 lignes à −6 % : la somme des lignes remisées et le pourcentage appliqué
  // au total ne donnent pas le même montant. Sans ce constat, les tests
  // d'égalité ci-dessus passeraient aussi bien AVANT le correctif.
  const lines = CARTS[1]!.lines
  const server = await serverTotals(lines)
  const ancien = rateOnTotal(lines, 0.06)

  expect(server.totalHt).toBe(8085.54)
  expect(ancien.totalHt).toBe(8085.56)
  expect(server.totalHt).not.toBe(ancien.totalHt)
})

it('le correctif change VRAIMENT le résultat : 1 centime de TVA', async () => {
  // 20 lignes à −10 % : ici c'est la TVA qui diverge.
  const lines = CARTS[2]!.lines
  const server = await serverTotals(lines)
  const ancien = rateOnTotal(lines, 0.1)

  expect(server.vat).toBe(3518.65)
  expect(ancien.vat).toBe(3518.64)
  expect(server.vat).not.toBe(ancien.vat)
})

it('reste idempotente : rejouer la migration ne casse rien', async () => {
  await db.exec(MIGRATION)
  const server = await serverTotals(CARTS[1]!.lines)
  const client = calculateOrder(cart(CARTS[1]!.lines))
  expect(server.vat).toBe(client.vat)
})
