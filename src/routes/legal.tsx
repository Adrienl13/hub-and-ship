import { createFileRoute, Link } from '@tanstack/react-router'
import {
  ChevronRight,
  Cookie,
  FileCheck,
  FileText,
  Receipt,
  Scroll,
  Shield,
} from 'lucide-react'
import { lazy, Suspense, useState } from 'react'

import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { LEGAL_PAGES, type LegalSlug } from '@/components/LegalLayout'
import { useCart } from '@/stores/cart.store'

const LazyReservationDialog = lazy(() =>
  import('@/components/ReservationDialog').then((module) => ({
    default: module.ReservationDialog,
  })),
)

const ICONS: Record<LegalSlug, typeof FileText> = {
  'mentions-legales': FileText,
  cgv: FileCheck,
  cgu: Scroll,
  confidentialite: Shield,
  cookies: Cookie,
  remboursement: Receipt,
}

const DESCRIPTIONS: Record<LegalSlug, string> = {
  'mentions-legales':
    'Éditeur, hébergement, propriété intellectuelle et coordonnées de Pros Import EURL.',
  cgv: 'Conditions générales de vente B2B — pré-commande groupée, échéancier, garanties, médiation.',
  cgu: 'Conditions générales d’utilisation du Site — accès, compte, comportements interdits.',
  confidentialite:
    'Conforme RGPD : données collectées, finalités, sous-traitants, durée, vos droits, contact CNIL.',
  cookies:
    'Types de cookies utilisés, consentement, comment les paramétrer ou les refuser.',
  remboursement:
    'Cas de remboursement intégral, sort des frais de réservation, délais, geste commercial en cas de retard.',
}

export const Route = createFileRoute('/legal')({
  component: LegalHub,
  head: () => ({
    meta: [
      { title: 'Documents légaux — Container Club' },
      {
        name: 'description',
        content:
          'Tous les documents légaux de Container Club : mentions légales, CGV, CGU, confidentialité, cookies, politique de remboursement.',
      },
    ],
  }),
})

function LegalHub() {
  const { items, totals } = useCart()
  const [reserveOpen, setReserveOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header onReserve={() => setReserveOpen(true)} />

      <div className="mx-auto max-w-5xl px-6 py-12">
        <nav
          aria-label="Fil d'Ariane"
          className="mb-8 flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <Link to="/" className="hover:text-foreground">
            Container Club
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">Légal</span>
        </nav>

        <header className="mb-10 border-b border-[color:var(--sand-deep)] pb-8">
          <div className="label-eyebrow text-[color:var(--ember)]">
            Documents légaux
          </div>
          <h1 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">
            Transparence légale & protection.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[color:var(--ink-soft)]">
            Tous les documents légaux régissant l'utilisation du site Container
            Club et les relations commerciales avec Pros Import EURL. Adaptés au
            modèle B2B de pré-commande groupée, conformes au droit français.
          </p>
        </header>

        <div className="grid gap-3 sm:grid-cols-2">
          {LEGAL_PAGES.map((page) => {
            const Icon = ICONS[page.slug]
            return (
              <Link
                key={page.slug}
                to="/legal/$slug"
                params={{ slug: page.slug }}
                className="hover:shadow-paper hover:border-foreground/30 group flex items-start gap-4 rounded-md border border-[color:var(--sand-deep)] bg-card p-5 transition-all hover:-translate-y-0.5"
              >
                <span className="text-foreground/80 flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-[color:var(--sand-soft)]">
                  <Icon className="h-4 w-4" strokeWidth={1.5} />
                </span>
                <div className="flex-1">
                  <div className="font-display text-base font-semibold tracking-tight">
                    {page.label}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {DESCRIPTIONS[page.slug]}
                  </p>
                </div>
                <ChevronRight className="mt-1.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
              </Link>
            )
          })}
        </div>

        <div className="mt-10 rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] p-6 text-xs">
          <div className="label-eyebrow text-muted-foreground">
            Contact juridique
          </div>
          <p className="text-foreground/85 mt-2 leading-relaxed">
            Pour toute question relative à ces documents, exercer vos droits
            RGPD, ou signaler un problème de conformité, écrivez à{' '}
            <a
              href="mailto:legal@terrassea.fr"
              className="font-medium text-foreground underline-offset-2 hover:underline"
            >
              legal@terrassea.fr
            </a>{' '}
            — réponse sous 5 jours ouvrés.
          </p>
        </div>
      </div>

      <Footer />

      <Suspense fallback={null}>
        {reserveOpen && (
          <LazyReservationDialog
            open={reserveOpen}
            onOpenChange={setReserveOpen}
            items={items}
            totals={totals}
          />
        )}
      </Suspense>
    </div>
  )
}
