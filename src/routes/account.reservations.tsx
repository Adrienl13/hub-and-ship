import {
  Link,
  Outlet,
  createFileRoute,
  useRouterState,
} from '@tanstack/react-router'
import { ArrowRight, Ship } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import {
  ACCOUNT_RESERVATION_STATUS_LABEL,
  accountReservationFromMyReservation,
  calculateAccountReservationKpis,
  mergeAccountReservations,
  type AccountReservation,
} from '@/lib/account/reservations'
import { formatEUR } from '@/lib/order'
import {
  readLocalReservationHistory,
  type LocalReservationRecord,
} from '@/lib/reservations/local-history'
import { listMyReservationsFromSupabase } from '@/lib/reservations/repository'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'

export const Route = createFileRoute('/account/reservations')({
  component: AccountReservationsPage,
  head: () => ({
    meta: [
      { title: 'Mes réservations — Container Club Terrassea' },
      { name: 'robots', content: 'noindex,nofollow' },
    ],
  }),
})

function AccountReservationsPage() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const auth = useAuth()
  const [localRecords, setLocalRecords] = useState<
    ReadonlyArray<LocalReservationRecord>
  >([])
  const [remoteReservations, setRemoteReservations] = useState<
    ReadonlyArray<AccountReservation>
  >([])
  const [remoteLoading, setRemoteLoading] = useState(false)
  const [remoteError, setRemoteError] = useState<string | null>(null)

  const reservations = useMemo(
    () =>
      mergeAccountReservations({
        remoteReservations,
        localRecords,
      }),
    [remoteReservations, localRecords],
  )
  const kpis = calculateAccountReservationKpis(reservations)

  useEffect(() => {
    setLocalRecords(readLocalReservationHistory(window.localStorage))
  }, [])

  useEffect(() => {
    if (auth.status !== 'authenticated') {
      setRemoteReservations([])
      setRemoteError(null)
      return
    }

    const config = getSupabasePublicConfig()
    if (!config.isConfigured) return

    let cancelled = false
    setRemoteLoading(true)
    void (async () => {
      try {
        const client = createSupabaseBrowserClient(config)
        const list = await listMyReservationsFromSupabase(
          client as unknown as Parameters<
            typeof listMyReservationsFromSupabase
          >[0],
        )
        if (cancelled) return
        setRemoteReservations(list.map(accountReservationFromMyReservation))
        setRemoteError(null)
      } catch (error) {
        if (cancelled) return
        setRemoteError(
          error instanceof Error ? error.message : 'Erreur inconnue',
        )
      } finally {
        if (!cancelled) setRemoteLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [auth.status])

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
          {remoteError && (
            <div className="border-[color:var(--ember)]/30 bg-[color:var(--ember)]/10 mb-4 rounded-md border p-3 text-xs leading-5">
              Lecture des réservations indisponible : {remoteError}
            </div>
          )}
          <div className="overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card">
            <div className="hidden border-b border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-4 py-2 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground md:grid md:grid-cols-[1.2fr_1fr_90px_110px_150px_42px] md:gap-3">
              <span>Référence</span>
              <span>Container</span>
              <span>Statut</span>
              <span className="text-right">Montant HT</span>
              <span>Prochaine action</span>
              <span />
            </div>
            {remoteLoading && reservations.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Chargement de vos réservations…
              </div>
            ) : reservations.length === 0 ? (
              <EmptyReservations authStatus={auth.status} />
            ) : (
              <div className="divide-[color:var(--sand-deep)]/70 divide-y">
                {reservations.map((reservation) => (
                  <ReservationRow
                    key={reservation.id}
                    reservation={reservation}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}

function EmptyReservations({ authStatus }: { authStatus: string }) {
  if (authStatus === 'authenticated') {
    return (
      <div className="space-y-3 p-8 text-center">
        <div className="text-sm font-medium">
          Aucune réservation enregistrée.
        </div>
        <p className="mx-auto max-w-md text-xs leading-5 text-muted-foreground">
          Vos commandes container apparaîtront ici dès votre première
          réservation. Démarrez par le catalogue.
        </p>
        <Link
          to="/catalogue"
          className="text-foreground/85 mt-2 inline-flex items-center gap-1 text-xs underline underline-offset-4 hover:text-foreground"
        >
          Voir le catalogue →
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-3 p-8 text-center">
      <div className="text-sm font-medium">
        Connectez-vous pour retrouver vos réservations.
      </div>
      <p className="mx-auto max-w-md text-xs leading-5 text-muted-foreground">
        Les réservations faites avec votre email professionnel sont consultables
        après connexion. Les commandes anonymes restent accessibles depuis ce
        navigateur via le lien envoyé par email.
      </p>
      <Link
        to="/auth/login"
        className="mt-2 inline-flex h-9 items-center rounded-sm bg-foreground px-4 text-xs font-medium text-background hover:bg-[color:var(--ink-soft)]"
      >
        Se connecter
      </Link>
    </div>
  )
}

function AccountTopBar() {
  return (
    <header className="bg-[color:var(--sand)]/85 border-b border-[color:var(--sand-deep)] backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-[color:var(--foreground)] font-display text-base font-semibold text-[color:var(--background)]">
            C
          </span>
          <span className="font-display text-base font-semibold tracking-tight">
            Container Club
          </span>
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link
            to="/catalogue"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Catalogue
          </Link>
          <Button
            asChild
            size="sm"
            className="h-9 rounded-sm bg-[color:var(--foreground)] text-[color:var(--background)] hover:bg-[color:var(--ink-soft)]"
          >
            <Link to="/auth/login">Connexion</Link>
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
        <Link
          to="/account/reservations/$reservationId"
          params={{ reservationId: reservation.id }}
          className="font-medium hover:underline"
        >
          {reservation.draft.reference}
        </Link>
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
        <Link
          to="/account/reservations/$reservationId"
          params={{ reservationId: reservation.id }}
          aria-label={`Ouvrir ${reservation.draft.reference}`}
        >
          <ArrowRight className="h-4 w-4" />
        </Link>
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
