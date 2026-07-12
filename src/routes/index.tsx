import { Link, createFileRoute } from '@tanstack/react-router'
import {
  lazy,
  Suspense,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  ArrowUpDown,
  Handshake,
  LockKeyhole,
  Search,
  Store,
} from 'lucide-react'
import { toast } from 'sonner'

import { Header } from '@/components/Header'
import { Hero } from '@/components/Hero'
import { ValueProps } from '@/components/ValueProps'
import { HowItWorks } from '@/components/HowItWorks'
import { ComparisonTable } from '@/components/ComparisonTable'
import { ProductCard } from '@/components/ProductCard'
import { OrderSidebar } from '@/components/OrderSidebar'
import { DeliveryInfoBox } from '@/components/DeliveryInfoBox'
import { PastContainers } from '@/components/PastContainers'
import { FaqAccordion } from '@/components/FaqAccordion'
import { FinalCta } from '@/components/FinalCta'
import { Footer } from '@/components/Footer'
import { MobileStickyBar } from '@/components/MobileStickyBar'
import { useIsMobile } from '@/hooks/use-mobile'

import { type Product } from '@/lib/products'
import { calculateStockKpis } from '@/lib/stock'
import { useStockLines } from '@/hooks/useStockLines'
import {
  CATEGORY_FILTERS,
  filterAndSortProducts,
  getCategoryCounts,
  getDefaultVariant,
  type CatalogueFilter,
  type SortKey,
} from '@/lib/catalogue'
import { formatEUR } from '@/lib/order'
import { openQuotePDF } from '@/lib/quote'
import { useCatalog } from '@/hooks/useCatalog'
import { buildReservedLoadItems } from '@/lib/container/reserved-load'
import { buildSeoHead, jsonLdScript, SITE_URL } from '@/lib/seo'
import { useCart } from '@/stores/cart.store'

export const Route = createFileRoute('/')({
  head: () => ({
    ...buildSeoHead({
      title: 'Mobilier outdoor pro direct usine par container',
      description:
        'Container Club mutualise les commandes de mobilier outdoor pour restaurants, hôtels et campings : prix usine, container partagé, contrôle qualité et stock disponible.',
      path: '/',
    }),
    scripts: [
      jsonLdScript({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'Container Club Terrassea',
        url: SITE_URL,
      }),
    ],
  }),
  component: ContainerClubPage,
})

const MOBILE_PAGE_SIZE = 8
const DESKTOP_PAGE_SIZE = 18
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

