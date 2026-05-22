import { createFileRoute } from '@tanstack/react-router'
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  LayoutDashboard,
  PackageCheck,
  Ship,
  ShoppingCart,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { AdminContainersTab } from '@/components/AdminContainersTab'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import {
  ADMIN_DEMO_STOCK_REQUESTS,
  createAdminDashboardSnapshot,
} from '@/lib/admin/dashboard'
import {
  ACCOUNT_RESERVATION_STATUS_LABEL,
  type AccountReservation,
} from '@/lib/account/reservations'
import { CURRENT_CONTAINER, CATEGORY_LABEL } from '@/lib/products'
import { formatEUR } from '@/lib/order'
import { STOCK_CONDITION_LABEL, type StockLine } from '@/lib/stock'
import {
  STOCK_REQUEST_STATUS_LABEL,
  readLocalStockRequests,
  type StockRequestDraft,
} from '@/lib/stock-requests'

export const Route = createFileRoute('/admin')({
  component: AdminPage,
})

type AdminTab =
  | 'overview'
  | 'stock-requests'
  | 'reservations'
  | 'products'
  | 'containers'

function AdminPage() {
  const auth = useAuth()
  const [activeTab, setActiveTab] = useState<AdminTab>('overview')
  const [localStockRequests, setLocalStockRequests] = useState<
    ReadonlyArray<StockRequestDraft>
  >([])

  useEffect(() => {
    setLocalStockRequests(readLocalStockRequests(window.localStorage))
  }, [])

  const stockRequests = useMemo(() => {
    const localIds = new Set(
      localStockRequests.map((request) => request.localId),
    )
    return [
      ...localStockRequests,
      ...ADMIN_DEMO_STOCK_REQUESTS.filter(
        (request) => !localIds.has(request.localId),
      ),
    ]
  }, [localStockRequests])

  const snapshot = useMemo(
    () => createAdminDashboardSnapshot({ stockRequests }),
    [stockRequests],
  )

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
          {[
            ['overview', 'Vue générale'],
            ['stock-requests', 'Demandes stock'],
            ['reservations', 'Réservations'],
            ['products', 'Produits & stock'],
            ['containers', 'Containers'],
          ].map(([id, label]) => {
            const active = activeTab === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id as AdminTab)}
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
          <StockRequestsTable requests={snapshot.stockRequests} />
        )}
        {activeTab === 'reservations' && (
          <ReservationsTable reservations={snapshot.reservations} />
        )}
        {activeTab === 'products' && (
          <ProductsAndStockTable stockLines={snapshot.stockLines} />
        )}
        {activeTab === 'containers' && (
          <AdminContainersTab authStatus={auth.status} />
        )}
      </section>
    </main>
  )
}

function AdminTopBar() {
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
            href="/stock-24h"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Stock 24h
          </a>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="h-9 rounded-sm"
          >
            <a href="/catalogue">Catalogue</a>
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
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
          label="Demandes stock"
          value={`${snapshot.kpis.newStockRequests}`}
          detail="À traiter"
        />
        <Kpi
          Icon={Boxes}
          label="Unités stock 24h"
          value={`${snapshot.kpis.stockAvailableUnits}`}
          detail={`${snapshot.kpis.productReferences} références catalogue`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Demandes stock à rappeler">
          <StockRequestsTable
            requests={snapshot.stockRequests.slice(0, 4)}
            compact
          />
        </Panel>
        <Panel title="Réservations récentes">
          <ReservationsTable
            reservations={snapshot.reservations.slice(0, 4)}
            compact
          />
        </Panel>
      </div>
    </div>
  )
}

