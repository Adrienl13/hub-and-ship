import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'

import { Reveal, RevealItem, RevealStagger } from '@/components/motion-helpers'
import { COLLECTIONS, countByCollection } from '@/lib/collections'
import type { Product } from '@/lib/products'

// D3 — « comprendre sans lire un seul mot » : juste sous le hero, les 4
// gammes se présentent par l'image (vrais packshots produit), une scène par
// univers. Chaque carte ouvre le catalogue déjà filtré sur la gamme.
export function CollectionsShowcase({
  products,
}: {
  readonly products: ReadonlyArray<Product>
}) {
  const counts = countByCollection(products)
  const hasLiveCollections = COLLECTIONS.some((c) => counts[c.key] > 0)

  return (
    <section
      aria-label="Les collections"
      className="border-y border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]"
    >
      <div className="mx-auto max-w-7xl px-6 py-14">
        <Reveal>
          <div className="label-eyebrow text-[color:var(--ember)]">
            Quatre gammes, quatre terrasses
          </div>
          <h2 className="mt-2 max-w-2xl font-display text-2xl tracking-tight sm:text-3xl">
            Le mobilier que vos clients verront, avant tout discours.
          </h2>
        </Reveal>
        <RevealStagger className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {COLLECTIONS.map((collection) => (
            <RevealItem key={collection.key}>
              <Link
                to="/catalogue"
                search={{ collection: collection.key }}
                className="group block h-full rounded-md border border-[color:var(--sand-deep)] bg-card p-4 transition-all hover:-translate-y-1 hover:shadow-md"
              >
                <div className="flex h-40 items-center justify-center overflow-hidden sm:h-48">
                  <img
                    src={collection.heroImage}
                    alt={`Collection ${collection.label}`}
                    loading="lazy"
                    className="max-h-full w-auto object-contain drop-shadow-md transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                </div>
                <div className="mt-4 flex items-baseline justify-between gap-2">
                  <h3 className="font-display text-lg font-semibold tracking-tight">
                    {collection.label}
                  </h3>
                  {hasLiveCollections && counts[collection.key] > 0 && (
                    <span className="mono text-[11px] text-muted-foreground">
                      {counts[collection.key]} modèles
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {collection.tagline}
                </p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[color:var(--ember)]">
                  Découvrir
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </RevealItem>
          ))}
        </RevealStagger>
      </div>
    </section>
  )
}
