import { createFileRoute } from '@tanstack/react-router'
import { lazy, Suspense, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { Hero } from '@/components/Hero'
import { MobileStickyBar } from '@/components/MobileStickyBar'
import { CataloguePreview } from '@/components/home/CataloguePreview'
import {
  ClienteleBand,
  DeliverySection,
  DualPathSection,
  FinalCtaSection,
  GammesSection,
  HomeFaqSection,
  NewsletterSection,
  PillarsSection,
  ProcessSection,
} from '@/components/home/HomeSections'
import { useCatalog } from '@/hooks/useCatalog'
import { useSiteMedia } from '@/hooks/useSiteMedia'
import { getDefaultVariant } from '@/lib/catalogue'
import { openQuotePDF } from '@/lib/quote'
import { type Product } from '@/lib/products'
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
        name: 'Container Club',
        url: SITE_URL,
      }),
    ],
  }),
  component: ContainerClubPage,
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

function ContainerClubPage() {
  const { products, currentContainer } = useCatalog()
  const media = useSiteMedia()
  const productsArray = useMemo(() => [...products], [products])
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

  const [detailId, setDetailId] = useState<string | null>(null)
  const [reserveOpen, setReserveOpen] = useState(false)

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
        slides={media.hero}
      />

      <GammesSection media={media.collections} />
      <ClienteleBand media={media.clienteleBand} />
      <PillarsSection />
      <DualPathSection />
      <ProcessSection />

      <CataloguePreview
        products={productsArray}
        container={currentContainer}
        fillPercent={fill.percent}
        usedCbm={fill.usedCbm}
        capacity={fill.capacity}
        seriesReached={currentContainer.seriesReached}
        totalSeries={currentContainer.totalSeries}
        professionalsEngaged={currentContainer.professionalsEngaged}
        hasSelection={totalUnits > 0}
        onReserve={() => setReserveOpen(true)}
        onDownloadPdf={handlePdf}
        onOpenProduct={setDetailId}
      />

      <DeliverySection />
      <HomeFaqSection />
      <FinalCtaSection onReserve={() => setReserveOpen(true)} />
      <NewsletterSection />
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
