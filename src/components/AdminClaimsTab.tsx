import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  CLAIM_CATEGORY_LABEL,
  CLAIM_STATUS_LABEL,
  type ReservationClaimStatus,
} from '@/lib/account/claims'
import {
  listAllClaims,
  updateClaim,
  type AdminClaimRow,
  type AdminClaimsClient,
} from '@/lib/account/admin-claims.repository'
import { downloadCsv, toCsv } from '@/lib/admin/csv'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'

const CLAIM_STATUSES: ReadonlyArray<ReservationClaimStatus> = [
  'open',
  'in_review',
  'resolved',
  'rejected',
]

function formatClaimDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10)
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function AdminClaimsTab({
  authStatus,
}: {
  readonly authStatus: string
}) {
  const [claims, setClaims] = useState<ReadonlyArray<AdminClaimRow>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<
    ReservationClaimStatus | 'all'
  >('all')
  const [search, setSearch] = useState('')

  const config = useMemo(() => getSupabasePublicConfig(), [])
  const isConfigured = config.isConfigured

  function client(): AdminClaimsClient {
    return createSupabaseBrowserClient(config)
  }

  async function refresh(): Promise<void> {
    if (!isConfigured) {
      setError('Supabase non configuré.')
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      setClaims(await listAllClaims(client()))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    }
    setLoading(false)
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return claims.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false
      if (!needle) return true
      return [
        c.reservationReference ?? '',
        c.reservationSiret ?? '',
        c.companyName ?? '',
        c.contactName ?? '',
        c.contactEmail ?? '',
        c.message,
        CLAIM_CATEGORY_LABEL[c.category],
      ]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    })
  }, [claims, statusFilter, search])

  const openCount = claims.filter((c) => c.status === 'open').length

  function exportCsv(): void {
    const csv = toCsv(filtered, [
      { header: 'Date', value: (c) => c.createdAt.slice(0, 10) },
      { header: 'Réservation', value: (c) => c.reservationReference ?? '' },
      { header: 'SIRET', value: (c) => c.reservationSiret ?? '' },
      { header: 'Société', value: (c) => c.companyName ?? '' },
      { header: 'Contact', value: (c) => c.contactName ?? '' },
      { header: 'Email', value: (c) => c.contactEmail ?? '' },
      { header: 'Téléphone', value: (c) => c.contactPhone ?? '' },
      { header: 'Catégorie', value: (c) => CLAIM_CATEGORY_LABEL[c.category] },
      { header: 'Statut', value: (c) => CLAIM_STATUS_LABEL[c.status] },
      { header: 'Quantité', value: (c) => c.quantity ?? '' },
      { header: 'Message', value: (c) => c.message },
      { header: 'Réponse', value: (c) => c.adminResponse ?? '' },
      { header: 'Mise à jour', value: (c) => c.updatedAt.slice(0, 10) },
    ])
    downloadCsv(`sav-${new Date().toISOString().slice(0, 10)}.csv`, csv)
  }

  async function changeStatus(
    row: AdminClaimRow,
    status: ReservationClaimStatus,
  ): Promise<void> {
    setBusyId(row.id)
    try {
      await updateClaim(client(), row.id, { status })
      await refresh()
    } catch (err) {
      toast.error('Mise à jour impossible', {
        description: err instanceof Error ? err.message : undefined,
      })
    }
    setBusyId(null)
  }

  async function saveResponse(
    row: AdminClaimRow,
    adminResponse: string,
  ): Promise<void> {
    setBusyId(row.id)
    try {
      await updateClaim(client(), row.id, { adminResponse })
      toast.success('Réponse enregistrée')
      await refresh()
    } catch (err) {
      toast.error('Enregistrement impossible', {
        description: err instanceof Error ? err.message : undefined,
      })
    }
    setBusyId(null)
  }

  if (!isConfigured) {
    return (
      <div className="border-[color:var(--ochre)]/40 bg-[color:var(--ochre)]/10 rounded-md border p-6 text-sm">
        Supabase non configuré : impossible de charger le SAV.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {authStatus !== 'authenticated' && (
        <div className="border-[color:var(--ochre)]/40 bg-[color:var(--ochre)]/10 rounded-md border p-3 text-xs">
          Vous n&apos;êtes pas connecté en tant qu&apos;admin. Les lectures et
          mises à jour seront refusées par RLS.
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
          placeholder="Rechercher référence / SIRET / société / contact / motif"
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 max-w-sm text-xs"
          aria-label="Rechercher une réclamation"
        />
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as ReservationClaimStatus | 'all')
          }
          className="h-9 rounded-md border border-input bg-transparent px-2 text-xs"
          aria-label="Filtrer par statut"
        >
          <option value="all">Tous statuts</option>
          {CLAIM_STATUSES.map((s) => (
            <option key={s} value={s}>
              {CLAIM_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={filtered.length === 0}
          onClick={exportCsv}
          className="h-9 px-2 text-xs"
        >
          Exporter CSV
        </Button>
        <span className="text-xs text-muted-foreground">
          {filtered.length} / {claims.length} · {openCount} ouverte(s)
        </span>
      </div>

      <div className="overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card">
        {loading ? (
          <div className="px-4 py-8 text-sm text-muted-foreground">
            Chargement…
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-8 text-sm text-muted-foreground">
            Aucune réclamation.
          </div>
        ) : (
          <div className="divide-[color:var(--sand-deep)]/70 divide-y">
            {filtered.map((claim) => (
              <ClaimCard
                key={claim.id}
                claim={claim}
                busy={busyId === claim.id}
                onChangeStatus={(status) => void changeStatus(claim, status)}
                onSaveResponse={(response) =>
                  void saveResponse(claim, response)
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ClaimCard({
  claim,
  busy,
  onChangeStatus,
  onSaveResponse,
}: {
  readonly claim: AdminClaimRow
  readonly busy: boolean
  readonly onChangeStatus: (status: ReservationClaimStatus) => void
  readonly onSaveResponse: (response: string) => void
}) {
  const [response, setResponse] = useState(claim.adminResponse ?? '')
  useEffect(() => {
    setResponse(claim.adminResponse ?? '')
  }, [claim.adminResponse])
  const dirty = (claim.adminResponse ?? '') !== response.trim()

  return (
    <article className="grid gap-3 px-4 py-4 text-sm lg:grid-cols-[1fr_1.4fr_180px]">
      <div>
        <div className="font-medium">
          {claim.reservationReference ?? 'Réservation'}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {formatClaimDate(claim.createdAt)} · SIRET{' '}
          {claim.reservationSiret ?? '—'}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {CLAIM_CATEGORY_LABEL[claim.category]}
          {claim.quantity ? ` · ${claim.quantity} unité(s)` : ''}
        </div>
        <div className="mt-2 space-y-0.5 text-xs">
          <div className="font-medium">{claim.companyName ?? '—'}</div>
          {claim.contactName && (
            <div className="text-muted-foreground">{claim.contactName}</div>
          )}
          <div className="flex flex-wrap gap-x-2">
            {claim.contactEmail && (
              <a
                href={`mailto:${claim.contactEmail}`}
                className="text-[color:var(--ember)] hover:underline"
              >
                {claim.contactEmail}
              </a>
            )}
            {claim.contactPhone && (
              <a
                href={`tel:${claim.contactPhone.replace(/\s+/g, '')}`}
                className="text-[color:var(--ember)] hover:underline"
              >
                {claim.contactPhone}
              </a>
            )}
          </div>
        </div>
      </div>

      <div>
        <p className="text-foreground/85 text-xs leading-5">{claim.message}</p>
        <div className="mt-2">
          <label className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
            Réponse au client
            <textarea
              value={response}
              disabled={busy}
              rows={2}
              placeholder="Réponse au client…"
              onChange={(e) => setResponse(e.target.value)}
              className="mt-1 w-full rounded-sm border border-input bg-background px-2 py-1.5 text-xs font-normal normal-case tracking-normal text-foreground"
            />
          </label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy || !dirty}
            onClick={() => onSaveResponse(response)}
            className="mt-1 h-8 px-2 text-xs"
          >
            Enregistrer la réponse
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <span className="border-[color:var(--ochre)]/30 bg-[color:var(--ochre)]/10 inline-flex h-7 w-fit items-center rounded-sm border px-2 text-[11px] font-medium">
          {CLAIM_STATUS_LABEL[claim.status]}
        </span>
        <select
          value={claim.status}
          disabled={busy}
          onChange={(e) =>
            onChangeStatus(e.target.value as ReservationClaimStatus)
          }
          className="h-8 w-full rounded-sm border border-input bg-transparent px-2 text-xs"
          aria-label="Changer le statut"
        >
          {CLAIM_STATUSES.map((s) => (
            <option key={s} value={s}>
              {CLAIM_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>
    </article>
  )
}
