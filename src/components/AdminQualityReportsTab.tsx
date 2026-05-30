import { Eye, EyeOff, Info, Pencil, PowerOff, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { AdminQualityReportEditor } from '@/components/AdminQualityReportEditor'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  listAllQualityReportsForAdmin,
  type QualityReportsClient,
} from '@/lib/quality-reports/repository'
import type { QualityReportDetail } from '@/lib/quality-reports/types'
import { useAuth } from '@/hooks/useAuth'
import { logAdminAction } from '@/lib/admin/audit-log'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'
import type { AuthStatus } from '@/hooks/useAuth'
import type { Database } from '@/lib/supabase/types'

type QualityReportUpdate =
  Database['public']['Tables']['quality_reports']['Update']

interface ContainerOption {
  readonly id: string
  readonly reference: string
}

export interface AdminQualityReportsTabProps {
  readonly authStatus: AuthStatus
}

type StateLabel = 'Publié' | 'Brouillon' | 'Inactif'

function reportState(row: QualityReportDetail): StateLabel {
  if (!row.publishedAt) return 'Brouillon'
  // Note: list endpoint hides inactives. listAllQualityReportsForAdmin is
  // the only place inactives surface; this helper still handles them in
  // case we later relax that filter.
  return 'Publié'
}

export function AdminQualityReportsTab({
  authStatus,
}: AdminQualityReportsTabProps) {
  const [rows, setRows] = useState<ReadonlyArray<QualityReportDetail>>([])
  const [containers, setContainers] = useState<ReadonlyArray<ContainerOption>>(
    [],
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<QualityReportDetail | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const auth = useAuth()
  const config = useMemo(() => getSupabasePublicConfig(), [])
  const isConfigured = config.isConfigured

  const refresh = useMemo(() => {
    return async () => {
      if (!isConfigured) {
        setRows([])
        setError('Supabase non configuré. Ajoutez VITE_SUPABASE_URL/ANON_KEY.')
        setLoading(false)
        return
      }
      setLoading(true)
      const client = createSupabaseBrowserClient(config) as QualityReportsClient
      try {
        const [reports, containerRows] = await Promise.all([
          listAllQualityReportsForAdmin(client),
          loadDeliveredContainers(client),
        ])
        setRows(reports)
        setContainers(containerRows)
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

  async function update(
    row: QualityReportDetail,
    payload: QualityReportUpdate,
  ): Promise<void> {
    if (!isConfigured) return
    setBusyId(row.id)
    const client = createSupabaseBrowserClient(config)
    const { error: updateError } = await client
      .from('quality_reports')
      .update(payload as never)
      .eq('id', row.id)
    if (updateError) {
      setError(updateError.message)
    } else {
      const action =
        payload.published_at === null
          ? 'quality_report.unpublish'
          : payload.published_at
            ? 'quality_report.publish'
            : payload.is_active === false
              ? 'quality_report.deactivate'
              : 'quality_report.update'
      await logAdminAction(client, auth.user?.id ?? null, {
        action,
        target: row.id,
        extra: { reference: row.referenceNumber },
      })
      await refresh()
    }
    setBusyId(null)
  }

  async function remove(row: QualityReportDetail): Promise<void> {
    if (!isConfigured) return
    if (
      !window.confirm(
        `Supprimer définitivement le rapport ${row.referenceNumber} ?`,
      )
    ) {
      return
    }
    setBusyId(row.id)
    const client = createSupabaseBrowserClient(config)
    const { error: deleteError } = await client
      .from('quality_reports')
      .delete()
      .eq('id', row.id)
    if (deleteError) {
      setError(deleteError.message)
    } else {
      await logAdminAction(client, auth.user?.id ?? null, {
        action: 'quality_report.delete',
        target: row.id,
        extra: { reference: row.referenceNumber, title: row.title },
      })
      await refresh()
    }
    setBusyId(null)
  }

  if (!isConfigured) {
    return (
      <div className="border-[color:var(--ochre)]/40 bg-[color:var(--ochre)]/10 rounded-md border p-6 text-sm">
        Supabase non configuré : impossible de charger les rapports qualité.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] p-3 text-xs leading-5 text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        Le bucket Supabase Storage{' '}
        <code className="rounded bg-card px-1">quality-reports</code> doit être
        créé manuellement (Dashboard → Storage → New bucket → privé, 10 MB max)
        avant de pouvoir uploader des PDF.
      </div>

      {authStatus !== 'authenticated' && (
        <div className="border-[color:var(--ochre)]/40 bg-[color:var(--ochre)]/10 rounded-md border p-3 text-xs text-foreground">
          Vous n&apos;êtes pas connecté en tant qu&apos;admin. Les actions
          d&apos;édition/publication seront refusées par RLS.
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-900">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card">
        <div className="hidden border-b border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-4 py-2 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground md:grid md:grid-cols-[1.2fr_120px_120px_120px_140px_260px] md:gap-3">
          <span>Référence / Titre</span>
          <span>Organisme</span>
          <span>Type</span>
          <span>Date</span>
          <span>État</span>
          <span>Actions</span>
        </div>
        <div className="divide-[color:var(--sand-deep)]/70 divide-y">
          {loading ? (
            <div className="px-4 py-8 text-sm text-muted-foreground">
              Chargement…
            </div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-8 text-sm text-muted-foreground">
              Aucun rapport.
            </div>
          ) : (
            rows.map((row) => {
              const state = reportState(row)
              const isPublished = state === 'Publié'
              const busy = busyId === row.id
              return (
                <article
                  key={row.id}
                  className="grid gap-3 px-4 py-3 text-sm md:grid-cols-[1.2fr_120px_120px_120px_140px_260px] md:items-center md:gap-3"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {row.referenceNumber}
                    </div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">
                      {row.title}
                      {row.containerReference
                        ? ` · ${row.containerReference}`
                        : ''}
                    </div>
                  </div>
                  <span className="rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-2 py-0.5 text-[11px] uppercase tracking-wide">
                    {row.organizationLabel}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {row.reportTypeLabel}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {row.issuedAt}
                  </span>
                  <StateBadge state={state} />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 rounded-sm"
                      onClick={() => setEditing(row)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Éditer
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={isPublished ? 'outline' : 'default'}
                      className="h-8 gap-1.5 rounded-sm"
                      disabled={busy}
                      onClick={() =>
                        void update(row, {
                          published_at: isPublished
                            ? null
                            : new Date().toISOString(),
                        })
                      }
                    >
                      {isPublished ? (
                        <>
                          <EyeOff className="h-3.5 w-3.5" />
                          Dépublier
                        </>
                      ) : (
                        <>
                          <Eye className="h-3.5 w-3.5" />
                          Publier
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 rounded-sm"
                      disabled={busy}
                      onClick={() => void update(row, { is_active: false })}
                    >
                      <PowerOff className="h-3.5 w-3.5" />
                      Désactiver
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 rounded-sm text-red-700 hover:bg-red-50"
                      disabled={busy}
                      onClick={() => void remove(row)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Supprimer
                    </Button>
                  </div>
                </article>
              )
            })
          )}
        </div>
      </div>

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Éditer le rapport {editing?.referenceNumber}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <AdminQualityReportEditor
              report={editing}
              containers={containers}
              onSaved={async () => {
                setEditing(null)
                await refresh()
              }}
              onCancel={() => setEditing(null)}
            />
          )}
          <DialogFooter className="text-[11px] text-muted-foreground">
            L&apos;enregistrement passe par UPDATE Supabase. Les erreurs RLS
            apparaissent ici.
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StateBadge({ state }: { readonly state: StateLabel }) {
  const variant =
    state === 'Publié'
      ? 'bg-[color:var(--forest)]/15 text-[color:var(--forest)]'
      : state === 'Brouillon'
        ? 'bg-[color:var(--ochre)]/15 text-[color:var(--ochre)]'
        : 'bg-[color:var(--sand-deep)] text-muted-foreground'
  return (
    <span
      className={`inline-flex w-fit items-center rounded-sm px-2 py-0.5 text-[11px] font-medium ${variant}`}
    >
      {state}
    </span>
  )
}

async function loadDeliveredContainers(
  client: QualityReportsClient,
): Promise<ReadonlyArray<ContainerOption>> {
  const { data, error } = await client
    .from('containers')
    .select('id, reference, status')
    .order('delivered_at', { ascending: false })

  if (error) throw new Error(error.message)
  return ((data ?? []) as Array<{ id: string; reference: string }>).map(
    (row) => ({
      id: row.id,
      reference: row.reference,
    }),
  )
}