function ContainerClubPage() {
  const isMobile = useIsMobile()
  const pageSize = isMobile ? MOBILE_PAGE_SIZE : DESKTOP_PAGE_SIZE
  const { products, currentContainer } = useCatalog()
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

  const [filter, setFilter] = useState<CatalogueFilter>('all')
  const [sort, setSort] = useState<SortKey>('default')
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [visibleCount, setVisibleCount] = useState(pageSize)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [reserveOpen, setReserveOpen] = useState(false)

  const categoryCounts = useMemo(
    () => getCategoryCounts(productsArray),
    [productsArray],
  )

  const filtered = useMemo(() => {
    return filterAndSortProducts({
      products: productsArray,
      filter,
      search: deferredSearch,
      sort,
    })
  }, [deferredSearch, filter, sort, productsArray])

  const visibleProducts = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount],
  )
  const remainingProducts = Math.max(
    0,
    filtered.length - visibleProducts.length,
  )

  useEffect(() => {
    setVisibleCount(pageSize)
  }, [deferredSearch, filter, pageSize, sort])

  const detailProduct: Product | null = useMemo(
    () => productsArray.find((p) => p.id === detailId) ?? null,
    [detailId, productsArray],
  )

  const handlePdf = () => {
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
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <Header onReserve={() => setReserveOpen(true)} />

      <Hero
        fillPercent={fill.percent}
        seriesReached={currentContainer.seriesReached}
        totalSeries={currentContainer.totalSeries}
        professionalsEngaged={currentContainer.professionalsEngaged}
        container={currentContainer}
      />

      <ValueProps />
      <PartnerPathway />
      <Stock24hTeaser />
      <HowItWorks />
      <ComparisonTable />

      {/* Catalogue */}
      <section
        id="catalogue"
        className="scroll-mt-20 border-t border-[color:var(--sand-deep)]"
      >
        <div className="mx-auto max-w-7xl px-6 py-16">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <div className="label-eyebrow text-[color:var(--ember)]">
                Catalogue
              </div>
              <h2 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">
                Choisissez vos modèles, design par design.
              </h2>
              <p className="mt-3 text-sm text-[color:var(--ink-soft)]">
                Chaque référence affiche son MOQ en temps réel : ajoutez votre
                quantité pour faire grimper la barre et déclencher la série.
              </p>
            </div>
            <Link
              to="/catalogue"
              className="inline-flex min-h-11 items-center rounded-sm border border-[color:var(--foreground)] px-4 py-2 text-sm font-medium transition-colors hover:bg-[color:var(--foreground)] hover:text-[color:var(--background)]"
            >
              Ouvrir le catalogue complet
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Catalogue (60%) */}
            <div className="lg:col-span-7">
              <div className="mb-5 flex flex-col gap-3 border-b border-[color:var(--sand-deep)] pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="-mx-6 flex gap-1.5 overflow-x-auto px-6 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
                  {CATEGORY_FILTERS.map((f) => {
                    const active = f.id === filter
                    const count = categoryCounts[f.id]
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setFilter(f.id)}
                        className={`min-h-11 shrink-0 rounded-sm px-3 py-1.5 text-xs font-medium transition-colors sm:min-h-0 ${
                          active
                            ? 'bg-[color:var(--foreground)] text-[color:var(--background)]'
                            : 'text-foreground/75 hover:border-foreground/40 border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] hover:text-foreground'
                        }`}
                      >
                        {f.label}
                        <span
                          className={`ml-1.5 tabular-nums ${active ? 'opacity-70' : 'opacity-50'}`}
                        >
                          {count}
                        </span>
                      </button>
                    )
                  })}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <label className="relative block text-xs text-muted-foreground">
                    <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Rechercher SKU, modèle, design..."
                      className="h-11 w-full rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] pl-8 pr-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground sm:h-8 sm:w-64 sm:text-xs"
                    />
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ArrowUpDown className="h-3 w-3" />
                    <select
                      value={sort}
                      onChange={(e) => setSort(e.target.value as SortKey)}
                      className="h-11 rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-foreground sm:h-8 sm:text-xs"
                    >
                      <option value="default">Tri par défaut</option>
                      <option value="price-asc">Prix croissant</option>
                      <option value="price-desc">Prix décroissant</option>
                      <option value="cbm-asc">Volume CBM</option>
                      <option value="popular">Popularité</option>
                    </select>
                  </label>
                </div>
                <div className="text-xs text-muted-foreground">
                  {filtered.length} référence{filtered.length > 1 ? 's' : ''}{' '}
                  trouvée
                  {filtered.length > 1 ? 's' : ''} · {visibleProducts.length}{' '}
                  affichée
                  {visibleProducts.length > 1 ? 's' : ''}
                </div>
              </div>

              {filtered.length === 0 ? (
                <div className="rounded-md border border-dashed border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] py-16 text-center text-sm text-muted-foreground">
                  Aucun produit dans cette catégorie pour ce container.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {visibleProducts.map((product) => {
                    const selectedVariantId =
                      variantByProduct[product.id] ??
                      getDefaultVariant(product).id
                    const quantity = qtyByProduct[product.id] ?? 0
                    const commonProps = {
                      product,
                      variantId: selectedVariantId,
                      qty: quantity,
                      onQtyChange: (n: number) => setQty(product.id, n),
                      onVariantChange: (id: string) =>
                        setVariant(product.id, id),
                      onOpenDetails: () => setDetailId(product.id),
                    }

                    return <ProductCard key={product.id} {...commonProps} />
                  })}
                </div>
              )}

              {remainingProducts > 0 && (
                <div className="mt-5 border-t border-[color:var(--sand-deep)] pt-5 text-center">
                  <button
                    type="button"
                    className="hover:border-foreground/40 min-h-11 rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-4 py-2 text-sm font-medium transition-colors"
                    onClick={() =>
                      setVisibleCount((current) => current + pageSize)
                    }
                  >
                    Charger {Math.min(pageSize, remainingProducts)} référence
                    {Math.min(pageSize, remainingProducts) > 1 ? 's' : ''} de
                    plus
                  </button>
                </div>
              )}

              <div className="mt-4 text-[11px] text-muted-foreground">
                MOQ usine :{' '}
                <strong className="text-foreground/80">
                  50 unités par modèle ET par design
                </strong>{' '}
                pour les assises, 20 pour les tables.
              </div>
            </div>

            {/* Sidebar (40%) */}
            <aside className="lg:col-span-5">
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
          </div>
        </div>
      </section>

      <DeliveryInfoBox />
      <PastContainers />
      <FaqAccordion />
      <FinalCta onReserve={() => setReserveOpen(true)} />
      <Footer />

      <MobileStickyBar
        totalItems={totalUnits}
        fillPercent={fill.percent}
        subtotalHt={totals.totalHt}
        onReserve={() => setReserveOpen(true)}
        container={currentContainer}
      />

      {/* Modals */}
      <Suspense fallback={null}>
        {detailProduct && (
          <LazyProductDetailDialog
            product={detailProduct}
            open
            onOpenChange={(v) => !v && setDetailId(null)}
            qty={qtyByProduct[detailProduct.id] ?? 0}
            variantId={
              variantByProduct[detailProduct.id] ??
              getDefaultVariant(detailProduct).id
            }
            onQtyChange={(n) => setQty(detailProduct.id, n)}
            onVariantChange={(id) => setVariant(detailProduct.id, id)}
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

function PartnerPathway() {
  const lanes = [
    {
      Icon: Store,
      title: "J'équipe mon établissement",
      desc: 'Prix direct pro, MOQ clair, réservation container et stock 24h pour les besoins urgents.',
      href: '/catalogue',
      cta: 'Explorer les produits',
    },
    {
      Icon: Handshake,
      title: 'Je revends à mon réseau',
      desc: 'Prix nets réservés, opportunités protégées et sélections co-brandées à construire avec les premiers partenaires.',
      href: '/partenaires',
      cta: 'Voir le programme',
    },
  ] as const

  return (
    <section className="border-t border-[color:var(--sand-deep)]">
      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className="mb-7 flex max-w-3xl items-start gap-3">
          <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-[color:var(--foreground)] text-[color:var(--background)]">
            <LockKeyhole className="h-4 w-4" />
          </div>
          <div>
            <div className="label-eyebrow text-[color:var(--ember)]">
              Deux parcours, une règle
            </div>
            <h2 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">
              Acheter en direct ou revendre : le canal doit rester clair.
            </h2>
            <p className="mt-3 text-sm leading-6 text-[color:var(--ink-soft)]">
              Pros Import garde une offre directe pour les pros, tout en
              construisant une protection partenaire pour que les revendeurs
              puissent partager la plateforme sans perdre leur client.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {lanes.map(({ Icon, title, desc, href, cta }) => (
            <Link
              key={title}
              to={href}
              className="hover:border-[color:var(--foreground)]/35 rounded-md border border-[color:var(--sand-deep)] bg-card p-5 transition-colors"
            >
              <Icon className="h-5 w-5 text-[color:var(--ember)]" />
              <h3 className="mt-5 font-display text-xl font-semibold">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {desc}
              </p>
              <span className="mt-5 inline-flex text-sm font-medium text-foreground">
                {cta} →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

function Stock24hTeaser() {
  // Stock RÉEL (DB-first). Pas de stock → on masque tout le bloc plutôt que
  // d'afficher un inventaire fictif sur la home. Pendant le chargement, un
  // squelette réserve la place pour éviter le saut de mise en page.
  const { lines: stockLines, loading: stockLoading } = useStockLines()
  const kpis = useMemo(() => calculateStockKpis(stockLines), [stockLines])
  const topLines = stockLines.slice(0, 3)

  if (stockLoading) {
    return (
      <section className="border-t border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="h-48 animate-pulse rounded-md border border-[color:var(--sand-deep)] bg-card/60" />
        </div>
      </section>
    )
  }
  if (stockLines.length === 0) return null

  return (
    <section className="border-t border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]">
      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-12 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div className="max-w-xl">
          <div className="label-eyebrow text-[color:var(--ember)]">
            Stock disponible sous 24h
          </div>
          <h2 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">
            Besoin d’aller vite avant le prochain container ?
          </h2>
          <p className="mt-3 text-sm leading-6 text-[color:var(--ink-soft)]">
            Une partie du stock restant est déjà en France : utile pour une
            ouverture de terrasse, un remplacement urgent ou un complément de
            mobilier.
          </p>
          <div className="mt-5 grid grid-cols-3 gap-2 text-sm">
            <MiniKpi label="Références" value={`${kpis.references}`} />
            <MiniKpi label="Unités libres" value={`${kpis.availableUnits}`} />
            <MiniKpi label="Valeur HT" value={formatEUR(kpis.totalValueHt)} />
          </div>
          <Link
            to="/stock-24h"
            className="mt-6 inline-flex min-h-11 items-center rounded-sm bg-[color:var(--foreground)] px-4 py-2 text-sm font-medium text-[color:var(--background)] transition-colors hover:bg-[color:var(--ink-soft)]"
          >
            Voir le stock 24h
          </Link>
        </div>

        <div className="overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card">
          {topLines.map((line) => (
            <Link
              key={line.id}
              to="/stock-24h"
              className="grid grid-cols-[56px_1fr_auto] items-center gap-3 border-b border-[color:var(--sand-deep)] px-3 py-3 text-sm last:border-b-0 hover:bg-[color:var(--sand-soft)]"
            >
              <span className="relative h-14 w-14 overflow-hidden rounded-sm bg-[color:var(--sand)]">
                <img
                  src={line.product.mainImageUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-medium">
                  {line.product.name}
                </span>
                <span className="mt-1 block truncate text-xs text-muted-foreground">
                  {line.variant.name} · {line.location}
                </span>
              </span>
              <span className="text-right">
                <span className="block font-display text-lg font-semibold tabular-nums">
                  {line.availableUnits}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  unités
                </span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

function MiniKpi({
  label,
  value,
}: {
  readonly label: string
  readonly value: string
}) {
  return (
    <div className="rounded-sm border border-[color:var(--sand-deep)] bg-card p-3">
      <div className="label-eyebrow text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-lg font-semibold tabular-nums">
        {value}
      </div>
    </div>
  )
}
