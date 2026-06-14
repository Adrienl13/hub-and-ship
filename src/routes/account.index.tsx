import { Link, createFileRoute } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  CreditCard,
  FileText,
  Gift,
  Heart,
  LayoutDashboard,
  LifeBuoy,
  Loader2,
  Settings,
  Ship,
  Star,
  Truck,
} from 'lucide-react'

import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { Button } from '@/components/ui/button'
import { useAccountReservations } from '@/hooks/useAccountReservations'
import {
  isPaymentDue,
  primaryActionReservation,
  reservationsAwaitingPayment,
} from '@/lib/account/dashboard'
import {
  ACCOUNT_RESERVATION_STATUS_LABEL,
  calculateAccountReservationKpis,
  type AccountReservation,
} from '@/lib/account/reservations'
import { formatEUR } from '@/lib/order'
import { buildSeoHead } from '@/lib/seo'

export const Route = createFileRoute('/account/')({
  component: AccountDashboard,
  head: () =>
    buildSeoHead({
      title: 'Mon espace',
      description: 'Votre espace client Pros Import — Container Club.',
      path: '/account',
      noindex: true,
    }),
})

function AccountDashboard() {
  const { reservations, loading, error, authStatus } = useAccountReservations()
  const kpis = calculateAccountReservationKpis(reservations)
  const primary = primaryActionReservation(reservations)
  const awaitingPayment = reservationsAwaitingPayment(reservations)
  const recent = reservations.slice(0, 4)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header onReserve={() => window.location.assign('/catalogue')} />

      <main className="mx-auto max-w-5xl px-6 py-8">
        <section className="shadow-paper relative overflow-hidden rounded-xl border border-[color:var(--ember)]/30">
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-br from-[color:var(--ember)]/35 via-[color:var(--sand-soft)] to-[color:var(--ochre)]/30"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 overflow-hidden"
          >
            <motion.div
              className="absolute -left-12 -top-20 h-52 w-52 rounded-full bg-[color:var(--ember)]/30 blur-3xl"
              animate={{ x: [0, 40, 0], y: [0, 20, 0], scale: [1, 1.18, 1] }}
              transition={{ duration: 17, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute right-[-5%] top-1/4 h-60 w-60 rounded-full bg-[color:var(--ochre)]/25 blur-3xl"
              animate={{ x: [0, -40, 0], y: [0, -15, 0], scale: [1, 1.2, 1] }}
              transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
            className="relative p-6 sm:p-8"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--ember)]/30 bg-[color:var(--ember)]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--ember)]">
              <LayoutDashboard className="h-3.5 w-3.5" />
              Mon espace
            </span>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Tableau de bord
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Vos réservations container, paiements à venir et documents, au même
              endroit.
            </p>

            {authStatus === 'authenticated' && (
              <div className="mt-4 flex flex-wrap items-center gap-4">
            <Link
              to="/account/parametres"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <Settings className="h-3.5 w-3.5" />
              Paramètres du compte
            </Link>
            <Link
              to="/account/avis"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <Star className="h-3.5 w-3.5" />
              Donner mon avis
            </Link>
            <Link
              to="/account/parrainage"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <Gift className="h-3.5 w-3.5" />
              Parrainage
            </Link>
            <Link
              to="/account/favoris"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <Heart className="h-3.5 w-3.5" />
              Mes favoris
            </Link>
              </div>
            )}
          </motion.div>
        </section>


        {authStatus !== 'authenticated' && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-md border border-[color:var(--ochre)]/40 bg-[color:var(--ochre)]/10 p-4 text-sm">
            <span>
              Connectez-vous avec votre email professionnel pour retrouver
              toutes vos réservations.
            </span>
            <Button
              asChild
              size="sm"
              className="h-9 rounded-sm bg-foreground px-3 text-xs text-background"
            >
              <Link to="/auth/login" search={{ returnTo: '/account' }}>
                Se connecter
              </Link>
            </Button>
          </div>
        )}

        {error && (
          <div className="mt-5 rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-900">
            Lecture des réservations indisponible : {error}
          </div>
        )}

        {loading && reservations.length === 0 ? (
          <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement de votre espace…
          </div>
        ) : reservations.length === 0 ? (
          <EmptyState authenticated={authStatus === 'authenticated'} />
        ) : (
          <div className="mt-6 space-y-6">
            <NextActionCard reservation={primary} />

            <div className="grid gap-2 sm:grid-cols-4">
              <Kpi
                label="Réservations actives"
                value={`${kpis.activeCount}`}
              />
              <Kpi label="Engagé HT" value={formatEUR(kpis.totalCommittedHt)} />
              <Kpi label="Déjà réglé" value={formatEUR(kpis.totalPaid)} />
              <Kpi
                label="Volume réservé"
                value={`${kpis.totalCbm.toFixed(1)} m³`}
              />
            </div>

            {awaitingPayment.length > 0 && (
              <PaymentsDueCard reservations={awaitingPayment} />
            )}

            <RecentReservationsCard reservations={recent} />

            <ResourcesCard />
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}

function NextActionCard({
  reservation,
}: {
  readonly reservation: AccountReservation | null
}) {
  if (!reservation) {
    return (
      <section className="rounded-md border border-[color:var(--forest)]/30 bg-[color:var(--forest)]/[0.06] p-5">
        <h2 className="font-display text-lg font-semibold">
          Tout est à jour 👌
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Aucune action requise pour le moment. Vous pouvez suivre vos
          réservations ci-dessous.
        </p>
      </section>
    )
  }

  const dueNow = isPaymentDue(reservation)
  return (
    <section className="rounded-md border border-[color:var(--ember)]/40 bg-[color:var(--ember)]/[0.06] p-5">
      <div className="flex items-center gap-2">
        <CreditCard className="h-4 w-4 text-[color:var(--ember)]" />
        <h2 className="font-display text-lg font-semibold">
          Votre prochaine action
        </h2>
      </div>
      <p className="mt-2 text-sm">
        <span className="font-medium">{reservation.draft.reference}</span> —{' '}
        {reservation.nextActionLabel}
      </p>
      <Button
        asChild
        className="mt-4 h-10 rounded-sm bg-foreground px-4 text-sm text-background"
      >
        <Link
          to="/account/reservations/$reservationId"
          params={{ reservationId: reservation.draft.id }}
        >
          {dueNow ? 'Régler maintenant' : 'Voir la réservation'}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </section>
  )
}

function PaymentsDueCard({
  reservations,
}: {
  readonly reservations: ReadonlyArray<AccountReservation>
}) {
  return (
    <section className="overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card">
      <div className="border-b border-[color:var(--sand-deep)] px-5 py-3">
        <h2 className="font-display text-lg font-semibold">
          Paiements en attente ({reservations.length})
        </h2>
      </div>
      <ul className="divide-[color:var(--sand-deep)]/70 divide-y">
        {reservations.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm"
          >
            <div>
              <div className="font-medium">{r.draft.reference}</div>
              <div className="text-xs text-muted-foreground">
                {r.nextActionLabel}
              </div>
            </div>
            <Button
              asChild
              size="sm"
              className="h-9 rounded-sm bg-foreground px-3 text-xs text-background"
            >
              <Link
                to="/account/reservations/$reservationId"
                params={{ reservationId: r.draft.id }}
              >
                Régler
              </Link>
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}

function RecentReservationsCard({
  reservations,
}: {
  readonly reservations: ReadonlyArray<AccountReservation>
}) {
  return (
    <section className="overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-[color:var(--sand-deep)] px-5 py-3">
        <h2 className="font-display text-lg font-semibold">
          Mes réservations
        </h2>
        <Link
          to="/account/reservations"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          Voir toutes
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <ul className="divide-[color:var(--sand-deep)]/70 divide-y">
        {reservations.map((r) => (
          <li key={r.id}>
            <Link
              to="/account/reservations/$reservationId"
              params={{ reservationId: r.draft.id }}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-[color:var(--sand-soft)]/40"
            >
              <div className="min-w-0">
                <div className="font-medium">{r.draft.reference}</div>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Ship className="h-3.5 w-3.5" />
                  {r.draft.containerReference}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  {formatEUR(r.draft.totals.subtotalHt)} HT
                </span>
                <span className="border-[color:var(--ochre)]/30 bg-[color:var(--ochre)]/10 inline-flex h-7 items-center rounded-sm border px-2 text-[11px] font-medium">
                  {ACCOUNT_RESERVATION_STATUS_LABEL[r.status]}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ResourcesCard() {
  const links = [
    { href: '/catalogue', icon: ArrowRight, label: 'Catalogue' },
    { href: '/transport-partenaires', icon: Truck, label: 'Transport' },
    { href: '/qualite', icon: FileText, label: 'Qualité & tests' },
    { href: '/faq', icon: LifeBuoy, label: 'FAQ' },
  ]
  return (
    <section className="rounded-md border border-[color:var(--sand-deep)] bg-card p-5">
      <h2 className="font-display text-lg font-semibold">Documents & aide</h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        {links.map(({ href, icon: Icon, label }) => (
          <a
            key={href}
            href={href}
            className="flex items-center gap-2 rounded-sm border border-[color:var(--sand-deep)] px-3 py-2.5 text-sm hover:bg-[color:var(--sand-soft)]/40"
          >
            <Icon className="h-4 w-4 text-[color:var(--ember)]" />
            {label}
          </a>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Une question sur une réservation, un document ou une facture ?{' '}
        <a
          href="mailto:contact@prosimport.com"
          className="text-foreground underline"
        >
          Contacter notre équipe
        </a>
        .
      </p>
    </section>
  )
}

function EmptyState({ authenticated }: { readonly authenticated: boolean }) {
  return (
    <div className="mt-8 rounded-md border border-[color:var(--sand-deep)] bg-card p-8 text-center">
      <h2 className="font-display text-lg font-semibold">
        {authenticated
          ? 'Aucune réservation pour le moment'
          : 'Bienvenue dans votre espace'}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Vos commandes container apparaîtront ici. Démarrez par le catalogue pour
        réserver votre place sur le prochain départ.
      </p>
      <Button
        asChild
        className="mt-4 h-10 rounded-sm bg-foreground px-4 text-sm text-background"
      >
        <a href="/catalogue">Voir le catalogue</a>
      </Button>
    </div>
  )
}

function Kpi({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <Link
      to="/account/reservations"
      className="group rounded-md border border-[color:var(--sand-deep)] bg-card p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-[color:var(--ember)]/40 hover:shadow-[0_8px_24px_-14px_rgba(0,0,0,0.25)]"
    >
      <div className="label-eyebrow text-muted-foreground">{label}</div>
      <div className="mt-2 font-display text-2xl font-semibold tabular-nums">
        {value}
      </div>
    </Link>
  )
}
