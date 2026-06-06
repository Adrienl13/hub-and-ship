import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  ExternalLink,
  LayoutDashboard,
  PackageCheck,
  Handshake,
  Ship,
  ShoppingCart,
  type LucideIcon,
} from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { AdminGuard } from '@/components/AdminGuard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/hooks/useAuth'
import {
  listAllReservations,
  updateReservationAdminNote,
  updateReservationStatus,
  type AdminReservationRow,
  type AdminReservationsClient,
} from '@/lib/account/admin-reservations.repository'
import { logAdminAction } from '@/lib/admin/audit-log'
import {
  ADMIN_DEMO_STOCK_REQUESTS,
  createAdminDashboardSnapshot,
} from '@/lib/admin/dashboard'
import { CURRENT_CONTAINER } from '@/lib/products'
import { formatEUR } from '@/lib/order'
import {
  listAllStockRequests,
  updateStockRequestInternalNote,
  updateStockRequestStatus,
  type StockRequestAdminClient,
  type StockRequestAdminRow,
} from '@/lib/stock-requests/admin-repository'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'
import type {
  ReservationStatus,
  StockRequestStatus,
} from '@/lib/supabase/types'

const ADMIN_TABS = [
  'overview',
  'stock-requests',
  'reservations',
  'products',
  'containers',
  'quality',
  'carriers',
  'partners',
  'users',
] as const

type AdminTab = (typeof ADMIN_TABS)[number]

const LazyAdminCatalogueTab = lazy(() =>
  import('@/components/AdminCatalogueTab').then((module) => ({
    default: module.AdminCatalogueTab,
  })),
)

const LazyAdminContainersTab = lazy(() =>
  import('@/components/AdminContainersTab').then((module) => ({
    default: module.AdminContainersTab,
  })),
)

const LazyAdminQualityReportsTab = lazy(() =>
  import('@/components/AdminQualityReportsTab').then((module) => ({
    default: module.AdminQualityReportsTab,
  })),
)

const LazyAdminCarrierPartnersTab = lazy(() =>
  import('@/components/AdminCarrierPartnersTab').then((module) => ({
    default: module.AdminCarrierPartnersTab,
  })),
)

const LazyAdminUsersTab = lazy(() =>
  import('@/components/AdminUsersTab').then((module) => ({
    default: module.AdminUsersTab,
  })),
)

const LazyAdminPartnersTab = lazy(() =>
  import('@/components/AdminPartnersTab').then((module) => ({
    default: module.AdminPartnersTab,
  })),
)

const adminSearchSchema = z.object({
  tab: z.enum(ADMIN_TABS).optional(),
})

export const Route = createFileRoute('/admin')({
  component: AdminRoute,
  validateSearch: adminSearchSchema,
  head: () => ({
    meta: [
      { title: 'Administration — Container Club Terrassea' },
      { name: 'robots', content: 'noindex,nofollow' },
    ],
  }),
})

function AdminRoute() {
  return (
    <AdminGuard>
      <AdminPage />
    </AdminGuard>
  )
}

const RESERVATION_STATUS_LABEL: Record<ReservationStatus, string> = {
  draft: 'Brouillon',
  pending_reservation_fee: 'Frais réservation',
  reserved: 'Réservée',
  deposit_called: 'Acompte appelé',
  deposit_paid: 'Acompte payé',
  in_production: 'En production',
  in_transit: 'En transit',
  delivered: 'Livrée',
  cancelled: 'Annulée',
}

const PARTNER_ATTRIBUTION_REASON_LABEL: Record<string, string> = {
  partner_link: 'Lien partenaire',
  client_siret: 'SIRET',
  client_email: 'Email',
  client_email_domain: 'Domaine email',
}

const STOCK_REQUEST_STATUS_LABEL_LOCAL: Record<StockRequestStatus, string> = {
  new: 'Nouveau',
  contacted: 'Contactée',
  reserved: 'Réservée',
  converted: 'Convertie',
  closed: 'Fermée',
}

