import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import {
  ArrowRight,
  Check,
  ChevronRight,
  Package,
  Ruler,
  ShieldCheck,
  Truck,
  Weight,
} from 'lucide-react'

import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { ProductDocumentsList } from '@/components/ProductDocumentsList'
import { ProductGallery } from '@/components/ProductGallery'
import { Button } from '@/components/ui/button'
import { CATEGORY_LABEL, PRODUCTS, type Product } from '@/lib/products'
import { formatEUR } from '@/lib/order'
import { getQuantityRule } from '@/lib/quantity'
import { findProductBySlug, productPath } from '@/lib/product-slugs'
import {
  breadcrumbJsonLd,
  buildSeoHead,
  faqJsonLd,
  jsonLdScript,
  productJsonLd,
} from '@/lib/seo'

export const Route = createFileRoute('/catalogue_/$productSlug')({
  component: ProductPage,
  head: ({ params }) => {
    const product = findProductBySlug(PRODUCTS, params.productSlug)
    if (!product) {
      return buildSeoHead({
        title: 'Produit introuvable',
        description:
          'Cette référence catalogue n’existe pas ou a été déplacée.',
        path: `/catalogue/${params.productSlug}`,
        noindex: true,
      })
    }

    const path = productPath(product)
    const description = product.description.slice(0, 155)
    const faq = productFaq(product)

    return {
      ...buildSeoHead({
        title: `${product.name} - ${formatEUR(product.basePriceHt)} HT`,
        description,
        path,
        image: product.mainImageUrl,
      }),
      scripts: [
        jsonLdScript(productJsonLd(product, path)),
        jsonLdScript(faqJsonLd(faq)),
        jsonLdScript(
          breadcrumbJsonLd([
            { name: 'Accueil', path: '/' },
            { name: 'Catalogue', path: '/catalogue' },
            {
              name: CATEGORY_LABEL[product.category],
              path: categoryPath(product),
            },
            { name: product.name, path },
          ]),
        ),
      ],
    }
  },
})

