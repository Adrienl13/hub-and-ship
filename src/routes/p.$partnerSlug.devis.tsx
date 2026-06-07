import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Printer } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  normalizePartnerSlug,
  partnerDisplayNameFromSlug,
} from '@/lib/partners/link'
import {
  getPublicSelection,
  quoteReference,
  selectionEcoTotal,
  selectionPublicTotalHt,
  selectionTotalUnits,
  type PartnerSelectionsClient,
  type PublicSelection,
} from '@/lib/partners/selections'
import { CATEGORY_LABEL } from '@/lib/products'
import { formatEUR, formatEURprecise } from '@/lib/order'
import { buildSeoHead } from '@/lib/seo'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'

const VAT_RATE = 0.2
const VALIDITY_DAYS = 30

export const Route = createFileRoute('/p/$partnerSlug/devis')({
  component: PartnerQuotePage,
  validateSearch: (
    search: Record<string, unknown>,
  ): { readonly selection?: string } => ({
    selection:
      typeof search.selection === 'string' && search.selection.trim() !== ''
        ? search.selection
        : undefined,
  }),
  head: ({ params }) => {
    const slug = normalizePartnerSlug(params.partnerSlug) ?? 'partenaire'
    return buildSeoHead({
      title: `Devis ${partnerDisplayNameFromSlug(slug)}`,
      description: 'Devis co-brandé Pros Import.',
      path: `/p/${slug}/devis`,
      noindex: true,
    })
  },
})

function usePublicSelection(
  selectionId: string | undefined,
): PublicSelection | null | 'missing' {
  const [selection, setSelection] = useState<
    PublicSelection | null | 'missing'
  >(null)

  useEffect(() => {
    if (!selectionId) {
      setSelection('missing')
      return
    }
    const config = getSupabasePublicConfig()
    if (!config.isConfigured) return
    let cancelled = false
    void (async () => {
      try {
        const client = createSupabaseBrowserClient(
          config,
        ) as unknown as PartnerSelectionsClient
        const data = await getPublicSelection(client, selectionId)
        if (!cancelled) setSelection(data ?? 'missing')
      } catch {
        if (!cancelled) setSelection('missing')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectionId])

  return selection
}

function PartnerQuotePage() {
  const { partnerSlug } = Route.useParams()
  const { selection: selectionId } = Route.useSearch()
  const slug = normalizePartnerSlug(partnerSlug) ?? 'partenaire'
  const partnerName = partnerDisplayNameFromSlug(slug)
  const selection = usePublicSelection(selectionId)

  if (selection === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-sm text-neutral-500">
        Chargement du devis…
      </div>
    )
  }

  if (selection === 'missing') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-white px-6 text-center">
        <p className="text-sm text-neutral-600">
          Ce devis n'est pas disponible. La sélection doit être publiée par le
          partenaire.
        </p>
        <a href={`/p/${slug}`} className="text-sm font-medium underline">
          Voir la page partenaire
        </a>
      </div>
    )
  }

  const items = selection.items
  const subtotalHt = selectionPublicTotalHt(items)
  const ecoTotal = selectionEcoTotal(items)
  const totalHt = subtotalHt + ecoTotal
  const vat = totalHt * VAT_RATE
  const ttc = totalHt + vat
  const totalUnits = selectionTotalUnits(items)

  const now = new Date()
  const validUntil = new Date(now)
  validUntil.setDate(validUntil.getDate() + VALIDITY_DAYS)
  const dateFmt = (d: Date) => d.toLocaleDateString('fr-FR')

  return (
    <div className="min-h-screen bg-neutral-100 py-8 text-neutral-900 print:bg-white print:py-0">
      <style>{`@media print { @page { margin: 1.5cm; } body { background: white; } }`}</style>

      <div className="mx-auto max-w-3xl px-4 print:px-0">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <a href={`/p/${slug}?selection=${selectionId}`} className="text-sm underline">
            ← Retour à la sélection
          </a>
          <Button
            type="button"
            onClick={() => window.print()}
            className="h-10 rounded-sm bg-neutral-900 px-4 text-white"
          >
            <Printer className="h-4 w-4" />
            Imprimer / Enregistrer en PDF
          </Button>
        </div>

        <article className="rounded-md bg-white p-8 shadow-sm print:rounded-none print:p-0 print:shadow-none">
          <header className="flex items-start justify-between gap-6 border-b border-neutral-200 pb-5">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
                Devis co-brandé
              </div>
              <h1 className="mt-1 font-display text-2xl font-semibold">
                {partnerName}
              </h1>
              <p className="mt-0.5 text-xs text-neutral-500">
                Sélection préparée via Pros Import — Container Club
              </p>
            </div>
            <div className="text-right text-xs text-neutral-600">
              <div className="font-mono text-sm font-semibold text-neutral-900">
                {quoteReference(selection.id)}
              </div>
              <div className="mt-1">Date : {dateFmt(now)}</div>
              <div>Valable jusqu'au {dateFmt(validUntil)}</div>
            </div>
          </header>

          <div className="mt-5">
            <h2 className="font-display text-lg font-semibold">
              {selection.title}
            </h2>
            {selection.comment && (
              <p className="mt-1 text-sm text-neutral-600">{selection.comment}</p>
            )}
          </div>

          <table className="mt-5 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-300 text-left text-[11px] uppercase tracking-wide text-neutral-500">
                <th className="py-2">Produit</th>
                <th className="py-2 text-right">Qté</th>
                <th className="py-2 text-right">PU HT</th>
                <th className="py-2 text-right">Total HT</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const labels = CATEGORY_LABEL as Record<string, string>
                return (
                  <tr key={item.id} className="border-b border-neutral-100">
                    <td className="py-2">
                      <div className="font-medium">{item.snapshot.name}</div>
                      <div className="text-[11px] text-neutral-500">
                        {labels[item.snapshot.category] ??
                          item.snapshot.category}
                        {item.variantName ? ` · ${item.variantName}` : ''}
                      </div>
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {item.quantity}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatEURprecise(item.snapshot.basePriceHt)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatEUR(item.snapshot.basePriceHt * item.quantity)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div className="mt-4 flex justify-end">
            <dl className="w-64 space-y-1 text-sm">
              <Row label="Sous-total HT" value={formatEUR(subtotalHt)} />
              <Row label="Éco-participation" value={formatEURprecise(ecoTotal)} />
              <Row label="Total HT" value={formatEUR(totalHt)} strong />
              <Row label={`TVA ${VAT_RATE * 100}%`} value={formatEUR(vat)} />
              <Row label="Total TTC" value={formatEUR(ttc)} strong />
            </dl>
          </div>

          <footer className="mt-6 border-t border-neutral-200 pt-4 text-[11px] leading-5 text-neutral-500">
            <p>
              {totalUnits} unité{totalUnits > 1 ? 's' : ''}. Devis indicatif aux
              prix publics directs pros (HT), hors transport et hors options.
              Soumis à la disponibilité du container actif. Les conditions
              partenaires ne figurent pas sur ce document.
            </p>
            <p className="mt-2">
              Pros Import — Container Club · prosimport.com · Réservation et
              suivi sur la page partenaire.
            </p>
          </footer>
        </article>
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  strong,
}: {
  readonly label: string
  readonly value: string
  readonly strong?: boolean
}) {
  return (
    <div
      className={`flex justify-between ${
        strong ? 'font-semibold text-neutral-900' : 'text-neutral-600'
      }`}
    >
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}
