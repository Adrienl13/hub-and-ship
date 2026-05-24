import { createFileRoute, notFound } from '@tanstack/react-router'
import { lazy, Suspense, useMemo, useState } from 'react'

import {
  LEGAL_PAGES,
  LegalLayout,
  type LegalSlug,
} from '@/components/LegalLayout'
import { useCatalog } from '@/hooks/useCatalog'
import { getLegalDoc } from '@/lib/legal-content'
import { useCart } from '@/stores/cart.store'

const LazyReservationDialog = lazy(() =>
  import('@/components/ReservationDialog').then((module) => ({
    default: module.ReservationDialog,
  })),
)

const VALID_SLUGS: ReadonlyArray<LegalSlug> = LEGAL_PAGES.map((p) => p.slug)

function isValidSlug(value: string): value is LegalSlug {
  return (VALID_SLUGS as ReadonlyArray<string>).includes(value)
}

export const Route = createFileRoute('/legal/$slug')({
  beforeLoad: ({ params }) => {
    if (!isValidSlug(params.slug)) {
      throw notFound()
    }
  },
  component: LegalDocPage,
  head: ({ params }) => {
    const slug = params?.slug
    const doc = slug && isValidSlug(slug) ? getLegalDoc(slug) : undefined
    if (!doc) {
      return { meta: [{ title: 'Document légal — Container Club' }] }
    }
    return {
      meta: [
        { title: `${doc.title} — Container Club` },
        { name: 'description', content: doc.metaDescription },
      ],
    }
  },
})

function LegalDocPage() {
  const { slug } = Route.useParams()
  const { products, currentContainer } = useCatalog()
  const productsArray = useMemo(() => [...products], [products])
  const { items, totals } = useCart({
    products: productsArray,
    capacityCbm: currentContainer.capacityCbm,
  })
  const [reserveOpen, setReserveOpen] = useState(false)

  if (!isValidSlug(slug)) {
    throw notFound()
  }
  const doc = getLegalDoc(slug)
  if (!doc) {
    throw notFound()
  }

  return (
    <>
      <LegalLayout
        slug={doc.slug}
        title={doc.title}
        updatedAt={doc.updatedAt}
        onReserve={() => setReserveOpen(true)}
      >
        {doc.content}
      </LegalLayout>

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
    </>
  )
}
