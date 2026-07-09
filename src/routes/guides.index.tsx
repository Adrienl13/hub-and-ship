import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'

import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { GUIDES } from '@/lib/guides/content'
import {
  breadcrumbJsonLd,
  buildSeoHead,
  jsonLdScript,
  linkListJsonLd,
} from '@/lib/seo'

export const Route = createFileRoute('/guides/')({
  component: GuidesIndexPage,
  head: () => ({
    ...buildSeoHead({
      title: 'Guides import mobilier CHR',
      description:
        "Guides pratiques Pros Import : importer du mobilier CHR par container, prix en volume, container 20 vs 40 pieds, qualité et logistique.",
      path: '/guides',
    }),
    scripts: [
      jsonLdScript(
        linkListJsonLd({
          name: 'Guides Pros Import',
          path: '/guides',
          items: GUIDES.map((g) => ({
            name: g.title,
            path: `/guides/${g.slug}`,
          })),
        }),
      ),
      jsonLdScript(
        breadcrumbJsonLd([
          { name: 'Accueil', path: '/' },
          { name: 'Guides', path: '/guides' },
        ]),
      ),
    ],
  }),
})

function GuidesIndexPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header onReserve={() => window.location.assign('/catalogue')} />

      <main id="contenu" className="mx-auto max-w-3xl px-6 py-10">
        <div className="label-eyebrow text-[color:var(--ember)]">Guides</div>
        <h1 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">
          Comprendre l’import de mobilier CHR
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
          Des réponses directes aux questions des restaurateurs, hôteliers,
          campings et revendeurs : achat groupé par container, prix en volume,
          formats et logistique.
        </p>

        <ul className="mt-8 space-y-3">
          {GUIDES.map((guide) => (
            <li key={guide.slug}>
              <Link
                to="/guides/$slug"
                params={{ slug: guide.slug }}
                className="block rounded-md border border-[color:var(--sand-deep)] bg-card p-5 transition-colors hover:border-[color:var(--ember)]/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-semibold">
                      {guide.title}
                    </h2>
                    <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                      {guide.metaDescription}
                    </p>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[color:var(--ember)]" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </main>

      <Footer />
    </div>
  )
}
