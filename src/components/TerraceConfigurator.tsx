import { useMemo, useState } from 'react'
import { ArrowRight, Minus, Plus, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

import { Reveal } from '@/components/motion-helpers'
import { formatEUR } from '@/lib/order'
import type { Product } from '@/lib/products'
import {
  DEFAULT_COVERS,
  MAX_COVERS,
  MIN_COVERS,
  buildTerraceMix,
  coversPerTable,
  pickDefaultChair,
  pickDefaultTable,
} from '@/lib/terrace-mix'
import { useCartStore } from '@/stores/cart.store'

// D4 — le configurateur de terrasse : le visiteur donne son nombre de
// couverts, le site répond par un mix chaises + tables chiffré et l'économie
// réelle vs retail. Le CTA charge le mix dans le vrai panier.
export function TerraceConfigurator({
  products,
}: {
  readonly products: ReadonlyArray<Product>
}) {
  const chairs = useMemo(
    () => products.filter((p) => p.category === 'chair'),
    [products],
  )
  const tables = useMemo(
    () => products.filter((p) => p.category === 'table'),
    [products],
  )
  const [covers, setCovers] = useState(DEFAULT_COVERS)
  const [chairId, setChairId] = useState<string | null>(null)
  const [tableId, setTableId] = useState<string | null>(null)
  const setQty = useCartStore((state) => state.setQty)

  const chair =
    chairs.find((p) => p.id === chairId) ?? pickDefaultChair(products)
  const table =
    tables.find((p) => p.id === tableId) ?? pickDefaultTable(products)
  const mix =
    chair && table ? buildTerraceMix({ covers, chair, table }) : null

  // Sans chaise ET table au catalogue (état de chargement), pas de module.
  if (!chair || !table || !mix) return null

  const applyMix = () => {
    // setQty émet déjà l'événement add_to_cart du funnel (0 → n).
    setQty(chair.id, mix.chairUnits)
    setQty(table.id, mix.tableUnits)
    toast.success(
      `Mix ${mix.covers} couverts chargé : ${mix.chairUnits} chaises + ${mix.tableUnits} tables.`,
    )
    document
      .getElementById('catalogue')
      ?.scrollIntoView({ behavior: 'smooth' })
  }

  const step = 10
  const adjustCovers = (delta: number) => {
    setCovers((current) =>
      Math.min(MAX_COVERS, Math.max(MIN_COVERS, current + delta)),
    )
  }

  return (
    <section
      aria-label="Configurateur de terrasse"
      className="mx-auto max-w-7xl px-6 py-14"
    >
      <Reveal>
        <div className="overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]">
          <div className="grid gap-0 lg:grid-cols-2">
            {/* Entrées */}
            <div className="p-6 sm:p-8">
              <div className="label-eyebrow flex items-center gap-1.5 text-[color:var(--ember)]">
                <Sparkles className="h-3.5 w-3.5" />
                Configurateur de terrasse
              </div>
              <h2 className="mt-2 font-display text-2xl tracking-tight sm:text-3xl">
                Votre terrasse&nbsp;:{' '}
                <span className="tabular-nums">{mix.covers}</span> couverts.
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                On traduit vos couverts en mobilier commandable, au prix
                container.
              </p>

              <div className="mt-6 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => adjustCovers(-step)}
                  aria-label="Moins de couverts"
                  className="flex h-11 w-11 items-center justify-center rounded-sm border border-[color:var(--sand-deep)] bg-card transition-colors hover:border-foreground/40"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <input
                  type="range"
                  min={MIN_COVERS}
                  max={MAX_COVERS}
                  step={step}
                  value={covers}
                  onChange={(event) => setCovers(Number(event.target.value))}
                  aria-label="Nombre de couverts"
                  className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-[color:var(--sand-deep)] accent-[color:var(--ember)]"
                />
                <button
                  type="button"
                  onClick={() => adjustCovers(step)}
                  aria-label="Plus de couverts"
                  className="flex h-11 w-11 items-center justify-center rounded-sm border border-[color:var(--sand-deep)] bg-card transition-colors hover:border-foreground/40"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <label className="block text-xs text-muted-foreground">
                  Assise
                  <select
                    value={chair.id}
                    onChange={(event) => setChairId(event.target.value)}
                    className="mt-1 h-11 w-full rounded-sm border border-[color:var(--sand-deep)] bg-card px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                  >
                    {chairs.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {formatEUR(p.basePriceHt)} HT
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs text-muted-foreground">
                  Table ({coversPerTable(table)} couverts)
                  <select
                    value={table.id}
                    onChange={(event) => setTableId(event.target.value)}
                    className="mt-1 h-11 w-full rounded-sm border border-[color:var(--sand-deep)] bg-card px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                  >
                    {tables.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {formatEUR(p.basePriceHt)} HT
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {/* Résultat */}
            <div className="border-t border-[color:var(--sand-deep)] bg-card p-6 sm:p-8 lg:border-l lg:border-t-0">
              <div className="space-y-3">
                {[
                  {
                    product: chair,
                    units: mix.chairUnits,
                    note: mix.chairAdjusted
                      ? `${mix.covers} couverts → ${mix.chairUnits} chaises (minimum de série)`
                      : null,
                  },
                  {
                    product: table,
                    units: mix.tableUnits,
                    note: `${mix.coversPerTable} couverts par table`,
                  },
                ].map(({ product, units, note }) => (
                  <div key={product.id} className="flex items-center gap-3">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-[color:var(--sand-soft)]">
                      <img
                        src={product.mainImageUrl}
                        alt=""
                        loading="lazy"
                        className="max-h-full w-auto object-contain"
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {product.name}
                      </div>
                      {note && (
                        <div className="text-[11px] text-muted-foreground">
                          {note}
                        </div>
                      )}
                    </div>
                    <div className="font-display text-base font-semibold tabular-nums">
                      ×{units}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 border-t border-[color:var(--sand-deep)] pt-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-muted-foreground">
                    Total mobilier HT
                  </span>
                  <span className="font-display text-2xl font-semibold tabular-nums">
                    {formatEUR(mix.totals.subtotalHt)}
                  </span>
                </div>
                <div className="mt-1 flex items-baseline justify-between text-xs">
                  <span className="text-muted-foreground">
                    Équivalent retail FR
                  </span>
                  <span className="tabular-nums text-muted-foreground line-through">
                    {formatEUR(mix.totals.retailReference)}
                  </span>
                </div>
                {mix.totals.savings > 0 && (
                  <div className="mt-3 inline-flex items-center rounded-sm bg-[color:var(--forest-bg)] px-2.5 py-1 text-xs font-semibold text-[color:var(--forest)]">
                    Économie −{formatEUR(mix.totals.savings)} (
                    {mix.totals.savingsPercent}%)
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={applyMix}
                className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-sm bg-[color:var(--foreground)] px-6 text-sm font-medium text-[color:var(--background)] transition-colors hover:bg-[color:var(--ink-soft)]"
              >
                Charger ce mix dans ma commande
                <ArrowRight className="h-4 w-4" />
              </button>
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                Modifiable ensuite ligne par ligne dans le catalogue.
              </p>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  )
}
