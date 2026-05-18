import { createFileRoute } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import {
  ArrowLeft,
  CreditCard,
  FileText,
  PackageCheck,
  Ship,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  ACCOUNT_RESERVATION_STATUS_LABEL,
  getAccountReservationById,
} from '@/lib/account/reservations'
import { formatEUR } from '@/lib/order'

export const Route = createFileRoute('/account/reservations/$reservationId')({
  component: AccountReservationDetailPage,
})

function AccountReservationDetailPage() {
  const { reservationId } = Route.useParams()
  const reservation = getAccountReservationById(reservationId)

  if (!reservation) {
    return (
      <main className="min-h-screen bg-background px-6 py-10 text-foreground">
        <div className="mx-auto max-w-3xl">
          <Button asChild variant="outline">
            <a href="/account/reservations">
              <ArrowLeft className="h-4 w-4" />
              Retour
            </a>
          </Button>
          <h1 className="mt-8 font-display text-3xl tracking-tight">
            Réservation introuvable
          </h1>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-[color:var(--sand-deep)] bg-[color:var(--sand)]/85">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <a href="/account/reservations" className="inline-flex items-center gap-2 text-sm">
            <ArrowLeft className="h-4 w-4" />
            Mes réservations
          </a>
          <Button asChild size="sm" variant="outline" className="h-9 rounded-sm">
            <a href="/catalogue">Catalogue</a>
          </Button>
        </div>
      </header>

      <section className="border-b border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="label-eyebrow text-[color:var(--ember)]">
            Réservation
          </div>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-4xl tracking-tight">
                {reservation.draft.reference}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {reservation.draft.contact.company} · {reservation.draft.siret}
              </p>
            </div>
            <span className="inline-flex h-8 items-center rounded-sm border border-[color:var(--ochre)]/30 bg-[color:var(--ochre)]/10 px-3 text-xs font-medium">
              {ACCOUNT_RESERVATION_STATUS_LABEL[reservation.status]}
            </span>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-12">
        <aside className="lg:col-span-4">
          <div className="space-y-3">
            <InfoBlock
              icon={<Ship className="h-4 w-4" />}
              label="Container"
              value={reservation.draft.containerReference}
              detail={reservation.nextActionLabel}
            />
            <InfoBlock
              icon={<CreditCard className="h-4 w-4" />}
              label="Paiement"
              value={formatEUR(reservation.draft.payment.payNow)}
              detail={`${formatEUR(reservation.paidAmount)} déjà réglé`}
            />
            <InfoBlock
              icon={<FileText className="h-4 w-4" />}
              label="Documents"
              value="Facture à venir"
              detail="Fiche technique et conformité à rattacher après auth"
            />
          </div>
        </aside>

        <div className="lg:col-span-8">
          <div className="overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card">
            <div className="border-b border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <PackageCheck className="h-4 w-4" />
                Lignes réservées
              </div>
            </div>
            <div className="divide-y divide-[color:var(--sand-deep)]/70">
              {reservation.draft.lines.map((line) => (
                <div
                  key={`${line.productId}:${line.variantId}`}
                  className="grid gap-2 px-4 py-4 text-sm md:grid-cols-[1fr_90px_120px_120px] md:items-center"
                >
                  <div>
                    <div className="font-medium">{line.productName}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {line.sku} · {line.variantName}
                    </div>
                  </div>
                  <div className="tabular-nums">{line.quantity} unités</div>
                  <div className="tabular-nums text-muted-foreground">
                    {line.cbmTotal.toFixed(2)} m³
                  </div>
                  <div className="font-medium tabular-nums md:text-right">
                    {formatEUR(line.subtotalHt)}
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-4 py-4 text-sm">
              <div className="ml-auto max-w-sm space-y-2">
                <AmountRow label="Total HT" value={reservation.draft.totals.subtotalHt} />
                <AmountRow label="TVA" value={reservation.draft.totals.vat} />
                <AmountRow
                  label="Total TTC"
                  value={reservation.draft.totals.totalTtc}
                  strong
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

function InfoBlock({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="rounded-md border border-[color:var(--sand-deep)] bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <span className="label-eyebrow">{label}</span>
      </div>
      <div className="mt-2 font-medium">{value}</div>
      <div className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</div>
    </div>
  )
}

function AmountRow({
  label,
  value,
  strong,
}: {
  label: string
  value: number
  strong?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className={strong ? 'font-medium' : 'text-muted-foreground'}>
        {label}
      </span>
      <span
        className={`tabular-nums ${strong ? 'font-display text-xl font-semibold' : 'font-medium'}`}
      >
        {formatEUR(value)}
      </span>
    </div>
  )
}
