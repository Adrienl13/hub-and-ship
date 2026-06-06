import { useEffect, useMemo, useState, type ReactNode } from 'react'

import { Input } from '@/components/ui/input'
import {
  listPartnerApplications,
  listPartnerDeals,
  updatePartnerApplicationStatus,
  updatePartnerDealStatus,
  type PartnerAdminRepositoryClient,
  type PartnerApplicationAdminRow,
  type PartnerDealAdminRow,
} from '@/lib/partners/repository'
import {
  PARTNER_APPLICATION_STATUS_LABEL,
  PARTNER_DEAL_STATUS_LABEL,
  PARTNER_KIND_LABEL,
  type PartnerApplicationStatus,
  type PartnerDealStatus,
} from '@/lib/partners/types'
import { formatEUR } from '@/lib/order'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import {
  getSupabasePublicConfig,
  type SupabasePublicConfig,
} from '@/lib/supabase/env'

const APPLICATION_STATUSES = [
  'new',
  'reviewing',
  'qualified',
  'approved',
  'rejected',
  'archived',
] as const satisfies ReadonlyArray<PartnerApplicationStatus>

const DEAL_STATUSES = [
  'submitted',
  'protected',
  'quoted',
  'reserved',
  'won',
  'lost',
  'expired',
  'rejected',
] as const satisfies ReadonlyArray<PartnerDealStatus>

function createPartnerAdminClient(
  config: SupabasePublicConfig,
): PartnerAdminRepositoryClient {
  return createSupabaseBrowserClient(
    config,
  ) as unknown as PartnerAdminRepositoryClient
}

