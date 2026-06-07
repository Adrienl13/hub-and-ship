import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  listPartnerApplications,
  listPartnerDeals,
  updatePartnerApplicationSlug,
  updatePartnerApplicationStatus,
  updatePartnerDealSlug,
  updatePartnerDealStatus,
  type PartnerAdminRepositoryClient,
  type PartnerApplicationAdminRow,
  type PartnerDealAdminRow,
} from '@/lib/partners/repository'
import { buildPartnerSharePath, normalizePartnerSlug } from '@/lib/partners/link'
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

  async function saveApplicationSlug(
    row: PartnerApplicationAdminRow,
    rawSlug: string | null,
  ): Promise<void> {
    if (!isConfigured) return
    setBusyId(row.id)
    const client = createPartnerAdminClient(config)
    try {
      const slug = await updatePartnerApplicationSlug(client, row.id, rawSlug)
      toast.success(slug ? `Lien partenaire enregistré` : 'Slug effacé', {
        description: slug ? buildPartnerSharePath({ slug }) : undefined,
      })
      await refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      setError(message)
      toast.error('Slug non enregistré', { description: message })
    }
    setBusyId(null)
  }

  async function saveDealSlug(
    row: PartnerDealAdminRow,
    rawSlug: string | null,
  ): Promise<void> {
    if (!isConfigured) return
    setBusyId(row.id)
    const client = createPartnerAdminClient(config)
    try {
      const slug = await updatePartnerDealSlug(client, row.id, rawSlug)
      toast.success(slug ? `Lien deal enregistré` : 'Slug effacé', {
        description: slug ? buildPartnerSharePath({ slug }) : undefined,
      })
      await refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      setError(message)
      toast.error('Slug non enregistré', { description: message })
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
            onSaveSlug={(slug) => void saveApplicationSlug(row, slug)}
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
            onSaveSlug={(slug) => void saveDealSlug(row, slug)}
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
  onSaveSlug,
}: {
  readonly row: PartnerApplicationAdminRow
  readonly busy: boolean
  readonly onChangeStatus: (status: PartnerApplicationStatus) => void
  readonly onSaveSlug: (slug: string | null) => void
}) {
  const attributionActive =
    row.status === 'qualified' || row.status === 'approved'

  return (
    <article className="grid gap-3 px-4 py-4 text-sm lg:grid-cols-[1fr_1fr_220px]">
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
        <PartnerShareLinkEditor
          currentSlug={row.partnerReferralSlug}
          suggestedFrom={row.companyName}
          busy={busy}
          attributionActive={attributionActive}
          attributionHint="Le lien est actif pour l'attribution quand la candidature est Qualifiée ou Approuvée."
          onSave={onSaveSlug}
        />
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
  onSaveSlug,
}: {
  readonly row: PartnerDealAdminRow
  readonly busy: boolean
  readonly onChangeStatus: (status: PartnerDealStatus) => void
  readonly onSaveSlug: (slug: string | null) => void
}) {
  const attributionActive =
    row.status === 'protected' ||
    row.status === 'quoted' ||
    row.status === 'reserved'

  return (
    <article className="grid gap-3 px-4 py-4 text-sm lg:grid-cols-[1fr_1fr_220px]">
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
        <PartnerShareLinkEditor
          currentSlug={row.partnerReferralSlug}
          suggestedFrom={row.partnerCompanyName}
          busy={busy}
          attributionActive={attributionActive}
          attributionHint="Le lien deal protège ce client quand le deal est Protégé, Devis envoyé ou Réservé (avec protection en cours)."
          onSave={onSaveSlug}
        />
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

function absoluteShareUrl(path: string): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${path}`
  }
  return `https://prosimport.com${path}`
}

function PartnerShareLinkEditor({
  currentSlug,
  suggestedFrom,
  busy,
  attributionActive,
  attributionHint,
  onSave,
}: {
  readonly currentSlug: string | null
  readonly suggestedFrom: string
  readonly busy: boolean
  readonly attributionActive: boolean
  readonly attributionHint: string
  readonly onSave: (slug: string | null) => void
}) {
  const suggestion = normalizePartnerSlug(suggestedFrom) ?? ''
  const [value, setValue] = useState(currentSlug ?? suggestion)

  // Keep the field in sync when the row's saved slug changes after a refresh.
  useEffect(() => {
    setValue(currentSlug ?? suggestion)
  }, [currentSlug, suggestion])

  const normalized = normalizePartnerSlug(value)
  const trimmedEmpty = value.trim() === ''
  const isInvalid = !trimmedEmpty && !normalized
  const sharePath = normalized ? buildPartnerSharePath({ slug: normalized }) : null
  const dirty = (currentSlug ?? '') !== (normalized ?? '')

  async function copyLink(): Promise<void> {
    if (!sharePath) return
    const url = absoluteShareUrl(sharePath)
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Lien copié', { description: url })
    } catch {
      toast.error('Copie impossible', { description: url })
    }
  }

  return (
    <div className="mt-3 rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]/40 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
          Lien partageable
        </span>
        <span
          className={`text-[10px] font-medium ${
            attributionActive
              ? 'text-[color:var(--forest)]'
              : 'text-muted-foreground'
          }`}
        >
          {attributionActive
            ? '● Attribution active'
            : '○ Attribution en attente'}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] text-muted-foreground">/p/</span>
        <Input
          value={value}
          placeholder={suggestion || 'chr-conseil'}
          disabled={busy}
          onChange={(event) => setValue(event.target.value)}
          className="h-8 w-40 text-xs"
          aria-label="Slug du lien partenaire"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy || isInvalid || !dirty}
          onClick={() => onSave(trimmedEmpty ? null : value)}
          className="h-8 px-2 text-xs"
        >
          {trimmedEmpty ? 'Effacer' : 'Enregistrer'}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!sharePath}
          onClick={() => void copyLink()}
          className="h-8 px-2 text-xs"
        >
          Copier le lien
        </Button>
      </div>

      {isInvalid ? (
        <p className="mt-1.5 text-[11px] text-red-700">
          Slug invalide : lettres, chiffres et tirets uniquement (ex.
          chr-conseil).
        </p>
      ) : sharePath ? (
        <p className="mt-1.5 truncate text-[11px] text-muted-foreground">
          {absoluteShareUrl(sharePath)}
        </p>
      ) : (
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Définissez un slug pour générer le lien co-brandé.
        </p>
      )}

      <p className="mt-1.5 text-[10px] leading-4 text-muted-foreground">
        {attributionHint}
      </p>
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
