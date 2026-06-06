import { Link, createFileRoute } from '@tanstack/react-router'
import {
  ArrowRight,
  BadgeEuro,
  FileText,
  Handshake,
  LockKeyhole,
  PackageCheck,
  ShieldCheck,
  Store,
  UsersRound,
} from 'lucide-react'
import { lazy, Suspense, useMemo, useState } from 'react'

import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { Button } from '@/components/ui/button'
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

const PARTNER_FAQ = [
  {
    q: 'Un client que je partage peut-il commander en direct ensuite ?',
    a: 'Le chantier cible prévoit une protection par SIRET, email domaine et lien co-brandé. Un prospect apporté reste attribué au partenaire pendant la durée de protection définie, même s’il revient ensuite sur le site.',
  },
  {
    q: 'Les prix nets partenaires seront-ils visibles publiquement ?',
    a: 'Non. Le site public affiche les prix directs pros. Les conditions nettes partenaires doivent rester derrière un compte validé manuellement.',
  },
  {
    q: 'Puis-je appliquer ma propre marge ?',
    a: 'Oui. Pros Import fournit un prix net et des supports. Le partenaire reste libre de son prix final, de son conseil, de sa livraison, de sa pose et de son service.',
  },
  {
    q: 'Est-ce réservé aux gros revendeurs ?',
    a: 'Non. Le modèle peut accueillir des apporteurs, agenceurs, installateurs et revendeurs CHR, avec des droits différents selon le niveau de relation et de volume.',
  },
] as const

export const Route = createFileRoute('/partenaires')({
  component: PartenairesPage,
  head: () => ({
    ...buildSeoHead({
      title: 'Partenaires revendeurs mobilier CHR',
      description:
        'Programme partenaires Pros Import pour revendeurs CHR, agenceurs et apporteurs : prix nets protégés, client attribué, devis co-brandé et import mobilier par container.',
      path: '/partenaires',
    }),
    scripts: [
      jsonLdScript(
        breadcrumbJsonLd([
          { name: 'Accueil', path: '/' },
          { name: 'Partenaires', path: '/partenaires' },
        ]),
      ),
      jsonLdScript(faqJsonLd(PARTNER_FAQ)),
    ],
  }),
})

