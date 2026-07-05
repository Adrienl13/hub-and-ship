import { createFileRoute } from '@tanstack/react-router'
import {
  lazy,
  Suspense,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { ArrowUpDown, Layers3, Search, X } from 'lucide-react'
import { toast } from 'sonner'

import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { MobileStickyBar } from '@/components/MobileStickyBar'
import { OrderSidebar } from '@/components/OrderSidebar'
import { ProductCard } from '@/components/ProductCard'
import { Button } from '@/components/ui/button'
import {
  CATEGORY_FILTERS,
  EMPTY_ADVANCED_FILTERS,
  PAGE_SIZE_OPTIONS,
  filterAndSortProducts,
  getCategoryCounts,
  getDefaultVariant,
  hasActiveAdvancedFilters,
  isStackable,
  type CatalogueAdvancedFilters,
  type CatalogueFilter,
  type PageSizeOption,
  type SortKey,
} from '@/lib/catalogue'
import { formatEUR } from '@/lib/order'
import { openQuotePDF } from '@/lib/quote'
import {
  decodeCartSelection,
  encodeCartSelection,
} from '@/lib/catalogue/share-cart'
import { AnalyticsEvent, track } from '@/lib/analytics'
import { CATEGORY_LABEL, PRODUCTS, type Product } from '@/lib/products'
import { useCatalog } from '@/hooks/useCatalog'
import { useFavorites } from '@/hooks/useFavorites'
import { buildReservedLoadItems } from '@/lib/container/reserved-load'
import {
  breadcrumbJsonLd,
  buildSeoHead,
  itemListJsonLd,
  jsonLdScript,
} from '@/lib/seo'
import { useCart } from '@/stores/cart.store'

export const Route = createFileRoute('/catalogue')({
  head: () => ({
    ...buildSeoHead({
      title: 'Catalogue mobilier outdoor professionnel',
      description:
        'Catalogue visuel de mobilier outdoor CHR : cartes portrait plein cadre, chaises, fauteuils, tables et bancs à réserver par container groupé.',
      path: '/catalogue',
      image: PRODUCTS[0]?.mainImageUrl,
    }),
    scripts: [
      jsonLdScript(
        breadcrumbJsonLd([
          { name: 'Accueil', path: '/' },
          { name: 'Catalogue', path: '/catalogue' },
        ]),
      ),
      jsonLdScript(
        itemListJsonLd({
          name: 'Catalogue mobilier outdoor professionnel',
          path: '/catalogue',
          products: PRODUCTS,
        }),
      ),
    ],
  }),
  component: CataloguePage,
})

const LazyProductDetailDialog = lazy(() =>
  import('@/components/ProductDetailDialog').then((module) => ({
    default: module.ProductDetailDialog,
  })),
)
const LazyReservationDialog = lazy(() =>
  import('@/components/ReservationDialog').then((module) => ({
    default: module.ReservationDialog,
  })),
)

function CataloguePage() {
  const { products, currentContainer } = useCatalog()
  const favorites = useFavorites()
  const productsArray = useMemo(() => [...products], [products])
  const reservedItems = useMemo(
    () => buildReservedLoadItems(productsArray),
    [productsArray],
  )
  const {
    items,
    totals,
    fill,
    totalUnits,
    preferredContainerType,
    variantByProduct,
    qtyByProduct,
    setQty,
    setVariant,
  } = useCart({
    products: productsArray,
    capacityCbm: currentContainer.capacityCbm,
  })
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [filter, setFilter] = useState<CatalogueFilter>('all')
  const [sort, setSort] = useState<SortKey>('default')
  const [search, setSearch] = useState('')
  const [advanced, setAdvanced] = useState<CatalogueAdvancedFilters>(
    EMPTY_ADVANCED_FILTERS,
  )
  const [compareIds, setCompareIds] = useState<ReadonlySet<string>>(new Set())
  const [compareOpen, setCompareOpen] = useState(false)
  const deferredSearch = useDeferredValue(search)
  const [pageSize, setPageSize] = useState<PageSizeOption>(30)
  const [visibleCount, setVisibleCount] = useState<number>(pageSize)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [reserveOpen, setReserveOpen] = useState(false)

  const categoryCounts = useMemo(
    () => getCategoryCounts(productsArray),
    [productsArray],
  )
  const filtered = useMemo(
    () =>
      filterAndSortProducts({
        products: productsArray,
        filter,
        search: deferredSearch,
        sort,
        advanced,
      }),
    [deferredSearch, filter, sort, advanced, productsArray],
  )
  const visibleProducts = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount],
  )
  const remainingProducts = Math.max(
    0,
    filtered.length - visibleProducts.length,
  )
  const detailProduct: Product | null = useMemo(
    () => productsArray.find((product) => product.id === detailId) ?? null,
    [detailId, productsArray],
  )
  const compareProducts = useMemo(
    () => productsArray.filter((product) => compareIds.has(product.id)),
    [productsArray, compareIds],
  )

  function toggleCompare(id: string): void {
    setCompareIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < 4) next.add(id)
      return next
    })
  }

  // Reconstruct the cart from a shared ?panier= link, once products are loaded.
  const sharedApplied = useRef(false)
  useEffect(() => {
    if (sharedApplied.current || productsArray.length === 0) return
    sharedApplied.current = true
    const entries = decodeCartSelection(
      new URLSearchParams(window.location.search).get('panier'),
    )
    if (entries.length === 0) return
    for (const entry of entries) {
      const product = productsArray.find((p) => p.id === entry.productId)
      if (!product) continue
      if (product.variants.some((v) => v.id === entry.variantId)) {
        setVariant(entry.productId, entry.variantId)
      }
      setQty(entry.productId, entry.qty)
    }
    toast.success('Sélection chargée depuis le lien partagé.')
  }, [productsArray, setQty, setVariant])

  async function shareSelection(): Promise<void> {
    const entries = productsArray
      .filter((p) => (qtyByProduct[p.id] ?? 0) > 0)
      .map((p) => ({
        productId: p.id,
        variantId: variantByProduct[p.id] ?? getDefaultVariant(p).id,
        qty: qtyByProduct[p.id] ?? 0,
      }))
    if (entries.length === 0) {
      toast.message('Ajoutez des produits avant de partager.')
      return
    }
    const url = `${window.location.origin}/catalogue?panier=${encodeCartSelection(
      entries,
    )}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Lien de votre sélection copié', { description: url })
      track(AnalyticsEvent.ShareSelection, { items: entries.length })
    } catch {
      toast.error('Copie impossible', { description: url })
    }
  }

  // Chunk the grid into category sections to break the "flat wall of 50"
  // decision fatigue. Only when browsing everything in the default order —
  // an active filter or sort means the user wants one ordered stream.
  const useSections = view === 'grid' && filter === 'all' && sort === 'default'
  const sections = useMemo(
    () =>
      CATEGORY_FILTERS.filter((category) => category.id !== 'all')
        .map((category) => ({
          id: category.id,
          label: category.label,
          products: visibleProducts.filter((p) => p.category === category.id),
        }))
        .filter((section) => section.products.length > 0),
    [visibleProducts],
  )

  // Smooth-scroll a category section to just below the sticky controls. We
  // measure the controls height at runtime (it varies a lot between mobile
  // and desktop) rather than hard-coding a CSS scroll-margin that would hide
  // the section title behind the bar on one breakpoint or the other.
  const controlsRef = useRef<HTMLDivElement>(null)
  const scrollToCategory = (id: string) => {
    const el = document.getElementById(`cat-${id}`)
    if (!el) return
    const HEADER = 64
    const offset = HEADER + (controlsRef.current?.offsetHeight ?? 0) + 12
    const y = el.getBoundingClientRect().top + window.scrollY - offset
    window.scrollTo({ top: y, behavior: 'smooth' })
  }

  const renderGridCard = (product: Product) => (
    <CatalogueGridCard
      key={product.id}
      product={product}
      variantId={variantByProduct[product.id] ?? getDefaultVariant(product).id}
      qty={qtyByProduct[product.id] ?? 0}
      onQtyChange={(quantity) => setQty(product.id, quantity)}
      onOpenDetails={() => setDetailId(product.id)}
    />
  )

  useEffect(() => {
    setVisibleCount(pageSize)
  }, [deferredSearch, filter, pageSize, sort, advanced])

  const handlePdf = () => {
    track(AnalyticsEvent.QuotePdf, { items: items.length })
    const opened = openQuotePDF({
      items,
      totals,
      fillPercent: fill.percent,
      usedCbm: fill.usedCbm,
      capacity: fill.capacity,
      containerRef: currentContainer.reference,
      port: currentContainer.port,
      containerType:
        preferredContainerType ?? currentContainer.containerType ?? '20_hc',
    })
    if (!opened) {
      toast.error('Devis bloqué par le navigateur', {
        description:
          'Autorisez les popups pour ouvrir le devis imprimable en PDF.',
      })
    }
  }

  return (
    <div
      id="top"
      className="min-h-screen overflow-x-hidden bg-background text-foreground"
    >
      <Header
        onReserve={() => {
          track(AnalyticsEvent.ReserveOpen)
          setReserveOpen(true)
        }}
      />

      <main>
        <section className="border-b border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]">
          <div className="mx-auto grid max-w-7xl gap-6 px-6 py-10 md:grid-cols-[1fr_auto] md:items-end">
            <div className="max-w-3xl">
              <div className="label-eyebrow text-[color:var(--ember)]">
                Catalogue complet
              </div>
              <h1 className="mt-2 font-display text-4xl tracking-tight md:text-5xl">
                Cartes portrait plein cadre.
              </h1>
              <p className="mt-4 text-sm leading-relaxed text-[color:var(--ink-soft)]">
                Une vision produit plus nette pour choisir vite : photos plein
                cadre, designs accessibles, quantité directe, recherche
                SKU/design et panier toujours visible.
              </p>
            </div>
            <div className="rounded-md border border-[color:var(--sand-deep)] bg-card p-4 text-sm">
              <div className="label-eyebrow text-muted-foreground">
                Commande active
              </div>
              <div className="mt-2 font-display text-2xl font-semibold tabular-nums">
                {formatEUR(totals.subtotalHt)}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {totalUnits} unités · {fill.percent.toFixed(0)}% container
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-12">
          <div className="min-w-0 lg:col-span-9">
            <div
              ref={controlsRef}
              className="bg-background/95 sticky top-16 z-20 min-w-0 border-b border-[color:var(--sand-deep)] py-4 backdrop-blur"
            >
              <div className="flex min-w-0 flex-col gap-3">
                <div className="flex max-w-full gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
                  {CATEGORY_FILTERS.map((category) => {
                    const active = category.id === filter
                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => setFilter(category.id)}
                        className={`min-h-11 shrink-0 rounded-sm px-3 py-1.5 text-xs font-medium transition-colors ${
                          active
                            ? 'bg-[color:var(--foreground)] text-[color:var(--background)]'
                            : 'text-foreground/75 hover:border-foreground/40 border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] hover:text-foreground'
                        }`}
                      >
                        {category.label}
                        <span
                          className={`ml-1.5 tabular-nums ${active ? 'opacity-70' : 'opacity-50'}`}
                        >
                          {categoryCounts[category.id]}
                        </span>
                      </button>
                    )
                  })}
                </div>

                <div className="grid min-w-0 gap-2 md:grid-cols-[1fr_auto_auto] md:items-center">
                  <label className="relative block min-w-0 text-xs text-muted-foreground">
                    <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Rechercher SKU, modèle, design..."
                      className="h-11 w-full min-w-0 rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] pl-8 pr-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                    />
                  </label>
                  <label className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <ArrowUpDown className="h-3 w-3" />
                    <select
                      value={sort}
                      onChange={(event) =>
                        setSort(event.target.value as SortKey)
                      }
                      className="h-11 min-w-0 flex-1 rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-foreground"
                    >
                      <option value="default">Tri par défaut</option>
                      <option value="price-asc">Prix croissant</option>
                      <option value="price-desc">Prix décroissant</option>
                      <option value="cbm-asc">Volume CBM</option>
                      <option value="popular">Popularité</option>
                    </select>
                  </label>
                  <label className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <Layers3 className="h-3 w-3" />
                    <select
                      value={pageSize}
                      onChange={(event) =>
                        setPageSize(
                          Number(event.target.value) as PageSizeOption,
                        )
                      }
                      className="h-11 min-w-0 flex-1 rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-foreground"
                    >
                      {PAGE_SIZE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option} / page
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Filtres :</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={advanced.maxPrice ?? ''}
                    placeholder="Prix max HT"
                    onChange={(e) =>
                      setAdvanced((a) => ({
                        ...a,
                        maxPrice:
                          e.target.value === '' ? null : Number(e.target.value),
                      }))
                    }
                    className="h-9 w-28 rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-2 text-sm focus:outline-none focus:ring-1 focus:ring-foreground"
                    aria-label="Prix maximum HT"
                  />
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={advanced.maxMoq ?? ''}
                    placeholder="MOQ max"
                    onChange={(e) =>
                      setAdvanced((a) => ({
                        ...a,
                        maxMoq:
                          e.target.value === '' ? null : Number(e.target.value),
                      }))
                    }
                    className="h-9 w-24 rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-2 text-sm focus:outline-none focus:ring-1 focus:ring-foreground"
                    aria-label="MOQ maximum"
                  />
                  <FilterToggle
                    active={advanced.fireM1Only}
                    onClick={() =>
                      setAdvanced((a) => ({ ...a, fireM1Only: !a.fireM1Only }))
                    }
                  >
                    Classé feu M1
                  </FilterToggle>
                  <FilterToggle
                    active={advanced.stackableOnly}
                    onClick={() =>
                      setAdvanced((a) => ({
                        ...a,
                        stackableOnly: !a.stackableOnly,
                      }))
                    }
                  >
                    Empilable
                  </FilterToggle>
                  {hasActiveAdvancedFilters(advanced) && (
                    <button
                      type="button"
                      onClick={() => setAdvanced(EMPTY_ADVANCED_FILTERS)}
                      className="text-muted-foreground underline hover:text-foreground"
                    >
                      Réinitialiser
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {filtered.length} référence{filtered.length > 1 ? 's' : ''}{' '}
                    trouvée
                    {filtered.length > 1 ? 's' : ''} · {visibleProducts.length}{' '}
                    affichée
                    {visibleProducts.length > 1 ? 's' : ''}
                  </span>
                  {totalUnits > 0 && (
                    <button
                      type="button"
                      onClick={() => void shareSelection()}
                      className="underline hover:text-foreground"
                    >
                      Partager ma sélection
                    </button>
                  )}
                </div>

                {useSections && sections.length > 1 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs">
                    <span className="shrink-0 text-muted-foreground">
                      Aller à
                    </span>
                    {sections.map((section) => (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => scrollToCategory(section.id)}
                        className="hover:border-foreground/40 shrink-0 rounded-sm border border-[color:var(--sand-deep)] bg-card px-2.5 py-1 font-medium text-foreground/80 transition-colors hover:text-foreground"
                      >
                        {section.label}
                        <span className="ml-1 tabular-nums opacity-50">
                          {section.products.length}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="rounded-md border border-dashed border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-4 py-16 text-center text-sm text-muted-foreground">
                Aucun produit ne correspond à ces filtres.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
                {visibleProducts.map((product) => {
                  const selectedVariantId =
                    variantByProduct[product.id] ??
                    getDefaultVariant(product).id
                  return (
                    <ProductCard
                      key={product.id}
                      product={product}
                      variantId={selectedVariantId}
                      qty={qtyByProduct[product.id] ?? 0}
                      onQtyChange={(quantity) => setQty(product.id, quantity)}
                      onVariantChange={(variantId) =>
                        setVariant(product.id, variantId)
                      }
                      onOpenDetails={() => setDetailId(product.id)}
                      compareSelected={compareIds.has(product.id)}
                      onToggleCompare={() => toggleCompare(product.id)}
                      isFavorite={favorites.isFavorite(product.id)}
                      onToggleFavorite={() => favorites.toggle(product.id)}
                    />
                  )
                })}
              </div>
            )}

            {remainingProducts > 0 && (
              <div className="mt-5 text-center">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-sm border-[color:var(--sand-deep)]"
                  onClick={() =>
                    setVisibleCount((current) => current + pageSize)
                  }
                >
                  Charger {Math.min(pageSize, remainingProducts)} référence
                  {Math.min(pageSize, remainingProducts) > 1 ? 's' : ''} de plus
                </Button>
              </div>
            )}
          </div>

          <aside className="lg:col-span-3">
            <OrderSidebar
              items={items}
              reservedItems={reservedItems}
              totals={totals}
              fillPercent={fill.percent}
              usedCbm={fill.usedCbm}
              capacity={fill.capacity}
              onReserve={() => setReserveOpen(true)}
              onDownloadPdf={handlePdf}
              container={currentContainer}
            />
          </aside>
        </section>
      </main>

      <Footer />

      <MobileStickyBar
        totalItems={totalUnits}
        fillPercent={fill.percent}
        subtotalHt={totals.subtotalHt}
        onReserve={() => setReserveOpen(true)}
        container={currentContainer}
      />

      {compareIds.size > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-30 hidden justify-center px-4 lg:flex">
          <div className="shadow-paper flex items-center gap-3 rounded-md border border-[color:var(--sand-deep)] bg-card px-4 py-2">
            <span className="text-sm font-medium">
              {compareIds.size} produit{compareIds.size > 1 ? 's' : ''} à
              comparer
            </span>
            <Button
              type="button"
              size="sm"
              disabled={compareIds.size < 2}
              onClick={() => setCompareOpen(true)}
              className="h-8 rounded-sm bg-foreground px-3 text-xs text-background"
            >
              Comparer
            </Button>
            <button
              type="button"
              onClick={() => setCompareIds(new Set())}
              className="text-xs text-muted-foreground underline hover:text-foreground"
            >
              Effacer
            </button>
          </div>
        </div>
      )}

      {compareOpen && (
        <CatalogueComparison
          products={compareProducts}
          onClose={() => setCompareOpen(false)}
          onRemove={toggleCompare}
        />
      )}

      <Suspense fallback={null}>
        {detailProduct && (
          <LazyProductDetailDialog
            product={detailProduct}
            open
            onOpenChange={(value) => !value && setDetailId(null)}
            qty={qtyByProduct[detailProduct.id] ?? 0}
            variantId={
              variantByProduct[detailProduct.id] ??
              getDefaultVariant(detailProduct).id
            }
            onQtyChange={(quantity) => setQty(detailProduct.id, quantity)}
            onVariantChange={(variantId) =>
              setVariant(detailProduct.id, variantId)
            }
          />
        )}

        {reserveOpen && (
          <LazyReservationDialog
            open={reserveOpen}
            onOpenChange={setReserveOpen}
            items={items}
            totals={totals}
            container={currentContainer}
          />
        )}
      </Suspense>
    </div>
  )
}

function FilterToggle({
  active,
  onClick,
  children,
}: {
  readonly active: boolean
  readonly onClick: () => void
  readonly children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex h-9 items-center rounded-sm border px-3 text-xs font-medium transition-colors ${
        active
          ? 'border-[color:var(--foreground)] bg-[color:var(--foreground)] text-[color:var(--background)]'
          : 'border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] text-foreground hover:border-foreground/40'
      }`}
    >
      {children}
    </button>
  )
}

