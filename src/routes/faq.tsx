import { createFileRoute } from '@tanstack/react-router'
import { lazy, Suspense, useMemo, useState } from 'react'

import { FAQ, FaqAccordion } from '@/components/FaqAccordion'
import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { useCatalog } from '@/hooks/useCatalog'
import {
  breadcrumbJsonLd,
  buildSeoHead,
  faqJsonLd,
  jsonLdScript,
} from '@/lib/seo'
import { useCart } from '@/stores/cart.store'

const LazyReservationDialog = lazy(() =>
  import('@/components/ReservationDialog').then((module) => ({
    default: module.ReservationDialog,
  })),
)

export const Route = createFileRoute('/faq')({
  component: FaqPage,
  head: () => ({
    ...buildSeoHead({
      title: 'FAQ achat groupé mobilier outdoor',
      description:
        'Foire aux questions Container Club : seuil 80 %, MOQ par design, échéancier de paiement, douane, livraison, garanties et SAV.',
      path: '/faq',
    }),
    scripts: [
      jsonLdScript(
        breadcrumbJsonLd([
          { name: 'Accueil', path: '/' },
          { name: 'FAQ', path: '/faq' },
        ]),
      ),
      jsonLdScript(faqJsonLd(FAQ)),
    ],
  }),
})

function FaqPage() {
  const { products, currentContainer } = useCatalog()
  const productsArray = useMemo(() => [...products], [products])
  const { items, totals } = useCart({
    products: productsArray,
    capacityCbm: currentContainer.capacityCbm,
  })
  const [reserveOpen, setReserveOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header onReserve={() => setReserveOpen(true)} />

      <section className="border-b border-[color:var(--sand-deep)] bg-[color:var(--sand)]">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <div className="label-eyebrow text-[color:var(--ember)]">
            Foire aux questions
          </div>
          <h1 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">
            Tout ce qu'il faut savoir avant de réserver.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[color:var(--ink-soft)]">
            Seuils de remplissage, échéancier de paiement, douane et TVA,
            livraison, garanties, SAV — les réponses claires aux questions que
            les pros nous posent le plus.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-4xl">
        <FaqAccordion />
      </div>

      <Footer />

      <Suspense fallback={null}>
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
