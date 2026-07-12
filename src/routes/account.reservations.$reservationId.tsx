import {
  Link,
  Outlet,
  createFileRoute,
  notFound,
  useRouterState,
} from '@tanstack/react-router'
import { useEffect, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  CreditCard,
  Download,
  FileText,
  LifeBuoy,
  PackageCheck,
  Plus,
  ShieldCheck,
  Ship,
} from 'lucide-react'
import { useServerFn } from '@tanstack/react-start'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { AnalyticsEvent, track } from '@/lib/analytics'
import {
  ACCOUNT_RESERVATION_STATUS_LABEL,
  accountReservationFromMyReservation,
  getAccountReservationById,
  mergeAccountReservations,
  type AccountReservation,
} from '@/lib/account/reservations'
import {
  isReservationCancelled,
  reservationTimelineSteps,
  type TimelineStep,
} from '@/lib/account/timeline'
import {
  CLAIM_CATEGORY_LABEL,
  CLAIM_STATUS_LABEL,
  createReservationClaim,
  listClaimsForReservation,
  type ReservationClaim,
  type ReservationClaimCategory,
  type ReservationClaimsClient,
} from '@/lib/account/claims'
import {
  listInvoicesForReservation,
  type Invoice,
  type InvoicesClient,
} from '@/lib/account/invoices'
import { formatEUR } from '@/lib/order'
import {
  readLocalReservationHistory,
  type LocalReservationRecord,
} from '@/lib/reservations/local-history'
import {
  claimMyReservationsInSupabase,
  listMyReservationsFromSupabase,
  type ClaimReservationsClient,
} from '@/lib/reservations/repository'
import { createCheckoutSession } from '@/lib/stripe/checkout'
import { getReservationQuoteUrl } from '@/lib/reservations/quote-access'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'

const reservationSearchSchema = z.object({
  session_id: z.string().optional(),
  canceled: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((value) => value === true || value === 'true'),
})

export const Route = createFileRoute('/account/reservations/$reservationId')({
  component: AccountReservationDetailPage,
  validateSearch: reservationSearchSchema,
  head: () => ({
    meta: [
      { title: 'Détail réservation — Container Club' },
      { name: 'robots', content: 'noindex,nofollow' },
    ],
  }),
})

