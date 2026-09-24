import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'
import { logAdminAction } from '@/lib/admin/audit-log'
import {
  createPartnerCodeForApplication,
  describePartnerApplicationOrigin,
  listPartnerApplications,
  listPartnerDeals,
  updatePartnerApplicationNote,
  updatePartnerApplicationSlug,
  updatePartnerApplicationStatus,
  updatePartnerDealNote,
  updatePartnerDealSlug,
  updatePartnerDealStatus,
  type PartnerAdminRepositoryClient,
  type PartnerApplicationAdminRow,
  type PartnerDealAdminRow,
} from '@/lib/partners/repository'
import { buildPartnerLink } from '@/lib/partner-space/qr'
import {
  listAllReservations,
  type AdminReservationRow,
} from '@/lib/account/admin-reservations.repository'
import { ACCOUNT_RESERVATION_STATUS_LABEL } from '@/lib/account/reservations'
import {
  buildPartnerSharePath,
  normalizePartnerSlug,
} from '@/lib/partners/link'
import { downloadCsv, toCsv } from '@/lib/admin/csv'
import { partnerSourceLabel } from '@/lib/admin/origin'
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

// Le client complet sert au journal d'audit ; les dépôts partenaires ne voient
// que l'interface étroite.
function createPartnerAdminClients(config: SupabasePublicConfig): {
  readonly repo: PartnerAdminRepositoryClient
  readonly audit: ReturnType<typeof createSupabaseBrowserClient>
} {
  const audit = createSupabaseBrowserClient(config)
  return { repo: audit as unknown as PartnerAdminRepositoryClient, audit }
}

function createPartnerAdminClient(
  config: SupabasePublicConfig,
): PartnerAdminRepositoryClient {
  return createPartnerAdminClients(config).repo
}

function formatPartnerDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10)
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function AdminPartnersTab({
  authStatus,
}: {
  readonly authStatus: string
}) {
  const auth = useAuth()
  const [applications, setApplications] = useState<
    ReadonlyArray<PartnerApplicationAdminRow>
  >([])
  const [deals, setDeals] = useState<ReadonlyArray<PartnerDealAdminRow>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [applicationStatusFilter, setApplicationStatusFilter] = useState<
    PartnerApplicationStatus | 'all'
  >('all')
  const [dealStatusFilter, setDealStatusFilter] = useState<
    PartnerDealStatus | 'all'
  >('all')
  const [reservations, setReservations] = useState<
    ReadonlyArray<AdminReservationRow>
  >([])
  const [reservationsState, setReservationsState] = useState<
    'idle' | 'loading' | 'loaded' | 'error'
  >('idle')

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
    return applications.filter((row) => {
      if (
        applicationStatusFilter !== 'all' &&
        row.status !== applicationStatusFilter
      ) {
        return false
      }
      if (!needle) return true
      return [
        row.companyName,
        row.contactName,
        row.contactEmail,
        row.siret ?? '',
        row.territory ?? '',
        row.website ?? '',
        row.activityProfileLabel ?? '',
        row.targetStatusLabel ?? '',
        row.partnerRef ?? '',
        row.utmSource ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    })
  }, [applications, applicationStatusFilter, search])

  const filteredDeals = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return deals.filter((row) => {
      if (dealStatusFilter !== 'all' && row.status !== dealStatusFilter) {
        return false
      }
      if (!needle) return true
      return [
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
        .includes(needle)
    })
  }, [deals, dealStatusFilter, search])

  async function changeApplicationStatus(
    row: PartnerApplicationAdminRow,
    status: PartnerApplicationStatus,
  ): Promise<void> {
    if (!isConfigured) return
    setBusyId(row.id)
    const { repo, audit } = createPartnerAdminClients(config)
    try {
      await updatePartnerApplicationStatus(repo, row.id, status)
      await logAdminAction(audit, auth.user?.id ?? null, {
        action: 'partner_application.status_change',
        target: row.id,
        previousValue: row.status,
        nextValue: status,
        extra: { company: row.companyName },
      })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    }
    setBusyId(null)
  }

  // M13 — chaînon manquant : sans code apporteur, aucune commission ne peut
  // s'accruer. Idempotent côté SQL (re-clic = renvoie le code existant).
  async function generatePartnerCode(
    row: PartnerApplicationAdminRow,
  ): Promise<void> {
    if (!isConfigured) return
    setBusyId(row.id)
    const { repo, audit } = createPartnerAdminClients(config)
    try {
      const result = await createPartnerCodeForApplication(repo, row.id)
      await logAdminAction(audit, auth.user?.id ?? null, {
        action: result.created
          ? 'partner_application.code_create'
          : 'partner_application.code_reuse',
        target: row.id,
        nextValue: result.code,
        extra: { company: row.companyName, linkedUser: result.linkedUser },
      })
      const link = buildPartnerLink(result.code)
      try {
        await navigator.clipboard.writeText(link)
      } catch {
        // copie refusée (permissions) — le toast affiche quand même le lien.
      }
      toast.success(
        result.created
          ? `Code apporteur créé : ${result.code}`
          : `Code apporteur existant : ${result.code}`,
        {
          description: result.linkedUser
            ? `Lien copié : ${link} — compte partenaire relié à sa société.`
            : `Lien copié : ${link} — le partenaire verra son espace après création de son compte (${row.contactEmail}).`,
        },
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      toast.error('Code apporteur non créé', { description: message })
      setError(message)
    }
    setBusyId(null)
  }

  async function changeDealStatus(
    row: PartnerDealAdminRow,
    status: PartnerDealStatus,
  ): Promise<void> {
    if (!isConfigured) return
    setBusyId(row.id)
    const { repo, audit } = createPartnerAdminClients(config)
    try {
      await updatePartnerDealStatus(repo, row.id, status)
      await logAdminAction(audit, auth.user?.id ?? null, {
        action: 'partner_deal.status_change',
        target: row.id,
        previousValue: row.status,
        nextValue: status,
        extra: {
          partner: row.partnerCompanyName,
          client: row.clientCompanyName,
        },
      })
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
    const { repo, audit } = createPartnerAdminClients(config)
    try {
      const slug = await updatePartnerApplicationSlug(repo, row.id, rawSlug)
      await logAdminAction(audit, auth.user?.id ?? null, {
        action: 'partner_application.slug_change',
        target: row.id,
        previousValue: row.partnerReferralSlug,
        nextValue: slug,
        extra: { company: row.companyName },
      })
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
    const { repo, audit } = createPartnerAdminClients(config)
    try {
      const slug = await updatePartnerDealSlug(repo, row.id, rawSlug)
      await logAdminAction(audit, auth.user?.id ?? null, {
        action: 'partner_deal.slug_change',
        target: row.id,
        previousValue: row.partnerReferralSlug,
        nextValue: slug,
        extra: { partner: row.partnerCompanyName },
      })
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

  async function saveApplicationNote(
    row: PartnerApplicationAdminRow,
    note: string | null,
  ): Promise<void> {
    if (!isConfigured) return
    setBusyId(row.id)
    const { repo, audit } = createPartnerAdminClients(config)
    try {
      await updatePartnerApplicationNote(repo, row.id, note)
      await logAdminAction(audit, auth.user?.id ?? null, {
        action: 'partner_application.note_change',
        target: row.id,
        extra: { company: row.companyName },
      })
      toast.success('Note interne enregistrée')
      await refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      setError(message)
      toast.error('Note non enregistrée', { description: message })
    }
    setBusyId(null)
  }

  async function saveDealNote(
    row: PartnerDealAdminRow,
    note: string | null,
  ): Promise<void> {
    if (!isConfigured) return
    setBusyId(row.id)
    const { repo, audit } = createPartnerAdminClients(config)
    try {
      await updatePartnerDealNote(repo, row.id, note)
      await logAdminAction(audit, auth.user?.id ?? null, {
        action: 'partner_deal.note_change',
        target: row.id,
        extra: { partner: row.partnerCompanyName },
      })
      toast.success('Note interne enregistrée')
      await refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      setError(message)
      toast.error('Note non enregistrée', { description: message })
    }
    setBusyId(null)
  }

  // Les réservations attribuées ne servent qu'au dépliage d'une candidature :
  // chargement paresseux (500 dernières réservations) à la première ouverture.
  async function ensureReservationsLoaded(): Promise<void> {
    if (!isConfigured) return
    if (reservationsState === 'loading' || reservationsState === 'loaded')
      return
    setReservationsState('loading')
    try {
      const client = createSupabaseBrowserClient(config)
      const rows = await listAllReservations(client)
      setReservations(rows)
      setReservationsState('loaded')
    } catch (err) {
      setReservationsState('error')
      toast.error('Réservations attribuées indisponibles', {
        description: err instanceof Error ? err.message : 'Erreur inconnue',
      })
    }
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
          placeholder="Rechercher partenaire / client / SIRET / ville / profil"
          onChange={(event) => setSearch(event.target.value)}
          className="h-9 max-w-sm text-xs"
        />
        <select
          value={applicationStatusFilter}
          onChange={(event) =>
            setApplicationStatusFilter(
              event.target.value as PartnerApplicationStatus | 'all',
            )
          }
          className="h-9 rounded-md border border-input bg-transparent px-2 text-xs"
          aria-label="Filtrer les candidatures par statut"
        >
          <option value="all">Candidatures : tous statuts</option>
          {APPLICATION_STATUSES.map((status) => (
            <option key={status} value={status}>
              {PARTNER_APPLICATION_STATUS_LABEL[status]}
            </option>
          ))}
        </select>
        <select
          value={dealStatusFilter}
          onChange={(event) =>
            setDealStatusFilter(event.target.value as PartnerDealStatus | 'all')
          }
          className="h-9 rounded-md border border-input bg-transparent px-2 text-xs"
          aria-label="Filtrer les opportunités par statut"
        >
          <option value="all">Opportunités : tous statuts</option>
          {DEAL_STATUSES.map((status) => (
            <option key={status} value={status}>
              {PARTNER_DEAL_STATUS_LABEL[status]}
            </option>
          ))}
        </select>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={filteredApplications.length === 0}
          onClick={() =>
            downloadCsv(
              `partenaires-candidatures-${new Date().toISOString().slice(0, 10)}.csv`,
              toCsv(filteredApplications, [
                { header: 'Date', value: (r) => r.createdAt.slice(0, 10) },
                { header: 'Société', value: (r) => r.companyName },
                {
                  header: 'Type',
                  value: (r) => PARTNER_KIND_LABEL[r.partnerKind],
                },
                {
                  header: 'Profil',
                  value: (r) => r.activityProfileLabel ?? '',
                },
                {
                  header: 'Statut visé',
                  value: (r) => r.targetStatusLabel ?? '',
                },
                { header: 'Contact', value: (r) => r.contactName },
                { header: 'Email', value: (r) => r.contactEmail },
                { header: 'Téléphone', value: (r) => r.contactPhone },
                { header: 'SIRET', value: (r) => r.siret ?? '' },
                {
                  header: 'SIRET vérifié',
                  value: (r) => (r.siretVerified ? 'oui' : 'non'),
                },
                { header: 'Site web', value: (r) => r.website ?? '' },
                { header: 'Territoire', value: (r) => r.territory ?? '' },
                {
                  header: 'Volume',
                  value: (r) => r.expectedMonthlyVolume ?? '',
                },
                {
                  header: 'Statut',
                  value: (r) => PARTNER_APPLICATION_STATUS_LABEL[r.status],
                },
                { header: 'Slug', value: (r) => r.partnerReferralSlug ?? '' },
                {
                  header: 'Source',
                  value: (r) => partnerSourceLabel(r.source),
                },
                { header: 'UTM source', value: (r) => r.utmSource ?? '' },
                { header: 'UTM medium', value: (r) => r.utmMedium ?? '' },
                { header: 'UTM campagne', value: (r) => r.utmCampaign ?? '' },
                {
                  header: 'Partenaire (ref)',
                  value: (r) => r.partnerRef ?? '',
                },
                { header: 'Note interne', value: (r) => r.internalNote ?? '' },
              ]),
            )
          }
          className="h-9 px-2 text-xs"
        >
          Export candidatures
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={filteredDeals.length === 0}
          onClick={() =>
            downloadCsv(
              `partenaires-deals-${new Date().toISOString().slice(0, 10)}.csv`,
              toCsv(filteredDeals, [
                { header: 'Date', value: (r) => r.createdAt.slice(0, 10) },
                { header: 'Partenaire', value: (r) => r.partnerCompanyName },
                {
                  header: 'Email partenaire',
                  value: (r) => r.partnerContactEmail,
                },
                { header: 'Client', value: (r) => r.clientCompanyName },
                { header: 'SIRET client', value: (r) => r.clientSiret ?? '' },
                { header: 'Email client', value: (r) => r.clientEmail ?? '' },
                { header: 'Projet', value: (r) => r.projectType },
                { header: 'Ville', value: (r) => r.projectCity ?? '' },
                {
                  header: 'Budget HT',
                  value: (r) => r.expectedBudgetHt ?? '',
                },
                {
                  header: 'Statut',
                  value: (r) => PARTNER_DEAL_STATUS_LABEL[r.status],
                },
                {
                  header: 'Protégé jusqu’au',
                  value: (r) => r.protectedUntil ?? '',
                },
                { header: 'Slug', value: (r) => r.partnerReferralSlug ?? '' },
                {
                  header: 'Source',
                  value: (r) => partnerSourceLabel(r.source),
                },
                { header: 'Note interne', value: (r) => r.internalNote ?? '' },
              ]),
            )
          }
          className="h-9 px-2 text-xs"
        >
          Export deals
        </Button>
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
        {filteredApplications.map((row) => {
          const linkedDeals = deals.filter((d) => d.applicationId === row.id)
          const linkedDealIds = new Set(linkedDeals.map((d) => d.id))
          const attributedReservations = reservations.filter(
            (r) =>
              r.partnerApplicationId === row.id ||
              (r.partnerDealId !== null && linkedDealIds.has(r.partnerDealId)),
          )
          return (
            <ApplicationCard
              key={row.id}
              row={row}
              busy={busyId === row.id}
              linkedDeals={linkedDeals}
              attributedReservations={attributedReservations}
              reservationsState={reservationsState}
              onExpand={() => void ensureReservationsLoaded()}
              onChangeStatus={(status) =>
                void changeApplicationStatus(row, status)
              }
              onSaveSlug={(slug) => void saveApplicationSlug(row, slug)}
              onSaveNote={(note) => void saveApplicationNote(row, note)}
              onGenerateCode={() => void generatePartnerCode(row)}
            />
          )
        })}
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
            onSaveNote={(note) => void saveDealNote(row, note)}
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
  linkedDeals,
  attributedReservations,
  reservationsState,
  onExpand,
  onChangeStatus,
  onSaveSlug,
  onSaveNote,
  onGenerateCode,
}: {
  readonly row: PartnerApplicationAdminRow
  readonly busy: boolean
  readonly linkedDeals: ReadonlyArray<PartnerDealAdminRow>
  readonly attributedReservations: ReadonlyArray<AdminReservationRow>
  readonly reservationsState: 'idle' | 'loading' | 'loaded' | 'error'
  readonly onExpand: () => void
  readonly onChangeStatus: (status: PartnerApplicationStatus) => void
  readonly onSaveSlug: (slug: string | null) => void
  readonly onSaveNote: (note: string | null) => void
  readonly onGenerateCode: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const attributionActive =
    row.status === 'qualified' || row.status === 'approved'

  function toggleExpanded(): void {
    const next = !expanded
    setExpanded(next)
    if (next) onExpand()
  }

  return (
    <div>
      <article className="grid gap-3 px-4 py-4 text-sm lg:grid-cols-[1fr_1fr_220px]">
        <div>
          <div className="font-medium">{row.companyName}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {formatPartnerDate(row.createdAt)} ·{' '}
            {PARTNER_KIND_LABEL[row.partnerKind]} · {row.contactName}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {row.contactEmail} · {row.contactPhone}
          </div>
          {(row.activityProfileLabel || row.targetStatusLabel) && (
            <div className="mt-1 text-xs text-muted-foreground">
              {[row.activityProfileLabel, row.targetStatusLabel]
                .filter(Boolean)
                .join(' · ')}
            </div>
          )}
          {row.internalNote && (
            <p className="bg-[color:var(--ochre)]/10 mt-2 rounded-sm px-2 py-1 text-[11px] leading-4 text-foreground">
              📝 {row.internalNote}
            </p>
          )}
        </div>
        <div>
          <div className="text-xs text-muted-foreground">
            SIRET {row.siret ?? 'à compléter'}
            {row.siret && (row.siretVerified ? ' (vérifié)' : ' (à vérifier)')}
            {' · '}
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
          {row.status === 'approved' && (
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={onGenerateCode}
              className="h-8 w-full px-2 text-xs"
              title="Génère le code de suivi ?ref= (QR/lien) et provisionne la société — nécessaire pour les commissions apporteur"
            >
              {busy ? 'Génération…' : 'Générer le code apporteur'}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={toggleExpanded}
            className="h-8 w-full px-2 text-xs"
          >
            {expanded ? 'Masquer le détail' : 'Détail'} · {linkedDeals.length}{' '}
            deal{linkedDeals.length > 1 ? 's' : ''}
          </Button>
        </div>
      </article>

      {expanded && (
        <div className="bg-[color:var(--sand-soft)]/30 border-t border-[color:var(--sand-deep)] px-4 py-4">
          <ApplicationDetailFacts row={row} />

          <NoteEditor
            label="Note interne (candidature)"
            currentNote={row.internalNote}
            busy={busy}
            onSave={onSaveNote}
          />

          <PartnerDetailDeals deals={linkedDeals} />

          <PartnerDetailReservations
            reservations={attributedReservations}
            reservationsState={reservationsState}
          />
        </div>
      )}
    </div>
  )
}

// Fiche candidature : ce que le formulaire /partenaires collecte mais que la
// ligne compacte ne montre pas (profil, statut visé, site, origine marketing).
function ApplicationDetailFacts({
  row,
}: {
  readonly row: PartnerApplicationAdminRow
}) {
  const facts: ReadonlyArray<{
    readonly label: string
    readonly value: ReactNode
  }> = [
    { label: 'Reçue le', value: formatPartnerDate(row.createdAt) },
    { label: 'Profil', value: row.activityProfileLabel ?? 'non renseigné' },
    { label: 'Statut visé', value: row.targetStatusLabel ?? 'non renseigné' },
    {
      label: 'Site web',
      value: row.website ? (
        <a
          href={
            /^https?:\/\//i.test(row.website)
              ? row.website
              : `https://${row.website}`
          }
          target="_blank"
          rel="noreferrer"
          className="text-[color:var(--ember)] hover:underline"
        >
          {row.website}
        </a>
      ) : (
        'non renseigné'
      ),
    },
    {
      label: 'SIRET',
      value: row.siret
        ? `${row.siret} · ${row.siretVerified ? 'vérifié' : 'à vérifier'}`
        : 'à compléter',
    },
    { label: 'Origine', value: describePartnerApplicationOrigin(row) },
    { label: 'Source', value: partnerSourceLabel(row.source) || '—' },
  ]

  return (
    <dl className="mb-4 grid gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2 lg:grid-cols-3">
      {facts.map((fact) => (
        <div key={fact.label} className="min-w-0">
          <dt className="text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
            {fact.label}
          </dt>
          <dd className="truncate">{fact.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function NoteEditor({
  label,
  currentNote,
  busy,
  onSave,
}: {
  readonly label: string
  readonly currentNote: string | null
  readonly busy: boolean
  readonly onSave: (note: string | null) => void
}) {
  const [value, setValue] = useState(currentNote ?? '')

  useEffect(() => {
    setValue(currentNote ?? '')
  }, [currentNote])

  const dirty = (currentNote ?? '') !== value.trim()

  return (
    <div className="mb-4">
      <label className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </label>
      <textarea
        value={value}
        disabled={busy}
        rows={2}
        placeholder="Visible uniquement par les admins."
        onChange={(event) => setValue(event.target.value)}
        className="mt-1 w-full rounded-sm border border-input bg-background px-2 py-1.5 text-xs"
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy || !dirty}
        onClick={() => onSave(value.trim() === '' ? null : value)}
        className="mt-1 h-8 px-2 text-xs"
      >
        Enregistrer la note
      </Button>
    </div>
  )
}

function PartnerDetailDeals({
  deals,
}: {
  readonly deals: ReadonlyArray<PartnerDealAdminRow>
}) {
  return (
    <div className="mb-4">
      <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
        Opportunités liées ({deals.length})
      </div>
      {deals.length === 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Aucune opportunité rattachée à cette candidature.
        </p>
      ) : (
        <ul className="mt-1.5 space-y-1.5">
          {deals.map((deal) => (
            <li
              key={deal.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-[color:var(--sand-deep)] bg-background px-2.5 py-1.5 text-xs"
            >
              <span className="font-medium">{deal.clientCompanyName}</span>
              <span className="text-muted-foreground">
                {deal.projectType} · {deal.projectCity ?? 'ville à cadrer'}
              </span>
              <StatusPill label={PARTNER_DEAL_STATUS_LABEL[deal.status]} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function PartnerDetailReservations({
  reservations,
  reservationsState,
}: {
  readonly reservations: ReadonlyArray<AdminReservationRow>
  readonly reservationsState: 'idle' | 'loading' | 'loaded' | 'error'
}) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
        Réservations attribuées ({reservations.length})
      </div>
      {reservationsState === 'loading' ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Chargement des réservations…
        </p>
      ) : reservationsState === 'error' ? (
        <p className="mt-1 text-xs text-red-700">
          Réservations indisponibles (accès admin requis).
        </p>
      ) : reservations.length === 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Aucune réservation attribuée (sur les 500 dernières).
        </p>
      ) : (
        <ul className="mt-1.5 space-y-1.5">
          {reservations.map((res) => (
            <li
              key={res.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-[color:var(--sand-deep)] bg-background px-2.5 py-1.5 text-xs"
            >
              <span className="font-mono font-medium">{res.reference}</span>
              <span className="text-muted-foreground">
                {res.companyLegalName ?? res.contactEmail ?? res.siret}
              </span>
              <span className="text-muted-foreground">
                {formatEUR(res.totalHt)} ·{' '}
                {res.partnerAttributionReason ?? 'lien'}
              </span>
              <StatusPill label={reservationStatusLabel(res.status)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function DealCard({
  row,
  busy,
  onChangeStatus,
  onSaveSlug,
  onSaveNote,
}: {
  readonly row: PartnerDealAdminRow
  readonly busy: boolean
  readonly onChangeStatus: (status: PartnerDealStatus) => void
  readonly onSaveSlug: (slug: string | null) => void
  readonly onSaveNote: (note: string | null) => void
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
          {formatPartnerDate(row.createdAt)} · {row.projectType} ·{' '}
          {row.projectCity ?? 'ville à cadrer'}
          {row.source ? ` · ${partnerSourceLabel(row.source)}` : ''}
        </div>
        <NoteEditor
          label="Note interne (deal)"
          currentNote={row.internalNote}
          busy={busy}
          onSave={onSaveNote}
        />
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

function reservationStatusLabel(status: AdminReservationRow['status']): string {
  const labels = ACCOUNT_RESERVATION_STATUS_LABEL as Record<string, string>
  return labels[status] ?? status
}

function absoluteShareUrl(path: string): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${path}`
  }
  return `https://terrassea.com${path}`
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
  const sharePath = normalized
    ? buildPartnerSharePath({ slug: normalized })
    : null
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
    <div className="bg-[color:var(--sand-soft)]/40 mt-3 rounded-sm border border-[color:var(--sand-deep)] p-2.5">
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
