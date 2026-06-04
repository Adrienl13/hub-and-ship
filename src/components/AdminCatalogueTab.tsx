import { useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Power, PowerOff } from 'lucide-react'

import { AdminProductEditor } from '@/components/AdminProductEditor'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CATEGORY_LABEL } from '@/lib/products'
import {
  listAdminContainers,
  listProducts,
  reactivateProduct,
  softDeleteProduct,
  type CatalogueAdminClient,
} from '@/lib/catalogue-admin/repository'
import type {
  AdminContainerOption,
  AdminProduct,
} from '@/lib/catalogue-admin/types'
import { useAuth } from '@/hooks/useAuth'
import { logAdminAction } from '@/lib/admin/audit-log'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'
import type { AuthStatus } from '@/hooks/useAuth'

export interface AdminCatalogueTabProps {
  readonly authStatus: AuthStatus
}

export function AdminCatalogueTab({ authStatus }: AdminCatalogueTabProps) {
  const [rows, setRows] = useState<ReadonlyArray<AdminProduct>>([])
  const [containers, setContainers] = useState<
    ReadonlyArray<AdminContainerOption>
  >([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<AdminProduct | null>(null)
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
      const client = createSupabaseBrowserClient(config) as CatalogueAdminClient
      try {
        const [products, containerRows] = await Promise.all([
          listProducts(client),
          listAdminContainers(client),
        ])
        setRows(products)
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

  async function toggleActive(row: AdminProduct): Promise<void> {
    if (!isConfigured) return
    setBusyId(row.id)
    const client = createSupabaseBrowserClient(config) as CatalogueAdminClient
    try {
      if (row.isActive) await softDeleteProduct(client, row.id)
      else await reactivateProduct(client, row.id)
      await logAdminAction(client, auth.user?.id ?? null, {
        action: row.isActive ? 'product.deactivate' : 'product.activate',
        target: row.id,
        extra: { sku: row.sku, name: row.name },
      })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    }
    setBusyId(null)
  }

  if (!isConfigured) {
    return (
      <div className="border-[color:var(--ochre)]/40 bg-[color:var(--ochre)]/10 rounded-md border p-6 text-sm">
        Supabase non configuré : impossible de charger le catalogue.
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
          Créer un produit
        </Button>
      </div>

      <div className="overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card">
        <div className="hidden border-b border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-4 py-2 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground md:grid md:grid-cols-[1.4fr_100px_70px_90px_90px_70px_220px] md:gap-3">
          <span>Produit</span>
          <span>Catégorie</span>
          <span>MOQ</span>
          <span className="text-right">Prix HT</span>
          <span>État</span>
          <span>Variantes</span>
          <span>Actions</span>
        </div>
        <div className="divide-[color:var(--sand-deep)]/70 divide-y">
          {loading ? (
            <div className="px-4 py-8 text-sm text-muted-foreground">
              Chargement…
            </div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-8 text-sm text-muted-foreground">
              Aucun produit.
            </div>
          ) : (
            rows.map((row) => {
              const busy = busyId === row.id
              return (
                <article
                  key={row.id}
                  className="grid gap-3 px-4 py-3 text-sm md:grid-cols-[1.4fr_100px_70px_90px_90px_70px_220px] md:items-center md:gap-3"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{row.name}</div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">
                      {row.sku}
                    </div>
                  </div>
                  <span className="rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-2 py-0.5 text-[11px]">
                    {CATEGORY_LABEL[row.category]}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {row.moqUnits}
                  </span>
                  <span className="font-medium tabular-nums md:text-right">
                    {row.basePriceHt.toFixed(2)} €
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
                  <span className="text-xs text-muted-foreground">
                    {row.variantsCount}
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
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {creating
                ? 'Nouveau produit'
                : `Éditer le produit ${editing?.sku ?? ''}`}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Formulaire administrateur pour gérer la fiche produit, les
              variantes et les engagements container.
            </DialogDescription>
          </DialogHeader>
          {(editing || creating) && (
            <AdminProductEditor
              productId={creating ? null : editing!.id}
              containers={containers}
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
            Les enregistrements passent par UPSERT Supabase. Les erreurs RLS
            apparaissent ici.
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