function ProductPage() {
  const { productSlug } = Route.useParams()
  const product = findProductBySlug(PRODUCTS, productSlug)
  if (!product) throw notFound()

  const defaultVariant = product.variants[0] ?? null
  const related = relatedProducts(product)
  const quantityRule = getQuantityRule(product)
  const reserveHref = `/catalogue?acheter=${encodeURIComponent(product.sku)}`
  const faq = productFaq(product)
  const savingsPct = Math.round(
    (1 - product.basePriceHt / product.retailPriceRef) * 100,
  )

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header onReserve={() => window.location.assign(reserveHref)} />

      <main id="contenu">
        <section className="border-b border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]">
          <div className="mx-auto max-w-7xl px-6 py-6">
            <nav
              aria-label="Fil d’Ariane"
              className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground"
            >
              <Link to="/" className="hover:text-foreground">
                Accueil
              </Link>
              <ChevronRight className="h-3 w-3" />
              <Link to="/catalogue" className="hover:text-foreground">
                Catalogue
              </Link>
              <ChevronRight className="h-3 w-3" />
              <a href={categoryPath(product)} className="hover:text-foreground">
                {CATEGORY_LABEL[product.category]}
              </a>
            </nav>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-8 px-6 py-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.95fr)]">
          <div className="min-w-0">
            <ProductGallery product={product} design={defaultVariant} />
          </div>

          <article className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="label-eyebrow rounded-sm bg-muted px-2 py-1 text-muted-foreground">
                {CATEGORY_LABEL[product.category]}
              </span>
              <span className="label-eyebrow bg-[color:var(--ember)]/10 rounded-sm px-2 py-1 text-[color:var(--ember)]">
                -{savingsPct}% vs retail
              </span>
              <span className="label-eyebrow text-muted-foreground">
                {product.sku}
              </span>
            </div>

            <h1 className="mt-4 font-display text-4xl tracking-tight md:text-5xl">
              {product.name}
            </h1>

            <p className="mt-4 text-sm leading-7 text-[color:var(--ink-soft)]">
              {product.description}
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-[color:var(--sand-deep)] bg-card p-4">
                <div className="label-eyebrow text-muted-foreground">
                  Prix public pro
                </div>
                <div className="mt-2 flex items-baseline gap-3">
                  <span className="font-display text-4xl font-semibold tabular-nums">
                    {formatEUR(product.basePriceHt)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    HT / unité
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Prix affiché pour réservation par achat groupé container.
                </p>
              </div>

              <div className="rounded-md border border-[color:var(--sand-deep)] bg-card p-4">
                <div className="label-eyebrow text-muted-foreground">
                  Minimum de commande
                </div>
                <div className="mt-2 font-display text-4xl font-semibold tabular-nums">
                  {quantityRule.minimum}
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {quantityRule.label} · MOQ catalogue {product.moqUnits}{' '}
                  unités.
                </p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
              <Spec
                icon={Ruler}
                label="Dimensions"
                value={`${product.dimensions.l}x${product.dimensions.w}x${product.dimensions.h} cm`}
              />
              <Spec
                icon={Weight}
                label="Poids"
                value={`${product.weightKg} kg`}
              />
              <Spec
                icon={Package}
                label="Volume"
                value={`${product.cbmPerUnit.toFixed(3)} m3/u`}
              />
              <Spec icon={Truck} label="Logistique" value="Container groupé" />
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                asChild
                className="h-11 rounded-sm bg-foreground text-background hover:bg-[color:var(--ink-soft)]"
              >
                <a href={reserveHref}>
                  Réserver cette référence
                  <ArrowRight className="h-4 w-4" />
                </a>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-11 rounded-sm border-[color:var(--sand-deep)]"
              >
                <a href="/catalogue">Comparer dans le catalogue</a>
              </Button>
            </div>
          </article>
        </section>

        <section className="border-y border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]">
          <div className="mx-auto grid max-w-7xl gap-6 px-6 py-10 lg:grid-cols-[1fr_22rem]">
            <div>
              <div className="label-eyebrow text-[color:var(--ember)]">
                Points à valider
              </div>
              <h2 className="mt-2 font-display text-3xl tracking-tight">
                Informations utiles avant une commande en volume.
              </h2>
              <ul className="mt-5 grid gap-2 md:grid-cols-2">
                {product.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex gap-2 rounded-sm border border-[color:var(--sand-deep)] bg-card px-3 py-2 text-sm"
                  >
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--forest)]" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3">
              {product.fireRating ? (
                <div className="border-[color:var(--forest)]/30 bg-[color:var(--forest)]/5 rounded-md border p-4 text-sm">
                  <div className="flex items-center gap-2 font-medium">
                    <ShieldCheck className="h-4 w-4 text-[color:var(--forest)]" />
                    Conformité CE
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    Signal conformité disponible pour usage mobilier extérieur
                    professionnel.
                  </p>
                </div>
              ) : null}
              <ProductDocumentsList product={product} />
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-8 px-6 py-12 lg:grid-cols-[1fr_1fr]">
          <div>
            <div className="label-eyebrow text-[color:var(--ember)]">
              Questions fréquentes
            </div>
            <div className="mt-5 divide-y divide-[color:var(--sand-deep)] rounded-md border border-[color:var(--sand-deep)] bg-card">
              {faq.map((item) => (
                <details
                  key={item.q}
                  className="group [&_summary::-webkit-details-marker]:hidden"
                >
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-4 py-4 text-sm hover:text-[color:var(--ember)]">
                    <span className="font-medium">{item.q}</span>
                    <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                  </summary>
                  <p className="px-4 pb-4 text-sm leading-6 text-muted-foreground">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </div>

          <div>
            <div className="label-eyebrow text-[color:var(--ember)]">
              Références proches
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {related.map((item) => (
                <a
                  key={item.id}
                  href={productPath(item)}
                  className="group overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card"
                >
                  <img
                    src={item.mainImageUrl}
                    alt={item.name}
                    loading="lazy"
                    decoding="async"
                    className="h-36 w-full object-cover transition-transform group-hover:scale-[1.03]"
                  />
                  <div className="p-3">
                    <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                      {CATEGORY_LABEL[item.category]} · MOQ {item.moqUnits}
                    </div>
                    <h3 className="mt-1 line-clamp-2 font-display text-base font-semibold tracking-tight">
                      {item.name}
                    </h3>
                    <div className="mt-2 text-sm font-medium tabular-nums">
                      {formatEUR(item.basePriceHt)} HT
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}

function Spec({
  icon: Icon,
  label,
  value,
}: {
  readonly icon: typeof Ruler
  readonly label: string
  readonly value: string
}) {
  return (
    <div className="rounded-sm border border-[color:var(--sand-deep)] bg-card p-3">
      <div className="label-eyebrow flex items-center gap-1 text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className="mt-1 font-medium tabular-nums">{value}</div>
    </div>
  )
}

function categoryPath(product: Product): string {
  if (product.category === 'chair') return '/catalogue/chaises-restaurant'
  if (product.category === 'armchair') return '/catalogue/fauteuils-restaurant'
  if (product.category === 'table') return '/catalogue/tables-restaurant'
  return '/catalogue/bancs-terrasse'
}

function relatedProducts(product: Product): Product[] {
  return PRODUCTS.filter(
    (item) => item.id !== product.id && item.category === product.category,
  ).slice(0, 4)
}

function productFaq(product: Product) {
  return [
    {
      q: `Quel est le minimum de commande pour ${product.name} ?`,
      a: `Le minimum indiqué pour cette référence est de ${product.moqUnits} unités. Si le produit est une chaise, le premier ajout se fait à 50 unités, puis les quantités peuvent augmenter par paliers adaptés au catalogue.`,
    },
    {
      q: 'Le prix affiché est-il un prix HT professionnel ?',
      a: `Oui, le prix affiché est ${formatEUR(product.basePriceHt)} HT par unité dans le cadre d’un achat groupé par container. Le transport final après arrivée au port reste organisé côté client.`,
    },
    {
      q: 'Cette référence convient-elle à une terrasse CHR ?',
      a: 'La fiche est pensée pour les restaurants, hôtels, cafés, campings, rooftops et projets de terrasse professionnelle. Les dimensions, le poids, le volume et les photos aident à valider le choix avant réservation.',
    },
  ] as const
}