function AccountReservationDetailPage() {
  const { reservationId } = Route.useParams()
  const { session_id: routeSessionId, canceled: routeCanceled } =
    Route.useSearch()
  const runtimeSearch =
    typeof window === 'undefined'
      ? null
      : new URLSearchParams(window.location.search)
  const sessionId = routeSessionId ?? runtimeSearch?.get('session_id')
  const canceled =
    routeCanceled === true || runtimeSearch?.get('canceled') === 'true'
  const isLeaf = useRouterState({
    select: (state) =>
      state.matches[state.matches.length - 1]?.routeId === Route.id,
  })
  const auth = useAuth()
  const [localRecords, setLocalRecords] = useState<
    ReadonlyArray<LocalReservationRecord>
  >([])
  const [remoteReservations, setRemoteReservations] = useState<
    ReadonlyArray<AccountReservation>
  >([])
  const [localLoaded, setLocalLoaded] = useState(false)
  const [remoteLoaded, setRemoteLoaded] = useState(false)
  const [retryingPayment, setRetryingPayment] = useState(false)
  const startCheckout = useServerFn(createCheckoutSession)
  const reservations = mergeAccountReservations({
    remoteReservations,
    localRecords,
  })
  const reservation = getAccountReservationById(reservationId, reservations)

  useEffect(() => {
    setLocalRecords(readLocalReservationHistory(window.localStorage))
    setLocalLoaded(true)
  }, [])

  // Stripe redirects back here with ?session_id=... once the reservation fee
  // is paid, or ?canceled=true on an aborted checkout. Fire the funnel event
  // once per return, then strip the params from the URL (replaceState) so a
  // reload/bookmark doesn't re-emit the event — the UI state is already read.
  useEffect(() => {
    if (!sessionId && !canceled) return
    if (sessionId) {
      track(AnalyticsEvent.ReservationPaid, { reservation: reservationId })
    } else {
      track(AnalyticsEvent.CheckoutCancel, { reservation: reservationId })
    }
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [sessionId, canceled, reservationId])

  useEffect(() => {
    if (auth.status === 'loading') {
      setRemoteLoaded(false)
      return
    }
    if (auth.status !== 'authenticated') {
      setRemoteReservations([])
      setRemoteLoaded(true)
      return
    }

    const config = getSupabasePublicConfig()
    if (!config.isConfigured) {
      setRemoteLoaded(true)
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const client = createSupabaseBrowserClient(config)
        // Cible du magic-link des relances impayés : adopter d'abord les
        // réservations invité faites avec cet email, sinon la liste RLS est
        // vide au premier passage. Best-effort — l'échec n'empêche pas la
        // lecture de l'existant.
        try {
          await claimMyReservationsInSupabase(
            client as unknown as ClaimReservationsClient,
          )
        } catch {
          // ignore — listing below still runs
        }
        const list = await listMyReservationsFromSupabase(
          client as unknown as Parameters<
            typeof listMyReservationsFromSupabase
          >[0],
        )
        if (cancelled) return
        setRemoteReservations(list.map(accountReservationFromMyReservation))
      } catch (error) {
        if (!cancelled) {
          console.error('account reservation fetch failed', error)
        }
      } finally {
        if (!cancelled) setRemoteLoaded(true)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [auth.status])

  // Parent de /document et /facture/$invoiceId (récapitulatif & factures) :
  // pass-through AVANT le notFound() ci-dessous, sinon un lien profond ouvert
  // sans session verrait la 404 du parent au lieu du guard de l'enfant.
  // Détection par identité du match feuille (robuste : encodage %, casse,
  // trailing slash — contrairement à une comparaison de pathname).
  if (!isLeaf) {
    return <Outlet />
  }

  const fullyResolved = localLoaded && remoteLoaded
  if (fullyResolved && !reservation) {
    throw notFound()
  }

  const handleRetryPayment = async () => {
    setRetryingPayment(true)
    try {
      const result = await startCheckout({ data: { reservationId } })
      if (result.skipped) {
        toast.message('Paiement à connecter', {
          description:
            'Le paiement Stripe n’est pas encore configuré. Nous reprendrons contact sous 24 h.',
        })
        return
      }
      window.location.assign(result.url)
    } catch (error) {
      console.error('retry checkout failed', error)
      toast.error('Paiement temporairement indisponible', {
        description:
          'Impossible de relancer le paiement. Réessayez dans quelques minutes.',
      })
    } finally {
      setRetryingPayment(false)
    }
  }

  if (!reservation) {
    return (
      <main className="min-h-screen bg-background px-6 py-10 text-foreground">
        <div className="mx-auto max-w-3xl">
          <Button asChild variant="outline">
            <Link to="/account/reservations">
              <ArrowLeft className="h-4 w-4" />
              Retour
            </Link>
          </Button>
          <div className="bg-primary/10 mt-8 h-12 w-2/3 animate-pulse rounded" />
          <div className="bg-primary/10 mt-4 h-24 animate-pulse rounded" />
        </div>
      </main>
    )
  }

  const paymentConfirmedByStatus =
    reservation.status !== 'pending_reservation_fee' &&
    reservation.status !== 'cancelled'
  const showPaymentConfirmed = Boolean(sessionId && paymentConfirmedByStatus)
  const showPaymentSyncing = Boolean(sessionId && !paymentConfirmedByStatus)
  const canRetryPayment = reservation.status === 'pending_reservation_fee'

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="bg-[color:var(--sand)]/85 border-b border-[color:var(--sand-deep)]">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link
            to="/account/reservations"
            className="inline-flex items-center gap-2 text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Mes réservations
          </Link>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="h-9 rounded-sm"
          >
            <Link to="/catalogue">Catalogue</Link>
          </Button>
        </div>
      </header>

      {showPaymentConfirmed ? (
        <div className="border-[color:var(--forest)]/25 bg-[color:var(--forest)]/10 border-b">
          <div className="mx-auto flex max-w-7xl items-start gap-3 px-6 py-3 text-sm text-[color:var(--forest)]">
            <CheckCircle2 className="mt-0.5 h-4 w-4" />
            <div>
              <div className="font-medium">Paiement confirmé</div>
              <div className="mt-0.5 text-xs leading-5">
                Votre réservation est validée. La confirmation et la facture
                vous parviennent par email.
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showPaymentSyncing ? (
        <div className="border-[color:var(--ochre)]/30 bg-[color:var(--ochre)]/10 border-b">
          <div className="text-foreground/85 mx-auto flex max-w-7xl items-start gap-3 px-6 py-3 text-sm">
            <CreditCard className="mt-0.5 h-4 w-4 text-[color:var(--ochre)]" />
            <div>
              <div className="font-medium">
                Paiement en cours de confirmation
              </div>
              <div className="mt-0.5 text-xs leading-5">
                Stripe nous a renvoyé sur cette réservation. Le statut peut
                prendre quelques secondes à se synchroniser via le webhook.
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Tant que les frais restent dus, la page DOIT offrir le paiement —
          pas seulement au retour d'un checkout annulé (?canceled=true) :
          c'est aussi la cible des emails de relance. */}
      {canRetryPayment && !showPaymentSyncing ? (
        <div className="border-[color:var(--ochre)]/30 bg-[color:var(--ochre)]/10 border-b">
          <div className="text-foreground/85 mx-auto flex max-w-7xl items-start gap-3 px-6 py-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-[color:var(--ochre)]" />
            <div className="flex-1">
              <div className="font-medium">Paiement non finalisé</div>
              <div className="mt-0.5 text-xs leading-5">
                {canceled
                  ? 'Vous avez quitté la page de paiement avant la fin. La réservation est toujours en attente — vous pouvez retenter immédiatement.'
                  : 'Les frais de réservation restent à régler : votre place n’est pas encore verrouillée sur le container.'}
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              className="h-9 rounded-sm bg-[color:var(--foreground)] text-[color:var(--background)] hover:bg-[color:var(--ink-soft)]"
              onClick={handleRetryPayment}
              disabled={retryingPayment}
            >
              {retryingPayment ? 'Redirection...' : 'Retenter le paiement'}
            </Button>
          </div>
        </div>
      ) : null}

      <section className="border-b border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="label-eyebrow text-[color:var(--ember)]">
            Réservation
          </div>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-4xl tracking-tight">
                {reservation.draft.reference}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {reservation.draft.contact.company} · {reservation.draft.siret}
              </p>
            </div>
            <span className="border-[color:var(--ochre)]/30 bg-[color:var(--ochre)]/10 inline-flex h-8 items-center rounded-sm border px-3 text-xs font-medium">
              {ACCOUNT_RESERVATION_STATUS_LABEL[reservation.status]}
            </span>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-12">
        <aside className="lg:col-span-4">
          <div className="space-y-3">
            <InfoBlock
              icon={<Ship className="h-4 w-4" />}
              label="Container"
              value={reservation.draft.containerReference}
              detail={reservation.nextActionLabel}
            />
            <InfoBlock
              icon={<CreditCard className="h-4 w-4" />}
              label="Paiement"
              value={formatEUR(reservation.draft.payment.payNow)}
              detail={`${formatEUR(reservation.paidAmount)} déjà réglé`}
            />
            <DocumentsCard
              reservationId={reservation.draft.id}
              feePaid={paymentConfirmedByStatus}
              delivered={reservation.status === 'delivered'}
            />
          </div>
        </aside>

        <div className="space-y-6 lg:col-span-8">
          <ReservationTimeline status={reservation.status} />

          <div className="overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card">
            <div className="border-b border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <PackageCheck className="h-4 w-4" />
                Lignes réservées
              </div>
            </div>
            <div className="divide-[color:var(--sand-deep)]/70 divide-y">
              {reservation.draft.lines.map((line) => (
                <div
                  key={`${line.productId}:${line.variantId}`}
                  className="grid gap-2 px-4 py-4 text-sm md:grid-cols-[1fr_90px_120px_120px] md:items-center"
                >
                  <div>
                    <div className="font-medium">{line.productName}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {line.sku} · {line.variantName}
                    </div>
                  </div>
                  <div className="tabular-nums">{line.quantity} unités</div>
                  <div className="tabular-nums text-muted-foreground">
                    {line.cbmTotal.toFixed(2)} m³
                  </div>
                  <div className="font-medium tabular-nums md:text-right">
                    {formatEUR(line.subtotalHt)}
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-4 py-4 text-sm">
              <div className="ml-auto max-w-sm space-y-2">
                {reservation.draft.totals.volumeDiscountAmount > 0 && (
                  <>
                    <AmountRow
                      label="Sous-total HT"
                      value={reservation.draft.totals.subtotalHt}
                    />
                    <div className="flex items-center justify-between text-[color:var(--forest)]">
                      <span>Remise volume</span>
                      <span className="font-medium tabular-nums">
                        −
                        {formatEUR(
                          reservation.draft.totals.volumeDiscountAmount,
                        )}
                      </span>
                    </div>
                  </>
                )}
                <AmountRow
                  label="Total HT"
                  value={reservation.draft.totals.totalHt}
                />
                <AmountRow label="TVA" value={reservation.draft.totals.vat} />
                <AmountRow
                  label="Total TTC"
                  value={reservation.draft.totals.totalTtc}
                  strong
                />
              </div>
            </div>
          </div>

          <ClaimsSection
            reservationId={reservation.draft.id}
            authStatus={auth.status}
          />
        </div>
      </section>
    </main>
  )
}

function InfoBlock({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="rounded-md border border-[color:var(--sand-deep)] bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <span className="label-eyebrow">{label}</span>
      </div>
      <div className="mt-2 font-medium">{value}</div>
      <div className="mt-1 text-xs leading-5 text-muted-foreground">
        {detail}
      </div>
    </div>
  )
}

function ReservationTimeline({
  status,
}: {
  readonly status: AccountReservation['status']
}) {
  const steps = reservationTimelineSteps(status)
  const cancelled = isReservationCancelled(status)

  return (
    <div className="overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card">
      <div className="flex items-center gap-2 border-b border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-4 py-3 text-sm font-medium">
        <Clock className="h-4 w-4" />
        Suivi de la réservation
      </div>
      {cancelled ? (
        <div className="text-destructive flex items-center gap-2 px-4 py-6 text-sm">
          <AlertTriangle className="h-4 w-4" />
          Cette réservation a été annulée.
        </div>
      ) : (
        <ol className="px-4 py-4">
          {steps.map((step, index) => (
            <TimelineRow
              key={step.key}
              step={step}
              last={index === steps.length - 1}
            />
          ))}
        </ol>
      )}
    </div>
  )
}

function TimelineRow({
  step,
  last,
}: {
  readonly step: TimelineStep
  readonly last: boolean
}) {
  const Icon =
    step.state === 'done'
      ? CheckCircle2
      : step.state === 'current'
        ? Clock
        : Circle
  const iconColor =
    step.state === 'done'
      ? 'text-[color:var(--forest)]'
      : step.state === 'current'
        ? 'text-[color:var(--ember)]'
        : 'text-muted-foreground'

  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <Icon className={`h-5 w-5 shrink-0 ${iconColor}`} />
        {!last && (
          <span
            className={`w-px flex-1 ${
              step.state === 'done'
                ? 'bg-[color:var(--forest)]/40'
                : 'bg-[color:var(--sand-deep)]'
            }`}
          />
        )}
      </div>
      <div className={last ? '' : 'pb-5'}>
        <div className="flex items-center gap-2 text-sm font-medium">
          <span
            className={step.state === 'upcoming' ? 'text-muted-foreground' : ''}
          >
            {step.label}
          </span>
          {step.state === 'current' && (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--ember)]">
              En cours
            </span>
          )}
        </div>
        <div className="mt-0.5 text-xs leading-5 text-muted-foreground">
          {step.description}
        </div>
      </div>
    </li>
  )
}

function DocumentsCard({
  reservationId,
  feePaid,
  delivered,
}: {
  readonly reservationId: string
  readonly feePaid: boolean
  readonly delivered: boolean
}) {
  const [invoices, setInvoices] = useState<ReadonlyArray<Invoice>>([])
  const getQuoteUrl = useServerFn(getReservationQuoteUrl)
  const [loadingQuote, setLoadingQuote] = useState(false)

  useEffect(() => {
    const config = getSupabasePublicConfig()
    if (!config.isConfigured) return
    let cancelled = false
    void (async () => {
      try {
        const client = createSupabaseBrowserClient(
          config,
        ) as unknown as InvoicesClient
        const list = await listInvoicesForReservation(client, reservationId)
        if (!cancelled) setInvoices(list)
      } catch {
        /* invoices are optional — ignore read errors */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [reservationId])

  async function openQuote(): Promise<void> {
    setLoadingQuote(true)
    try {
      const result = await getQuoteUrl({ data: { reservationId } })
      if (result.ok) {
        window.open(result.url, '_blank', 'noopener')
      } else if (result.reason === 'no_file') {
        toast.message('Devis pas encore disponible', {
          description: 'Votre devis officiel sera ajouté ici par notre équipe.',
        })
      } else {
        toast.error('Devis indisponible pour le moment.')
      }
    } catch {
      toast.error('Devis indisponible pour le moment.')
    } finally {
      setLoadingQuote(false)
    }
  }

  return (
    <div className="rounded-md border border-[color:var(--sand-deep)] bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <FileText className="h-4 w-4" />
        <span className="label-eyebrow">Documents</span>
      </div>
      <ul className="mt-3 space-y-2">
        {invoices.map((invoice) => (
          <li key={invoice.id}>
            <Link
              to="/account/reservations/$reservationId/facture/$invoiceId"
              params={{ reservationId, invoiceId: invoice.id }}
              className="inline-flex items-center gap-2 text-sm font-medium hover:underline"
            >
              <Download className="h-3.5 w-3.5 text-[color:var(--forest)]" />
              Facture {invoice.number}
            </Link>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={() => void openQuote()}
            disabled={loadingQuote}
            className="inline-flex items-center gap-2 text-sm font-medium hover:underline disabled:opacity-60"
          >
            <Download className="h-3.5 w-3.5 text-[color:var(--forest)]" />
            {loadingQuote ? 'Ouverture…' : 'Devis officiel (PDF)'}
          </button>
        </li>
        <li>
          <Link
            to="/account/reservations/$reservationId/document"
            params={{ reservationId }}
            className="inline-flex items-center gap-2 text-sm font-medium hover:underline"
          >
            <Download className="h-3.5 w-3.5 text-[color:var(--ember)]" />
            Récapitulatif de réservation (PDF)
          </Link>
        </li>
        <li>
          <a
            href="/legal/cgv"
            className="inline-flex items-center gap-2 text-sm hover:underline"
          >
            <FileText className="h-3.5 w-3.5 text-[color:var(--ember)]" />
            Conditions générales de vente
          </a>
        </li>
        <li>
          <a
            href="/qualite"
            className="inline-flex items-center gap-2 text-sm hover:underline"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-[color:var(--ember)]" />
            Preuves qualité &amp; tests
          </a>
        </li>
        {invoices.length === 0 && (
          <li className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
            <Download className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Facture :{' '}
            {feePaid
              ? 'émise par notre équipe après confirmation du paiement.'
              : 'émise après le règlement des frais de réservation.'}
          </li>
        )}
        {delivered && (
          <li className="text-xs leading-5 text-muted-foreground">
            Documents de livraison disponibles — contactez-nous pour les
            recevoir.
          </li>
        )}
      </ul>
      <a
        href="mailto:contact@prosimport.com"
        className="mt-3 inline-block text-xs text-foreground underline"
      >
        Demander un document
      </a>
    </div>
  )
}

const CLAIM_CATEGORIES: ReadonlyArray<ReservationClaimCategory> = [
  'damaged',
  'missing',
  'wrong_item',
  'delay',
  'other',
]

function ClaimsSection({
  reservationId,
  authStatus,
}: {
  readonly reservationId: string
  readonly authStatus: string
}) {
  const [claims, setClaims] = useState<ReadonlyArray<ReservationClaim>>([])
  const [loadState, setLoadState] = useState<'loading' | 'loaded' | 'error'>(
    'loading',
  )
  const [formOpen, setFormOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [category, setCategory] = useState<ReservationClaimCategory>('damaged')
  const [quantity, setQuantity] = useState('')
  const [message, setMessage] = useState('')

  const isAuthenticated = authStatus === 'authenticated'

  function client(): ReservationClaimsClient {
    return createSupabaseBrowserClient(
      getSupabasePublicConfig(),
    ) as unknown as ReservationClaimsClient
  }

  async function refresh(): Promise<void> {
    try {
      const list = await listClaimsForReservation(client(), reservationId)
      setClaims(list)
      setLoadState('loaded')
    } catch {
      setLoadState('error')
    }
  }

  useEffect(() => {
    if (!isAuthenticated) {
      setLoadState('loaded')
      return
    }
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, reservationId])

  async function submit(): Promise<void> {
    setBusy(true)
    try {
      await createReservationClaim(client(), {
        reservationId,
        category,
        quantity: quantity.trim() === '' ? null : Number(quantity),
        message,
      })
      toast.success('Réclamation envoyée', {
        description: 'Notre équipe revient vers vous rapidement.',
      })
      setFormOpen(false)
      setMessage('')
      setQuantity('')
      setCategory('damaged')
      await refresh()
    } catch (err) {
      toast.error('Envoi impossible', {
        description: err instanceof Error ? err.message : undefined,
      })
    }
    setBusy(false)
  }

  return (
    <div className="overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-4 py-3 text-sm font-medium">
        <span className="flex items-center gap-2">
          <LifeBuoy className="h-4 w-4" />
          Service après-vente
        </span>
        {isAuthenticated && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setFormOpen((open) => !open)}
            className="h-8 gap-1 px-2 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            {formOpen ? 'Fermer' : 'Signaler un problème'}
          </Button>
        )}
      </div>

      {!isAuthenticated ? (
        <div className="px-4 py-6 text-sm text-muted-foreground">
          Connectez-vous pour ouvrir une réclamation rattachée à cette
          réservation.{' '}
          <Link
            to="/auth/login"
            search={{ returnTo: `/account/reservations/${reservationId}` }}
            className="text-foreground underline"
          >
            Se connecter
          </Link>
        </div>
      ) : (
        <>
          {formOpen && (
            <div className="border-b border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]/30 px-4 py-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-medium text-muted-foreground">
                    Type de problème
                  </span>
                  <select
                    value={category}
                    disabled={busy}
                    onChange={(e) =>
                      setCategory(e.target.value as ReservationClaimCategory)
                    }
                    className="mt-1 h-9 w-full rounded-sm border border-input bg-transparent px-2 text-sm"
                  >
                    {CLAIM_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {CLAIM_CATEGORY_LABEL[c]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-muted-foreground">
                    Quantité concernée (optionnel)
                  </span>
                  <input
                    value={quantity}
                    disabled={busy}
                    inputMode="numeric"
                    onChange={(e) =>
                      setQuantity(e.target.value.replace(/[^0-9]/g, ''))
                    }
                    className="mt-1 h-9 w-full rounded-sm border border-input bg-transparent px-2 text-sm"
                  />
                </label>
              </div>
              <label className="mt-3 block">
                <span className="text-xs font-medium text-muted-foreground">
                  Description
                </span>
                <textarea
                  value={message}
                  disabled={busy}
                  rows={3}
                  placeholder="Décrivez le problème (état, références, photos disponibles…)"
                  onChange={(e) => setMessage(e.target.value)}
                  className="mt-1 w-full rounded-sm border border-input bg-background px-2 py-1.5 text-sm"
                />
              </label>
              <div className="mt-3 flex justify-end">
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => void submit()}
                  className="h-9 rounded-sm bg-foreground px-3 text-sm text-background"
                >
                  Envoyer la réclamation
                </Button>
              </div>
            </div>
          )}

          {loadState === 'loading' ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">
              Chargement…
            </div>
          ) : claims.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">
              Aucune réclamation sur cette réservation. En cas de souci à la
              réception, signalez-le ici.
            </div>
          ) : (
            <ul className="divide-[color:var(--sand-deep)]/70 divide-y">
              {claims.map((claim) => (
                <li key={claim.id} className="px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">
                      {CLAIM_CATEGORY_LABEL[claim.category]}
                      {claim.quantity ? ` · ${claim.quantity} unité(s)` : ''}
                    </span>
                    <span className="border-[color:var(--ochre)]/30 bg-[color:var(--ochre)]/10 inline-flex h-7 items-center rounded-sm border px-2 text-[11px] font-medium">
                      {CLAIM_STATUS_LABEL[claim.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {claim.message}
                  </p>
                  {claim.adminResponse && (
                    <p className="mt-2 rounded-sm bg-[color:var(--sand-soft)]/60 px-2 py-1.5 text-xs leading-5">
                      <span className="font-medium">Réponse Pros Import : </span>
                      {claim.adminResponse}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

function AmountRow({
  label,
  value,
  strong,
}: {
  label: string
  value: number
  strong?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className={strong ? 'font-medium' : 'text-muted-foreground'}>
        {label}
      </span>
      <span
        className={`tabular-nums ${strong ? 'font-display text-xl font-semibold' : 'font-medium'}`}
      >
        {formatEUR(value)}
      </span>
    </div>
  )
}
