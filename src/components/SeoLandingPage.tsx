import { Link } from '@tanstack/react-router'
import { ArrowRight, CheckCircle2, PackageCheck, Ship } from 'lucide-react'

import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { Button } from '@/components/ui/button'
import { CATEGORY_LABEL, type Product } from '@/lib/products'
import { formatEUR } from '@/lib/order'
import { productPath } from '@/lib/product-slugs'

export interface SeoLandingSection {
  readonly title: string
  readonly body: string
}

export interface SeoLandingFaq {
  readonly q: string
  readonly a: string
}

export interface SeoLandingPageProps {
  readonly eyebrow: string
  readonly title: string
  readonly description: string
  readonly proofPoints: ReadonlyArray<string>
  readonly products: ReadonlyArray<Product>
  readonly sections: ReadonlyArray<SeoLandingSection>
  readonly faqs: ReadonlyArray<SeoLandingFaq>
  readonly primaryHref?: string
  readonly primaryLabel?: string
}

export function SeoLandingPage({
  eyebrow,
  title,
  description,
  proofPoints,
  products,
  sections,
  faqs,
  primaryHref = '/catalogue',
  primaryLabel = 'Voir les produits',
}: SeoLandingPageProps) {
  const goToCatalogue = () => {
    window.location.href = primaryHref
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header onReserve={goToCatalogue} />

      <main id="contenu">
        <section className="border-b border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]">
          <div className="mx-auto grid max-w-7xl gap-8 px-6 py-14 lg:grid-cols-[1fr_360px] lg:items-end">
            <div className="max-w-3xl">
              <div className="label-eyebrow text-[color:var(--ember)]">
                {eyebrow}
              </div>
              <h1 className="mt-3 font-display text-4xl tracking-tight md:text-5xl">
                {title}
              </h1>
              <p className="mt-4 text-sm leading-6 text-[color:var(--ink-soft)]">
                {description}
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button
                  asChild
                  className="h-11 rounded-sm bg-foreground text-background hover:bg-[color:var(--ink-soft)]"
                >
                  <a href={primaryHref}>
                    {primaryLabel}
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="h-11 rounded-sm border-[color:var(--sand-deep)]"
                >
                  <Link to="/faq">Questions fréquentes</Link>
                </Button>
              </div>
            </div>

            <div className="rounded-md border border-[color:var(--sand-deep)] bg-card p-4">
              <div className="label-eyebrow text-muted-foreground">
                Points clés
              </div>
              <ul className="mt-4 space-y-3 text-sm">
                {proofPoints.map((point) => (
                  <li key={point} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--ember)]" />
                    <span className="text-foreground/80">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="border-b border-[color:var(--sand-deep)]">
          <div className="mx-auto grid max-w-7xl gap-4 px-6 py-10 md:grid-cols-3">
            {sections.map((section) => (
              <article
                key={section.title}
                className="rounded-md border border-[color:var(--sand-deep)] bg-card p-5"
              >
                <Ship className="h-5 w-5 text-[color:var(--ember)]" />
                <h2 className="mt-3 font-display text-lg font-semibold tracking-tight">
                  {section.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {section.body}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-14">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="label-eyebrow text-[color:var(--ember)]">
                Sélection catalogue
              </div>
              <h2 className="mt-2 font-display text-3xl tracking-tight">
                Produits adaptés aux recherches professionnelles.
              </h2>
            </div>
            <Link
              to="/catalogue"
              className="hover:border-foreground/40 inline-flex min-h-11 items-center rounded-sm border border-[color:var(--sand-deep)] px-4 text-sm font-medium"
            >
              Catalogue complet
            </Link>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <article
                key={product.id}
                className="overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card"
              >
                <img
                  src={product.mainImageUrl}
                  alt={product.name}
                  loading="lazy"
                  decoding="async"
                  className="h-40 w-full object-cover"
                />
                <div className="space-y-3 p-4">
                  <div>
                    <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                      {CATEGORY_LABEL[product.category]} · MOQ{' '}
                      {product.moqUnits}
                    </div>
                    <h3 className="mt-1 font-display text-lg font-semibold tracking-tight">
                      {product.name}
                    </h3>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">
                      {product.description}
                    </p>
                  </div>
                  <div className="flex items-center justify-between border-t border-[color:var(--sand-deep)] pt-3 text-sm">
                    <span className="text-muted-foreground">
                      {product.cbmPerUnit.toFixed(2)} m3/u
                    </span>
                    <span className="font-display font-semibold tabular-nums">
                      {formatEUR(product.basePriceHt)} HT
                    </span>
                  </div>
                  <a
                    href={productPath(product)}
                    className="inline-flex min-h-10 w-full items-center justify-center rounded-sm bg-foreground px-3 text-sm font-medium text-background hover:bg-[color:var(--ink-soft)]"
                  >
                    Voir cette référence
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="border-t border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]">
          <div className="mx-auto max-w-4xl px-6 py-14">
            <div className="label-eyebrow text-[color:var(--ember)]">
              Réponses rapides
            </div>
            <div className="mt-6 divide-y divide-[color:var(--sand-deep)] border-y border-[color:var(--sand-deep)]">
              {faqs.map((item) => (
                <details
                  key={item.q}
                  className="group [&_summary::-webkit-details-marker]:hidden"
                >
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4 py-5 text-sm hover:text-[color:var(--ember)]">
                    <span className="font-display text-base font-medium tracking-tight">
                      {item.q}
                    </span>
                    <PackageCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-open:text-[color:var(--ember)]" />
                  </summary>
                  <p className="pb-5 pr-9 text-sm leading-6 text-[color:var(--ink-soft)]">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