// Stripe dashboard URLs differ between test and live modes. Detect from the
// publishable key prefix (the only reliable client-side signal — payment
// intent IDs themselves don't carry a test/live marker).
function buildStripePaymentIntentUrl(paymentIntentId: string): string {
  const pubKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? ''
  const segment = pubKey.startsWith('pk_test_') ? '/test' : ''
  return `https://dashboard.stripe.com${segment}/payments/${paymentIntentId}`
}

const CANCELLATION_REASONS = [
  { value: 'client_request', label: 'Demande client' },
  { value: 'minimum_not_reached', label: 'Minimum non atteint' },
  { value: 'supplier_issue', label: 'Problème fournisseur' },
  { value: 'other', label: 'Autre' },
] as const

function AdminPage() {
  const auth = useAuth()
  const navigate = useNavigate({ from: '/admin' })
  const { tab } = Route.useSearch()
  const activeTab: AdminTab = tab ?? 'overview'
  const setActiveTab = (next: AdminTab) => {
    void navigate({
      search: next === 'overview' ? {} : { tab: next },
      replace: true,
    })
  }

  const snapshot = useMemo(() => createAdminDashboardSnapshot(), [])

  return (
    <main className="min-h-screen bg-background text-foreground">
      <AdminTopBar />

      <section className="border-b border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]">
        <div className="mx-auto grid max-w-7xl gap-5 px-6 py-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="label-eyebrow text-[color:var(--ember)]">
              Back-office
            </div>
            <h1 className="mt-2 font-display text-4xl tracking-tight">
              Pilotage opérationnel
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              Vue compacte pour suivre les réservations, les demandes stock 24h,
              le catalogue et le remplissage du container.
            </p>
          </div>
          <AdminAccessBox
            status={auth.status}
            isConfigured={auth.isConfigured}
          />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-6">
        <div className="mb-5 flex gap-1.5 overflow-x-auto pb-1">
          {(
            [
              ['overview', 'Vue générale'],
              ['stock-requests', 'Demandes stock'],
              ['reservations', 'Réservations'],
              ['products', 'Catalogue'],
              ['containers', 'Containers'],
              ['quality', 'Qualité'],
              ['carriers', 'Transporteurs'],
              ['partners', 'Partenaires'],
              ['users', 'Utilisateurs'],
            ] as const
          ).map(([id, label]) => {
            const active = activeTab === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`min-h-11 shrink-0 rounded-sm px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? 'bg-[color:var(--foreground)] text-[color:var(--background)]'
                    : 'text-foreground/75 hover:border-foreground/40 border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] hover:text-foreground'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>

        {activeTab === 'overview' && <Overview snapshot={snapshot} />}
        {activeTab === 'stock-requests' && (
          <StockRequestsAdminPanel authStatus={auth.status} />
        )}
        {activeTab === 'reservations' && (
          <ReservationsAdminPanel authStatus={auth.status} />
        )}
        <Suspense fallback={<AdminTabLoading />}>
          {activeTab === 'products' && (
            <LazyAdminCatalogueTab authStatus={auth.status} />
          )}
          {activeTab === 'containers' && (
            <LazyAdminContainersTab authStatus={auth.status} />
          )}
          {activeTab === 'quality' && (
            <LazyAdminQualityReportsTab authStatus={auth.status} />
          )}
          {activeTab === 'carriers' && (
            <LazyAdminCarrierPartnersTab authStatus={auth.status} />
          )}
          {activeTab === 'partners' && (
            <LazyAdminPartnersTab authStatus={auth.status} />
          )}
          {activeTab === 'users' && (
            <LazyAdminUsersTab authStatus={auth.status} />
          )}
        </Suspense>
      </section>
    </main>
  )
}

function AdminTabLoading() {
  return (
    <div className="rounded-md border border-[color:var(--sand-deep)] bg-card p-6 text-sm text-muted-foreground">
      Chargement de l'onglet...
    </div>
  )
}

function AdminTopBar() {
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
            to="/stock-24h"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Stock 24h
          </Link>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="h-9 rounded-sm"
          >
            <Link to="/catalogue">Catalogue</Link>
          </Button>
        </nav>
      </div>
    </header>
  )
}

function AdminAccessBox({
  status,
  isConfigured,
}: {
  readonly status: string
  readonly isConfigured: boolean
}) {
  return (
    <div className="rounded-md border border-[color:var(--sand-deep)] bg-card p-4 text-sm">
      <div className="label-eyebrow text-muted-foreground">Accès admin</div>
      <div className="mt-2 font-medium">
        {isConfigured
          ? status === 'authenticated'
            ? 'Session active'
            : 'Connexion requise'
          : 'Aperçu local'}
      </div>
      <p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">
        Les données locales permettent de piloter les tests avant activation
        Supabase/RLS.
      </p>
    </div>
  )
}

function Overview({
  snapshot,
}: {
  readonly snapshot: ReturnType<typeof createAdminDashboardSnapshot>
}) {
  return (
    <div className="space-y-6">
      <AdminWarning />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Kpi
          Icon={ShoppingCart}
          label="Réservations actives"
          value={`${snapshot.kpis.activeReservations}`}
          detail={formatEUR(snapshot.kpis.revenueHt)}
        />
        <Kpi
          Icon={Ship}
          label="Remplissage estimé"
          value={`${snapshot.kpis.fillPercent.toFixed(0)}%`}
          detail={`${snapshot.kpis.reservedCbm.toFixed(1)} / ${CURRENT_CONTAINER.capacityCbm} m³`}
        />
        <Kpi
          Icon={PackageCheck}
          label="Demandes stock (demo)"
          value={`${snapshot.kpis.newStockRequests}`}
          detail="À traiter"
        />
        <Kpi
          Icon={Handshake}
          label="Partenaires"
          value="Beta"
          detail="Candidatures + deals"
        />
        <Kpi
          Icon={Boxes}
          label="Unités stock 24h"
          value={`${snapshot.kpis.stockAvailableUnits}`}
          detail={`${snapshot.kpis.productReferences} références catalogue`}
        />
      </div>

      <div className="rounded-md border border-[color:var(--sand-deep)] bg-card p-4 text-xs text-muted-foreground">
        Les listes complètes (réservations + demandes stock) sont désormais
        servies par Supabase dans les onglets dédiés.
      </div>
    </div>
  )
}

// ============================================================================
// Stock requests admin panel — DB-backed via stock-requests/admin-repository
// ============================================================================

function STOCK_REQUEST_NEXT_BUTTONS(
  status: StockRequestStatus,
): Array<{ readonly label: string; readonly target: StockRequestStatus }> {
  switch (status) {
    case 'new':
      return [
        { label: 'Contactée', target: 'contacted' },
        { label: 'Convertie', target: 'converted' },
        { label: 'Fermée', target: 'closed' },
      ]
    case 'contacted':
      return [
        { label: 'Réservée', target: 'reserved' },
        { label: 'Convertie', target: 'converted' },
        { label: 'Fermée', target: 'closed' },
      ]
    case 'reserved':
      return [
        { label: 'Convertie', target: 'converted' },
        { label: 'Fermée', target: 'closed' },
      ]
    case 'converted':
    case 'closed':
      return [{ label: 'Rouvrir', target: 'new' }]
    default:
      return []
  }
}

function StockRequestsAdminPanel({
  authStatus,
}: {
  readonly authStatus: string
}) {
  const auth = useAuth()
  const [rows, setRows] = useState<ReadonlyArray<StockRequestAdminRow>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StockRequestStatus | 'all'>(
    'all',
  )
  const [search, setSearch] = useState('')

  const config = useMemo(() => getSupabasePublicConfig(), [])
  const isConfigured = config.isConfigured

  const refresh = useMemo(() => {
    return async () => {
      if (!isConfigured) {
        setRows([])
        setError('Supabase non configuré.')
        setLoading(false)
        return
      }
      setLoading(true)
      const client = createSupabaseBrowserClient(
        config,
      ) as StockRequestAdminClient
      try {
        const list = await listAllStockRequests(client)
        setRows(list)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue')
      }
      setLoading(false)
    }
  }, [config, isConfigured])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function changeStatus(
    row: StockRequestAdminRow,
    target: StockRequestStatus,
  ): Promise<void> {
    if (!isConfigured) return
    setBusyId(row.id)
    const client = createSupabaseBrowserClient(
      config,
    ) as StockRequestAdminClient
    try {
      await updateStockRequestStatus(client, row.id, target)
      await logAdminAction(client, auth.user?.id ?? null, {
        action: 'stock_request.status_change',
        target: row.id,
        previousValue: row.status,
        nextValue: target,
        extra: { company: row.companyName, sku: row.sku },
      })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    }
    setBusyId(null)
  }

  async function saveNote(
    row: StockRequestAdminRow,
    note: string,
  ): Promise<void> {
    if (!isConfigured) return
    const trimmed = note.trim()
    if ((row.internalNote ?? '') === trimmed) return
    const client = createSupabaseBrowserClient(
      config,
    ) as StockRequestAdminClient
    try {
      await updateStockRequestInternalNote(
        client,
        row.id,
        trimmed.length === 0 ? null : trimmed,
      )
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    }
  }

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false
      if (!needle) return true
      return (
        row.companyName.toLowerCase().includes(needle) ||
        row.contactEmail.toLowerCase().includes(needle) ||
        row.sku.toLowerCase().includes(needle) ||
        row.productName.toLowerCase().includes(needle)
      )
    })
  }, [rows, statusFilter, search])

  if (!isConfigured) {
    return (
      <div className="border-[color:var(--ochre)]/40 bg-[color:var(--ochre)]/10 rounded-md border p-6 text-sm">
        Supabase non configuré : seules les demandes stock locales (démo) sont
        consultables côté navigation publique.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {authStatus !== 'authenticated' && (
        <div className="border-[color:var(--ochre)]/40 bg-[color:var(--ochre)]/10 rounded-md border p-3 text-xs text-foreground">
          Vous n&apos;êtes pas connecté en tant qu&apos;admin. Les actions de
          changement de statut seront refusées par RLS.
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-900">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          placeholder="Rechercher société / email / SKU / produit"
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 max-w-xs text-xs"
        />
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as StockRequestStatus | 'all')
          }
          className="h-9 rounded-md border border-input bg-transparent px-2 text-xs"
        >
          <option value="all">Tous statuts</option>
          {(
            ['new', 'contacted', 'reserved', 'converted', 'closed'] as const
          ).map((s) => (
            <option key={s} value={s}>
              {STOCK_REQUEST_STATUS_LABEL_LOCAL[s]}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">
          {filteredRows.length} / {rows.length}
        </span>
      </div>

      <div className="overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card">
        {loading ? (
          <div className="px-4 py-8 text-sm text-muted-foreground">
            Chargement…
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="px-4 py-8 text-sm text-muted-foreground">
            Aucune demande stock.
          </div>
        ) : (
          <div className="divide-[color:var(--sand-deep)]/70 divide-y">
            {filteredRows.map((row) => {
              const busy = busyId === row.id
              const buttons = STOCK_REQUEST_NEXT_BUTTONS(row.status)
              return (
                <article
                  key={row.id}
                  className="grid gap-3 px-4 py-4 text-sm md:grid-cols-[1fr_1fr_120px_120px] md:items-start md:gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-medium">{row.companyName}</div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">
                      {row.contactEmail} · {row.contactPhone}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {row.productName}
                    </div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">
                      {row.sku} · {row.variantName}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {row.requestedQuantity} u / {row.availableUnitsSnapshot} ·{' '}
                      {formatEUR(row.estimatedTotalHt)}
                    </div>
                  </div>
                  <StatusPill
                    label={STOCK_REQUEST_STATUS_LABEL_LOCAL[row.status]}
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {buttons.map((b) => (
                      <Button
                        key={b.target}
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        className="h-7 rounded-sm px-2 text-[11px]"
                        onClick={() => void changeStatus(row, b.target)}
                      >
                        {b.label}
                      </Button>
                    ))}
                  </div>
                  {row.customerNote && (
                    <p className="text-xs leading-5 text-muted-foreground md:col-span-4">
                      <strong>Client :</strong> {row.customerNote}
                    </p>
                  )}
                  <div className="md:col-span-4">
                    <NoteField
                      initialValue={row.internalNote ?? ''}
                      placeholder="Note interne (save on blur)"
                      onCommit={(value) => void saveNote(row, value)}
                    />
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Reservations admin panel — DB-backed via account/admin-reservations.repo
// ============================================================================

const RESERVATION_ACTIONS: Record<
  ReservationStatus,
  ReadonlyArray<{
    readonly label: string
    readonly target: ReservationStatus
    readonly variant?: 'default' | 'outline' | 'destructive'
  }>
> = {
  draft: [
    { label: 'Marquer en attente', target: 'pending_reservation_fee' },
    { label: 'Annuler', target: 'cancelled', variant: 'destructive' },
  ],
  pending_reservation_fee: [
    { label: 'Marquer payée (reserved)', target: 'reserved' },
    { label: 'Annuler', target: 'cancelled', variant: 'destructive' },
  ],
  reserved: [
    { label: 'Demander acompte', target: 'deposit_called' },
    { label: 'Annuler', target: 'cancelled', variant: 'destructive' },
  ],
  deposit_called: [
    { label: 'Acompte reçu', target: 'deposit_paid' },
    { label: 'Annuler', target: 'cancelled', variant: 'destructive' },
  ],
  deposit_paid: [
    { label: 'Lancer production', target: 'in_production' },
    { label: 'Annuler', target: 'cancelled', variant: 'destructive' },
  ],
  in_production: [{ label: 'Embarquée (in_transit)', target: 'in_transit' }],
  in_transit: [{ label: 'Livrée', target: 'delivered' }],
  delivered: [],
  cancelled: [],
}

const NON_FINAL_STATUSES: ReadonlySet<ReservationStatus> =
  new Set<ReservationStatus>([
    'draft',
    'pending_reservation_fee',
    'reserved',
    'deposit_called',
    'deposit_paid',
    'in_production',
    'in_transit',
  ])

function sortReservationsForAdmin(
  rows: ReadonlyArray<AdminReservationRow>,
): ReadonlyArray<AdminReservationRow> {
  return [...rows].sort((a, b) => {
    const aFinal = !NON_FINAL_STATUSES.has(a.status)
    const bFinal = !NON_FINAL_STATUSES.has(b.status)
    if (aFinal !== bFinal) return aFinal ? 1 : -1
    return b.createdAt.localeCompare(a.createdAt)
  })
}

function ReservationsAdminPanel({
  authStatus,
}: {
  readonly authStatus: string
}) {
  const auth = useAuth()
  const [rows, setRows] = useState<ReadonlyArray<AdminReservationRow>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [cancelReason, setCancelReason] =
    useState<(typeof CANCELLATION_REASONS)[number]['value']>('client_request')
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | 'all'>(
    'all',
  )
  const [search, setSearch] = useState('')

  const config = useMemo(() => getSupabasePublicConfig(), [])
  const isConfigured = config.isConfigured

  const refresh = useMemo(() => {
    return async () => {
      if (!isConfigured) {
        setRows([])
        setError('Supabase non configuré.')
        setLoading(false)
        return
      }
      setLoading(true)
      const client = createSupabaseBrowserClient(
        config,
      ) as AdminReservationsClient
      try {
        const list = await listAllReservations(client)
        setRows(sortReservationsForAdmin(list))
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue')
      }
      setLoading(false)
    }
  }, [config, isConfigured])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false
      if (!needle) return true
      return (
        row.reference.toLowerCase().includes(needle) ||
        row.siret.toLowerCase().includes(needle) ||
        (row.companyLegalName?.toLowerCase().includes(needle) ?? false) ||
        (row.contactEmail?.toLowerCase().includes(needle) ?? false) ||
        (row.contactName?.toLowerCase().includes(needle) ?? false) ||
        (row.partnerAttributionPartnerCompany
          ?.toLowerCase()
          .includes(needle) ??
          false) ||
        (row.partnerAttributionPartnerEmail?.toLowerCase().includes(needle) ??
          false) ||
        (row.partnerLinkSlug?.toLowerCase().includes(needle) ?? false) ||
        (row.partnerLinkDisplayName?.toLowerCase().includes(needle) ?? false)
      )
    })
  }, [rows, statusFilter, search])

  async function changeStatus(
    row: AdminReservationRow,
    target: ReservationStatus,
  ): Promise<void> {
    if (!isConfigured) return

    if (target === 'cancelled') {
      // Force the inline UI for cancellation_reason.
      setCancellingId(row.id)
      return
    }

    setBusyId(row.id)
    const client = createSupabaseBrowserClient(
      config,
    ) as AdminReservationsClient
    try {
      await updateReservationStatus(client, row.id, { status: target })
      await logAdminAction(client, auth.user?.id ?? null, {
        action: 'reservation.status_change',
        target: row.id,
        previousValue: row.status,
        nextValue: target,
        extra: { reference: row.reference },
      })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    }
    setBusyId(null)
  }

  async function confirmCancel(row: AdminReservationRow): Promise<void> {
    if (!isConfigured) return
    setBusyId(row.id)
    const client = createSupabaseBrowserClient(
      config,
    ) as AdminReservationsClient
    try {
      await updateReservationStatus(client, row.id, {
        status: 'cancelled',
        cancellationReason: cancelReason,
      })
      await logAdminAction(client, auth.user?.id ?? null, {
        action: 'reservation.cancel',
        target: row.id,
        previousValue: row.status,
        nextValue: 'cancelled',
        note: cancelReason,
        extra: { reference: row.reference },
      })
      setCancellingId(null)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    }
    setBusyId(null)
  }

  async function saveNote(
    row: AdminReservationRow,
    note: string,
  ): Promise<void> {
    if (!isConfigured) return
    const trimmed = note.trim()
    if ((row.adminNotes ?? '') === trimmed) return
    const client = createSupabaseBrowserClient(
      config,
    ) as AdminReservationsClient
    try {
      await updateReservationAdminNote(
        client,
        row.id,
        trimmed.length === 0 ? null : trimmed,
      )
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    }
  }

  if (!isConfigured) {
    return (
      <div className="border-[color:var(--ochre)]/40 bg-[color:var(--ochre)]/10 rounded-md border p-6 text-sm">
        Supabase non configuré : impossible de charger les réservations.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {authStatus !== 'authenticated' && (
        <div className="border-[color:var(--ochre)]/40 bg-[color:var(--ochre)]/10 rounded-md border p-3 text-xs text-foreground">
          Vous n&apos;êtes pas connecté en tant qu&apos;admin. Les actions de
          changement de statut seront refusées par RLS.
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-900">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          placeholder="Rechercher référence / SIRET / société / email / partenaire"
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 max-w-sm text-xs"
        />
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as ReservationStatus | 'all')
          }
          className="h-9 rounded-md border border-input bg-transparent px-2 text-xs"
        >
          <option value="all">Tous statuts</option>
          {(Object.keys(RESERVATION_STATUS_LABEL) as ReservationStatus[]).map(
            (s) => (
              <option key={s} value={s}>
                {RESERVATION_STATUS_LABEL[s]}
              </option>
            ),
          )}
        </select>
        <span className="text-xs text-muted-foreground">
          {filteredRows.length} / {rows.length}
        </span>
      </div>

      <div className="overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card">
        {loading ? (
          <div className="px-4 py-8 text-sm text-muted-foreground">
            Chargement…
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="px-4 py-8 text-sm text-muted-foreground">
            Aucune réservation.
          </div>
        ) : (
          <div className="divide-[color:var(--sand-deep)]/70 divide-y">
            {filteredRows.map((row) => {
              const busy = busyId === row.id
              const actions = RESERVATION_ACTIONS[row.status]
              const isCancelling = cancellingId === row.id
              const readOnly =
                row.status === 'delivered' || row.status === 'cancelled'
              const hasPartnerSignal =
                Boolean(row.partnerDealId) ||
                Boolean(row.partnerApplicationId) ||
                Boolean(row.partnerLinkSlug)
              const partnerSignalLabel = row.partnerDealId
                ? 'Deal partenaire reconnu'
                : row.partnerApplicationId
                  ? 'Partenaire reconnu'
                  : 'Lien partenaire capté'
              const partnerSignalName =
                row.partnerAttributionPartnerCompany ??
                row.partnerLinkDisplayName
              return (
                <article
                  key={row.id}
                  className="grid gap-3 px-4 py-4 text-sm md:grid-cols-[1.2fr_1fr_120px_120px] md:items-start md:gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="truncate font-medium">
                        {row.reference}
                      </div>
                      {row.requestedContainerType &&
                        row.requestedContainerType.startsWith('40_') && (
                          <span
                            className="border-[color:var(--ember)]/40 bg-[color:var(--ember)]/10 inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--ember)]"
                            title="L'acheteur a demandé un container 40' au lieu du 20' actif"
                          >
                            40&apos; demandé
                          </span>
                        )}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {row.containerReference} · SIRET {row.siret}
                    </div>
                    {hasPartnerSignal && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-[color:var(--forest)]">
                        <Handshake className="h-3.5 w-3.5" />
                        <span className="font-medium">
                          {partnerSignalLabel}
                        </span>
                        {partnerSignalName && <span>· {partnerSignalName}</span>}
                        {row.partnerAttributionReason && (
                          <span className="rounded-sm border border-[color:var(--forest)]/25 px-1.5 py-0.5">
                            {PARTNER_ATTRIBUTION_REASON_LABEL[
                              row.partnerAttributionReason
                            ] ?? row.partnerAttributionReason}
                          </span>
                        )}
                        {!row.partnerAttributionReason && row.partnerLinkSlug && (
                          <span className="rounded-sm border border-[color:var(--forest)]/25 px-1.5 py-0.5">
                            {row.partnerLinkSlug}
                          </span>
                        )}
                      </div>
                    )}
                    {row.stripePaymentIntentId && (
                      <a
                        href={buildStripePaymentIntentUrl(
                          row.stripePaymentIntentId,
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-xs text-[color:var(--ember)] hover:underline"
                      >
                        Stripe PaymentIntent
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-xs">
                      {row.companyLegalName ?? '—'}
                    </div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">
                      {row.contactName ?? ''} · {row.contactEmail ?? ''}
                    </div>
                    <div className="mt-1 text-xs tabular-nums">
                      {formatEUR(row.totalHt)} · {row.totalCbm.toFixed(1)} m³
                    </div>
                  </div>
                  <StatusPill label={RESERVATION_STATUS_LABEL[row.status]} />
                  <div className="flex flex-wrap gap-1.5">
                    {readOnly && (
                      <span className="text-xs text-muted-foreground">
                        Lecture seule
                      </span>
                    )}
                    {!readOnly &&
                      actions.map((a) => (
                        <Button
                          key={a.target}
                          type="button"
                          size="sm"
                          variant={a.variant ?? 'outline'}
                          disabled={busy}
                          className={`h-7 rounded-sm px-2 text-[11px] ${
                            a.variant === 'destructive'
                              ? 'border-red-300 text-red-700 hover:bg-red-50'
                              : ''
                          }`}
                          onClick={() => void changeStatus(row, a.target)}
                        >
                          {a.label}
                        </Button>
                      ))}
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="h-7 rounded-sm px-2 text-[11px]"
                    >
                      <a href={`/account/reservations/${row.id}`}>
                        <ArrowRight className="h-3 w-3" />
                      </a>
                    </Button>
                  </div>

                  {isCancelling && (
                    <div className="border-[color:var(--ochre)]/40 bg-[color:var(--ochre)]/10 col-span-full rounded-md border p-3 text-xs">
                      <div className="mb-2 font-medium">
                        Confirmer l&apos;annulation
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={cancelReason}
                          onChange={(e) =>
                            setCancelReason(
                              e.target
                                .value as (typeof CANCELLATION_REASONS)[number]['value'],
                            )
                          }
                          className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                        >
                          {CANCELLATION_REASONS.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 rounded-sm border-red-300 text-red-700 hover:bg-red-50"
                          disabled={busy}
                          onClick={() => void confirmCancel(row)}
                        >
                          Confirmer annulation
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 rounded-sm"
                          onClick={() => setCancellingId(null)}
                        >
                          Abandonner
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="md:col-span-4">
                    <NoteField
                      initialValue={row.adminNotes ?? ''}
                      placeholder="Note admin (save on blur)"
                      onCommit={(value) => void saveNote(row, value)}
                      multiline
                    />
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function NoteField({
  initialValue,
  placeholder,
  onCommit,
  multiline = false,
}: {
  readonly initialValue: string
  readonly placeholder?: string
  readonly onCommit: (value: string) => void | Promise<void>
  readonly multiline?: boolean
}) {
  const [value, setValue] = useState(initialValue)
  useEffect(() => setValue(initialValue), [initialValue])
  if (multiline) {
    return (
      <Textarea
        rows={2}
        value={value}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => void onCommit(value)}
        className="text-xs"
      />
    )
  }
  return (
    <Input
      value={value}
      placeholder={placeholder}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => void onCommit(value)}
      className="text-xs"
    />
  )
}

function Kpi({
  Icon,
  label,
  value,
  detail,
}: {
  readonly Icon: LucideIcon
  readonly label: string
  readonly value: string
  readonly detail: string
}) {
  return (
    <div className="rounded-md border border-[color:var(--sand-deep)] bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="label-eyebrow">{label}</span>
      </div>
      <div className="mt-2 font-display text-3xl font-semibold tabular-nums">
        {value}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
    </div>
  )
}

function StatusPill({ label }: { readonly label: string }) {
  return (
    <span className="border-[color:var(--ochre)]/30 bg-[color:var(--ochre)]/10 inline-flex h-7 w-fit items-center rounded-sm border px-2 text-[11px] font-medium">
      {label}
    </span>
  )
}

function AdminWarning() {
  return (
    <div className="border-[color:var(--ochre)]/30 bg-[color:var(--ochre)]/10 text-foreground/75 flex items-start gap-2 rounded-md border p-3 text-xs leading-5">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      KPIs basés sur les fixtures démo. Les onglets Réservations, Demandes
      stock, Catalogue et Transporteurs lisent les données Supabase en direct.
    </div>
  )
}

// Re-export legacy symbols used elsewhere if any (kept for compatibility).
export { ADMIN_DEMO_STOCK_REQUESTS }

// Lay-out wrapper for the dashboard panels (kept for shape parity)
export function AdminDashboardLayout({
  children,
}: {
  readonly children: ReactNode
}) {
  return <LayoutDashboardWrapper>{children}</LayoutDashboardWrapper>
}

function LayoutDashboardWrapper({
  children,
}: {
  readonly children: ReactNode
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
      </div>
      {children}
    </section>
  )
}
