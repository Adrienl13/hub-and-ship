import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Printer } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  listInvoicesForReservation,
  type Invoice,
  type InvoicesClient,
} from '@/lib/account/invoices'
import { formatEUR } from '@/lib/order'
import { buildSeoHead } from '@/lib/seo'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'

export const Route = createFileRoute(
  '/account/reservations/$reservationId/facture/$invoiceId',
)({
  component: InvoicePage,
  head: () =>
    buildSeoHead({
      title: 'Facture',
      description: 'Facture Container Club.',
      path: '/account/reservations',
      noindex: true,
    }),
})

function InvoicePage() {
  const { reservationId, invoiceId } = Route.useParams()
  const config = useMemo(() => getSupabasePublicConfig(), [])
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [state, setState] = useState<'loading' | 'loaded' | 'missing'>(
    'loading',
  )

  useEffect(() => {
    if (!config.isConfigured) {
      setState('missing')
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const client = createSupabaseBrowserClient(
          config,
        ) as unknown as InvoicesClient
        const invoices = await listInvoicesForReservation(client, reservationId)
        const found = invoices.find((i) => i.id === invoiceId) ?? null
        if (!cancelled) {
          setInvoice(found)
          setState(found ? 'loaded' : 'missing')
        }
      } catch {
        if (!cancelled) setState('missing')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [config, reservationId, invoiceId])

  if (state === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-sm text-neutral-500">
        Chargement de la facture…
      </div>
    )
  }

  if (state === 'missing' || !invoice) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-white px-6 text-center">
        <p className="text-sm text-neutral-600">
          Facture introuvable ou accès non autorisé.
        </p>
        <Link
          to="/account/reservations/$reservationId"
          params={{ reservationId }}
          className="text-sm underline"
        >
          Retour à la réservation
        </Link>
      </div>
    )
  }

  const snap = invoice.snapshot
  const company = snap.contact?.company ?? '—'
  const dateFmt = (iso: string) => new Date(iso).toLocaleDateString('fr-FR')

  return (
    <div className="min-h-screen bg-neutral-100 py-8 text-neutral-900 print:bg-white print:py-0">
      <style>{`@media print { @page { margin: 1.5cm; } body { background: white; } }`}</style>

      <div className="mx-auto max-w-3xl px-4 print:px-0">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <Link
            to="/account/reservations/$reservationId"
            params={{ reservationId }}
            className="inline-flex items-center gap-1 text-sm underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à la réservation
          </Link>
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
                Facture
              </div>
              <h1 className="mt-1 font-mono text-2xl font-semibold">
                {invoice.number}
              </h1>
              <p className="mt-1 text-xs text-neutral-500">
                Émise le {dateFmt(invoice.issuedAt)}
                {invoice.status === 'cancelled' ? ' · ANNULÉE' : ''}
              </p>
            </div>
            <div className="text-right text-xs leading-5 text-neutral-600">
              <div className="font-semibold text-neutral-900">
                Pros Import EURL
              </div>
              <div>60 Rue François Ier, 75008 Paris</div>
              <div>SIRET 98826998100011</div>
              <div>TVA FR08988269981</div>
              <div>RCS Paris 988 269 981</div>
            </div>
          </header>

          <div className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                Facturé à
              </div>
              <div className="mt-1 font-medium">{company}</div>
              {snap.siret && (
                <div className="text-neutral-600">SIRET {snap.siret}</div>
              )}
              {snap.contact?.email && (
                <div className="text-neutral-600">{snap.contact.email}</div>
              )}
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                Réservation
              </div>
              <div className="mt-1 font-medium">{snap.reference ?? '—'}</div>
              <div className="text-neutral-600">
                Container {snap.container_reference ?? '—'}
              </div>
            </div>
          </div>

          <table className="mt-6 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-300 text-left text-[11px] uppercase tracking-wide text-neutral-500">
                <th className="py-2">Désignation</th>
                <th className="py-2 text-right">Montant HT</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-neutral-100">
                <td className="py-2">
                  Réservation mobilier CHR par container —{' '}
                  {snap.reference ?? invoice.number}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {formatEUR(invoice.subtotalHt)}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="mt-4 flex justify-end">
            <dl className="w-64 space-y-1 text-sm">
              <Row label="Total HT" value={formatEUR(invoice.subtotalHt)} />
              <Row
                label={`TVA ${invoice.vatRate}%`}
                value={formatEUR(invoice.vatAmount)}
              />
              <Row
                label="Total TTC"
                value={formatEUR(invoice.totalTtc)}
                strong
              />
            </dl>
          </div>

          <footer className="mt-8 border-t border-neutral-200 pt-4 text-[10px] leading-5 text-neutral-500">
            <p>
              Paiement à réception. En cas de retard, pénalités au taux de trois
              fois le taux d'intérêt légal et indemnité forfaitaire de
              recouvrement de 40 € (art. L441-10 et D441-5 du Code de commerce).
              Pas d'escompte pour paiement anticipé. TVA acquittée sur les
              débits.
            </p>
            <p className="mt-2">
              Pros Import EURL — Container Club · prosimport.com ·
              adrienlaniez1@gmail.com
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
