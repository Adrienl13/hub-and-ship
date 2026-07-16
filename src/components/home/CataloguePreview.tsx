import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'

import { CountdownBadge } from '@/components/CountdownBadge'
import { CATEGORY_FILTERS, type CatalogueFilter } from '@/lib/catalogue'
import { formatEUR } from '@/lib/order'
import type { ContainerSummary, Product } from '@/lib/products'

// Aperçu catalogue de l'accueil v2 : chips de catégories fonctionnels,
// fiches produit RÉELLES (prix, barre MOQ, compteur réservés) et panneau
// container sticky avec les mêmes données temps réel que le hero.

const PREVIEW_COUNT = 3

function committedUnits(product: Product): number {
  return product.variants.reduce(
    (sum, variant) => sum + variant.unitsCommitted,
    0,
  )
}

export function CataloguePreview({
  products,
  container,
  fillPercent,
  usedCbm,
  capacity,
  seriesReached,
  totalSeries,
  professionalsEngaged,
  hasSelection,
  onReserve,
  onDownloadPdf,
  onOpenProduct,
}: {
  readonly products: ReadonlyArray<Product>
  readonly container: ContainerSummary
  readonly fillPercent: number
  readonly usedCbm: number
  readonly capacity: number
  readonly seriesReached: number
  readonly totalSeries: number
  readonly professionalsEngaged: number
  readonly hasSelection: boolean
  readonly onReserve: () => void
  readonly onDownloadPdf: () => void
  readonly onOpenProduct: (productId: string) => void
}) {
  const [filter, setFilter] = useState<CatalogueFilter>('all')

  // Les plus engagées d'abord : la preuve sociale est réelle (MOQ committed).
  const preview = useMemo(() => {
    const pool =
      filter === 'all'
        ? [...products]
        : products.filter((p) => p.category === filter)
    return pool
      .sort((a, b) => committedUnits(b) - committedUnits(a))
      .slice(0, PREVIEW_COUNT)
  }, [products, filter])

  return (
    <section className="mx-auto max-w-[1240px] px-5 pt-16 sm:px-10 lg:pt-[104px]">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-6 lg:gap-10">
        <div>
          <div className="mb-3.5 text-[13px] font-bold uppercase tracking-[0.14em] text-[color:var(--ember)]">
            Catalogue
          </div>
          <h2 className="m-0 max-w-[640px] text-[26px] font-extrabold leading-[1.05] tracking-[-0.025em] sm:text-[33px] lg:text-[40px]">
            Choisissez vos modèles, design par design.
          </h2>
        </div>
        <Link
          to="/catalogue"
          className="whitespace-nowrap border-b-2 border-[color:var(--ember)] pb-0.5 text-[15px] font-semibold text-[#4a443c] transition-colors hover:text-foreground"
        >
          Ouvrir le catalogue complet →
        </Link>
      </div>
      <p className="mb-7 mt-0 max-w-[640px] text-[17px] text-[color:var(--color-text-secondary)]">
        Chaque référence affiche son MOQ en temps réel : ajoutez votre
        quantité pour déclencher la série.
      </p>

      <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="mb-5 flex flex-wrap gap-2">
            {CATEGORY_FILTERS.map((category) => {
              const active = category.id === filter
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setFilter(category.id)}
                  aria-pressed={active}
                  className={
                    'rounded-full px-4 py-2 text-[13.5px] transition-colors ' +
                    (active
                      ? 'bg-foreground font-bold text-[color:var(--sand)]'
                      : 'border border-[color:var(--border-strong)] bg-white font-semibold text-[#4a443c] hover:border-foreground/40')
                  }
                >
                  {category.label}
                </button>
              )
            })}
          </div>

          {preview.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[color:var(--border-strong)] p-10 text-center text-sm text-[color:var(--muted)]">
              Aucun produit dans cette catégorie pour le moment.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {preview.map((product) => {
                const committed = committedUnits(product)
                const progress = Math.min(
                  100,
                  Math.round((committed / product.moqUnits) * 100),
                )
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => onOpenProduct(product.id)}
                    className="group overflow-hidden rounded-2xl border border-[color:var(--sand-deep)] bg-white text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="relative h-[180px] bg-[color:var(--sand-deep)]">
                      <img
                        src={product.mainImageUrl}
                        alt={product.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    </div>
                    <div className="flex flex-col gap-2 p-4">
                      <div className="truncate text-base font-extrabold">
                        {product.name}
                      </div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-[13px] text-[color:var(--color-text-secondary)]">
                          dès
                        </span>
                        <span className="text-lg font-extrabold">
                          {formatEUR(product.basePriceHt)} HT
                        </span>
                      </div>
                      <div className="relative h-[5px] rounded-full bg-[color:var(--sand-deep)]">
                        <div
                          className="absolute bottom-0 left-0 top-0 rounded-full bg-[color:var(--ember)]"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="text-xs text-[color:var(--muted)]">
                        MOQ {product.moqUnits} · {committed} réservés
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Panneau container — données temps réel, sticky en desktop */}
        <div className="flex flex-col gap-4 rounded-[18px] border border-[color:var(--sand-deep)] bg-white p-6 lg:sticky lg:top-24">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-[color:var(--muted)]">
              {container.reference}
            </span>
            <span className="inline-flex items-center gap-[5px] text-xs font-bold text-[color:var(--forest)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--forest)]" />
              {container.status === 'open' ? 'Ouvert' : 'Clôturé'}
            </span>
          </div>
          <div className="text-[13px] text-[color:var(--color-text-secondary)]">
            {container.port} · 20&apos; High Cube · {capacity.toFixed(0)} m³
            utiles
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <span className="text-[13px] text-[color:var(--color-text-secondary)]">
                Votre sélection
              </span>
              <span className="text-xl font-extrabold">
                {fillPercent.toFixed(0)}%
              </span>
            </div>
            <div className="relative h-1.5 rounded-full bg-[color:var(--sand-deep)]">
              <div
                className="absolute bottom-0 left-0 top-0 rounded-full bg-[color:var(--ember)] transition-[width] duration-500"
                style={{ width: `${Math.min(100, fillPercent)}%` }}
              />
              <div
                className="absolute -bottom-[3px] -top-[3px] w-0.5 bg-[#b7ac98]"
                style={{ left: `${container.thresholdPercent}%` }}
              />
            </div>
            <div className="text-[11.5px] text-[color:var(--muted)]">
              {usedCbm.toFixed(1)} / {capacity.toFixed(0)} m³ · Départ à{' '}
              {container.thresholdPercent}%
            </div>
            <CountdownBadge
              target={container.expectedCloseAt}
              className="inline-flex w-max items-center gap-1 rounded-md bg-[color:var(--ember-soft)] px-2 py-1 text-[11px] font-bold text-[color:var(--ember)]"
            />
          </div>
          <div className="flex gap-[22px] border-b border-t border-[color:var(--sand-deep)] py-3.5">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--muted)]">
                Séries
              </div>
              <div className="text-lg font-extrabold">
                {seriesReached}/{totalSeries}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--muted)]">
                Pros engagés
              </div>
              <div className="text-lg font-extrabold">
                {professionalsEngaged}
              </div>
            </div>
          </div>
          <div className="text-[13px] leading-[1.45] text-[color:var(--color-text-secondary)]">
            {hasSelection
              ? 'Votre sélection est prête — confirmez pour bloquer votre place.'
              : 'Sélectionnez des produits dans le catalogue pour démarrer votre commande.'}
          </div>
          <button
            type="button"
            onClick={onReserve}
            className="rounded-[11px] bg-foreground px-4 py-[13px] text-center text-[15px] font-bold text-[color:var(--sand)] transition-colors hover:bg-[color:var(--color-cta-primary-hover)]"
          >
            Confirmer ma réservation
          </button>
          <button
            type="button"
            onClick={onDownloadPdf}
            className="text-center text-sm font-semibold text-[#4a443c] transition-colors hover:text-foreground"
          >
            Télécharger le devis PDF
          </button>
        </div>
      </div>
    </section>
  )
}
