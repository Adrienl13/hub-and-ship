import { Link } from '@tanstack/react-router'
import { ChevronRight, FileText } from 'lucide-react'

import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'

export const LEGAL_PAGES = [
  {
    slug: 'mentions-legales',
    label: 'Mentions légales',
    short: 'Éditeur & hébergement',
  },
  { slug: 'cgv', label: 'Conditions générales de vente', short: 'CGV B2B' },
  {
    slug: 'cgu',
    label: 'Conditions générales d’utilisation',
    short: 'CGU du site',
  },
  {
    slug: 'confidentialite',
    label: 'Politique de confidentialité',
    short: 'RGPD & données',
  },
  {
    slug: 'cookies',
    label: 'Politique cookies',
    short: 'Traceurs & consentement',
  },
  {
    slug: 'remboursement',
    label: 'Politique de remboursement',
    short: 'Modalités de remboursement',
  },
] as const

export type LegalSlug = (typeof LEGAL_PAGES)[number]['slug']

export function LegalLayout({
  slug,
  title,
  updatedAt,
  onReserve,
  children,
}: {
  slug: LegalSlug
  title: string
  updatedAt: string
  onReserve: () => void
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header onReserve={onReserve} />

      <div className="mx-auto max-w-7xl px-6 py-12">
        {/* Breadcrumb */}
        <nav
          aria-label="Fil d'Ariane"
          className="mb-8 flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <Link to="/" className="hover:text-foreground">
            Container Club
          </Link>
          <ChevronRight className="h-3 w-3" />
          <Link to="/legal" className="hover:text-foreground">
            Légal
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">{title}</span>
        </nav>

        <div className="grid gap-10 lg:grid-cols-12">
          {/* Sidebar */}
          <aside className="lg:col-span-3">
            <nav className="sticky top-20 space-y-1">
              <div className="label-eyebrow mb-3 text-muted-foreground">
                Documents légaux
              </div>
              {LEGAL_PAGES.map((page) => {
                const active = page.slug === slug
                return (
                  <Link
                    key={page.slug}
                    to="/legal/$slug"
                    params={{ slug: page.slug }}
                    className={`block rounded-sm px-3 py-2 text-sm transition-colors ${
                      active
                        ? 'bg-foreground text-background'
                        : 'text-foreground/75 hover:bg-card hover:text-foreground'
                    }`}
                  >
                    <div className="font-medium">{page.label}</div>
                    <div
                      className={`text-[11px] ${
                        active ? 'text-background/65' : 'text-muted-foreground'
                      }`}
                    >
                      {page.short}
                    </div>
                  </Link>
                )
              })}
            </nav>
          </aside>

          {/* Content */}
          <main id="contenu" className="lg:col-span-9">
            <header className="border-b border-[color:var(--sand-deep)] pb-6">
              <div className="label-eyebrow text-[color:var(--ember)]">
                Document légal
              </div>
              <h1 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">
                {title}
              </h1>
              <p className="mt-2 text-xs text-muted-foreground">
                Dernière mise à jour : {updatedAt}
              </p>
            </header>

            <article className="legal-prose text-foreground/85 mt-8 max-w-none text-sm leading-relaxed">
              {children}
            </article>

            <div className="mt-12 flex flex-wrap items-center gap-3 border-t border-[color:var(--sand-deep)] pt-6 text-xs text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              <span>
                Pour toute question juridique :{' '}
                <a
                  href="mailto:legal@terrassea.fr"
                  className="font-medium text-foreground underline-offset-2 hover:underline"
                >
                  legal@terrassea.fr
                </a>
              </span>
              <span>·</span>
              <span>Édité par Pros Import EURL · RCS Paris 988 269 981</span>
            </div>
          </main>
        </div>
      </div>

      <Footer />
    </div>
  )
}

export function LegalSection({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 border-t border-[color:var(--sand-deep)] py-6 first:border-t-0 first:pt-0"
    >
      <h2 className="font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
        {title}
      </h2>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  )
}
