import { useEffect, useMemo, useState } from 'react'
import { Eye, EyeOff, Pencil, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AdminContainerEditor } from '@/components/AdminContainerEditor'
import { useAuth } from '@/hooks/useAuth'
import { logAdminAction } from '@/lib/admin/audit-log'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'
import type { Database } from '@/lib/supabase/types'
import type { AuthStatus } from '@/hooks/useAuth'

type ContainerRow = Database['public']['Tables']['containers']['Row']

export interface AdminContainersTabProps {
  readonly authStatus: AuthStatus
}

export function AdminContainersTab({ authStatus }: AdminContainersTabProps) {
  const [rows, setRows] = useState<ReadonlyArray<ContainerRow>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<ContainerRow | null>(null)
  const [creating, setCreating] = useState(false)
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
      const client = createSupabaseBrowserClient(config)
      const result = await client
        .from('containers')
        .select('*')
        .order('delivered_at', { ascending: false, nullsFirst: false })

      if (result.error) {
        setError(result.error.message)
      } else {
        setError(null)
        setRows((result.data as ContainerRow[]) ?? [])
      }
      setLoading(false)
    }
  }, [config, isConfigured])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function togglePublication(row: ContainerRow): Promise<void> {
    if (!isConfigured) return
    setBusyId(row.id)
    const client = createSupabaseBrowserClient(config)
    const payload: Database['public']['Tables']['containers']['Update'] = {
      published_at: row.published_at ? null : new Date().toISOString(),
    }
    const { error: updateError } = await client
      .from('containers')
      .update(payload as never)
      .eq('id', row.id)
    if (updateError) {
      setError(updateError.message)
    } else {
      await logAdminAction(client, auth.user?.id ?? null, {
        action: row.published_at ? 'container.unpublish' : 'container.publish',
        target: row.id,
        extra: { reference: row.reference },
      })
      await refresh()
    }
    setBusyId(null)
  }

  if (!isConfigured) {
    return (
      <div className="border-[color:var(--ochre)]/40 bg-[color:var(--ochre)]/10 rounded-md border p-6 text-sm">
        Supabase non configuré : impossible de charger les containers.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {authStatus !== 'authenticated' && (
        <div className="border-[color:var(--ochre)]/40 bg-[color:var(--ochre)]/10 rounded-md border p-3 text-xs text-foreground">
          Vous n&apos;êtes pas connecté en tant qu&apos;admin. Les actions de
          publication/édition seront refusées par RLS.
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-900">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          className="h-8 gap-1.5 rounded-sm"
          onClick={() => setCreating(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          Créer un container
        </Button>
      </div>

      <div className="overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card">
        <div className="hidden border-b border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-4 py-2 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground md:grid md:grid-cols-[1fr_120px_120px_120px_220px] md:gap-3">
          <span>Référence / Slug</span>
          <span>Statut</span>
          <span>Livré</span>
          <span>Publication</span>
          <span>Actions</span>
        </div>
        <div className="divide-[color:var(--sand-deep)]/70 divide-y">
          {loading ? (
            <div className="px-4 py-8 text-sm text-muted-foreground">
              Chargement…
            </div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-8 text-sm text-muted-foreground">
              Aucun container.
            </div>
          ) : (
            rows.map((row) => {
              const isPublished = Boolean(row.published_at)
              const busy = busyId === row.id
              return (
                <article
                  key={row.id}
                  className="grid gap-3 px-4 py-3 text-sm md:grid-cols-[1fr_120px_120px_120px_220px] md:items-center md:gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-medium">{row.reference}</div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">
                      {row.slug ?? '— pas de slug'}
                    </div>
                  </div>
                  <span className="rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-2 py-0.5 text-[11px] uppercase tracking-wide">
                    {row.status}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {row.delivered_at ?? '—'}
                  </span>
                  <span
                    className={`inline-flex w-fit items-center rounded-sm px-2 py-0.5 text-[11px] font-medium ${
                      isPublished
                        ? 'bg-[color:var(--forest)]/15 text-[color:var(--forest)]'
                        : 'bg-[color:var(--ochre)]/15 text-[color:var(--ochre)]'
                    }`}
                  >
                    {isPublished ? 'Publié' : 'Brouillon'}
                  </span>
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
                      onClick={() => void togglePublication(row)}
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
                  </div>
                </article>
              )
            })
          )}
        </div>
      </div>

      <Dialog
        open={editing !== null || creating}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null)
            setCreating(false)
          }
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {creating
                ? 'Nouveau container'
                : `Éditer le container ${editing?.reference ?? ''}`}
            </DialogTitle>
          </DialogHeader>
          {(editing || creating) && (
            <AdminContainerEditor
              container={creating ? null : editing}
              onSaved={async () => {
                setEditing(null)
                setCreating(false)
                await refresh()
              }}
              onCancel={() => {
                setEditing(null)
                setCreating(false)
              }}
            />
          )}
          <DialogFooter className="text-[11px] text-muted-foreground">
            L&apos;enregistrement passe par UPSERT Supabase. Les erreurs RLS
            apparaissent ici.
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