function StockRequestsTable({
  requests,
  compact = false,
}: {
  readonly requests: ReadonlyArray<StockRequestDraft>
  readonly compact?: boolean
}) {
  return (
    <div className="overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card">
      <div className="hidden border-b border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-4 py-2 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground md:grid md:grid-cols-[1fr_1fr_90px_110px_88px] md:gap-3">
        <span>Client</span>
        <span>Produit</span>
        <span>Quantité</span>
        <span className="text-right">Total HT</span>
        <span>Statut</span>
      </div>
      <div className="divide-[color:var(--sand-deep)]/70 divide-y">
        {requests.map((request) => (
          <article
            key={request.localId}
            className="grid gap-3 px-4 py-4 text-sm md:grid-cols-[1fr_1fr_90px_110px_88px] md:items-center md:gap-3"
          >
            <div className="min-w-0">
              <div className="font-medium">{request.companyName}</div>
              <div className="mt-1 truncate text-xs text-muted-foreground">
                {request.contactEmail} · {request.contactPhone}
              </div>
            </div>
            <div className="min-w-0">
              <div className="truncate font-medium">{request.productName}</div>
              <div className="mt-1 truncate text-xs text-muted-foreground">
                {request.variantName} · {request.location}
              </div>
            </div>
            <div className="tabular-nums">
              {request.requestedQuantity} / {request.availableUnitsSnapshot}
            </div>
            <div className="font-medium tabular-nums md:text-right">
              {formatEUR(request.estimatedTotalHt)}
            </div>
            <StatusPill label={STOCK_REQUEST_STATUS_LABEL[request.status]} />
            {!compact && request.customerNote && (
              <p className="text-xs leading-5 text-muted-foreground md:col-span-5">
                {request.customerNote}
              </p>
            )}
          </article>
        ))}
      </div>
    </div>
  )
}

function ReservationsTable({
  reservations,
  compact = false,
}: {
  readonly reservations: ReadonlyArray<AccountReservation>
  readonly compact?: boolean
}) {
  return (
    <div className="overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card">
      <div className="hidden border-b border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-4 py-2 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground md:grid md:grid-cols-[1.2fr_1fr_100px_120px_42px] md:gap-3">
        <span>Référence</span>
        <span>Client</span>
        <span>Statut</span>
        <span className="text-right">Montant HT</span>
        <span />
      </div>
      <div className="divide-[color:var(--sand-deep)]/70 divide-y">
        {reservations.map((reservation) => (
          <article
            key={reservation.id}
            className="grid gap-3 px-4 py-4 text-sm md:grid-cols-[1.2fr_1fr_100px_120px_42px] md:items-center md:gap-3"
          >
            <div className="min-w-0">
              <div className="truncate font-medium">
                {reservation.draft.reference}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {reservation.draft.lines.length} ligne(s)
              </div>
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {reservation.draft.contact.company}
            </div>
            <StatusPill
              label={ACCOUNT_RESERVATION_STATUS_LABEL[reservation.status]}
            />
            <div className="font-medium tabular-nums md:text-right">
              {formatEUR(reservation.draft.totals.subtotalHt)}
            </div>
            {!compact && (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-9 w-full rounded-sm border-[color:var(--sand-deep)] md:w-9 md:px-0"
              >
                <a href={`/account/reservations/${reservation.id}`}>
                  <ArrowRight className="h-4 w-4" />
                </a>
              </Button>
            )}
          </article>
        ))}
      </div>
    </div>
  )
}

function ProductsAndStockTable({
  stockLines,
}: {
  readonly stockLines: ReadonlyArray<StockLine>
}) {
  return (
    <div className="overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card">
      <div className="hidden border-b border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-4 py-2 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground md:grid md:grid-cols-[1.2fr_100px_90px_100px_110px] md:gap-3">
        <span>Produit</span>
        <span>Catégorie</span>
        <span>Stock</span>
        <span>État</span>
        <span className="text-right">Prix stock</span>
      </div>
      <div className="divide-[color:var(--sand-deep)]/70 divide-y">
        {stockLines.map((line) => (
          <article
            key={line.id}
            className="grid gap-3 px-4 py-4 text-sm md:grid-cols-[1.2fr_100px_90px_100px_110px] md:items-center md:gap-3"
          >
            <div className="min-w-0">
              <div className="truncate font-medium">{line.product.name}</div>
              <div className="mt-1 truncate text-xs text-muted-foreground">
                {line.product.sku} · {line.variant.name}
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              {CATEGORY_LABEL[line.product.category]}
            </div>
            <div className="font-medium tabular-nums">
              {line.availableUnits}
            </div>
            <StatusPill label={STOCK_CONDITION_LABEL[line.condition]} />
            <div className="font-medium tabular-nums md:text-right">
              {formatEUR(line.stockPriceHt)}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

function Panel({
  title,
  children,
}: {
  readonly title: string
  readonly children: ReactNode
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-display text-xl font-semibold tracking-tight">
          {title}
        </h2>
      </div>
      {children}
    </section>
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
      Les actions de changement de statut seront branchées après connexion
      Supabase admin.
    </div>
  )
}
