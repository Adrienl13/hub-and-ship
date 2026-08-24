import { useMemo, useState } from 'react'
import { ArrowRight, Minus, Plus, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

import { Reveal } from '@/components/motion-helpers'
import { getDefaultVariant } from '@/lib/catalogue'
import { formatEUR } from '@/lib/order'
import type { Product } from '@/lib/products'
import {
  COVERS_PRESETS,
  DEFAULT_COVERS,
  MAX_COVERS,
  MIN_COVERS,
  buildTerraceMix,
  coversPerTable,
  isDiningTable,
  isSeating,
  pickDefaultChair,
  pickDefaultTable,
} from '@/lib/terrace-mix'
import { useCartStore } from '@/stores/cart.store'

// Sélecteur VISUEL de produit : vignettes photo défilables — le visiteur
// voit le mobilier qu'il choisit (retour Adrien 08/2026 : les <select>
// texte n'étaient pas parlants).
function ProductPicker({
  label,
  products,
  selectedId,
  onSelect,
}: {
  readonly label: string
  readonly products: ReadonlyArray<Product>
  readonly selectedId: string
  readonly onSelect: (id: string) => void
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        role="listbox"
        aria-label={label}
        className="mt-1.5 flex gap-2 overflow-x-auto pb-1.5"
      >
        {products.map((product) => {
          const selected = product.id === selectedId
          return (
            <button
              key={product.id}
              type="button"
              role="option"
              aria-selected={selected}
              title={product.name}
              onClick={() => onSelect(product.id)}
              className={`w-[104px] shrink-0 rounded-sm border bg-card p-1.5 text-left transition-all ${
                selected
                  ? 'border-foreground ring-1 ring-foreground'
                  : 'border-[color:var(--sand-deep)] hover:border-foreground/40'
              }`}
            >
              <span className="flex h-16 w-full items-center justify-center overflow-hidden rounded-[3px] bg-white">
                <img
                  src={product.mainImageUrl}
                  alt=""
                  loading="lazy"
                  className="max-h-full w-auto object-contain"
                />
              </span>
              <span className="mt-1 block truncate text-[10px] leading-tight text-foreground">
                {product.name.replace(/^(Chaise|Fauteuil|Table) de \w+ /, '')}
              </span>
              <span className="block text-[10px] font-semibold tabular-nums text-muted-foreground">
                {formatEUR(product.basePriceHt)} HT
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// D4 — le configurateur de terrasse : le visiteur donne son nombre de
// couverts, le site répond par un mix chaises + tables chiffré et l'économie
// réelle vs retail. Le CTA charge le mix dans le vrai panier.
export function TerraceConfigurator({
  products,
}: {
  readonly products: ReadonlyArray<Product>
}) {
  // Assises = chaises ET fauteuils ; tables = vraies tables uniquement
  // (jamais les piètements vendus seuls, pourtant en catégorie « table »).
  const chairs = useMemo(() => products.filter(isSeating), [products])
  const tables = useMemo(() => products.filter(isDiningTable), [products])
  const [covers, setCovers] = useState(DEFAULT_COVERS)
  const [chairId, setChairId] = useState<string | null>(null)
  const [tableId, setTableId] = useState<string | null>(null)
  const setLineQty = useCartStore((state) => state.setLineQty)

  const chair =
    chairs.find((p) => p.id === chairId) ?? pickDefaultChair(products)
  const table =
    tables.find((p) => p.id === tableId) ?? pickDefaultTable(products)
  const mix =
    chair && table ? buildTerraceMix({ covers, chair, table }) : null

  // Sans chaise ET table au catalogue (état de chargement), pas de module.
  if (!chair || !table || !mix) return null

  const applyMix = () => {
    // setLineQty émet déjà l'événement add_to_cart du funnel (0 → n) ; le
    // mix charge le design par défaut de chaque produit, modifiable ensuite.
    setLineQty(chair.id, getDefaultVariant(chair).id, mix.chairUnits)
    setLineQty(table.id, getDefaultVariant(table).id, mix.tableUnits)
    // Sur /catalogue on scrolle vers la grille ; ailleurs (accueil), on
    // confirme avec un raccourci direct vers la finalisation — celui qui a
    // trouvé son bonheur n'a plus rien à chercher.
    const catalogueAnchor = document.getElementById('catalogue')
    if (catalogueAnchor) {
      toast.success(
        `Mix ${mix.covers} couverts ajouté : ${mix.chairUnits} chaises + ${mix.tableUnits} tables.`,
      )
      catalogueAnchor.scrollIntoView({ behavior: 'smooth' })
    } else {
      toast.success(
        `Mix ${mix.covers} couverts ajouté à votre commande : ${mix.chairUnits} chaises + ${mix.tableUnits} tables.`,
        {
          action: {
            label: 'Finaliser',
            onClick: () => window.location.assign('/catalogue'),
          },
        },
      )
    }
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

              {/* Tailles typiques en UN clic — le curseur ne sert plus qu'à
                  affiner (retour Adrien : « personne ne va cliquer jusqu'à
                  40 pour enfin avoir la combinaison »). */}
              <div className="mt-5 flex flex-wrap gap-2">
                {COVERS_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    aria-pressed={covers === preset}
                    onClick={() => setCovers(preset)}
                    className={`h-9 rounded-full border px-4 text-sm font-medium tabular-nums transition-colors ${
                      covers === preset
                        ? 'border-foreground bg-[color:var(--foreground)] text-[color:var(--background)]'
                        : 'border-[color:var(--sand-deep)] bg-card hover:border-foreground/40'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <div className="mt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => adjustCovers(-step)}
                  aria-label="Moins de couverts"
                  className="flex h-9 w-9 items-center justify-center rounded-sm border border-[color:var(--sand-deep)] bg-card transition-colors hover:border-foreground/40"
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
                  className="flex h-9 w-9 items-center justify-center rounded-sm border border-[color:var(--sand-deep)] bg-card transition-colors hover:border-foreground/40"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-5 space-y-4">
                <ProductPicker
                  label="Assise"
                  products={chairs}
                  selectedId={chair.id}
                  onSelect={setChairId}
                />
                <ProductPicker
                  label={`Table (${coversPerTable(table)} couverts par table)`}
                  products={tables}
                  selectedId={table.id}
                  onSelect={setTableId}
                />
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
                    Économie −{formatEUR(mix.totals.savings)} (−
                    {Math.round(mix.totals.savingsPercent)}%)
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={applyMix}
                className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-sm bg-[color:var(--foreground)] px-6 text-sm font-medium text-[color:var(--background)] transition-colors hover:bg-[color:var(--ink-soft)]"
              >
                Ajouter ce mix à ma commande
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
