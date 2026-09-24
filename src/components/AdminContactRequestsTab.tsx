import { useEffect, useMemo, useState } from 'react'
import { Download, Mail, Phone, RefreshCw, Send } from 'lucide-react'
import { toast } from 'sonner'

import {
  FollowUpDialog,
  type FollowUpSent,
  type FollowUpTarget,
} from '@/components/admin/FollowUpDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth, type AuthStatus } from '@/hooks/useAuth'
import { logAdminAction } from '@/lib/admin/audit-log'
import { downloadCsv, toCsv } from '@/lib/admin/csv'
import { describeFollowUps } from '@/lib/admin/follow-ups'
import {
  listFollowUpsForTargets,
  type FollowUpRow,
  type FollowUpsClient,
} from '@/lib/admin/follow-ups.repository'
import {
  formatAdminDate,
  formatAdminDateTime,
  telHref,
} from '@/lib/admin/format'
import { describeOrigin } from '@/lib/admin/origin'
import { CONTACT_TOPICS } from '@/lib/contact'
import {
  CONTACT_REQUEST_STATUSES,
  CONTACT_REQUEST_STATUS_LABEL,
  adminListContactRequests,
  adminUpdateContactRequestNote,
  adminUpdateContactRequestStatus,
  contactSourceLabel,
  contactTopicLabel,
  countContactRequestsByStatus,
  matchesContactRequestSearch,
  nextContactRequestStatuses,
  type AdminContactRequestRow,
  type ContactRequestAdminClient,
  type ContactRequestStatus,
} from '@/lib/contact-requests/admin-repository'
import {
  createSupabaseBrowserClient,
  type SupabaseBrowserClient,
} from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'

// Onglet « Demandes » : toutes les demandes de contact enregistrées en base
// (formulaire contact, devis rapide, coloris, plateau, brief Studio…), avec
// suivi de statut, note interne et export CSV. Le mail reste une notification,
// cette liste est la source de vérité.

const STATUS_STYLE: Record<ContactRequestStatus, string> = {
  new: 'border-[color:var(--ember)]/40 bg-[color:var(--ember)]/10 text-[color:var(--ember)]',
  contacted:
    'border-[color:var(--ochre)]/40 bg-[color:var(--ochre)]/10 text-foreground',
  quoted:
    'border-[color:var(--ochre)]/40 bg-[color:var(--ochre)]/10 text-foreground',
  won: 'border-[color:var(--forest)]/40 bg-[color:var(--forest)]/10 text-[color:var(--forest)]',
  lost: 'border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] text-muted-foreground',
}

function createContactAdminClient(
  browser: SupabaseBrowserClient,
): ContactRequestAdminClient {
  return browser as unknown as ContactRequestAdminClient
}

// Origine marketing : partenaire puis UTM, sinon le point de capture
// (helper commun lib/admin/origin.ts).
function originLabel(row: AdminContactRequestRow): string {
  return describeOrigin({
    partnerRef: row.partnerRef,
    utmSource: row.utmSource,
    utmMedium: row.utmMedium,
    utmCampaign: row.utmCampaign,
    sourceLabel: row.sourceLabel,
  })
}

function productLabel(row: AdminContactRequestRow): string | null {
  if (!row.productName && !row.productSku) return null
  const parts: string[] = []
  parts.push(row.productName ?? row.productSku ?? '')
  if (row.productName && row.productSku) parts.push(row.productSku)
  if (row.productDesign) parts.push(row.productDesign)
  if (row.quantity !== null) parts.push(`${row.quantity} u`)
  if (row.priceLabel) parts.push(row.priceLabel)
  return parts.join(' · ')
}

