import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'
import { accrueReservationCommission } from '@/lib/commission/ledger-server'
import {
  commissionsToCsv,
  listAllCommissions,
  setCommissionsStatus,
  summarizeByPartner,
  type CommissionAdminClient,
  type CommissionAdminRow,
} from '@/lib/commission/admin-repository'
import { logAdminAction } from '@/lib/admin/audit-log'
import { formatEUR } from '@/lib/order'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'
import type { CommissionStatus } from '@/lib/supabase/types'

function downloadCsv(filename: string, csv: string): void {
  if (typeof document === 'undefined') return
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function AdminCommissionsTab({
  authStatus,
}: {
  readonly authStatus: string
}) {
  const auth = useAuth()
  const [rows, setRows] = useState<ReadonlyArray<CommissionAdminRow>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [statusFilter, setStatusFilter] = useState<CommissionStatus | 'all'>(
    'all',
  )
  const [reservationId, setReservationId] = useState('')

  const config = useMemo(() => getSupabasePublicConfig(), [])
  const isConfigured = config.isConfigured

  const refresh = useMemo(() => {
    return async () => {
      if (!isConfigured) {
        setRows([])
        setLoading(false)
        return
      }
      setLoading(true)
      const client = createSupabaseBrowserClient(config) as CommissionAdminClient
      try {
        setRows(await listAllCommissions(client))
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

  const summary = useMemo(() => summarizeByPartner(rows), [rows])
  const filteredRows = useMemo(
    () =>
      statusFilter === 'all'
        ? rows
        : rows.filter((row) => row.status === statusFilter),
    [rows, statusFilter],
  )

  async function markPayablePaid(status: CommissionStatus): Promise<void> {
    if (!isConfigured) return
    const ids = filteredRows
      .filter((row) =>
        status === 'paid' ? row.status === 'payable' : row.status === 'accrued',
      )
      .map((row) => row.id)
    if (ids.length === 0) return
    setBusy(true)
    const client = createSupabaseBrowserClient(config) as CommissionAdminClient
    try {
      await setCommissionsStatus(client, ids, status)
      await logAdminAction(client, auth.user?.id ?? null, {
        action: 'commission.status_change',
        target: ids.join(','),
        previousValue: status === 'paid' ? 'payable' : 'accrued',
        nextValue: status,
        extra: { count: ids.length },
      })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    }
    setBusy(false)
  }

  async function generateAccrual(): Promise<void> {
    const id = reservationId.trim()
    if (!id) return
    setBusy(true)
    setNotice(null)
    try {
      const result = await accrueReservationCommission({
        data: { reservationId: id },
      })
      if (!result.ok) {
        setError(result.error)
      } else if (result.accrued) {
        setNotice(`Commission générée : ${formatEUR(result.amount)}.`)
        setReservationId('')
        await refresh()
      } else {
        setNotice(`Aucune commission : ${result.reason}.`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    }
    setBusy(false)
  }

  if (!isConfigured) {
    return (
      <div className="border-[color:var(--ochre)]/40 bg-[color:var(--ochre)]/10 rounded-md border p-6 text-sm">
        Supabase non configuré : le ledger de commissions n&apos;est pas
        consultable ici.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {authStatus !== 'authenticated' && (
        <div className="border-[color:var(--ochre)]/40 bg-[color:var(--ochre)]/10 rounded-md border p-3 text-xs text-foreground">
          Vous n&apos;êtes pas connecté en tant qu&apos;admin. Les actions seront
          refusées par RLS.
        </div>
      )}
      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-900">
          {error}
        </div>
      )}
      {notice && (
        <div className="border-[color:var(--forest)]/40 bg-[color:var(--forest)]/10 rounded-md border p-3 text-xs">
          {notice}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        8% du CA encaissé (HT) par client apporté, pendant 12 mois. Les écritures
        sont générées uniquement à l&apos;encaissement complet et ne sont jamais
        supprimées (annulation → écriture négative).
      </p>

      {/* Accrual trigger — the admin "encaissement complet" action. */}
      <div className="flex flex-wrap items-end gap-2 rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] p-3">
        <div>
          <label className="text-[11px] font-medium text-muted-foreground">
            Générer la commission (encaissement complet)
          </label>
          <Input
            value={reservationId}
            placeholder="UUID de la réservation encaissée"
            onChange={(e) => setReservationId(e.target.value)}
            className="mono mt-1 h-9 w-80 max-w-full text-xs"
          />
        </div>
        <Button
          size="sm"
          disabled={busy || reservationId.trim().length === 0}
          onClick={generateAccrual}
          className="h-9 text-xs"
        >
          Générer
        </Button>
      </div>

      {/* Per-apporteur summary */}
      {summary.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {summary.map((partner) => (
            <div
              key={partner.partnerCodeId}
              className="rounded-md border border-[color:var(--sand-deep)] bg-card p-3 text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-sm font-semibold">
                  {partner.companyName}
                </span>
                <span className="mono text-[11px] text-muted-foreground">
                  {partner.partnerCode}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1 text-center">
                <Metric label="Accrued" value={partner.accrued} />
                <Metric label="Payable" value={partner.payable} />
                <Metric label="Payé" value={partner.paid} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as CommissionStatus | 'all')
          }
          className="h-9 rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-2 text-xs"
        >
          <option value="all">Tous statuts</option>
          <option value="accrued">Accrued</option>
          <option value="payable">Payable</option>
          <option value="paid">Payé</option>
        </select>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => markPayablePaid('payable')}
          className="h-9 text-xs"
        >
          Accrued → Payable
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => markPayablePaid('paid')}
          className="h-9 text-xs"
        >
          Payable → Payé (lot)
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={rows.length === 0}
          onClick={() =>
            downloadCsv(
              `commissions-${new Date().toISOString().slice(0, 10)}.csv`,
              commissionsToCsv(filteredRows),
            )
          }
          className="h-9 text-xs"
        >
          Export CSV
        </Button>
      </div>

      {loading ? (
        <div className="rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] p-6 text-sm text-muted-foreground">
          Chargement…
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] p-6 text-sm text-muted-foreground">
          Aucune commission.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-[color:var(--sand-deep)]">
          <table className="w-full min-w-[720px] text-xs">
            <thead className="bg-[color:var(--sand-soft)] text-left text-muted-foreground">
              <tr>
                <th className="p-2">Apporteur</th>
                <th className="p-2">Réservation</th>
                <th className="p-2 text-right">Base HT</th>
                <th className="p-2 text-right">Montant</th>
                <th className="p-2">Statut</th>
                <th className="p-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-[color:var(--sand-deep)]"
                >
                  <td className="p-2">
                    <span className="mono">{row.partnerCode}</span>
                    <span className="text-muted-foreground"> · {row.companyName}</span>
                    {row.phase === 'reversal' && (
                      <span className="text-[color:var(--stamp)]"> (reversal)</span>
                    )}
                  </td>
                  <td className="mono p-2 text-[10px]">{row.reservationId}</td>
                  <td className="p-2 text-right">{formatEUR(row.baseAmountHt)}</td>
                  <td className="p-2 text-right font-semibold">
                    {formatEUR(row.amount)}
                  </td>
                  <td className="p-2">{row.status}</td>
                  <td className="p-2">
                    {new Date(row.accruedAt).toLocaleDateString('fr-FR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-sm bg-[color:var(--sand-soft)] px-1.5 py-1">
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mono text-[11px] font-semibold tabular-nums">
        {formatEUR(value)}
      </div>
    </div>
  )
}