export function AdminPartnersTab({
  authStatus,
}: {
  readonly authStatus: string
}) {
  const [applications, setApplications] = useState<
    ReadonlyArray<PartnerApplicationAdminRow>
  >([])
  const [deals, setDeals] = useState<ReadonlyArray<PartnerDealAdminRow>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const config = useMemo(() => getSupabasePublicConfig(), [])
  const isConfigured = config.isConfigured

  const refresh = useMemo(() => {
    return async () => {
      if (!isConfigured) {
        setApplications([])
        setDeals([])
        setError('Supabase non configuré.')
        setLoading(false)
        return
      }

      setLoading(true)
      const client = createPartnerAdminClient(config)
      try {
        const [nextApplications, nextDeals] = await Promise.all([
          listPartnerApplications(client),
          listPartnerDeals(client),
        ])
        setApplications(nextApplications)
        setDeals(nextDeals)
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

  const filteredApplications = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return applications
    return applications.filter((row) =>
      [
        row.companyName,
        row.contactName,
        row.contactEmail,
        row.siret ?? '',
        row.territory ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(needle),
    )
  }, [applications, search])

  const filteredDeals = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return deals
    return deals.filter((row) =>
      [
        row.partnerCompanyName,
        row.partnerContactEmail,
        row.clientCompanyName,
        row.clientSiret ?? '',
        row.clientEmail ?? '',
        row.projectCity ?? '',
        row.projectType,
      ]
        .join(' ')
        .toLowerCase()
        .includes(needle),
    )
  }, [deals, search])

  async function changeApplicationStatus(
    row: PartnerApplicationAdminRow,
    status: PartnerApplicationStatus,
  ): Promise<void> {
    if (!isConfigured) return
    setBusyId(row.id)
    const client = createPartnerAdminClient(config)
    try {
      await updatePartnerApplicationStatus(client, row.id, status)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    }
    setBusyId(null)
  }

  async function changeDealStatus(
    row: PartnerDealAdminRow,
    status: PartnerDealStatus,
  ): Promise<void> {
    if (!isConfigured) return
    setBusyId(row.id)
    const client = createPartnerAdminClient(config)
    try {
      await updatePartnerDealStatus(client, row.id, status)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    }
    setBusyId(null)
  }

  if (!isConfigured) {
    return (
      <div className="border-[color:var(--ochre)]/40 bg-[color:var(--ochre)]/10 rounded-md border p-6 text-sm">
        Supabase non configuré : impossible de charger les partenaires.
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {authStatus !== 'authenticated' && (
        <div className="border-[color:var(--ochre)]/40 bg-[color:var(--ochre)]/10 rounded-md border p-3 text-xs text-foreground">
          Vous n&apos;êtes pas connecté en tant qu&apos;admin. Les lectures et
          transitions seront refusées par RLS.
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
          placeholder="Rechercher partenaire / client / SIRET / ville"
          onChange={(event) => setSearch(event.target.value)}
          className="h-9 max-w-sm text-xs"
        />
        <span className="text-xs text-muted-foreground">
          {filteredApplications.length} candidatures · {filteredDeals.length}{' '}
          opportunités
        </span>
      </div>

      <AdminPartnerSection
        title="Candidatures partenaires"
        emptyLabel="Aucune candidature partenaire."
        loading={loading}
      >
        {filteredApplications.map((row) => (
          <ApplicationCard
            key={row.id}
            row={row}
            busy={busyId === row.id}
            onChangeStatus={(status) =>
              void changeApplicationStatus(row, status)
            }
          />
        ))}
      </AdminPartnerSection>

      <AdminPartnerSection
        title="Opportunités à protéger"
        emptyLabel="Aucune opportunité partenaire."
        loading={loading}
      >
        {filteredDeals.map((row) => (
          <DealCard
            key={row.id}
            row={row}
            busy={busyId === row.id}
            onChangeStatus={(status) => void changeDealStatus(row, status)}
          />
        ))}
      </AdminPartnerSection>
    </div>
  )
}

function AdminPartnerSection({
  title,
  emptyLabel,
  loading,
  children,
}: {
  readonly title: string
  readonly emptyLabel: string
  readonly loading: boolean
  readonly children: ReactNode
}) {
  const hasChildren = Array.isArray(children)
    ? children.length > 0
    : Boolean(children)

  return (
    <section className="overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card">
      <div className="border-b border-[color:var(--sand-deep)] px-4 py-3">
        <h2 className="font-display text-lg font-semibold">{title}</h2>
      </div>
      {loading ? (
        <div className="px-4 py-8 text-sm text-muted-foreground">
          Chargement…
        </div>
      ) : !hasChildren ? (
        <div className="px-4 py-8 text-sm text-muted-foreground">
          {emptyLabel}
        </div>
      ) : (
        <div className="divide-[color:var(--sand-deep)]/70 divide-y">
          {children}
        </div>
      )}
    </section>
  )
}

function ApplicationCard({
  row,
  busy,
  onChangeStatus,
}: {
  readonly row: PartnerApplicationAdminRow
  readonly busy: boolean
  readonly onChangeStatus: (status: PartnerApplicationStatus) => void
}) {
  return (
    <article className="grid gap-3 px-4 py-4 text-sm lg:grid-cols-[1fr_1fr_160px]">
      <div>
        <div className="font-medium">{row.companyName}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {PARTNER_KIND_LABEL[row.partnerKind]} · {row.contactName}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {row.contactEmail} · {row.contactPhone}
        </div>
      </div>
      <div>
        <div className="text-xs text-muted-foreground">
          SIRET {row.siret ?? 'à compléter'} ·{' '}
          {row.territory ?? 'zone à cadrer'}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          Volume : {row.expectedMonthlyVolume ?? 'à qualifier'}
        </div>
        {(row.networkDescription || row.message) && (
          <p className="text-foreground/80 mt-2 text-xs leading-5">
            {row.networkDescription ?? row.message}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <StatusPill label={PARTNER_APPLICATION_STATUS_LABEL[row.status]} />
        <select
          value={row.status}
          disabled={busy}
          onChange={(event) =>
            onChangeStatus(event.target.value as PartnerApplicationStatus)
          }
          className="h-8 w-full rounded-sm border border-input bg-transparent px-2 text-xs"
        >
          {APPLICATION_STATUSES.map((status) => (
            <option key={status} value={status}>
              {PARTNER_APPLICATION_STATUS_LABEL[status]}
            </option>
          ))}
        </select>
      </div>
    </article>
  )
}

function DealCard({
  row,
  busy,
  onChangeStatus,
}: {
  readonly row: PartnerDealAdminRow
  readonly busy: boolean
  readonly onChangeStatus: (status: PartnerDealStatus) => void
}) {
  return (
    <article className="grid gap-3 px-4 py-4 text-sm lg:grid-cols-[1fr_1fr_170px]">
      <div>
        <div className="font-medium">{row.clientCompanyName}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          Client SIRET {row.clientSiret ?? '—'} ·{' '}
          {row.clientEmail ?? 'email à compléter'}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {row.projectType} · {row.projectCity ?? 'ville à cadrer'}
        </div>
      </div>
      <div>
        <div className="text-xs text-muted-foreground">
          Partenaire : {row.partnerCompanyName} · {row.partnerContactEmail}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          Budget :{' '}
          {row.expectedBudgetHt === null
            ? 'à qualifier'
            : formatEUR(row.expectedBudgetHt)}
          {' · '}
          Fenêtre : {row.expectedPurchaseWindow ?? 'à cadrer'}
        </div>
        {(row.productInterest || row.message) && (
          <p className="text-foreground/80 mt-2 text-xs leading-5">
            {row.productInterest ?? row.message}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <StatusPill label={PARTNER_DEAL_STATUS_LABEL[row.status]} />
        <select
          value={row.status}
          disabled={busy}
          onChange={(event) =>
            onChangeStatus(event.target.value as PartnerDealStatus)
          }
          className="h-8 w-full rounded-sm border border-input bg-transparent px-2 text-xs"
        >
          {DEAL_STATUSES.map((status) => (
            <option key={status} value={status}>
              {PARTNER_DEAL_STATUS_LABEL[status]}
            </option>
          ))}
        </select>
        <div className="text-[11px] leading-4 text-muted-foreground">
          Protection :{' '}
          {row.protectedUntil ?? `${row.protectionDays} jours après validation`}
        </div>
      </div>
    </article>
  )
}

function StatusPill({ label }: { readonly label: string }) {
  return (
    <span className="border-[color:var(--ochre)]/30 bg-[color:var(--ochre)]/10 inline-flex h-7 w-fit items-center rounded-sm border px-2 text-[11px] font-medium">
      {label}
    </span>
  )
}
