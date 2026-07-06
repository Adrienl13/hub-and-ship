import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import {
  ArrowRight,
  Box,
  Container as ContainerIcon,
  Ruler,
  ShieldCheck,
} from 'lucide-react'

import { ContainerNotifySection } from '@/components/ContainerNotifyForm'
import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import {
  findProductBySlug,
  productPath,
} from '@/lib/catalogue/product-slug'
import { loadCatalogProducts } from '@/lib/catalogue/server-catalog'
import { formatEUR } from '@/lib/order'
import { CATEGORY_LABEL, type Product } from '@/lib/products'
import {
  breadcrumbJsonLd,
  buildSeoHead,
  jsonLdScript,
  productJsonLd,
} from '@/lib/seo'

// Page produit SSR — chaque produit obtient une URL propre, du HTML complet
// côté serveur et un Product JSON-LD auto-référent : c'est ce que lisent
// Google, les moteurs IA et les agents d'achat (le dialog du catalogue est
// invisible pour eux).
export const Route = createFileRoute('/catalogue_/p/$slug')({
  loader: async ({ params }) => {
    const products = await loadCatalogProducts()
    const product = findProductBySlug(products, params.slug)
    if (!product) throw notFound()
    return { product }
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return buildSeoHead({
        title: 'Produit introuvable',
        description: 'Ce produit n’existe pas ou a été retiré du catalogue.',
        path: '/catalogue',
        noindex: true,
      })
    }
    const { product } = loaderData
    const path = productPath(product)
    return {
      ...buildSeoHead({
        title: `${product.name} — prix direct pro`,
        description: `${product.name} : ${formatEUR(product.basePriceHt)} HT en direct usine (réf. distribution ${formatEUR(product.retailPriceRef)}). MOQ ${product.moqUnits} unités, contrôle SGS, garantie 2 ans, livraison par container mutualisé.`,
        path,
        image: product.mainImageUrl,
      }),
      scripts: [
        jsonLdScript(productJsonLd(product, { url: path })),
        jsonLdScript(
          breadcrumbJsonLd([
            { name: 'Accueil', path: '/' },
            { name: 'Catalogue', path: '/catalogue' },
            { name: product.name, path },
          ]),
        ),
      ],
    }
  },
  component: ProductPage,
})

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
    <div className="flex items-start gap-2.5 rounded-md border border-[color:var(--sand-deep)] bg-card p-3">
      <Icon className="mt-0.5 h-4 w-4 flex-none text-[color:var(--ember)]" />
      <div>
        <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </div>
        <div className="mt-0.5 text-sm font-medium">{value}</div>
      </div>
    </div>
  )
}

function savingsPercent(product: Product): number {
  if (product.retailPriceRef <= 0) return 0
  return Math.round(
    (1 - product.basePriceHt / product.retailPriceRef) * 100,
  )
}

function ProductPage() {
  const { product } = Route.useLoaderData()
  const savings = savingsPercent(product)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header onReserve={() => window.location.assign('/catalogue')} />

      <main className="mx-auto max-w-4xl px-6 py-10">
        <nav className="text-xs text-muted-foreground">
          <Link to="/catalogue" className="hover:text-foreground">
            Catalogue
          </Link>
          <span className="mx-1.5">/</span>
          <span>{CATEGORY_LABEL[product.category]}</span>
        </nav>

        <div className="mt-4 grid gap-8 md:grid-cols-[1.1fr_1fr]">
          <div>
            <img
              src={product.mainImageUrl}
              alt={product.name}
              className="w-full rounded-md border border-[color:var(--sand-deep)] object-cover"
            />
            {product.galleryUrls.length > 0 && (
              <div className="mt-2 grid grid-cols-4 gap-2">
                {product.galleryUrls.slice(0, 4).map((url) => (
                  <img
                    key={url}
                    src={url}
                    alt={product.name}
                    loading="lazy"
                    decoding="async"
                    className="h-20 w-full rounded-sm border border-[color:var(--sand-deep)] object-cover"
                  />
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="label-eyebrow text-[color:var(--ember)]">
              {CATEGORY_LABEL[product.category]} · Réf. {product.sku}
            </div>
            <h1 className="mt-2 font-display text-3xl tracking-tight">
              {product.name}
            </h1>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              {product.description}
            </p>

            <div className="mt-5 rounded-md border border-[color:var(--sand-deep)] bg-card p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">
                  Prix direct pro
                </span>
                <span className="font-display text-2xl font-semibold tabular-nums">
                  {formatEUR(product.basePriceHt)} HT
                </span>
              </div>
              <div className="mt-1 flex items-baseline justify-between text-xs text-muted-foreground">
                <span>Prix public conseillé (réf. distribution)</span>
                <span className="tabular-nums line-through">
                  {formatEUR(product.retailPriceRef)}
                </span>
              </div>
              {savings > 0 && (
                <div className="mt-2 inline-flex rounded-sm bg-[color:var(--ember)]/10 px-2 py-1 text-xs font-semibold text-[color:var(--ember)]">
                  −{savings} % vs circuit classique
                </div>
              )}
              <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
                Prix rendu port (Marseille-Fos / Le Havre) : achat usine, fret
                mutualisé, douane et contrôle SGS inclus. Remises volume : −6 %
                dès 100 pièces, −10 % dès 150.{' '}
                <Link to="/prix" className="underline underline-offset-2">
                  Voir la méthode de prix
                </Link>
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                to="/catalogue"
                className="inline-flex h-11 items-center gap-2 rounded-sm bg-foreground px-5 text-sm font-medium text-background"
              >
                Réserver sur le container
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/contact"
                className="inline-flex h-11 items-center rounded-sm border border-[color:var(--sand-deep)] px-5 text-sm font-medium"
              >
                Poser une question
              </Link>
            </div>
          </div>
        </div>

        <section className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Spec
            icon={Ruler}
            label="Dimensions"
            value={`${product.dimensions.l} × ${product.dimensions.w} × ${product.dimensions.h} cm`}
          />
          <Spec
            icon={Box}
            label="Volume / MOQ"
            value={`${product.cbmPerUnit.toFixed(2)} m³ par unité · MOQ ${product.moqUnits}`}
          />
          <Spec
            icon={ContainerIcon}
            label="Logistique"
            value="Container mutualisé, rendu port, enlèvement gratuit"
          />
          <Spec
            icon={ShieldCheck}
            label="Qualité"
            value="Contrôle SGS avant départ · Garantie 2 ans · SAV France"
          />
        </section>

        {product.features.length > 0 && (
          <section className="mt-8">
            <h2 className="font-display text-xl tracking-tight">
              Caractéristiques
            </h2>
            <ul className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              {product.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <span className="mt-2 h-1 w-1 flex-none rounded-full bg-[color:var(--ember)]" />
                  {feature}
                </li>
              ))}
            </ul>
          </section>
        )}

        {product.variants.length > 1 && (
          <section className="mt-8">
            <h2 className="font-display text-xl tracking-tight">
              Coloris & variantes
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {product.variants.map((variant) => (
                <span
                  key={variant.id}
                  className="rounded-sm border border-[color:var(--sand-deep)] bg-card px-3 py-1.5 text-xs"
                >
                  {variant.name}
                </span>
              ))}
            </div>
          </section>
        )}

        <ContainerNotifySection source="produit" />
      </main>

      <Footer />
    </div>
  )
}
