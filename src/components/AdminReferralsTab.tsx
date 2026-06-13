import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import type { AuthStatus } from '@/hooks/useAuth'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'
import { formatEUR } from '@/lib/order'
import {
  adminListReferralRedemptions,
  setRedemptionStatus,
  type ReferralAdminClient,
  type ReferralRedemption,
} from '@/lib/referrals/repository'

const STATUS_LABEL: Record<ReferralRedemption['rewardStatus'], string> = {
  pending: 'En attente',
  honored: 'Honoré',
  cancelled: 'Annulé',
}

export function AdminReferralsTab({ authStatus }: { authStatus: AuthStatus }) {
  const [rows, setRows] = useState<ReadonlyArray<ReferralRedemption>>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const config = getSupabasePublicConfig()
    if (!config.isConfigured) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const client = createSupabaseBrowserClient(
        config,
      ) as unknown as ReferralAdminClient
      setRows(await adminListReferralRedemptions(client))
    } catch (err) {
      toast.error(
        'Lecture des parrainages impossible : ' +
          (err instanceof Error ? err.message : 'erreur'),
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authStatus === 'authenticated') void refresh()
  }, [authStatus, refresh])

  async function mark(
    id: string,
    status: ReferralRedemption['rewardStatus'],
  ): Promise<void> {
    const config = getSupabasePublicConfig()
    if (!config.isConfigured) return
    setBusyId(id)
    try {
      const client = createSupabaseBrowserClient(
        config,
      ) as unknown as ReferralAdminClient
      await setRedemptionStatus(client, id, status)
      toast.success(status === 'honored' ? 'Marqué honoré.' : 'Mis à jour.')
      await refresh()
    } catch (err) {
      toast.error(
        'Action impossible : ' +
          (err instanceof Error ? err.message : 'erreur'),
      )
    } finally {
      setBusyId(null)
    }
  }

  const pendingTotal = rows
    .filter((r) => r.rewardStatus === 'pending')
    .reduce((sum, r) => sum + r.referrerReward, 0)

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-[color:var(--sand-deep)] bg-card p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Chargement des parrainages…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">
          Parrainages{' '}
          {pendingTotal > 0 && (
            <span className="ml-1 rounded-sm bg-[color:var(--ember)] px-2 py-0.5 text-xs text-white">
              {formatEUR(pendingTotal)} à honorer
            </span>
          )}
        </h2>
        <Button type="button" size="sm" variant="outline" onClick={() => void refresh()}>
          Rafraîchir
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-md border border-[color:var(--sand-deep)] bg-card p-6 text-sm text-muted-foreground">
          Aucun parrainage pour le moment.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[color:var(--sand-deep)] text-left text-xs text-muted-foreground">
                <th className="px-2 py-2">Parrain</th>
                <th className="px-2 py-2">Filleul</th>
                <th className="px-2 py-2">Réservation</th>
                <th className="px-2 py-2">Gain</th>
                <th className="px-2 py-2">Statut</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-[color:var(--sand-deep)]/60"
                >
                  <td className="px-2 py-2">
                    {r.referrerLabel ?? '—'}
                    <div className="text-[11px] text-muted-foreground">
                      {r.code}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-xs">{r.referredEmail ?? '—'}</td>
                  <td className="px-2 py-2 text-xs">{r.reservationRef ?? '—'}</td>
                  <td className="px-2 py-2 tabular-nums">
                    {formatEUR(r.referrerReward)}
                  </td>
                  <td className="px-2 py-2 text-xs">
                    {STATUS_LABEL[r.rewardStatus]}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex justify-end gap-2">
                      {r.rewardStatus !== 'honored' && (
                        <Button
                          type="button"
                          size="sm"
                          disabled={busyId === r.id}
                          onClick={() => void mark(r.id, 'honored')}
                        >
                          Marquer honoré
                        </Button>
                      )}
                      {r.rewardStatus === 'pending' && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busyId === r.id}
                          onClick={() => void mark(r.id, 'cancelled')}
                        >
                          Annuler
                        </Button>
                      )}
                    </div>
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
