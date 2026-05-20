import { Outlet, createFileRoute, useRouterState } from '@tanstack/react-router'
import { ArrowRight, Ship } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import {
  ACCOUNT_RESERVATIONS,
  ACCOUNT_RESERVATION_STATUS_LABEL,
  calculateAccountReservationKpis,
  mergeAccountReservations,
  type AccountReservation,
} from '@/lib/account/reservations'
import { formatEUR } from '@/lib/order'
import {
  readLocalReservationHistory,
  type LocalReservationRecord,
} from '@/lib/reservations/local-history'

export const Route = createFileRoute('/account/reservations')({
  component: AccountReservationsPage,
})

function AccountReservationsPage() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const auth = useAuth()
  const [localRecords, setLocalRecords] = useState<
    ReadonlyArray<LocalReservationRecord>
  >([])
  const reservations = mergeAccountReservations({
    baseReservations: ACCOUNT_RESERVATIONS,
    localRecords,
  })
  const kpis = calculateAccountReservationKpis(reservations)

  useEffect(() => {
    setLocalRecords(readLocalReservationHistory(window.localStorage))
  }, [])

  if (pathname !== '/account/reservations') {
    return <Outlet />
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <AccountTopBar />
      <section className="border-b border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <div className="label-eyebrow text-[color:var(--ember)]">
                Espace compte
              </div>
              <h1 className="mt-2 font-display text-4xl tracking-tight">
                Mes réservations
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                Suivez les commandes container, les prochains paiements et les
                documents liés à chaque réservation.
              </p>
            </div>
            <AuthStateBox
              status={auth.status}
              isConfigured={auth.isConfigured}
            />
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-12">
        <aside className="lg:col-span-3">
          <div className="sticky top-6 space-y-3">
            <Kpi label="Réservations actives" value={`${kpis.activeCount}`} />
            <Kpi label="Engagé HT" value={formatEUR(kpis.totalCommittedHt)} />
            <Kpi label="Déjà réglé" value={formatEUR(kpis.totalPaid)} />
            <Kpi
              label="Volume réservé"
              value={`${kpis.totalCbm.toFixed(1)} m³`}
            />
          </div>
        </aside>

        <div className="lg:col-span-9">
          <div className="overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card">
            <div className="hidden border-b border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-4 py-2 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground md:grid md:grid-cols-[1.2fr_1fr_90px_110px_150px_42px] md:gap-3">
              <span>Référence</span>
              <span>Container</span>
              <span>Statut</span>
              <span className="text-right">Montant HT</span>
              <span>Prochaine action</span>
              <span />
            </div>
            <div className="divide-[color:var(--sand-deep)]/70 divide-y">
              {reservations.map((reservation) => (
                <ReservationRow
                  key={reservation.id}
                  reservation={reservation}
                />
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

function AccountTopBar() {
  return (
    <header className="bg-[color:var(--sand)]/85 border-b border-[color:var(--sand-deep)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <a href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-[color:var(--foreground)] font-display text-base font-semibold text-[color:var(--background)]">
            C
          </span>
          <span className="font-display text-base font-semibold tracking-tight">
            Container Club
          </span>
        </a>
        <nav className="flex items-center gap-3 text-sm">
          <a
            href="/catalogue"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Catalogue
          </a>
          <Button
            asChild
            size="sm"
            className="h-9 rounded-sm bg-[color:var(--foreground)] text-[color:var(--background)] hover:bg-[color:var(--ink-soft)]"
          >
            <a href="/auth/login">Connexion</a>
          </Button>
        </nav>
      </div>
    </header>
  )
}

function AuthStateBox({
  status,
  isConfigured,
}: {
  status: string
  isConfigured: boolean
}) {
  return (
    <div className="rounded-md border border-[color:var(--sand-deep)] bg-card p-4 text-sm">
      <div className="label-eyebrow text-muted-foreground">Accès</div>
      <div className="mt-2 font-medium">
        {isConfigured
          ? status === 'authenticated'
            ? 'Session active'
            : 'Connexion requise'
          : 'Aperçu local'}
      </div>
      <p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">
        {isConfigured
          ? 'Les réservations seront lues depuis Supabase dès activation RLS.'
          : 'Données de démonstration affichées tant que les clés Supabase ne sont pas renseignées.'}
      </p>
    </div>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[color:var(--sand-deep)] bg-card p-4">
      <div className="label-eyebrow text-muted-foreground">{label}</div>
      <div className="mt-2 font-display text-2xl font-semibold tabular-nums">
        {value}
      </div>
    </div>
  )
}

function ReservationRow({
  reservation,
}: {
  readonly reservation: AccountReservation
}) {
  return (
    <article className="grid gap-3 px-4 py-4 text-sm md:grid-cols-[1.2fr_1fr_90px_110px_150px_42px] md:items-center md:gap-3">
      <div className="min-w-0">
        <a
          href={`/account/reservations/${reservation.id}`}
          className="font-medium hover:underline"
        >
          {reservation.draft.reference}
        </a>
        <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>{reservation.draft.lines.length} ligne(s)</span>
          <span>{reservation.draft.contact.company}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Ship className="h-4 w-4" />
        <span>{reservation.draft.containerReference}</span>
      </div>
      <StatusPill status={reservation.status} />
      <div className="font-medium tabular-nums md:text-right">
        {formatEUR(reservation.draft.totals.subtotalHt)}
      </div>
      <div className="text-xs leading-5 text-muted-foreground">
        {reservation.nextActionLabel}
      </div>
      <Button
        asChild
        variant="outline"
        size="sm"
        className="h-9 w-full rounded-sm border-[color:var(--sand-deep)] md:w-9 md:px-0"
      >
        <a
          href={`/account/reservations/${reservation.id}`}
          aria-label={`Ouvrir ${reservation.draft.reference}`}
        >
          <ArrowRight className="h-4 w-4" />
        </a>
      </Button>
    </article>
  )
}

function StatusPill({ status }: { status: AccountReservation['status'] }) {
  const tone =
    status === 'cancelled'
      ? 'border-destructive/30 bg-destructive/10 text-destructive'
      : status === 'delivered'
        ? 'border-[color:var(--forest)]/25 bg-[color:var(--forest)]/10 text-[color:var(--forest)]'
        : 'border-[color:var(--ochre)]/30 bg-[color:var(--ochre)]/10 text-foreground/80'

  return (
    <span
      className={`inline-flex h-7 w-fit items-center rounded-sm border px-2 text-[11px] font-medium ${tone}`}
    >
      {ACCOUNT_RESERVATION_STATUS_LABEL[status]}
    </span>
  )
}