export function AdminContactRequestsTab({
  authStatus,
}: {
  authStatus: AuthStatus
}) {
  const auth = useAuth()
  const [rows, setRows] = useState<ReadonlyArray<AdminContactRequestRow>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  // Relances par demande, chargées après la liste ; une lecture qui échoue
  // (RLS, réseau) ne bloque pas l'onglet : le badge reste simplement absent.
  const [followUps, setFollowUps] = useState<Map<string, FollowUpRow[]>>(
    () => new Map(),
  )
  const [followUpTarget, setFollowUpTarget] = useState<FollowUpTarget | null>(
    null,
  )
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<
    ContactRequestStatus | 'all'
  >('all')
  const [topicFilter, setTopicFilter] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')

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
      try {
        const browser = createSupabaseBrowserClient(config)
        const client = createContactAdminClient(browser)
        const list = await adminListContactRequests(client)
        setRows(list)
        setError(null)
        try {
          setFollowUps(
            await listFollowUpsForTargets(
              browser as unknown as FollowUpsClient,
              'contact_request',
              list.map((row) => row.id),
            ),
          )
        } catch (followUpError) {
          console.warn(
            'contact requests: follow-ups unavailable',
            followUpError,
          )
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue')
      }
      setLoading(false)
    }
  }, [config, isConfigured])

  useEffect(() => {
    void refresh()
  }, [refresh])

  function openFollowUp(row: AdminContactRequestRow): void {
    setFollowUpTarget({
      kind: 'contact_request',
      id: row.id,
      recipientName: row.name,
      recipientEmail: row.email,
      context: {
        name: row.name,
        company: row.company,
        productName: row.productName,
        quantity: row.quantity,
        priceLabel: row.priceLabel,
      },
      defaultTemplate: row.topic === 'devis' ? 'devis' : 'informations',
    })
  }

  // Après une relance partie : la demande neuve passe « contactée » (elle
  // l'est, de fait), l'action est auditée, la liste et les badges rechargés.
  async function handleFollowUpSent(
    target: FollowUpTarget,
    sent: FollowUpSent,
  ): Promise<void> {
    if (!isConfigured) return
    const row = rows.find((candidate) => candidate.id === target.id)
    const browser = createSupabaseBrowserClient(config)
    try {
      if (row?.status === 'new') {
        await adminUpdateContactRequestStatus(
          createContactAdminClient(browser),
          target.id,
          'contacted',
        )
      }
      await logAdminAction(browser, auth.user?.id ?? null, {
        action: 'contact_request.follow_up',
        target: target.id,
        ...(row?.status === 'new'
          ? { previousValue: 'new', nextValue: 'contacted' }
          : {}),
        extra: { template: sent.template, traced: sent.traced },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      setError(message)
      toast.error('Statut non modifié', { description: message })
    }
    await refresh()
  }

  async function changeStatus(
    row: AdminContactRequestRow,
    target: ContactRequestStatus,
  ): Promise<void> {
    if (!isConfigured) return
    setBusyId(row.id)
    const browser = createSupabaseBrowserClient(config)
    try {
      await adminUpdateContactRequestStatus(
        createContactAdminClient(browser),
        row.id,
        target,
      )
      await logAdminAction(browser, auth.user?.id ?? null, {
        action: 'contact_request.status_change',
        target: row.id,
        previousValue: row.status,
        nextValue: target,
        extra: { topic: row.topic, source: row.source },
      })
      // « Rouvrir » ramène à new : « Demande nouvelle » serait trompeur.
      toast.success(
        target === 'new'
          ? 'Demande rouverte'
          : `Demande ${CONTACT_REQUEST_STATUS_LABEL[target].toLowerCase()}`,
      )
      await refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      setError(message)
      toast.error('Statut non modifié', { description: message })
    }
    setBusyId(null)
  }

  async function saveNote(
    row: AdminContactRequestRow,
    note: string | null,
  ): Promise<void> {
    if (!isConfigured) return
    setBusyId(row.id)
    const browser = createSupabaseBrowserClient(config)
    try {
      await adminUpdateContactRequestNote(
        createContactAdminClient(browser),
        row.id,
        note,
      )
      await logAdminAction(browser, auth.user?.id ?? null, {
        action: 'contact_request.note_change',
        target: row.id,
        extra: { hasNote: Boolean(note && note.trim() !== '') },
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

  const counts = useMemo(() => countContactRequestsByStatus(rows), [rows])

  // Sujets et sources présents en base, en plus des sujets connus du site :
  // un sujet ajouté côté site ou une nouvelle source apparaît d'elle-même.
  const topicOptions = useMemo(() => {
    const known = new Set<string>(CONTACT_TOPICS)
    for (const row of rows) known.add(row.topic)
    return [...known]
  }, [rows])

  const sourceOptions = useMemo(() => {
    const seen = new Set<string>()
    for (const row of rows) seen.add(row.source)
    return [...seen].sort()
  }, [rows])

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false
      if (topicFilter !== 'all' && row.topic !== topicFilter) return false
      if (sourceFilter !== 'all' && row.source !== sourceFilter) return false
      return matchesContactRequestSearch(row, search)
    })
  }, [rows, statusFilter, topicFilter, sourceFilter, search])

  const hasActiveFilter =
    statusFilter !== 'all' ||
    topicFilter !== 'all' ||
    sourceFilter !== 'all' ||
    search.trim() !== ''

  function exportCsv(): void {
    downloadCsv(
      `demandes-contact-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(filteredRows, [
        { header: 'Date', value: (r) => formatAdminDate(r.createdAt) },
        {
          header: 'Statut',
          value: (r) => CONTACT_REQUEST_STATUS_LABEL[r.status],
        },
        { header: 'Sujet', value: (r) => r.topicLabel },
        { header: 'Source', value: (r) => r.sourceLabel },
        { header: 'Nom', value: (r) => r.name },
        { header: 'Société', value: (r) => r.company ?? '' },
        { header: 'Email', value: (r) => r.email },
        { header: 'Téléphone', value: (r) => r.phone ?? '' },
        { header: 'Produit', value: (r) => r.productName ?? '' },
        { header: 'SKU', value: (r) => r.productSku ?? '' },
        { header: 'Design', value: (r) => r.productDesign ?? '' },
        { header: 'Quantité', value: (r) => r.quantity },
        { header: 'Prix', value: (r) => r.priceLabel ?? '' },
        { header: 'Message', value: (r) => r.message },
        { header: 'Brief Studio', value: (r) => r.studioBrief ?? '' },
        { header: 'UTM source', value: (r) => r.utmSource ?? '' },
        { header: 'UTM medium', value: (r) => r.utmMedium ?? '' },
        { header: 'UTM campagne', value: (r) => r.utmCampaign ?? '' },
        { header: 'Partenaire (ref)', value: (r) => r.partnerRef ?? '' },
        { header: 'Note interne', value: (r) => r.internalNote ?? '' },
        { header: 'Mise à jour', value: (r) => formatAdminDate(r.updatedAt) },
      ]),
    )
  }

  if (!isConfigured) {
    return (
      <div className="border-[color:var(--ochre)]/40 bg-[color:var(--ochre)]/10 rounded-md border p-6 text-sm">
        Supabase non configuré : les demandes de contact ne sont pas disponibles
        dans cet environnement.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {authStatus !== 'authenticated' && (
        <div className="border-[color:var(--ochre)]/40 bg-[color:var(--ochre)]/10 rounded-md border p-3 text-xs text-foreground">
          Vous n&apos;êtes pas connecté en tant qu&apos;admin. La lecture et les
          changements de statut seront refusés par RLS.
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-900">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {CONTACT_REQUEST_STATUSES.map((status) => {
          const active = statusFilter === status
          return (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(active ? 'all' : status)}
              aria-pressed={active}
              className={`rounded-md border p-3 text-left transition ${
                active
                  ? 'border-foreground bg-card'
                  : 'hover:border-foreground/40 border-[color:var(--sand-deep)] bg-card'
              }`}
            >
              <div className="font-display text-2xl font-semibold tabular-nums">
                {counts[status]}
              </div>
              <div className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                {CONTACT_REQUEST_STATUS_LABEL[status]}
              </div>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          placeholder="Rechercher nom / email / société / produit"
          onChange={(event) => setSearch(event.target.value)}
          className="h-9 max-w-xs text-xs"
          aria-label="Rechercher une demande"
        />
        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value as ContactRequestStatus | 'all')
          }
          className="h-9 rounded-md border border-input bg-transparent px-2 text-xs"
          aria-label="Filtrer par statut"
        >
          <option value="all">Tous statuts</option>
          {CONTACT_REQUEST_STATUSES.map((status) => (
            <option key={status} value={status}>
              {CONTACT_REQUEST_STATUS_LABEL[status]}
            </option>
          ))}
        </select>
        <select
          value={topicFilter}
          onChange={(event) => setTopicFilter(event.target.value)}
          className="h-9 rounded-md border border-input bg-transparent px-2 text-xs"
          aria-label="Filtrer par sujet"
        >
          <option value="all">Tous sujets</option>
          {topicOptions.map((topic) => (
            <option key={topic} value={topic}>
              {contactTopicLabel(topic)}
            </option>
          ))}
        </select>
        <select
          value={sourceFilter}
          onChange={(event) => setSourceFilter(event.target.value)}
          className="h-9 rounded-md border border-input bg-transparent px-2 text-xs"
          aria-label="Filtrer par source"
        >
          <option value="all">Toutes sources</option>
          {sourceOptions.map((source) => (
            <option key={source} value={source}>
              {contactSourceLabel(source)}
            </option>
          ))}
        </select>
        {hasActiveFilter && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setStatusFilter('all')
              setTopicFilter('all')
              setSourceFilter('all')
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
          onClick={() => void refresh()}
          disabled={loading}
          className="h-9 gap-1.5 px-2 text-xs"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Rafraîchir
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={filteredRows.length === 0}
          onClick={exportCsv}
          className="h-9 gap-1.5 px-2 text-xs"
        >
          <Download className="h-3.5 w-3.5" />
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
            {rows.length === 0
              ? 'Aucune demande de contact pour le moment.'
              : 'Aucune demande ne correspond aux filtres.'}
          </div>
        ) : (
          <div className="divide-[color:var(--sand-deep)]/70 divide-y">
            {filteredRows.map((row) => (
              <ContactRequestCard
                key={row.id}
                row={row}
                busy={busyId === row.id}
                followUpLabel={describeFollowUps(followUps.get(row.id) ?? [])}
                onChangeStatus={(target) => void changeStatus(row, target)}
                onSaveNote={(note) => void saveNote(row, note)}
                onFollowUp={() => openFollowUp(row)}
              />
            ))}
          </div>
        )}
      </div>

      <FollowUpDialog
        target={followUpTarget}
        onClose={() => setFollowUpTarget(null)}
        onSent={(target, sent) => void handleFollowUpSent(target, sent)}
      />
    </div>
  )
}

function ContactRequestCard({
  row,
  busy,
  followUpLabel,
  onChangeStatus,
  onSaveNote,
  onFollowUp,
}: {
  readonly row: AdminContactRequestRow
  readonly busy: boolean
  readonly followUpLabel: string | null
  readonly onChangeStatus: (target: ContactRequestStatus) => void
  readonly onSaveNote: (note: string | null) => void
  readonly onFollowUp: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const transitions = nextContactRequestStatuses(row.status)
  const product = productLabel(row)
  const origin = originLabel(row)
  const preview =
    row.message.length > 160 ? `${row.message.slice(0, 160)}…` : row.message

  return (
    <article className="grid gap-3 px-4 py-4 text-sm md:grid-cols-[1.1fr_1.4fr_220px] md:items-start">
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">
          {formatAdminDateTime(row.createdAt)}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="border-[color:var(--ochre)]/30 bg-[color:var(--ochre)]/10 inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[11px] font-medium">
            {row.topicLabel}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {row.sourceLabel}
          </span>
        </div>
        <div className="mt-2 truncate font-medium">{row.name}</div>
        {row.company && (
          <div className="truncate text-xs text-muted-foreground">
            {row.company}
          </div>
        )}
        <div className="mt-1.5 flex flex-col gap-0.5 text-xs">
          <a
            href={`mailto:${row.email}`}
            className="inline-flex items-center gap-1 truncate text-[color:var(--ember)] hover:underline"
          >
            <Mail className="h-3 w-3 shrink-0" />
            {row.email}
          </a>
          {row.phone && (
            <a
              href={telHref(row.phone)}
              className="inline-flex items-center gap-1 text-[color:var(--ember)] hover:underline"
            >
              <Phone className="h-3 w-3 shrink-0" />
              {row.phone}
            </a>
          )}
        </div>
      </div>

      <div className="min-w-0">
        {product && (
          <div className="mb-1.5 text-xs">
            <span className="font-medium">Produit :</span> {product}
          </div>
        )}
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="text-foreground/85 w-full rounded-sm border border-transparent text-left text-xs leading-5 hover:border-[color:var(--sand-deep)]"
        >
          <span className="whitespace-pre-wrap">
            {expanded ? row.message : preview}
          </span>
          {row.message.length > 160 && (
            <span className="ml-1 text-[11px] text-muted-foreground">
              {expanded ? 'Réduire' : 'Lire tout'}
            </span>
          )}
        </button>
        {expanded && row.studioBrief && (
          <p className="text-foreground/85 mt-2 whitespace-pre-wrap rounded-sm bg-[color:var(--sand-soft)] px-2 py-1.5 text-[11px] leading-4">
            <span className="font-medium">Brief Studio :</span>{' '}
            {row.studioBrief}
          </p>
        )}
        <div className="mt-2 text-[11px] text-muted-foreground">
          Origine : {origin}
        </div>
        {row.internalNote && !expanded && (
          <p className="bg-[color:var(--ochre)]/10 mt-2 rounded-sm px-2 py-1 text-[11px] leading-4 text-foreground">
            📝 {row.internalNote}
          </p>
        )}
        {expanded && (
          <NoteEditor
            currentNote={row.internalNote}
            busy={busy}
            onSave={onSaveNote}
          />
        )}
      </div>

      <div className="space-y-2">
        <span
          className={`inline-flex h-7 w-fit items-center rounded-sm border px-2 text-[11px] font-medium ${STATUS_STYLE[row.status]}`}
        >
          {CONTACT_REQUEST_STATUS_LABEL[row.status]}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {transitions.map((transition) => (
            <Button
              key={transition.target}
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              className="h-7 rounded-sm px-2 text-[11px]"
              onClick={() => onChangeStatus(transition.target)}
            >
              {transition.label}
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            className="h-7 gap-1 rounded-sm px-2 text-[11px]"
            onClick={onFollowUp}
            aria-label={`Relancer ${row.name}`}
          >
            <Send className="h-3 w-3" />
            Relancer
          </Button>
        </div>
        {followUpLabel && (
          <div className="text-[11px] text-muted-foreground">
            {followUpLabel}
          </div>
        )}
        {!expanded && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
          >
            {row.internalNote ? 'Modifier la note' : 'Ajouter une note'}
          </button>
        )}
      </div>
    </article>
  )
}

function NoteEditor({
  currentNote,
  busy,
  onSave,
}: {
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
    <div className="mt-3">
      <label className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
        Note interne
        <textarea
          value={value}
          disabled={busy}
          rows={2}
          placeholder="Visible uniquement par les admins."
          onChange={(event) => setValue(event.target.value)}
          className="mt-1 w-full rounded-sm border border-input bg-background px-2 py-1.5 text-xs font-normal normal-case tracking-normal text-foreground"
        />
      </label>
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
