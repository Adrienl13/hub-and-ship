import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { AuthStatus } from '@/hooks/useAuth'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'
import { formatEUR } from '@/lib/order'
import {
  adminListReferralRedemptions,
  getReferralSettings,
  setRedemptionStatus,
  updateReferralSettings,
  type ReferralAdminClient,
  type ReferralRedemption,
  type ReferralSettings,
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
  const [settings, setSettings] = useState<ReferralSettings | null>(null)
  const [savingSettings, setSavingSettings] = useState(false)

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
      const [list, current] = await Promise.all([
        adminListReferralRedemptions(client),
        getReferralSettings(client),
      ])
      setRows(list)
      setSettings(current)
    } catch (err) {
      toast.error(
        'Lecture des parrainages impossible : ' +
          (err instanceof Error ? err.message : 'erreur'),
      )
    } finally {
      setLoading(false)
    }
  }, [])

  async function saveSettings(): Promise<void> {
    if (!settings) return
    const config = getSupabasePublicConfig()
    if (!config.isConfigured) return
    setSavingSettings(true)
    try {
      const client = createSupabaseBrowserClient(
        config,
      ) as unknown as ReferralAdminClient
      const saved = await updateReferralSettings(client, settings)
      setSettings(saved)
      toast.success('Réglages du parrainage enregistrés.')
    } catch (err) {
      toast.error(
        'Enregistrement impossible : ' +
          (err instanceof Error ? err.message : 'erreur'),
      )
    } finally {
      setSavingSettings(false)
    }
  }

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
      {settings && (
        <section className="space-y-3 rounded-md border border-[color:var(--sand-deep)] bg-card p-5">
          <h2 className="font-display text-sm font-semibold">
            Réglages du programme
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Remise filleul (€)
              </Label>
              <Input
                type="number"
                min={0}
                step="1"
                value={settings.referredDiscount}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    referredDiscount: Math.max(0, Number(e.target.value)),
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Gain parrain (€)
              </Label>
              <Input
                type="number"
                min={0}
                step="1"
                value={settings.referrerReward}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    referrerReward: Math.max(0, Number(e.target.value)),
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Utilisations max / code
              </Label>
              <Input
                type="number"
                min={1}
                step="1"
                value={settings.maxUsesPerCode}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    maxUsesPerCode: Math.max(1, Number(e.target.value)),
                  })
                }
              />
            </div>
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                checked={settings.isActive}
                onChange={(e) =>
                  setSettings({ ...settings, isActive: e.target.checked })
                }
              />
              <span>
                {settings.isActive
                  ? 'Programme actif'
                  : 'Programme désactivé'}
              </span>
            </label>
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              disabled={savingSettings}
              onClick={() => void saveSettings()}
            >
              {savingSettings ? 'Enregistrement…' : 'Enregistrer les réglages'}
            </Button>
          </div>
        </section>
      )}

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