function CatalogueComparison({
  products,
  onClose,
  onRemove,
}: {
  readonly products: ReadonlyArray<Product>
  readonly onClose: () => void
  readonly onRemove: (id: string) => void
}) {
  const rows: ReadonlyArray<{ label: string; value: (p: Product) => string }> =
    [
      { label: 'Catégorie', value: (p) => CATEGORY_LABEL[p.category] },
      { label: 'Prix direct pro HT', value: (p) => `${formatEUR(p.basePriceHt)}` },
      { label: 'Prix retail réf.', value: (p) => formatEUR(p.retailPriceRef) },
      {
        label: 'Économie',
        value: (p) =>
          `${Math.round((1 - p.basePriceHt / p.retailPriceRef) * 100)}%`,
      },
      { label: 'MOQ', value: (p) => `${p.moqUnits} u.` },
      {
        label: 'Dimensions',
        value: (p) => `${p.dimensions.l}×${p.dimensions.w}×${p.dimensions.h} cm`,
      },
      { label: 'Volume', value: (p) => `${p.cbmPerUnit.toFixed(2)} m³` },
      { label: 'Poids', value: (p) => `${p.weightKg} kg` },
      { label: 'Classé feu', value: (p) => p.fireRating ?? '—' },
      { label: 'Empilable', value: (p) => (isStackable(p) ? 'Oui' : '—') },
      { label: 'SKU', value: (p) => p.sku },
    ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-4xl overflow-auto rounded-md border border-[color:var(--sand-deep)] bg-background p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Comparateur</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="w-32 py-2 text-left text-[11px] uppercase tracking-wide text-muted-foreground" />
                {products.map((p) => (
                  <th
                    key={p.id}
                    className="min-w-[160px] border-b border-[color:var(--sand-deep)] p-2 text-left align-top"
                  >
                    <div className="flex items-start gap-2">
                      <img
                        src={p.mainImageUrl}
                        alt={p.name}
                        className="h-12 w-12 shrink-0 rounded-sm object-cover"
                      />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">
                          {p.name}
                        </div>
                        <button
                          type="button"
                          onClick={() => onRemove(p.id)}
                          className="text-[11px] text-muted-foreground underline hover:text-red-700"
                        >
                          Retirer
                        </button>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-b border-[color:var(--sand-deep)]/60">
                  <td className="py-2 pr-3 text-xs font-medium text-muted-foreground">
                    {row.label}
                  </td>
                  {products.map((p) => (
                    <td key={p.id} className="py-2 pr-3 tabular-nums">
                      {row.value(p)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
