import {
  Outlet,
  createFileRoute,
  useRouterState,
} from '@tanstack/react-router'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  BadgeEuro,
  CheckCircle2,
  FileText,
  Handshake,
  Link2,
  PackageCheck,
  ShieldCheck,
  UserCheck,
} from 'lucide-react'

import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { Reveal, RevealItem, RevealStagger } from '@/components/motion-helpers'
import { Button } from '@/components/ui/button'
import { useCatalog } from '@/hooks/useCatalog'
import {
  buildPartnerSharePath,
  normalizePartnerSlug,
  partnerDisplayNameFromSlug,
} from '@/lib/partners/link'
import {
  getPublicSelection,
  selectionPublicTotalHt,
  selectionTotalUnits,
  type PartnerSelectionsClient,
  type PublicSelection,
} from '@/lib/partners/selections'
import { formatEUR } from '@/lib/order'
import { CATEGORY_LABEL, PRODUCTS } from '@/lib/products'
import { breadcrumbJsonLd, buildSeoHead, jsonLdScript } from '@/lib/seo'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'
import { useCart } from '@/stores/cart.store'

const LazyReservationDialog = lazy(() =>
  import('@/components/ReservationDialog').then((module) => ({
    default: module.ReservationDialog,
  })),
)

export const Route = createFileRoute('/p/$partnerSlug')({
  component: PartnerSharePage,
  validateSearch: (
    search: Record<string, unknown>,
  ): { readonly selection?: string } => ({
    selection:
      typeof search.selection === 'string' && search.selection.trim() !== ''
        ? search.selection
        : undefined,
  }),
  head: ({ params }) => {
    const slug = normalizePartnerSlug(params.partnerSlug) ?? 'partenaire'
    const partnerName = partnerDisplayNameFromSlug(slug)
    return {
      ...buildSeoHead({
        title: `Sélection partenaire ${partnerName}`,
        description:
          'Sélection partenaire Pros Import : mobilier CHR en achat groupé, client protégé, prix publics directs et conditions partenaires hors espace public.',
        path: buildPartnerSharePath({ slug }),
        image: PRODUCTS[0]?.mainImageUrl,
        // Espace d'URL non borné (n'importe quel slug matche) : ces pages
        // co-brandées se partagent par lien direct, elles n'ont pas à être
        // indexées (contenu catalogue dupliqué par partenaire + usurpation).
        noindex: true,
      }),
      scripts: [
        jsonLdScript(
          breadcrumbJsonLd([
            { name: 'Accueil', path: '/' },
            { name: 'Partenaires', path: '/partenaires' },
            { name: partnerName, path: buildPartnerSharePath({ slug }) },
          ]),
        ),
      ],
    }
  },
})

