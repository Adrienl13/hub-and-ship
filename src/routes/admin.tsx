import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  LayoutDashboard,
  PackageCheck,
  Handshake,
  Ship,
  ShoppingCart,
} from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { AdminGuard } from '@/components/AdminGuard'
import { AdminOverviewKpis } from '@/components/AdminOverviewKpis'
import { Kpi } from '@/components/admin/Kpi'
import { AdminReservationQuoteUpload } from '@/components/AdminReservationQuoteUpload'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/hooks/useAuth'
import {
  RESERVATION_PERIOD_OPTIONS,
  deliveryModeLabel,
  describeReservationOrigin,
  listAllReservations,
  listReservationItems,
  updateReservationAdminNote,
  updateReservationStatus,
  type AdminReservationItemRow,
  type AdminReservationRow,
  type AdminReservationsClient,
  type ReservationPeriodDays,
} from '@/lib/account/admin-reservations.repository'
import { useServerFn } from '@tanstack/react-start'
import { toast } from 'sonner'

import { logAdminAction } from '@/lib/admin/audit-log'
import { downloadCsv, toCsv } from '@/lib/admin/csv'
import { formatAdminDate, telHref } from '@/lib/admin/format'
import { stockRequestSourceLabel } from '@/lib/admin/origin'
import { issueInvoice, type InvoicesClient } from '@/lib/account/invoices'
import { sendInvoiceEmail } from '@/lib/email/invoice-email'
import { sendReservationCancelled } from '@/lib/email/reservation-cancelled'
import {
  loadAdminOverview,
  type AdminOverviewClient,
  type AdminOverviewKpis as AdminOverviewKpisData,
} from '@/lib/admin/overview'
import { formatEUR } from '@/lib/order'
import {
  describeStockRequestOrigin,
  listAllStockRequests,
  updateStockRequestInternalNote,
  updateStockRequestStatus,
  type StockRequestAdminClient,
  type StockRequestAdminRow,
} from '@/lib/stock-requests/admin-repository'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { AdminCommandCenter } from '@/components/AdminCommandCenter'
import {
  getSupabasePublicConfig,
  type SupabasePublicConfig,
} from '@/lib/supabase/env'
import type {
  ReservationStatus,
  StockRequestStatus,
} from '@/lib/supabase/types'

const ADMIN_TABS = [
  'studio',
  'overview',
  'stock-requests',
  'demandes',
  'reservations',
  'companies',
  'commissions',
  'products',
  'containers',
  'media',
  'showroom',
  'stock',
  'quality',
  'carriers',
  'partners',
  'claims',
  'reviews',
  'referrals',
  'leads',
  'users',
] as const

type AdminTab = (typeof ADMIN_TABS)[number]

const LazyAdminCompaniesTab = lazy(() =>
  import('@/components/AdminCompaniesTab').then((module) => ({
    default: module.AdminCompaniesTab,
  })),
)

const LazyAdminCommissionsTab = lazy(() =>
  import('@/components/AdminCommissionsTab').then((module) => ({
    default: module.AdminCommissionsTab,
  })),
)

const LazyAdminStockTab = lazy(() =>
  import('@/components/AdminStockTab').then((module) => ({
    default: module.AdminStockTab,
  })),
)

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

const LazyAdminStudioTab = lazy(() =>
  import('@/components/AdminStudioTab').then((module) => ({
    default: module.AdminStudioTab,
  })),
)

const LazyAdminSiteMediaTab = lazy(() =>
  import('@/components/AdminSiteMediaTab').then((module) => ({
    default: module.AdminSiteMediaTab,
  })),
)