function PartenairesPage() {
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

      <main>
        <PartnerHero />
        <PartnerPromise />
        <PartnerOperatingModel />
        <PartnerTools />
        <PartnerFaq />
        <PartnerCta />
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

function PartnerHero() {
  return (
    <section className="border-b border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
        <div>
          <div className="label-eyebrow text-[color:var(--ember)]">
            Partenaires revendeurs CHR
          </div>
          <h1 className="mt-3 max-w-4xl font-display text-4xl tracking-tight sm:text-5xl">
            Votre client reste votre client. Pros Import devient votre
            back-office d'import.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[color:var(--ink-soft)]">
            Accédez à des prix nets sur du mobilier professionnel importé en
            volume, préparez vos sélections, protégez vos opportunités et
            revendez avec votre propre marge, votre conseil et votre relation
            terrain.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button
              asChild
              className="min-h-11 rounded-sm bg-[color:var(--foreground)] px-5 text-[color:var(--background)] hover:bg-[color:var(--ink-soft)]"
            >
              <a href="mailto:adrienlaniez1@gmail.com?subject=Demande%20partenaire%20Pros%20Import">
                Devenir partenaire
                <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
            <Link
              to="/catalogue"
              className="inline-flex min-h-11 items-center rounded-sm border border-[color:var(--foreground)] px-5 text-sm font-medium transition-colors hover:bg-[color:var(--foreground)] hover:text-[color:var(--background)]"
            >
              Voir le catalogue
            </Link>
          </div>
        </div>

        <div className="rounded-md border border-[color:var(--sand-deep)] bg-card p-5">
          <div className="label-eyebrow text-muted-foreground">
            Ce que le partenaire garde
          </div>
          <div className="mt-5 space-y-4">
            {[
              ['La relation client', 'Attribution par SIRET, email et lien.'],
              ['Sa marge finale', 'Prix conseillé possible, jamais imposé.'],
              ['Son service', 'Conseil, livraison, pose, SAV terrain.'],
              ['Son image', 'Sélections et devis co-brandés à construire.'],
            ].map(([title, desc]) => (
              <div
                key={title}
                className="border-b border-[color:var(--sand-deep)] pb-4 last:border-b-0 last:pb-0"
              >
                <div className="font-display text-lg font-semibold">
                  {title}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function PartnerPromise() {
  const items = [
    {
      Icon: LockKeyhole,
      title: 'Protection des opportunités',
      desc: 'Le chantier cible enregistre les prospects par SIRET, email domaine et lien co-brandé pour éviter le court-circuit.',
    },
    {
      Icon: BadgeEuro,
      title: 'Prix nets réservés',
      desc: 'Les conditions partenaires restent derrière un compte validé. Le site public conserve ses prix directs pros.',
    },
    {
      Icon: FileText,
      title: 'Devis co-brandés',
      desc: 'Le partenaire doit pouvoir envoyer une sélection propre avec son nom, ses coordonnées et son offre commerciale.',
    },
  ] as const

  return (
    <section className="border-b border-[color:var(--sand-deep)]">
      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid grid-cols-1 gap-px bg-[color:var(--sand-deep)] md:grid-cols-3">
          {items.map(({ Icon, title, desc }) => (
            <article key={title} className="bg-background p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-[color:var(--foreground)] text-[color:var(--background)]">
                <Icon className="h-4 w-4" />
              </div>
              <h2 className="mt-6 font-display text-lg font-semibold">
                {title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[color:var(--ink-soft)]">
                {desc}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function PartnerOperatingModel() {
  const rows = [
    [
      'Apporteur',
      'Apporte un projet qualifié',
      'Attribution ou commission à cadrer',
    ],
    [
      'Revendeur validé',
      'Achète à prix net partenaire',
      'Marge libre et devis co-brandé',
    ],
    [
      'Direct pro',
      'Commande pour son établissement',
      'Prix public direct, conditions standard',
    ],
  ] as const

  return (
    <section className="border-b border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="max-w-2xl">
          <div className="label-eyebrow text-[color:var(--ember)]">
            Modèle de canal
          </div>
          <h2 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">
            Deux canaux, une règle simple : ne pas manger le terrain du
            partenaire.
          </h2>
          <p className="mt-3 text-sm leading-6 text-[color:var(--ink-soft)]">
            Pros Import garde la vente directe aux pros, mais les opportunités
            apportées par un partenaire doivent être protégées et traitées comme
            telles.
          </p>
        </div>

        <div className="mt-8 overflow-x-auto border-y border-[color:var(--sand-deep)]">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="text-left">
                <th className="px-4 py-4 font-medium text-muted-foreground">
                  Profil
                </th>
                <th className="px-4 py-4 font-medium text-muted-foreground">
                  Rôle
                </th>
                <th className="px-4 py-4 font-medium text-muted-foreground">
                  Ce que la plateforme doit garantir
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--sand-deep)]">
              {rows.map(([profile, role, guarantee]) => (
                <tr key={profile}>
                  <th className="px-4 py-4 text-left font-display text-base font-semibold">
                    {profile}
                  </th>
                  <td className="text-foreground/75 px-4 py-4">{role}</td>
                  <td className="text-foreground/75 px-4 py-4">{guarantee}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

function PartnerTools() {
  const tools = [
    {
      Icon: Store,
      title: 'Compte partenaire validé',
      desc: 'Accès aux conditions nettes, documents, sélections et opportunités protégées.',
    },
    {
      Icon: ShieldCheck,
      title: 'Deal registration',
      desc: 'Protection temporaire par client final, projet et source d’acquisition.',
    },
    {
      Icon: PackageCheck,
      title: 'Import mutualisé',
      desc: 'Produits, quantités, container, qualité et documents suivis dans un seul cockpit.',
    },
    {
      Icon: UsersRound,
      title: 'Assets de vente',
      desc: 'Photos, arguments, fiches et devis prêts à adapter pour son réseau.',
    },
  ] as const

  return (
    <section className="border-b border-[color:var(--sand-deep)]">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <div className="label-eyebrow text-[color:var(--ember)]">
              Chantiers plateforme
            </div>
            <h2 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">
              Les outils qui doivent rendre le partage du site naturel.
            </h2>
          </div>
          <Link
            to="/qualite"
            className="inline-flex min-h-11 items-center rounded-sm border border-[color:var(--foreground)] px-4 text-sm font-medium transition-colors hover:bg-[color:var(--foreground)] hover:text-[color:var(--background)]"
          >
            Voir la méthode qualité
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {tools.map(({ Icon, title, desc }) => (
            <article
              key={title}
              className="rounded-md border border-[color:var(--sand-deep)] bg-card p-5"
            >
              <Icon className="h-5 w-5 text-[color:var(--ember)]" />
              <h3 className="mt-4 font-display text-lg font-semibold">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {desc}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function PartnerFaq() {
  return (
    <section className="border-b border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]">
      <div className="mx-auto max-w-4xl px-6 py-16">
        <div className="label-eyebrow text-[color:var(--ember)]">
          Questions sensibles
        </div>
        <h2 className="mt-2 font-display text-3xl tracking-tight">
          La confiance partenaire se construit avec des règles explicites.
        </h2>
        <div className="mt-8 divide-y divide-[color:var(--sand-deep)] border-y border-[color:var(--sand-deep)]">
          {PARTNER_FAQ.map((item) => (
            <article key={item.q} className="py-5">
              <h3 className="font-display text-lg font-semibold">{item.q}</h3>
              <p className="mt-2 text-sm leading-6 text-[color:var(--ink-soft)]">
                {item.a}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function PartnerCta() {
  return (
    <section className="bg-[color:var(--foreground)] text-[color:var(--sand)]">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-14 md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl">
          <div className="label-eyebrow text-[color:var(--sand)]/60">
            Beta partenaires
          </div>
          <h2 className="mt-2 font-display text-3xl tracking-tight">
            On construit le réseau avec peu de partenaires, mais les bons.
          </h2>
          <p className="text-[color:var(--sand)]/70 mt-3 text-sm leading-6">
            L’objectif n’est pas d’ouvrir les prix nets à tout le monde. Il faut
            d’abord valider quelques partenaires qui apportent de vrais projets
            et veulent utiliser Pros Import comme levier d’import.
          </p>
        </div>
        <a
          href="mailto:adrienlaniez1@gmail.com?subject=Partenaire%20beta%20Pros%20Import"
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-sm bg-[color:var(--sand)] px-5 text-sm font-medium text-[color:var(--foreground)] transition-colors hover:bg-white"
        >
          Demander un accès partenaire
          <Handshake className="ml-2 h-4 w-4" />
        </a>
      </div>
    </section>
  )
}