function PartnerSharePage() {
  const { partnerSlug } = Route.useParams()
  // Parent de /p/$partnerSlug/devis : sans <Outlet/>, le CTA « Télécharger le
  // devis » ne rendait jamais la page devis (autonome). Pass-through basé sur
  // l'identité du match feuille — une comparaison de pathname casse sur les
  // URLs percent-encodées ou la casse (le matching du routeur est insensible).
  const isLeaf = useRouterState({
    select: (state) =>
      state.matches[state.matches.length - 1]?.routeId === Route.id,
  })
  const { selection: selectionId } = Route.useSearch()
  const normalizedSlug = normalizePartnerSlug(partnerSlug) ?? 'partenaire'
  const partnerName = partnerDisplayNameFromSlug(normalizedSlug)
  const { products, currentContainer } = useCatalog()
  const productsArray = useMemo(() => [...products], [products])
  const featuredProducts = productsArray.slice(0, 4)
  const { items, totals } = useCart({
    products: productsArray,
    capacityCbm: currentContainer.capacityCbm,
  })
  const [reserveOpen, setReserveOpen] = useState(false)
  const selection = usePublicSelection(selectionId)

  // Après tous les hooks (règles des hooks) : rendre l'enfant /devis autonome.
  if (!isLeaf) {
    return <Outlet />
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <Header onReserve={() => setReserveOpen(true)} />

      <main>
        <section className="border-b border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]">
          <div className="mx-auto grid max-w-7xl gap-8 px-6 py-10 lg:grid-cols-[1.02fr_0.98fr] lg:items-stretch">
            <Reveal className="flex flex-col justify-center py-8">
              <div className="label-eyebrow text-[color:var(--ember)]">
                Sélection partenaire
              </div>
              <h1 className="mt-3 max-w-3xl font-display text-4xl tracking-tight sm:text-5xl">
                {partnerName} vous ouvre son accès Pros Import.
              </h1>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-[color:var(--ink-soft)]">
                Vous consultez une page co-brandée : le projet reste rattaché au
                partenaire, tandis que Pros Import opère l'import, la qualité et
                le container. Les prix nets partenaires restent privés.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Button
                  asChild
                  className="min-h-11 rounded-sm bg-[color:var(--foreground)] px-5 text-[color:var(--background)] hover:bg-[color:var(--ink-soft)]"
                >
                  <a href={`/catalogue?partner=${normalizedSlug}`}>
                    Voir le catalogue
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 rounded-sm border-[color:var(--foreground)] px-5"
                  onClick={() => setReserveOpen(true)}
                >
                  Réserver avec ce lien
                </Button>
              </div>
            </Reveal>

            <RevealStagger className="grid min-h-[420px] grid-cols-2 gap-2">
              {featuredProducts.map((product, index) => (
                <RevealItem
                  key={product.id}
                  className={`relative overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card ${
                    index === 0 ? 'col-span-2' : ''
                  }`}
                >
                  <img
                    src={product.mainImageUrl}
                    alt={product.name}
                    className="h-full min-h-36 w-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 text-white">
                    <div className="text-xs uppercase tracking-[0.08em] opacity-80">
                      {CATEGORY_LABEL[product.category]}
                    </div>
                    <div className="mt-1 font-display text-lg font-semibold">
                      {product.name}
                    </div>
                  </div>
                </RevealItem>
              ))}
            </RevealStagger>
          </div>
        </section>

        {selection && (
          <SelectionShowcase
            selection={selection}
            partnerName={partnerName}
            slug={normalizedSlug}
            onReserve={() => setReserveOpen(true)}
          />
        )}

        <section className="border-b border-[color:var(--sand-deep)]">
          <RevealStagger className="mx-auto grid max-w-7xl gap-px bg-[color:var(--sand-deep)] px-6 py-12 md:grid-cols-4">
            {[
              {
                Icon: ShieldCheck,
                title: 'Projet protégé',
                text: 'Le lien garde une trace interne pour rattacher le dossier au partenaire.',
              },
              {
                Icon: BadgeEuro,
                title: 'Prix publics clairs',
                text: 'Le client voit les prix directs pros ; les prix nets partenaires ne sont jamais publics.',
              },
              {
                Icon: PackageCheck,
                title: 'Volume mutualisé',
                text: 'La commande rejoint le container actif et bénéficie du modèle achat groupé.',
              },
              {
                Icon: FileText,
                title: 'Support de vente',
                text: 'Cette page prépare les futures sélections et devis co-brandés.',
              },
            ].map(({ Icon, title, text }) => (
              <RevealItem key={title} className="bg-background p-5">
                <Icon className="h-5 w-5 text-[color:var(--ember)]" />
                <h2 className="mt-4 font-display text-lg font-semibold">
                  {title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {text}
                </p>
              </RevealItem>
            ))}
          </RevealStagger>
        </section>

        <section className="border-b border-[color:var(--sand-deep)] bg-[color:var(--foreground)] text-[color:var(--background)]">
          <div className="mx-auto grid max-w-7xl gap-8 px-6 py-14 lg:grid-cols-[0.78fr_1.22fr] lg:items-center">
            <Reveal>
              <div className="label-eyebrow text-[color:var(--ember-soft)]">
                Attribution en coulisses
              </div>
              <h2 className="mt-3 font-display text-3xl tracking-tight sm:text-4xl">
                Le lien travaille pour le partenaire, sans changer le parcours
                client.
              </h2>
              <p className="text-[color:var(--sand)]/75 mt-4 max-w-xl text-sm leading-7">
                Cette page explique le bon équilibre : le client voit un accès
                simple et public, tandis que le signal partenaire reste
                exploitable côté admin pour protéger la relation.
              </p>
            </Reveal>

            <RevealStagger className="grid gap-3 sm:grid-cols-4">
              {[
                {
                  Icon: Link2,
                  step: '01',
                  title: 'Lien capté',
                  text: `${normalizedSlug} reste mémorisé 120 jours sur le navigateur.`,
                },
                {
                  Icon: UserCheck,
                  step: '02',
                  title: 'Projet reconnu',
                  text: 'La réservation conserve le contexte partenaire dans son snapshot.',
                },
                {
                  Icon: ShieldCheck,
                  step: '03',
                  title: 'Deal protégé',
                  text: 'Supabase peut rattacher le dossier au deal ou partenaire validé.',
                },
                {
                  Icon: CheckCircle2,
                  step: '04',
                  title: 'Prix nets privés',
                  text: 'Le client final ne voit jamais les conditions nettes revendeur.',
                },
              ].map(({ Icon, step, title, text }) => (
                <RevealItem
                  key={step}
                  className="border-[color:var(--sand)]/15 bg-[color:var(--sand)]/[0.06] relative overflow-hidden rounded-md border p-4"
                >
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[color:var(--ember-soft)] to-transparent" />
                  <div className="flex items-center justify-between gap-2">
                    <Icon className="h-4 w-4 text-[color:var(--ember-soft)]" />
                    <span className="text-[color:var(--sand)]/25 font-display text-2xl">
                      {step}
                    </span>
                  </div>
                  <h3 className="mt-5 font-display text-lg font-semibold">
                    {title}
                  </h3>
                  <p className="text-[color:var(--sand)]/70 mt-2 text-xs leading-5">
                    {text}
                  </p>
                </RevealItem>
              ))}
            </RevealStagger>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-6 px-6 py-14 lg:grid-cols-[1fr_360px]">
          <Reveal>
            <div className="label-eyebrow text-[color:var(--ember)]">
              Sélection de départ
            </div>
            <h2 className="mt-2 font-display text-3xl tracking-tight">
              Une base claire à partager, puis à affiner.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
              Les revendeurs peuvent envoyer cette page pour cadrer le projet,
              puis transformer la sélection en devis personnalisé. Le panier
              reste modifiable côté client.
            </p>
          </Reveal>

          <Reveal className="rounded-md border border-[color:var(--sand-deep)] bg-card p-5">
            <div className="flex items-center gap-2">
              <Handshake className="h-4 w-4 text-[color:var(--forest)]" />
              <div className="text-sm font-medium">Lien actif</div>
            </div>
            <div className="mt-4 space-y-3 text-xs text-muted-foreground">
              <div className="flex justify-between gap-3">
                <span>Partenaire</span>
                <span className="text-right font-medium text-foreground">
                  {partnerName}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span>Container</span>
                <span className="text-right font-medium text-foreground">
                  {currentContainer.reference}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span>Panier actuel</span>
                <span className="text-right font-medium text-foreground">
                  {formatEUR(totals.subtotalHt)}
                </span>
              </div>
            </div>
            <Button
              type="button"
              className="mt-5 h-11 w-full rounded-sm bg-[color:var(--foreground)] text-[color:var(--background)]"
              onClick={() => setReserveOpen(true)}
            >
              Réserver ma place
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Reveal>
        </section>
      </main>

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

function usePublicSelection(
  selectionId: string | undefined,
): PublicSelection | null {
  const [selection, setSelection] = useState<PublicSelection | null>(null)

  useEffect(() => {
    if (!selectionId) {
      setSelection(null)
      return
    }
    const config = getSupabasePublicConfig()
    if (!config.isConfigured) return
    let cancelled = false
    void (async () => {
      try {
        const client = createSupabaseBrowserClient(
          config,
        ) as unknown as PartnerSelectionsClient
        const data = await getPublicSelection(client, selectionId)
        if (!cancelled) setSelection(data)
      } catch {
        if (!cancelled) setSelection(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectionId])

  return selection
}

function SelectionShowcase({
  selection,
  partnerName,
  slug,
  onReserve,
}: {
  readonly selection: PublicSelection
  readonly partnerName: string
  readonly slug: string
  readonly onReserve: () => void
}) {
  const totalHt = selectionPublicTotalHt(selection.items)
  const totalUnits = selectionTotalUnits(selection.items)
  const categoryLabels = CATEGORY_LABEL as Record<string, string>

  return (
    <section className="border-b border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="label-eyebrow text-[color:var(--ember)]">
          Sélection préparée par {partnerName}
        </div>
        <h2 className="mt-2 font-display text-3xl tracking-tight">
          {selection.title}
        </h2>
        {selection.comment && (
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[color:var(--ink-soft)]">
            {selection.comment}
          </p>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {selection.items.map((item) => (
            <article
              key={item.id}
              className="flex gap-3 rounded-md border border-[color:var(--sand-deep)] bg-card p-3"
            >
              <img
                src={item.snapshot.imageUrl}
                alt={item.snapshot.name}
                className="h-20 w-20 shrink-0 rounded-sm object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                  {categoryLabels[item.snapshot.category] ??
                    item.snapshot.category}
                </div>
                <div className="font-display text-base font-semibold">
                  {item.snapshot.name}
                </div>
                {item.variantName && (
                  <div className="text-xs text-muted-foreground">
                    {item.variantName}
                  </div>
                )}
                <div className="mt-1.5 text-sm">
                  <span className="font-semibold">×{item.quantity}</span>
                  <span className="text-muted-foreground">
                    {' · '}
                    {formatEUR(item.snapshot.basePriceHt)} HT / unité
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-[color:var(--sand-deep)] bg-card px-5 py-4">
          <span className="text-sm text-muted-foreground">
            {totalUnits} unité{totalUnits > 1 ? 's' : ''} · Total public{' '}
            <strong className="text-foreground">{formatEUR(totalHt)} HT</strong>
            <span className="block text-xs">
              Prix directs pros. Les conditions partenaires restent privées.
            </span>
          </span>
          <div className="flex flex-wrap gap-2">
            <Button
              asChild
              variant="outline"
              className="h-11 rounded-sm px-5"
            >
              <a
                href={`/p/${slug}/devis?selection=${selection.id}`}
                target="_blank"
                rel="noreferrer"
              >
                Télécharger le devis
              </a>
            </Button>
            <Button
              type="button"
              onClick={onReserve}
              className="h-11 rounded-sm bg-[color:var(--foreground)] px-5 text-[color:var(--background)]"
            >
              Réserver cette sélection
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
