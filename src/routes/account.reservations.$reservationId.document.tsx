import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, Printer } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useAccountReservations } from '@/hooks/useAccountReservations'
import {
  ACCOUNT_RESERVATION_STATUS_LABEL,
  getAccountReservationById,
} from '@/lib/account/reservations'
import { formatEUR, formatEURprecise } from '@/lib/order'
import { buildSeoHead } from '@/lib/seo'

export const Route = createFileRoute(
  '/account/reservations/$reservationId/document',
)({
  component: ReservationDocumentPage,
  head: () =>
    buildSeoHead({
      title: 'Récapitulatif de réservation',
      description: 'Récapitulatif imprimable de votre réservation Container Club.',
      path: '/account/reservations',
      noindex: true,
    }),
})

function ReservationDocumentPage() {
  const { reservationId } = Route.useParams()
  const { reservations, loading, authStatus } = useAccountReservations()
  const reservation = getAccountReservationById(reservationId, reservations)

  if (loading && !reservation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-sm text-neutral-500">
        Chargement du récapitulatif…
      </div>
    )
  }

  if (!reservation) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-white px-6 text-center">
        <p className="text-sm text-neutral-600">
          {authStatus === 'authenticated'
            ? 'Réservation introuvable.'
            : 'Connectez-vous pour accéder à ce document.'}
        </p>
        <Link to="/account/reservations" className="text-sm underline">
          Mes réservations
        </Link>
      </div>
    )
  }

  const { draft } = reservation
  const { totals, payment, contact } = draft
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
                Récapitulatif de réservation
              </div>
              <h1 className="mt-1 font-display text-2xl font-semibold">
                Pros Import — Container Club
              </h1>
              <p className="mt-0.5 text-xs text-neutral-500">
                prosimport.com · Pros Import EURL · SIRET 98826998100011
              </p>
            </div>
            <div className="text-right text-xs text-neutral-600">
              <div className="font-mono text-sm font-semibold text-neutral-900">
                {draft.reference}
              </div>
              <div className="mt-1">Date : {dateFmt(reservation.updatedAt)}</div>
              <div>
                Statut : {ACCOUNT_RESERVATION_STATUS_LABEL[reservation.status]}
              </div>
            </div>
          </header>

          <div className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                Client
              </div>
              <div className="mt-1 font-medium">{contact.company}</div>
              <div className="text-neutral-600">SIRET {draft.siret}</div>
              {contact.email && (
                <div className="text-neutral-600">{contact.email}</div>
              )}
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                Container
              </div>
              <div className="mt-1 font-medium">{draft.containerReference}</div>
            </div>
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
              {draft.lines.map((line) => (
                <tr
                  key={`${line.productId}:${line.variantId}`}
                  className="border-b border-neutral-100"
                >
                  <td className="py-2">
                    <div className="font-medium">{line.productName}</div>
                    <div className="text-[11px] text-neutral-500">
                      {line.sku}
                      {line.variantName ? ` · ${line.variantName}` : ''}
                    </div>
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {line.quantity}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {formatEURprecise(line.unitPriceHt)}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {formatEUR(line.subtotalHt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 flex justify-end">
            <dl className="w-64 space-y-1 text-sm">
              <Row label="Sous-total HT" value={formatEUR(totals.subtotalHt)} />
              {totals.volumeDiscountAmount > 0 && (
                <Row
                  label="Remise volume"
                  value={`−${formatEUR(totals.volumeDiscountAmount)}`}
                />
              )}
              <Row
                label="Éco-participation"
                value={formatEURprecise(totals.ecoContributionTotal)}
              />
              <Row label="Total HT" value={formatEUR(totals.totalHt)} strong />
              <Row label="TVA 20%" value={formatEUR(totals.vat)} />
              <Row label="Total TTC" value={formatEUR(totals.totalTtc)} strong />
            </dl>
          </div>

          <div className="mt-6 rounded-sm border border-neutral-200 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              Échéancier de paiement
            </div>
            <dl className="mt-2 space-y-1 text-sm">
              <Row
                label="Frais de réservation"
                value={formatEUR(payment.reservationFee)}
              />
              <Row
                label="Acompte 30% (à l’atteinte du seuil)"
                value={formatEUR(payment.depositAmount)}
              />
              <Row
                label="Solde avant expédition"
                value={formatEUR(payment.balanceAmount)}
              />
              <Row
                label="Déjà réglé"
                value={formatEUR(reservation.paidAmount)}
                strong
              />
            </dl>
          </div>

          <footer className="mt-6 border-t border-neutral-200 pt-4 text-[11px] leading-5 text-neutral-500">
            <p>
              Document récapitulatif indicatif. La facture définitive (numérotée)
              est émise après règlement, conformément aux CGV. Prix publics HT,
              hors transport éventuel, sous réserve de disponibilité du container.
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
