// Grille d'édition en masse des prix nets partenaires — 3 canaux × tout le
// catalogue, sans ouvrir 165 fois l'éditeur produit. Écrit dans
// channel_price_overrides (la table lue par le catalogue et la réservation) ;
// le canal revendeur alimente aussi product_partner_prices pour garder le
// moteur get_price et son trigger plancher cohérents.

import { useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/hooks/useAuth'
import { logAdminAction } from '@/lib/admin/audit-log'
import {
  listAllChannelPriceOverrides,
  PARTNER_CHANNELS,
  saveChannelPriceOverrides,
  savePartnerNetPrice,
  type CatalogueAdminClient,
  type PartnerChannel,
} from '@/lib/catalogue-admin/repository'
import type {
  AdminPricingParameters,
  AdminProduct,
} from '@/lib/catalogue-admin/types'
import { computeLandedCostHt } from '@/lib/pricing/product-profit'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'

const CHANNEL_LABELS: Record<PartnerChannel, string> = {
  revendeur: 'Revendeur',
  distributeur: 'Distributeur',
  grand_compte: 'Grand compte',
}

type OverrideValues = Record<PartnerChannel, string>

function emptyValues(): OverrideValues {
  return { revendeur: '', distributeur: '', grand_compte: '' }
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function parsePrice(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number(value.trim().replace(',', '.'))
  return Number.isFinite(parsed) && parsed > 0 ? round2(parsed) : null
}

// Même dérivation que get_catalogue_prices v2 : coefficient issu des marges
// actives, borné par la règle d'or.
function channelDefault(
  channel: PartnerChannel,
  basePriceHt: number,
  params: AdminPricingParameters,
): number {
  const worstDirect = 1 - params.tier3Discount
  if (channel === 'grand_compte') return round2(basePriceHt * worstDirect)
  const channelMargin =
    channel === 'revendeur'
      ? params.resellerMarginRate
      : params.distributorMarginRate
  let coefficient =
    params.directMarginRate > -1
      ? Math.round(((1 + channelMargin) / (1 + params.directMarginRate)) * 10000) /
        10000
      : 1
  if (coefficient >= worstDirect) coefficient = worstDirect - 0.0001
  return round2(basePriceHt * coefficient)
}

export interface AdminPartnerPriceGridProps {
  readonly open: boolean
  readonly products: ReadonlyArray<AdminProduct>
  readonly parameters: AdminPricingParameters | null
  readonly onClose: () => void
  readonly onSaved: () => void | Promise<void>
}

export function AdminPartnerPriceGrid({
  open,
  products,
  parameters,
  onClose,
  onSaved,
}: AdminPartnerPriceGridProps) {
  const [values, setValues] = useState<Record<string, OverrideValues>>({})
  const [initial, setInitial] = useState<Record<string, OverrideValues>>({})
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const auth = useAuth()
  const config = useMemo(() => getSupabasePublicConfig(), [])

  const activeProducts = useMemo(
    () => products.filter((product) => product.isActive),
    [products],
  )

  useEffect(() => {
    if (!open || !config.isConfigured) return
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      const client = createSupabaseBrowserClient(config) as CatalogueAdminClient
      try {
        const overrides = await listAllChannelPriceOverrides(client)
        if (cancelled) return
        const next: Record<string, OverrideValues> = {}
        for (const product of activeProducts) {
          next[product.id] = emptyValues()
        }
        for (const override of overrides) {
          const entry = next[override.productId]
          if (entry) {
            entry[override.channel] = String(override.unitPriceHt)
          }
        }
        // Amorce revendeur depuis l'ancien prix net unique quand aucun
        // override n'existe encore (continuité avec l'éditeur produit).
        for (const product of activeProducts) {
          const entry = next[product.id]
          if (entry && !entry.revendeur && product.partnerNetPriceHt) {
            entry.revendeur = String(product.partnerNetPriceHt)
          }
        }
        setValues(next)
        setInitial(structuredClone(next))
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Erreur inconnue')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [open, config, activeProducts])

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fr-FR')
    if (!query) return activeProducts
    return activeProducts.filter((product) =>
      `${product.name} ${product.sku}`
        .toLocaleLowerCase('fr-FR')
        .includes(query),
    )
  }, [activeProducts, search])

  const dirtyProductIds = useMemo(() => {
    const dirty: string[] = []
    for (const product of activeProducts) {
      const current = values[product.id]
      const before = initial[product.id]
      if (!current || !before) continue
      const changed = PARTNER_CHANNELS.some(
        (channel) =>
          (parsePrice(current[channel]) ?? 0) !==
          (parsePrice(before[channel]) ?? 0),
      )
      if (changed) dirty.push(product.id)
    }
    return dirty
  }, [activeProducts, initial, values])

  // Cellules invalides (règle d'or) : bloquent l'enregistrement global.
  const violations = useMemo(() => {
    if (!parameters) return []
    const list: Array<{ sku: string; channel: PartnerChannel }> = []
    for (const product of activeProducts) {
      const current = values[product.id]
      if (!current) continue
      const worstDirect = round2(
        product.basePriceHt * (1 - parameters.tier3Discount),
      )
      for (const channel of PARTNER_CHANNELS) {
        if (channel === 'grand_compte') continue
        const price = parsePrice(current[channel])
        if (price !== null && price >= worstDirect) {
          list.push({ sku: product.sku, channel })
        }
      }
    }
    return list
  }, [activeProducts, parameters, values])

  function setCell(
    productId: string,
    channel: PartnerChannel,
    value: string,
  ): void {
    setValues((prev) => ({
      ...prev,
      [productId]: { ...(prev[productId] ?? emptyValues()), [channel]: value },
    }))
  }

  async function handleSave(): Promise<void> {
    if (!config.isConfigured || saving || dirtyProductIds.length === 0) return
    const firstViolation = violations[0]
    if (firstViolation) {
      setError(
        `Règle d'or violée sur ${violations.length} cellule(s) (ex. ${firstViolation.sku} ${CHANNEL_LABELS[firstViolation.channel]}) : corrigez avant d'enregistrer.`,
      )
      return
    }
    setSaving(true)
    setError(null)
    const client = createSupabaseBrowserClient(config) as CatalogueAdminClient
    let saved = 0
    try {
      for (const productId of dirtyProductIds) {
        const current = values[productId]
        if (!current) continue
        await saveChannelPriceOverrides(
          client,
          productId,
          PARTNER_CHANNELS.map((channel) => ({
            channel,
            unitPriceHt: parsePrice(current[channel]),
          })),
        )
        await savePartnerNetPrice(
          client,
          productId,
          parsePrice(current.revendeur),
          auth.user?.id ?? null,
        )
        saved += 1
      }
      await logAdminAction(client, auth.user?.id ?? null, {
        action: 'pricing.partner_grid_save',
        target: 'channel_price_overrides',
        extra: { products: saved },
      })
      toast.success(`Prix partenaires enregistrés (${saved} produits).`)
      setInitial(structuredClone(values))
      await onSaved()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      setError(
        `Arrêt après ${saved} produit(s) enregistré(s) : ${message}`,
      )
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  function exportCsv(): void {
    const header = [
      'sku',
      'produit',
      'prix_base_ht',
      'defaut_revendeur',
      'net_revendeur',
      'defaut_distributeur',
      'net_distributeur',
      'defaut_grand_compte',
      'net_grand_compte',
    ]
    const lines = activeProducts.map((product) => {
      const current = values[product.id] ?? emptyValues()
      const cells = [
        product.sku,
        product.name.replaceAll(';', ','),
        product.basePriceHt.toFixed(2),
      ]
      for (const channel of PARTNER_CHANNELS) {
        cells.push(
          parameters
            ? channelDefault(channel, product.basePriceHt, parameters).toFixed(2)
            : '',
          current[channel],
        )
      }
      return cells.join(';')
    })
    const blob = new Blob([[header.join(';'), ...lines].join('\n')], {
      type: 'text/csv;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'prix-partenaires.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Grille prix partenaires</DialogTitle>
          <DialogDescription>
            Prix nets par canal pour tout le catalogue. Vide = défaut (base ×
            coefficient des marges actives, affiché en filigrane). Revendeur et
            distributeur restent sous le pire prix direct (règle d&apos;or).
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-900">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Filtrer par nom ou SKU…"
            className="h-9 w-64 rounded-sm border border-[color:var(--sand-deep)] bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-foreground"
          />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              {dirtyProductIds.length} modification(s) en attente
              {violations.length > 0 && (
                <span className="ml-2 font-medium text-red-700">
                  · {violations.length} règle(s) d&apos;or violée(s)
                </span>
              )}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 rounded-sm"
              onClick={exportCsv}
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="px-2 py-8 text-sm text-muted-foreground">
            Chargement des prix par canal…
          </div>
        ) : (
          <div className="max-h-[52vh] overflow-auto rounded-sm border border-[color:var(--sand-deep)]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 bg-[color:var(--sand-soft)] text-left">
                <tr>
                  <th className="px-2 py-2 font-medium">Produit</th>
                  <th className="px-2 py-2 text-right font-medium">Base HT</th>
                  {PARTNER_CHANNELS.map((channel) => (
                    <th
                      key={channel}
                      className="px-2 py-2 text-right font-medium"
                    >
                      {CHANNEL_LABELS[channel]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => {
                  const current = values[product.id] ?? emptyValues()
                  const worstDirect = parameters
                    ? round2(
                        product.basePriceHt * (1 - parameters.tier3Discount),
                      )
                    : null
                  const landed = parameters
                    ? computeLandedCostHt(
                        product.fobUsd,
                        product.qtyPerContainer,
                        parameters,
                      )
                    : null
                  const floor =
                    landed !== null && parameters
                      ? round2(landed * (1 + parameters.minMarginFloor))
                      : null
                  return (
                    <tr
                      key={product.id}
                      className="border-t border-[color:var(--sand-deep)]"
                    >
                      <td className="max-w-56 px-2 py-1.5">
                        <div className="truncate font-medium">
                          {product.name}
                        </div>
                        <div className="font-mono text-[10px] text-muted-foreground">
                          {product.sku}
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {product.basePriceHt.toFixed(2)} €
                      </td>
                      {PARTNER_CHANNELS.map((channel) => {
                        const price = parsePrice(current[channel])
                        const golden =
                          channel !== 'grand_compte' &&
                          price !== null &&
                          worstDirect !== null &&
                          price >= worstDirect
                        const belowFloor =
                          !golden &&
                          price !== null &&
                          floor !== null &&
                          price < floor
                        const defaultPrice = parameters
                          ? channelDefault(
                              channel,
                              product.basePriceHt,
                              parameters,
                            )
                          : null
                        return (
                          <td key={channel} className="px-2 py-1.5">
                            <input
                              type="number"
                              step="0.01"
                              value={current[channel]}
                              placeholder={
                                defaultPrice !== null
                                  ? `déf. ${defaultPrice.toFixed(2)}`
                                  : ''
                              }
                              onChange={(event) =>
                                setCell(
                                  product.id,
                                  channel,
                                  event.target.value,
                                )
                              }
                              title={
                                golden
                                  ? `Règle d'or : doit rester sous ${worstDirect?.toFixed(2)} €`
                                  : belowFloor
                                    ? `Sous le plancher de marge (${floor?.toFixed(2)} €)`
                                    : undefined
                              }
                              className={`h-8 w-28 rounded-sm border bg-background px-2 text-right text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-foreground ${
                                golden
                                  ? 'border-red-400 bg-red-50'
                                  : belowFloor
                                    ? 'border-amber-400 bg-amber-50'
                                    : 'border-[color:var(--sand-deep)]'
                              }`}
                            />
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="rounded-sm"
            onClick={onClose}
            disabled={saving}
          >
            Fermer
          </Button>
          <Button
            type="button"
            className="rounded-sm"
            disabled={
              saving || dirtyProductIds.length === 0 || violations.length > 0
            }
            onClick={() => void handleSave()}
          >
            {saving
              ? 'Enregistrement…'
              : `Enregistrer (${dirtyProductIds.length} produits)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
