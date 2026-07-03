import { Link } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { FileText, Printer } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { formatEUR } from '@/lib/order'
import { PRODUCTS } from '@/lib/products'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'

interface PriceRow {
  readonly productId: string
  readonly name: string
  readonly unitPriceHt: number
}

export function RevendeurDashboard() {
  const [prices, setPrices] = useState<ReadonlyArray<PriceRow>>([])
  const [loading, setLoading] = useState(true)

  const nameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const product of PRODUCTS) map.set(product.id, product.name)
    return map
  }, [])

  useEffect(() => {
    const config = getSupabasePublicConfig()
    if (!config.isConfigured) {
      setLoading(false)
      return
    }
    let cancelled = false
    const client = createSupabaseBrowserClient(config)
    void (async () => {
      try {
        const { data } = await client.rpc('get_catalogue_prices')
        if (cancelled) return
        const rows = (
          (data ?? []) as ReadonlyArray<{
            product_id: string
            unit_price_ht: number
          }>
        ).map((row) => ({
          productId: row.product_id,
          name: nameById.get(row.product_id) ?? row.product_id,
          unitPriceHt: Number(row.unit_price_ht),
        }))
        setPrices(rows)
      } catch {
        // Degrade gracefully to the empty-state message; a partner never sees
        // a raw error for a read-only grid.
        if (!cancelled) setPrices([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [nameById])

  return (
    <div className="space-y-6">
      <div>
        <span className="mono text-[11px] uppercase tracking-[0.14em] text-[color:var(--ink-soft)]">
          Espace revendeur
        </span>
        <h1 className="mt-1 font-display text-2xl font-black tracking-tight">
          Votre grille &amp; votre RFA
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Votre grille tarifaire revendeur, résolue côté serveur. Elle ne
          transite jamais en clair pour un autre canal.
        </p>
      </div>

      {/* RFA progress */}
      <div className="rounded-lg border border-[color:var(--sand-deep)] bg-card p-5">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-[color:var(--ember)]" />
          <span className="text-sm font-medium">Ristourne de fin d’année (RFA)</span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] p-3 text-sm">
            <b>3%</b> dès 1 container cumulé (année en cours)
          </div>
          <div className="rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] p-3 text-sm">
            <b>5%</b> dès 2 containers cumulés
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Versée en janvier sur le CA encaissé. Le cumul s’affiche ici dès votre
          première commande de l’année.
        </p>
      </div>

      {/* Pricing grid */}
      <div className="rounded-lg border border-[color:var(--sand-deep)] bg-card p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="text-sm font-medium">Grille tarifaire revendeur</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.print()}
            className="h-8 gap-1.5 text-xs"
          >
            <Printer className="h-3.5 w-3.5" />
            Imprimer / PDF
          </Button>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : prices.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Grille indisponible hors ligne (Supabase requis). Elle vous est
            communiquée après validation de votre statut.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-xs">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="p-2">Produit</th>
                  <th className="p-2 text-right">Prix revendeur HT</th>
                </tr>
              </thead>
              <tbody>
                {prices.map((row) => (
                  <tr
                    key={row.productId}
                    className="border-t border-[color:var(--sand-deep)]"
                  >
                    <td className="p-2">{row.name}</td>
                    <td className="p-2 text-right font-semibold tabular-nums">
                      {formatEUR(row.unitPriceHt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Link
        to="/account/reservations"
        className="inline-flex items-center rounded-sm border border-[color:var(--sand-deep)] px-4 py-2 text-sm hover:bg-[color:var(--sand-soft)]"
      >
        Historique de mes commandes →
      </Link>
    </div>
  )
}
