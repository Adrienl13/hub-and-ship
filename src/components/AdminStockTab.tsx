import { useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Power, PowerOff } from 'lucide-react'

import { AdminStockEditor } from '@/components/AdminStockEditor'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/hooks/useAuth'
import { useCatalog } from '@/hooks/useCatalog'
import { logAdminAction } from '@/lib/admin/audit-log'
import {
  listAdminContainers,
  listProducts,
  type CatalogueAdminClient,
} from '@/lib/catalogue-admin/repository'
import type {
  AdminContainerOption,
  AdminProduct,
} from '@/lib/catalogue-admin/types'
import {
  deactivateStockLine,
  listAllStockLines,
  reactivateStockLine,
  type AdminStockLineRow,
  type StockAdminClient,
} from '@/lib/stock-admin/repository'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'
import type { AuthStatus } from '@/hooks/useAuth'

const CONDITION_LABEL: Record<AdminStockLineRow['condition'], string> = {
  new: 'Neuf',
  opened_box: 'Carton ouvert',
  showroom: 'Exposition',
}

export interface AdminStockTabProps {
  readonly authStatus: AuthStatus
}

export function AdminStockTab({ authStatus }: AdminStockTabProps) {
  const [rows, setRows] = useState<ReadonlyArray<AdminStockLineRow>>([])
  const [products, setProducts] = useState<ReadonlyArray<AdminProduct>>([])
  const [containers, setContainers] = useState<
    ReadonlyArray<AdminContainerOption>
  >([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<AdminStockLineRow | null>(null)
  const [creating, setCreating] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const auth = useAuth()
  const { products: catalogProducts } = useCatalog()
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
      const client = createSupabaseBrowserClient(config) as StockAdminClient
      try {
        const [stock, productList, containerList] = await Promise.all([
          listAllStockLines(client),
          listProducts(client),
          listAdminContainers(client as unknown as CatalogueAdminClient),
        ])
        setRows(stock)
        setProducts(productList)
        setContainers(containerList)
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

  async function toggleActive(row: AdminStockLineRow): Promise<void> {
    if (!isConfigured) return
    setBusyId(row.id)
    const client = createSupabaseBrowserClient(config) as StockAdminClient
    try {
      if (row.isActive) await deactivateStockLine(client, row.id)
      else await reactivateStockLine(client, row.id)
      await logAdminAction(client, auth.user?.id ?? null, {
        action: row.isActive ? 'stock_line.deactivate' : 'stock_line.activate',
        target: row.id,
      })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    }
    setBusyId(null)
  }

  // Catalogue lookup for the table render — we want to show the product
  // name + variant from the live catalogue rather than just IDs.
  const productMap = useMemo(() => {
    const map = new Map<string, (typeof catalogProducts)[number]>()
    for (const p of catalogProducts) map.set(p.id, p)
    return map
  }, [catalogProducts])

  if (!isConfigured) {
    return (
      <div className="border-[color:var(--ochre)]/40 bg-[color:var(--ochre)]/10 rounded-md border p-6 text-sm">
        Supabase non configuré : impossible de charger le stock.
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
          Ajouter une référence
        </Button>
      </div>

      <div className="overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card">
        <div className="hidden border-b border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-4 py-2 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground md:grid md:grid-cols-[1.5fr_90px_80px_110px_140px_80px_200px] md:gap-3">
          <span>Produit / Design</span>
          <span className="text-right">Dispo</span>
          <span className="text-right">Réservé</span>
          <span className="text-right">Prix HT</span>
          <span>État / Lieu</span>
          <span>Statut</span>
          <span>Actions</span>
        </div>
        <div className="divide-[color:var(--sand-deep)]/70 divide-y">
          {loading ? (
            <div className="px-4 py-8 text-sm text-muted-foreground">
              Chargement…
            </div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-8 text-sm text-muted-foreground">
              Aucune référence en stock.
            </div>
          ) : (
            rows.map((row) => {
              const product = productMap.get(row.productId)
              const variant = product?.variants.find(
                (v) => v.id === row.variantId,
              )
              const busy = busyId === row.id
              return (
                <article
                  key={row.id}
                  className="grid gap-3 px-4 py-3 text-sm md:grid-cols-[1.5fr_90px_80px_110px_140px_80px_200px] md:items-center md:gap-3"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {product?.name ?? row.productId}
                    </div>
                    <div className="mt-1 truncate text-xs text-muted-foreground">
                      {variant?.name ?? row.variantId} · {row.id}
                    </div>
                  </div>
                  <span className="text-right font-medium tabular-nums">
                    {row.availableUnits}
                  </span>
                  <span className="text-right tabular-nums text-muted-foreground">
                    {row.reservedUnits}
                  </span>
                  <span className="text-right font-medium tabular-nums">
                    {row.stockPriceHt.toFixed(2)} €
                  </span>
                  <div className="text-xs text-muted-foreground">
                    <div>{CONDITION_LABEL[row.condition]}</div>
                    <div className="mt-0.5 text-[10px]">{row.location}</div>
                  </div>
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
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {creating
                ? 'Nouvelle référence stock'
                : `Éditer ${editing?.id ?? ''}`}
            </DialogTitle>
          </DialogHeader>
          {(editing || creating) && (
            <AdminStockEditor
              line={creating ? null : editing}
              products={products}
              containers={containers}
              onProductCreated={refresh}
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
