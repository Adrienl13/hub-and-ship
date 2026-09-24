// Tuiles business de la vue générale : CA HT encaissé, réservations,
// comptes, conversion des demandes, demandes de contact par statut, et le
// détail des douze derniers mois. Lecture sous RLS admin via le client
// navigateur ; calculs dans lib/admin/overview.ts (testés).

import {
  Download,
  Euro,
  Handshake,
  MessageSquare,
  PackageCheck,
  ShoppingCart,
  Users,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Kpi } from '@/components/admin/Kpi'
import { Button } from '@/components/ui/button'
import { downloadCsv, toCsv } from '@/lib/admin/csv'
import {
  loadAdminBusiness,
  type AdminBusinessClient,
  type AdminBusinessKpis,
  type ContactRequestStatusKey,
  type MonthlyBusinessRow,
} from '@/lib/admin/overview'
import {
  CONTACT_REQUEST_STATUSES,
  CONTACT_REQUEST_STATUS_LABEL,
} from '@/lib/contact-requests/admin-repository'
import { formatEUR } from '@/lib/order'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'

// Le lexique des statuts vit dans le dépôt des demandes (singulier, pour la
// pastille d'une demande) ; ici on compte, donc on accorde au pluriel.
function pluralStatusLabel(
  status: ContactRequestStatusKey,
  count: number,
): string {
  const label = CONTACT_REQUEST_STATUS_LABEL[status]
  return count > 1 && !label.endsWith('s') ? `${label}s` : label
}

// Une demande est « ouverte » tant qu'elle n'est ni gagnée ni perdue.
const OPEN_CONTACT_STATUSES: ReadonlyArray<ContactRequestStatusKey> = [
  'new',
  'contacted',
  'quoted',
]

function percent(rate: number): string {
  return `${rate.toFixed(0)} %`
}

export function AdminOverviewKpis() {
  const config = useMemo(() => getSupabasePublicConfig(), [])
  const [kpis, setKpis] = useState<AdminBusinessKpis | null>(null)
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    if (!config.isConfigured) {
      setState('error')
      setMessage('Supabase non configuré sur cet environnement.')
      return
    }
    void (async () => {
      try {
        const client = createSupabaseBrowserClient(
          config,
        ) as unknown as AdminBusinessClient
        const next = await loadAdminBusiness(client)
        if (cancelled) return
        setKpis(next)
        setState('loaded')
      } catch (err) {
        if (cancelled) return
        setMessage(err instanceof Error ? err.message : 'erreur inconnue')
        setState('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [config])

  if (state === 'error') {
    return (
      <div className="border-[color:var(--ochre)]/40 bg-[color:var(--ochre)]/10 rounded-md border p-4 text-sm">
        <p>
          Indicateurs indisponibles : connectez-vous avec un compte
          administrateur ou réessayez.
        </p>
        {message && (
          <p className="mt-1 text-xs text-muted-foreground">{message}</p>
        )}
      </div>
    )
  }

  if (state === 'loading' || !kpis) {
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="bg-[color:var(--sand-soft)]/50 h-28 animate-pulse rounded-md border border-[color:var(--sand-deep)]"
          />
        ))}
      </div>
    )
  }

  const currentMonth = kpis.months.at(-1)
  // « Ouvertes » = new + contacted + quoted ; le Command Center, lui, ne
  // compte que les « à traiter » (new).
  const contactOpen = OPEN_CONTACT_STATUSES.reduce(
    (sum, status) => sum + kpis.contactRequestsByStatus[status],
    0,
  )

  return (
    <section aria-label="Indicateurs business" className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Kpi
          Icon={Euro}
          label="CA HT encaissé · 12 mois"
          value={formatEUR(kpis.revenueHt)}
          detail={`Panier moyen ${formatEUR(kpis.averageBasketHt)} HT · ${
            currentMonth ? formatEUR(currentMonth.revenueHt) : '—'
          } ce mois`}
        />
        <Kpi
          Icon={ShoppingCart}
          label="Réservations payées · 12 mois"
          value={`${kpis.paidReservations}`}
          detail={`${currentMonth?.reservations ?? 0} ce mois`}
        />
        <Kpi
          Icon={Users}
          label="Comptes créés · 12 mois"
          value={`${kpis.accountsCreated}`}
          detail={`${currentMonth?.accounts ?? 0} ce mois`}
        />
        <Kpi
          Icon={PackageCheck}
          label="Conversion demandes stock"
          value={percent(kpis.stockRequestConversion.rate)}
          detail={`${kpis.stockRequestConversion.won} converties sur ${kpis.stockRequestConversion.total}`}
        />
        <Kpi
          Icon={Handshake}
          label="Affaires partenaires gagnées"
          value={percent(kpis.partnerDealConversion.rate)}
          detail={`${kpis.partnerDealConversion.won} gagnées sur ${kpis.partnerDealConversion.total}`}
        />
        <Kpi
          Icon={MessageSquare}
          label="Demandes ouvertes"
          value={`${contactOpen}`}
          detail={
            kpis.contactRequestsTotal === 0
              ? 'Aucune demande en base'
              : CONTACT_REQUEST_STATUSES.map((status) => {
                  const count = kpis.contactRequestsByStatus[status]
                  return `${count} ${pluralStatusLabel(status, count).toLowerCase()}`
                }).join(' · ')
          }
        />
      </div>

      <MonthsTable months={kpis.months} />
    </section>
  )
}

