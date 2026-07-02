import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/hooks/useAuth'
import { logAdminAction } from '@/lib/admin/audit-log'
import {
  listAllPartnerApplications,
  updatePartnerApplicationAdminNotes,
  updatePartnerApplicationStatus,
  type PartnerApplicationAdminClient,
  type PartnerApplicationAdminRow,
} from '@/lib/partner-applications/admin-repository'
import {
  PARTNER_ACTIVITY_PROFILE_LABEL,
  PARTNER_TARGET_STATUS_LABEL,
  type PartnerActivityProfile,
} from '@/lib/partner-applications'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'
import type { PartnerApplicationStatus } from '@/lib/supabase/types'

const STATUS_LABEL: Record<PartnerApplicationStatus, string> = {
  new: 'Nouvelle',
  in_review: 'En revue',
  approved: 'Approuvée',
  rejected: 'Rejetée',
}

const STATUS_FILTERS: ReadonlyArray<PartnerApplicationStatus> = [
  'new',
  'in_review',
  'approved',
  'rejected',
]

function nextButtons(
  status: PartnerApplicationStatus,
): ReadonlyArray<{ label: string; target: PartnerApplicationStatus }> {
  switch (status) {
    case 'new':
      return [{ label: 'Passer en revue', target: 'in_review' }]
    case 'in_review':
      return [
        { label: 'Approuver', target: 'approved' },
        { label: 'Rejeter', target: 'rejected' },
      ]
    case 'approved':
    case 'rejected':
      return [{ label: 'Rouvrir', target: 'in_review' }]
    default:
      return []
  }
}

function profileLabel(value: string): string {
  return (
    PARTNER_ACTIVITY_PROFILE_LABEL[value as PartnerActivityProfile] ?? value
  )
}