const LazyAdminShowroomTab = lazy(() =>
  import('@/components/AdminShowroomTab').then((module) => ({
    default: module.AdminShowroomTab,
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

const LazyAdminClaimsTab = lazy(() =>
  import('@/components/AdminClaimsTab').then((module) => ({
    default: module.AdminClaimsTab,
  })),
)

const LazyAdminPartnersTab = lazy(() =>
  import('@/components/AdminPartnersTab').then((module) => ({
    default: module.AdminPartnersTab,
  })),
)

const LazyAdminReviewsTab = lazy(() =>
  import('@/components/AdminReviewsTab').then((module) => ({
    default: module.AdminReviewsTab,
  })),
)

const LazyAdminReferralsTab = lazy(() =>
  import('@/components/AdminReferralsTab').then((module) => ({
    default: module.AdminReferralsTab,
  })),
)

const LazyAdminLeadsTab = lazy(() =>
  import('@/components/AdminLeadsTab').then((module) => ({
    default: module.AdminLeadsTab,
  })),
)

const LazyAdminContactRequestsTab = lazy(() =>
  import('@/components/AdminContactRequestsTab').then((module) => ({
    default: module.AdminContactRequestsTab,
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
      { title: 'Administration — Terrassea' },
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
              Vue compacte pour suivre les réservations, les demandes stock 24h
              et de contact, le catalogue et le remplissage du container.
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
              ['demandes', 'Demandes'],
              ['reservations', 'Réservations'],
              ['companies', 'Comptes'],
              ['commissions', 'Commissions'],
              ['products', 'Catalogue'],
              ['containers', 'Containers'],
              ['media', 'Médias'],
              ['showroom', 'Lieux équipés'],
              ['studio', 'Studio'],
              ['stock', 'Stock'],
              ['quality', 'Qualité'],
              ['carriers', 'Transporteurs'],
              ['partners', 'Partenaires'],
              ['claims', 'SAV'],
              ['reviews', 'Avis'],
              ['referrals', 'Parrainage'],
              ['leads', 'Prospects'],
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

        {activeTab === 'overview' && (
          <div className="space-y-8">
            <section
              aria-labelledby="admin-overview-todo"
              className="space-y-3"
            >
              <h2
                id="admin-overview-todo"
                className="label-eyebrow text-muted-foreground"
              >
                À traiter
              </h2>
              <AdminCommandCenter onNavigate={setActiveTab} />
            </section>
            <section
              aria-labelledby="admin-overview-activity"
              className="space-y-3"
            >
              <h2
                id="admin-overview-activity"
                className="label-eyebrow text-muted-foreground"
              >
                Activité 12 mois
              </h2>
              <AdminOverviewKpis />
            </section>
            <section
              aria-labelledby="admin-overview-operations"
              className="space-y-3"
            >
              <h2
                id="admin-overview-operations"
                className="label-eyebrow text-muted-foreground"
              >
                Opérationnel
              </h2>
              <Overview onNavigate={setActiveTab} />
            </section>
          </div>
        )}
        {activeTab === 'stock-requests' && (
          <StockRequestsAdminPanel authStatus={auth.status} />
        )}
        {activeTab === 'reservations' && (
          <ReservationsAdminPanel authStatus={auth.status} />
        )}
        <Suspense fallback={<AdminTabLoading />}>
          {activeTab === 'demandes' && (
            <LazyAdminContactRequestsTab authStatus={auth.status} />
          )}
          {activeTab === 'products' && (
            <LazyAdminCatalogueTab authStatus={auth.status} />
          )}
          {activeTab === 'containers' && (
            <LazyAdminContainersTab authStatus={auth.status} />
          )}
          {activeTab === 'studio' && <LazyAdminStudioTab />}
          {activeTab === 'media' && <LazyAdminSiteMediaTab />}
          {activeTab === 'showroom' && <LazyAdminShowroomTab />}
          {activeTab === 'quality' && (
            <LazyAdminQualityReportsTab authStatus={auth.status} />
          )}
          {activeTab === 'carriers' && (
            <LazyAdminCarrierPartnersTab authStatus={auth.status} />
          )}
          {activeTab === 'partners' && (
            <LazyAdminPartnersTab authStatus={auth.status} />
          )}
          {activeTab === 'claims' && (
            <LazyAdminClaimsTab authStatus={auth.status} />
          )}
          {activeTab === 'reviews' && (
            <LazyAdminReviewsTab authStatus={auth.status} />
          )}
          {activeTab === 'referrals' && (
            <LazyAdminReferralsTab authStatus={auth.status} />
          )}
          {activeTab === 'leads' && (
            <LazyAdminLeadsTab authStatus={auth.status} />
          )}
          {activeTab === 'users' && (
            <LazyAdminUsersTab authStatus={auth.status} />
          )}
          {activeTab === 'companies' && (
            <LazyAdminCompaniesTab authStatus={auth.status} />
          )}
          {activeTab === 'commissions' && (
            <LazyAdminCommissionsTab authStatus={auth.status} />
          )}
          {activeTab === 'stock' && (
            <LazyAdminStockTab authStatus={auth.status} />
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
            Terrassea
          </span>
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link
            to="/stock-24h"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Stock
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
        Les actions (statuts, catalogue, containers) exigent une session
        administrateur : sans elle, la base les refuse.
      </p>
    </div>
  )
}

// KPIs calculés sur la base réelle (plus aucune fixture de démo en prod).
function Overview({
  onNavigate,
}: {
  readonly onNavigate: (tab: AdminTab) => void
}) {
  const config = useMemo(() => getSupabasePublicConfig(), [])
  const [kpis, setKpis] = useState<AdminOverviewKpisData | null>(null)
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    if (!config.isConfigured) {
      setState('error')
      return
    }
    void (async () => {
      try {
        const client = createSupabaseBrowserClient(
          config,
        ) as unknown as AdminOverviewClient
        const next = await loadAdminOverview(client)
        if (!cancelled) {
          setKpis(next)
          setState('loaded')
        }
      } catch {
        if (!cancelled) setState('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [config])

  if (state === 'error') {
    return (
      <div className="border-[color:var(--ochre)]/40 bg-[color:var(--ochre)]/10 rounded-md border p-4 text-sm">
        Indicateurs indisponibles : connectez-vous avec un compte administrateur
        pour lire les réservations, le stock et les containers.
      </div>
    )
  }

  if (state === 'loading' || !kpis) {
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-[color:var(--sand-soft)]/50 h-28 animate-pulse rounded-md border border-[color:var(--sand-deep)]"
          />
        ))}
      </div>
    )
  }

  const container = kpis.openContainer

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Kpi
          Icon={ShoppingCart}
          label="Réservations actives"
          value={`${kpis.activeReservations}`}
          detail={`${formatEUR(kpis.committedHt)} HT engagés`}
        />
        <Kpi
          Icon={Ship}
          label={
            container
              ? `Remplissage ${container.reference}`
              : 'Container ouvert'
          }
          value={container ? `${container.fillPercent.toFixed(0)}%` : 'Aucun'}
          detail={
            container
              ? `${kpis.reservedCbm.toFixed(1)} / ${container.capacityCbm} m³`
              : `${kpis.reservedCbm.toFixed(1)} m³ réservés sans container ouvert`
          }
        />
        <Kpi
          Icon={PackageCheck}
          label="Demandes stock"
          value={`${kpis.newStockRequests}`}
          detail="À traiter"
        />
        <Kpi
          Icon={Boxes}
          label="Unités stock 24h"
          value={`${kpis.stockAvailableUnits}`}
          detail="Disponibles à l'enlèvement"
        />
        <Kpi
          Icon={Handshake}
          label="Références actives"
          value={`${kpis.activeProductReferences}`}
          detail="Visibles au catalogue"
        />
      </div>

      {!container && (
        <div className="border-[color:var(--ember)]/40 bg-[color:var(--ember)]/10 flex flex-wrap items-center justify-between gap-3 rounded-md border p-4 text-sm">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--ember)]" />
            <span>
              Aucun container au statut « ouvert » : le site affiche un
              container générique et les nouvelles réservations ne sont
              rattachées à aucun container réel.
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9 rounded-sm"
            onClick={() => onNavigate('containers')}
          >
            Ouvrir un container
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </div>
      )}
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
        Supabase non configuré : les demandes stock ne sont pas disponibles dans
        cet environnement.
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
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={filteredRows.length === 0}
          onClick={() =>
            downloadCsv(
              `stock-leads-${new Date().toISOString().slice(0, 10)}.csv`,
              toCsv(filteredRows, [
                { header: 'Date', value: (r) => formatAdminDate(r.createdAt) },
                { header: 'Produit', value: (r) => r.productName },
                { header: 'SKU', value: (r) => r.sku },
                { header: 'Variante', value: (r) => r.variantName },
                { header: 'Quantité', value: (r) => r.requestedQuantity },
                { header: 'Estimation HT', value: (r) => r.estimatedTotalHt },
                { header: 'Lieu', value: (r) => r.location },
                { header: 'Société', value: (r) => r.companyName },
                { header: 'Email', value: (r) => r.contactEmail },
                { header: 'Téléphone', value: (r) => r.contactPhone },
                {
                  header: 'Statut',
                  value: (r) => STOCK_REQUEST_STATUS_LABEL_LOCAL[r.status],
                },
                {
                  header: 'Source',
                  value: (r) => stockRequestSourceLabel(r.source),
                },
                { header: 'UTM source', value: (r) => r.utmSource ?? '' },
                { header: 'UTM medium', value: (r) => r.utmMedium ?? '' },
                { header: 'UTM campagne', value: (r) => r.utmCampaign ?? '' },
                {
                  header: 'Partenaire (ref)',
                  value: (r) => r.partnerRef ?? '',
                },
                { header: 'Note client', value: (r) => r.customerNote ?? '' },
                { header: 'Note interne', value: (r) => r.internalNote ?? '' },
              ]),
            )
          }
          className="h-9 px-2 text-xs"
        >
          Exporter CSV
        </Button>
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
                    <div className="mt-1 flex flex-wrap gap-x-1.5 text-xs text-muted-foreground">
                      <a
                        href={`mailto:${row.contactEmail}`}
                        className="truncate hover:underline"
                      >
                        {row.contactEmail}
                      </a>
                      <span>·</span>
                      <a
                        href={telHref(row.contactPhone)}
                        className="hover:underline"
                      >
                        {row.contactPhone}
                      </a>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatAdminDate(row.createdAt)} · Origine :{' '}
                      {describeStockRequestOrigin(row)}
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
                    <div className="mt-1 truncate text-xs text-muted-foreground">
                      Lieu : {row.location || '—'}
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
  const sendInvoice = useServerFn(sendInvoiceEmail)
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
  const [partnerFilter, setPartnerFilter] = useState<
    'all' | 'partner' | 'direct'
  >('all')
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'unpaid'>(
    'all',
  )
  const [containerFilter, setContainerFilter] = useState<'all' | '20' | '40'>(
    'all',
  )
  const [search, setSearch] = useState('')
  // Période chargée côté base (500 lignes max) ; « tout » reste possible.
  const [periodDays, setPeriodDays] = useState<ReservationPeriodDays>(90)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const config = useMemo(() => getSupabasePublicConfig(), [])
  const isConfigured = config.isConfigured
  const periodLabel =
    RESERVATION_PERIOD_OPTIONS.find((option) => option.value === periodDays)
      ?.label ?? 'Tout'

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
        const list = await listAllReservations(client, { periodDays })
        setRows(sortReservationsForAdmin(list))
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue')
      }
      setLoading(false)
    }
  }, [config, isConfigured, periodDays])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false

      const hasPartner =
        Boolean(row.partnerDealId) ||
        Boolean(row.partnerApplicationId) ||
        Boolean(row.partnerLinkSlug)
      if (partnerFilter === 'partner' && !hasPartner) return false
      if (partnerFilter === 'direct' && hasPartner) return false

      const isPaid = row.paidReservationFeeAt !== null
      if (paymentFilter === 'paid' && !isPaid) return false
      if (paymentFilter === 'unpaid' && isPaid) return false

      if (containerFilter !== 'all') {
        const ct = row.requestedContainerType
        if (containerFilter === '20' && !ct?.startsWith('20_')) return false
        if (containerFilter === '40' && !ct?.startsWith('40_')) return false
      }

      if (!needle) return true
      return (
        row.reference.toLowerCase().includes(needle) ||
        row.siret.toLowerCase().includes(needle) ||
        (row.companyLegalName?.toLowerCase().includes(needle) ?? false) ||
        (row.contactEmail?.toLowerCase().includes(needle) ?? false) ||
        (row.contactName?.toLowerCase().includes(needle) ?? false) ||
        (row.contactPhone?.replace(/\s+/g, '').includes(needle) ?? false) ||
        (row.referralCode?.toLowerCase().includes(needle) ?? false) ||
        (row.partnerRef?.toLowerCase().includes(needle) ?? false) ||
        (row.utmSource?.toLowerCase().includes(needle) ?? false) ||
        (row.utmCampaign?.toLowerCase().includes(needle) ?? false) ||
        (row.partnerAttributionPartnerCompany?.toLowerCase().includes(needle) ??
          false) ||
        (row.partnerAttributionPartnerEmail?.toLowerCase().includes(needle) ??
          false) ||
        (row.partnerLinkSlug?.toLowerCase().includes(needle) ?? false) ||
        (row.partnerLinkDisplayName?.toLowerCase().includes(needle) ?? false)
      )
    })
  }, [
    rows,
    statusFilter,
    partnerFilter,
    paymentFilter,
    containerFilter,
    search,
  ])

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
      // Fire-and-forget client notification. The cancellation is already
      // persisted; email failures shouldn't block the admin flow.
      void sendReservationCancelled({
        data: { reservationId: row.id },
      }).catch((err) => {
        console.error('sendReservationCancelled failed', err)
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

  async function issueInvoiceFor(row: AdminReservationRow): Promise<void> {
    if (!isConfigured) return
    if (
      !window.confirm(
        `Émettre une facture définitive pour ${row.reference} ? La numérotation est continue et non annulable.`,
      )
    ) {
      return
    }
    setBusyId(row.id)
    const client = createSupabaseBrowserClient(
      config,
    ) as unknown as InvoicesClient
    try {
      const invoice = await issueInvoice(client, row.id)
      // Email the invoice to the client (no-op when Resend is not configured).
      try {
        await sendInvoice({ data: { invoiceId: invoice.id } })
      } catch (mailErr) {
        console.error('admin: invoice email failed', mailErr)
      }
      toast.success(`Facture ${invoice.number} émise`)
    } catch (err) {
      toast.error('Émission impossible', {
        description: err instanceof Error ? err.message : undefined,
      })
    }
    setBusyId(null)
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
          placeholder="Rechercher référence / SIRET / société / email / téléphone / code / partenaire"
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 max-w-sm text-xs"
        />
        <select
          value={periodDays === null ? 'all' : String(periodDays)}
          onChange={(e) => {
            const value = e.target.value
            setPeriodDays(
              value === 'all' ? null : (Number(value) as ReservationPeriodDays),
            )
          }}
          className="h-9 rounded-md border border-input bg-transparent px-2 text-xs"
          aria-label="Période des réservations chargées"
        >
          {RESERVATION_PERIOD_OPTIONS.map((option) => (
            <option
              key={option.value === null ? 'all' : option.value}
              value={option.value === null ? 'all' : String(option.value)}
            >
              {option.label}
            </option>
          ))}
        </select>
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
        <select
          value={partnerFilter}
          onChange={(e) =>
            setPartnerFilter(e.target.value as 'all' | 'partner' | 'direct')
          }
          className="h-9 rounded-md border border-input bg-transparent px-2 text-xs"
          aria-label="Filtrer par origine partenaire"
        >
          <option value="all">Toutes origines</option>
          <option value="partner">Partenaire reconnu</option>
          <option value="direct">Direct (sans partenaire)</option>
        </select>
        <select
          value={paymentFilter}
          onChange={(e) =>
            setPaymentFilter(e.target.value as 'all' | 'paid' | 'unpaid')
          }
          className="h-9 rounded-md border border-input bg-transparent px-2 text-xs"
          aria-label="Filtrer par paiement"
        >
          <option value="all">Tous paiements</option>
          <option value="paid">Frais payés</option>
          <option value="unpaid">Frais en attente</option>
        </select>
        <select
          value={containerFilter}
          onChange={(e) =>
            setContainerFilter(e.target.value as 'all' | '20' | '40')
          }
          className="h-9 rounded-md border border-input bg-transparent px-2 text-xs"
          aria-label="Filtrer par type de container demandé"
        >
          <option value="all">Tous containers</option>
          <option value="20">20&apos; demandé</option>
          <option value="40">40&apos; demandé</option>
        </select>
        {(statusFilter !== 'all' ||
          partnerFilter !== 'all' ||
          paymentFilter !== 'all' ||
          containerFilter !== 'all' ||
          search.trim() !== '') && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setStatusFilter('all')
              setPartnerFilter('all')
              setPaymentFilter('all')
              setContainerFilter('all')
              setSearch('')
            }}
            className="h-9 px-2 text-xs"
          >
            Réinitialiser
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={filteredRows.length === 0}
          onClick={() =>
            downloadCsv(
              `reservations-${new Date().toISOString().slice(0, 10)}.csv`,
              toCsv(filteredRows, [
                { header: 'Date', value: (r) => formatAdminDate(r.createdAt) },
                { header: 'Référence', value: (r) => r.reference },
                { header: 'Container', value: (r) => r.containerReference },
                { header: 'Société', value: (r) => r.companyLegalName ?? '' },
                { header: 'SIRET', value: (r) => r.siret },
                { header: 'Contact', value: (r) => r.contactName ?? '' },
                { header: 'Email', value: (r) => r.contactEmail ?? '' },
                { header: 'Téléphone', value: (r) => r.contactPhone ?? '' },
                {
                  header: 'Statut',
                  value: (r) => RESERVATION_STATUS_LABEL[r.status],
                },
                { header: 'Total HT', value: (r) => r.totalHt },
                { header: 'TTC', value: (r) => r.totalTtc },
                { header: 'Volume m3', value: (r) => r.totalCbm },
                { header: 'Frais réservation', value: (r) => r.reservationFee },
                {
                  header: 'Frais payés',
                  value: (r) => (r.paidReservationFeeAt ? 'oui' : 'non'),
                },
                {
                  header: 'Relances paiement',
                  value: (r) => r.paymentReminderCount,
                },
                {
                  header: 'Livraison',
                  value: (r) => deliveryModeLabel(r.deliveryMode),
                },
                {
                  header: 'Note livraison',
                  value: (r) => r.deliveryNote ?? '',
                },
                { header: 'Code parrain', value: (r) => r.referralCode ?? '' },
                { header: 'UTM source', value: (r) => r.utmSource ?? '' },
                { header: 'UTM medium', value: (r) => r.utmMedium ?? '' },
                { header: 'UTM campagne', value: (r) => r.utmCampaign ?? '' },
                {
                  header: 'Partenaire (ref)',
                  value: (r) => r.partnerRef ?? '',
                },
                {
                  header: 'Partenaire',
                  value: (r) =>
                    r.partnerAttributionPartnerCompany ??
                    r.partnerLinkDisplayName ??
                    r.partnerLinkSlug ??
                    '',
                },
                {
                  header: 'Attribution',
                  value: (r) =>
                    r.partnerAttributionReason
                      ? (PARTNER_ATTRIBUTION_REASON_LABEL[
                          r.partnerAttributionReason
                        ] ?? r.partnerAttributionReason)
                      : '',
                },
                {
                  header: 'Container demandé',
                  value: (r) => r.requestedContainerType ?? '',
                },
                { header: 'Note admin', value: (r) => r.adminNotes ?? '' },
              ]),
            )
          }
          className="h-9 px-2 text-xs"
        >
          Exporter CSV
        </Button>
        <span className="text-xs text-muted-foreground">
          {filteredRows.length} / {rows.length} · {periodLabel.toLowerCase()}
        </span>
      </div>

      <div className="overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card">
        {loading ? (
          <div className="px-4 py-8 text-sm text-muted-foreground">
            Chargement…
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="px-4 py-8 text-sm text-muted-foreground">
            {rows.length === 0 && periodDays !== null
              ? `Aucune réservation sur la période (${periodLabel.toLowerCase()}). Élargissez la période.`
              : rows.length === 0
                ? 'Aucune réservation.'
                : 'Aucune réservation ne correspond aux filtres.'}
          </div>
        ) : (
          <div className="divide-[color:var(--sand-deep)]/70 divide-y">
            {filteredRows.map((row) => {
              const busy = busyId === row.id
              const actions = RESERVATION_ACTIONS[row.status]
              const isCancelling = cancellingId === row.id
              const isExpanded = expandedId === row.id
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
                      {formatAdminDate(row.createdAt)} ·{' '}
                      {row.containerReference} · SIRET {row.siret}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Origine : {describeReservationOrigin(row)}
                      {row.referralCode && (
                        <>
                          {' · '}Code parrain{' '}
                          <span className="font-mono">{row.referralCode}</span>
                        </>
                      )}
                    </div>
                    {hasPartnerSignal && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-[color:var(--forest)]">
                        <Handshake className="h-3.5 w-3.5" />
                        <span className="font-medium">
                          {partnerSignalLabel}
                        </span>
                        {partnerSignalName && (
                          <span>· {partnerSignalName}</span>
                        )}
                        {row.partnerAttributionReason && (
                          <span className="border-[color:var(--forest)]/25 rounded-sm border px-1.5 py-0.5">
                            {PARTNER_ATTRIBUTION_REASON_LABEL[
                              row.partnerAttributionReason
                            ] ?? row.partnerAttributionReason}
                          </span>
                        )}
                        {!row.partnerAttributionReason &&
                          row.partnerLinkSlug && (
                            <span className="border-[color:var(--forest)]/25 rounded-sm border px-1.5 py-0.5">
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
                    <div className="mt-1 flex flex-wrap gap-x-1.5 text-xs text-muted-foreground">
                      {row.contactName && <span>{row.contactName}</span>}
                      {row.contactEmail && (
                        <a
                          href={`mailto:${row.contactEmail}`}
                          className="truncate hover:underline"
                        >
                          {row.contactEmail}
                        </a>
                      )}
                      {row.contactPhone && (
                        <a
                          href={telHref(row.contactPhone)}
                          className="hover:underline"
                        >
                          {row.contactPhone}
                        </a>
                      )}
                    </div>
                    <div className="mt-1 text-xs tabular-nums">
                      {formatEUR(row.totalHt)} HT · {formatEUR(row.totalTtc)}{' '}
                      TTC · {row.totalCbm.toFixed(1)} m³
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {deliveryModeLabel(row.deliveryMode)}
                      {row.deliveryNote && (
                        <span
                          title={row.deliveryNote}
                          className="line-clamp-1 break-words"
                        >
                          {row.deliveryNote}
                        </span>
                      )}
                    </div>
                    {row.paymentReminderCount > 0 && (
                      <div className="mt-1 text-xs text-[color:var(--ember)]">
                        {row.paymentReminderCount} relance
                        {row.paymentReminderCount > 1 ? 's' : ''} paiement
                        {row.paymentReminderLastAt
                          ? ` · dernière le ${formatAdminDate(row.paymentReminderLastAt)}`
                          : ''}
                      </div>
                    )}
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
                    {row.status !== 'pending_reservation_fee' &&
                      row.status !== 'cancelled' && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => void issueInvoiceFor(row)}
                          className="h-7 rounded-sm px-2 text-[11px]"
                        >
                          Facturer
                        </Button>
                      )}
                    <AdminReservationQuoteUpload reservationId={row.id} />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 rounded-sm px-2 text-[11px]"
                      aria-expanded={isExpanded}
                      onClick={() => setExpandedId(isExpanded ? null : row.id)}
                    >
                      Produits
                      {isExpanded ? (
                        <ChevronUp className="ml-1 h-3 w-3" />
                      ) : (
                        <ChevronDown className="ml-1 h-3 w-3" />
                      )}
                    </Button>
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

                  {isExpanded && (
                    <div className="col-span-full">
                      <ReservationItemsDetail
                        reservationId={row.id}
                        config={config}
                      />
                    </div>
                  )}

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

// Lignes produits d'une réservation : chargées uniquement au dépliage, pour ne
// pas alourdir la liste (500 réservations max).
function ReservationItemsDetail({
  reservationId,
  config,
}: {
  readonly reservationId: string
  readonly config: SupabasePublicConfig
}) {
  const [items, setItems] = useState<ReadonlyArray<AdminReservationItemRow>>([])
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>('loading')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setState('loading')
    void (async () => {
      try {
        const client = createSupabaseBrowserClient(
          config,
        ) as AdminReservationsClient
        const next = await listReservationItems(client, reservationId)
        if (!cancelled) {
          setItems(next)
          setState('loaded')
        }
      } catch (err) {
        if (!cancelled) {
          setMessage(err instanceof Error ? err.message : 'Erreur inconnue')
          setState('error')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [config, reservationId])

  if (state === 'loading') {
    return (
      <div className="bg-[color:var(--sand-soft)]/40 rounded-sm border border-[color:var(--sand-deep)] px-3 py-2 text-xs text-muted-foreground">
        Chargement des lignes produits…
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="rounded-sm border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-900">
        Lignes produits indisponibles : {message}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="bg-[color:var(--sand-soft)]/40 rounded-sm border border-[color:var(--sand-deep)] px-3 py-2 text-xs text-muted-foreground">
        Aucune ligne produit enregistrée pour cette réservation.
      </div>
    )
  }

  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <div className="bg-[color:var(--sand-soft)]/40 overflow-x-auto rounded-sm border border-[color:var(--sand-deep)]">
      <table className="w-full text-xs">
        <thead className="text-left text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Produit</th>
            <th className="px-3 py-2 font-medium">Variante</th>
            <th className="px-3 py-2 text-right font-medium">Qté</th>
            <th className="px-3 py-2 text-right font-medium">PU HT</th>
            <th className="px-3 py-2 text-right font-medium">Sous-total HT</th>
            <th className="px-3 py-2 text-right font-medium">m³</th>
          </tr>
        </thead>
        <tbody className="divide-[color:var(--sand-deep)]/60 divide-y">
          {items.map((item) => (
            <tr key={item.id}>
              <td className="px-3 py-1.5">
                <div className="font-medium">{item.productName}</div>
                <div className="font-mono text-[10px] text-muted-foreground">
                  {item.sku}
                </div>
              </td>
              <td className="px-3 py-1.5 text-muted-foreground">
                {item.variantName}
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums">
                {item.quantity}
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums">
                {formatEUR(item.unitPriceHt)}
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums">
                {formatEUR(item.subtotalHt)}
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums">
                {item.cbmTotal.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="text-[11px] text-muted-foreground">
          <tr>
            <td className="px-3 py-1.5" colSpan={2}>
              {items.length} ligne{items.length > 1 ? 's' : ''}
            </td>
            <td className="px-3 py-1.5 text-right tabular-nums">
              {totalUnits}
            </td>
            <td colSpan={3} />
          </tr>
        </tfoot>
      </table>
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

function StatusPill({ label }: { readonly label: string }) {
  return (
    <span className="border-[color:var(--ochre)]/30 bg-[color:var(--ochre)]/10 inline-flex h-7 w-fit items-center rounded-sm border px-2 text-[11px] font-medium">
      {label}
    </span>
  )
}

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
