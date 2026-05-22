import { useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Power, PowerOff, Trash2 } from 'lucide-react'

import { AdminCarrierPartnerEditor } from '@/components/AdminCarrierPartnerEditor'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  deactivateCarrier,
  deleteCarrier,
  listAllCarriers,
  reactivateCarrier,
  type AdminCarrier,
  type CarrierPartnersClient,
} from '@/lib/carrier-partners/repository'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'
import type { AuthStatus } from '@/hooks/useAuth'

export interface AdminCarrierPartnersTabProps {
  readonly authStatus: AuthStatus
}

export function AdminCarrierPartnersTab({
  authStatus,
}: AdminCarrierPartnersTabProps) {
  const [rows, setRows] = useState<ReadonlyArray<AdminCarrier>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<AdminCarrier | null>(null)
  const [creating, setCreating] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

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
      const client = createSupabaseBrowserClient(
        config,
      ) as CarrierPartnersClient
      try {
        const list = await listAllCarriers(client)
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

  async function toggleActive(row: AdminCarrier): Promise<void> {
    if (!isConfigured) return
    setBusyId(row.id)
    const client = createSupabaseBrowserClient(config) as CarrierPartnersClient
    try {
      if (row.isActive) await deactivateCarrier(client, row.id)
      else await reactivateCarrier(client, row.id)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    }
    setBusyId(null)
  }

  async function remove(row: AdminCarrier): Promise<void> {
    if (!isConfigured) return
    if (
      !window.confirm(`Supprimer définitivement le transporteur ${row.name} ?`)
    )
      return
    setBusyId(row.id)
    const client = createSupabaseBrowserClient(config) as CarrierPartnersClient
    try {
      await deleteCarrier(client, row.id)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    }
    setBusyId(null)
  }

  if (!isConfigured) {
    return (
      <div className="border-[color:var(--ochre)]/40 bg-[color:var(--ochre)]/10 rounded-md border p-6 text-sm">
        Supabase non configuré : impossible de charger les transporteurs.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {authStatus !== 'authenticated' && (
        <div className="border-[color:var(--ochre)]/40 bg-[color:var(--ochre)]/10 rounded-md border p-3 text-xs text-foreground">
          Vous n&apos;êtes pas connecté en tant qu&apos;admin. Les actions
          d&apos;édition seront refusées par RLS.
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
          Ajouter un transporteur
        </Button>
      </div>

      <div className="overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card">
        <div className="hidden border-b border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-4 py-2 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground md:grid md:grid-cols-[40px_1.4fr_160px_1fr_120px_220px] md:gap-3">
          <span>#</span>
          <span>Transporteur</span>
          <span>Spécialité</span>
          <span>Couverture</span>
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
              Aucun transporteur.
            </div>
          ) : (
            rows.map((row) => {
              const busy = busyId === row.id
              return (
                <article
                  key={row.id}
                  className="grid gap-3 px-4 py-3 text-sm md:grid-cols-[40px_1.4fr_160px_1fr_120px_220px] md:items-center md:gap-3"
                >
                  <span className="text-xs text-muted-foreground">
                    {row.sortOrder}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{row.name}</div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">
                      {row.slug} ·{' '}
                      {row.contact.phone ?? row.contact.email ?? '—'}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {row.specialtyLabel}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {row.coverage}
                  </span>
                  <span
                    className={`inline-flex w-fit items-center rounded-sm px-2 py-0.5 text-[11px] font-medium ${
                      row.isActive
                        ? 'bg-[color:var(--forest)]/15 text-[color:var(--forest)]'
                        : 'bg-[color:var(--sand-deep)] text-muted-foreground'
                    }`}
                  >
                    {row.isActive ? 'Actif' : 'Désactivé'}
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
                      variant="outline"
                      className="h-8 gap-1.5 rounded-sm"
                      disabled={busy}
                      onClick={() => void toggleActive(row)}
                    >
                      {row.isActive ? (
                        <>
                          <PowerOff className="h-3.5 w-3.5" />
                          Désactiver
                        </>
                      ) : (
                        <>
                          <Power className="h-3.5 w-3.5" />
                          Activer
                        </>
                      )}
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
                ? 'Nouveau transporteur'
                : `Éditer ${editing?.name ?? ''}`}
            </DialogTitle>
          </DialogHeader>
          <AdminCarrierPartnerEditor
            carrier={editing}
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
          <DialogFooter className="text-[11px] text-muted-foreground">
            L&apos;enregistrement passe par UPSERT Supabase. Les erreurs RLS
            apparaissent ici.
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