export function AdminPartnerApplicationsTab({
  authStatus,
}: {
  readonly authStatus: string
}) {
  const auth = useAuth()
  const [rows, setRows] = useState<ReadonlyArray<PartnerApplicationAdminRow>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<
    PartnerApplicationStatus | 'all'
  >('all')
  const [profileFilter, setProfileFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  const config = useMemo(() => getSupabasePublicConfig(), [])
  const isConfigured = config.isConfigured

  const refresh = useMemo(() => {
    return async () => {
      if (!isConfigured) {
        setRows([])
        setLoading(false)
        return
      }
      setLoading(true)
      const client = createSupabaseBrowserClient(
        config,
      ) as PartnerApplicationAdminClient
      try {
        setRows(await listAllPartnerApplications(client))
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
    row: PartnerApplicationAdminRow,
    target: PartnerApplicationStatus,
  ): Promise<void> {
    if (!isConfigured) return
    setBusyId(row.id)
    const client = createSupabaseBrowserClient(
      config,
    ) as PartnerApplicationAdminClient
    try {
      await updatePartnerApplicationStatus(client, row.id, target)
      await logAdminAction(client, auth.user?.id ?? null, {
        action: 'partner_application.status_change',
        target: row.id,
        previousValue: row.status,
        nextValue: target,
        extra: { company: row.companyName },
      })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    }
    setBusyId(null)
  }

  async function saveNotes(
    row: PartnerApplicationAdminRow,
    note: string,
  ): Promise<void> {
    if (!isConfigured) return
    const trimmed = note.trim()
    if ((row.adminNotes ?? '') === trimmed) return
    const client = createSupabaseBrowserClient(
      config,
    ) as PartnerApplicationAdminClient
    try {
      await updatePartnerApplicationAdminNotes(
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
      if (profileFilter !== 'all' && row.activityProfile !== profileFilter)
        return false
      if (!needle) return true
      return (
        row.companyName.toLowerCase().includes(needle) ||
        row.email.toLowerCase().includes(needle) ||
        row.siret.includes(needle) ||
        (row.partnerRef?.toLowerCase().includes(needle) ?? false)
      )
    })
  }, [rows, statusFilter, profileFilter, search])

  if (!isConfigured) {
    return (
      <div className="border-[color:var(--ochre)]/40 bg-[color:var(--ochre)]/10 rounded-md border p-6 text-sm">
        Supabase non configuré : les candidatures partenaires ne sont pas
        consultables ici.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {authStatus !== 'authenticated' && (
        <div className="border-[color:var(--ochre)]/40 bg-[color:var(--ochre)]/10 rounded-md border p-3 text-xs text-foreground">
          Vous n&apos;êtes pas connecté en tant qu&apos;admin. Les actions
          seront refusées par RLS.
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
          placeholder="Rechercher société / email / SIRET / code partenaire"
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 max-w-xs text-xs"
        />
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as PartnerApplicationStatus | 'all')
          }
          className="h-9 rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-2 text-xs"
        >
          <option value="all">Tous statuts</option>
          {STATUS_FILTERS.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABEL[status]}
            </option>
          ))}
        </select>
        <select
          value={profileFilter}
          onChange={(e) => setProfileFilter(e.target.value)}
          className="h-9 rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-2 text-xs"
        >
          <option value="all">Tous profils</option>
          {Object.entries(PARTNER_ACTIVITY_PROFILE_LABEL).map(
            ([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ),
          )}
        </select>
        <span className="text-xs text-muted-foreground">
          {filteredRows.length} / {rows.length}
        </span>
      </div>

      {loading ? (
        <div className="rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] p-6 text-sm text-muted-foreground">
          Chargement…
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] p-6 text-sm text-muted-foreground">
          Aucune candidature.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRows.map((row) => (
            <ApplicationCard
              key={row.id}
              row={row}
              busy={busyId === row.id}
              onChangeStatus={changeStatus}
              onSaveNotes={saveNotes}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ApplicationCard({
  row,
  busy,
  onChangeStatus,
  onSaveNotes,
}: {
  readonly row: PartnerApplicationAdminRow
  readonly busy: boolean
  readonly onChangeStatus: (
    row: PartnerApplicationAdminRow,
    target: PartnerApplicationStatus,
  ) => void
  readonly onSaveNotes: (
    row: PartnerApplicationAdminRow,
    note: string,
  ) => void
}) {
  const [note, setNote] = useState(row.adminNotes ?? '')

  return (
    <div className="rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="mono rounded-[3px] bg-[color:var(--ink)] px-2 py-0.5 text-[11px] tracking-[0.08em] text-[color:var(--sand-soft)]">
              {PARTNER_TARGET_STATUS_LABEL[row.targetStatus].split(' · ')[0]}
            </span>
            <span className="font-display text-base font-semibold">
              {row.companyName}
            </span>
            <StatusPill status={row.status} />
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {profileLabel(row.activityProfile)} · visé :{' '}
            {PARTNER_TARGET_STATUS_LABEL[row.targetStatus]}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {nextButtons(row.status).map((button) => (
            <Button
              key={button.target}
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => onChangeStatus(row, button.target)}
              className="h-8 text-xs"
            >
              {button.label}
            </Button>
          ))}
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs md:grid-cols-3">
        <Detail label="Contact">
          {row.contactName} ·{' '}
          <a href={`mailto:${row.email}`} className="underline">
            {row.email}
          </a>
          {row.phone ? ` · ${row.phone}` : ''}
        </Detail>
        <Detail label="SIRET">
          <span className="mono">{row.siret}</span>{' '}
          {row.siretVerified ? '✓' : '(à vérifier)'}
        </Detail>
        <Detail label="Zone / volume">
          {[row.zone, row.estimatedVolume].filter(Boolean).join(' · ') || '—'}
        </Detail>
        {(row.partnerRef || row.utmSource) && (
          <Detail label="Attribution">
            {[
              row.partnerRef ? `ref=${row.partnerRef}` : null,
              row.utmSource ? `src=${row.utmSource}` : null,
              row.utmCampaign ? `camp=${row.utmCampaign}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Detail>
        )}
        <Detail label="Reçue le">
          {new Date(row.createdAt).toLocaleDateString('fr-FR')}
        </Detail>
      </dl>

      {row.message && (
        <p className="mt-2 rounded-sm bg-[color:var(--paper)] p-2 text-xs text-[color:var(--ink-soft)]">
          {row.message}
        </p>
      )}

      <div className="mt-3">
        <label className="text-[11px] font-medium text-muted-foreground">
          Notes admin
        </label>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => onSaveNotes(row, note)}
          placeholder="Notes internes (sauvegarde à la perte de focus)…"
          className="mt-1 min-h-[52px] text-xs"
        />
      </div>
    </div>
  )
}

function Detail({
  label,
  children,
}: {
  readonly label: string
  readonly children: React.ReactNode
}) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-foreground">{children}</dd>
    </div>
  )
}

function StatusPill({ status }: { status: PartnerApplicationStatus }) {
  const tone: Record<PartnerApplicationStatus, string> = {
    new: 'bg-[color:var(--info)]/10 text-[color:var(--info)]',
    in_review: 'bg-[color:var(--ochre)]/15 text-[color:var(--ochre)]',
    approved: 'bg-[color:var(--forest)]/12 text-[color:var(--forest)]',
    rejected: 'bg-[color:var(--stamp)]/12 text-[color:var(--stamp)]',
  }
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}