function MonthsTable({
  months,
}: {
  readonly months: ReadonlyArray<MonthlyBusinessRow>
}) {
  const peak = Math.max(1, ...months.map((m) => m.revenueHt))
  const exportCsv = () => {
    downloadCsv(
      `terrassea-12-mois-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(months, [
        { header: 'Mois', value: (m) => m.month },
        { header: 'CA HT', value: (m) => m.revenueHt.toFixed(2) },
        { header: 'Réservations payées', value: (m) => m.reservations },
        { header: 'Comptes créés', value: (m) => m.accounts },
        { header: 'Demandes (stock + contact)', value: (m) => m.requests },
      ]),
    )
  }

  return (
    <div className="rounded-md border border-[color:var(--sand-deep)] bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-sm font-semibold">
            Les 12 derniers mois
          </h3>
          <p className="text-xs text-muted-foreground">
            CA HT des réservations payées, comptes créés et demandes reçues
            (stock 24h + contact), par mois.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-9 rounded-sm"
          onClick={exportCsv}
        >
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Export CSV
        </Button>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="py-1.5 pr-3 font-medium">Mois</th>
              <th className="py-1.5 pr-3 text-right font-medium">CA HT</th>
              <th className="py-1.5 pr-3 text-right font-medium">
                Réservations
              </th>
              <th className="py-1.5 pr-3 text-right font-medium">Comptes</th>
              <th className="py-1.5 pr-3 text-right font-medium">Demandes</th>
              <th className="py-1.5 font-medium" aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr
                key={m.month}
                className="border-t border-[color:var(--sand-deep)]"
              >
                <td className="whitespace-nowrap py-1.5 pr-3 capitalize">
                  {m.label}
                </td>
                <td className="py-1.5 pr-3 text-right tabular-nums">
                  {formatEUR(m.revenueHt)}
                </td>
                <td className="py-1.5 pr-3 text-right tabular-nums">
                  {m.reservations}
                </td>
                <td className="py-1.5 pr-3 text-right tabular-nums">
                  {m.accounts}
                </td>
                <td className="py-1.5 pr-3 text-right tabular-nums">
                  {m.requests}
                </td>
                <td className="w-1/4 py-1.5">
                  <div
                    className="h-2 rounded-sm bg-[color:var(--forest)]"
                    style={{ width: `${(m.revenueHt / peak) * 100}%` }}
                    aria-hidden="true"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
