import { useCallback, useEffect, useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import type { AuthStatus } from '@/hooks/useAuth'
import { downloadCsv, toCsv } from '@/lib/admin/csv'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'
import {
  adminListNotifyLeads,
  type NotifyAdminClient,
  type NotifyLead,
} from '@/lib/leads/repository'

export function AdminLeadsTab({ authStatus }: { authStatus: AuthStatus }) {
  const [leads, setLeads] = useState<ReadonlyArray<NotifyLead>>([])
  const [loading, setLoading] = useState(true)

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
      ) as unknown as NotifyAdminClient
      setLeads(await adminListNotifyLeads(client))
    } catch (err) {
      toast.error(
        'Lecture des prospects impossible : ' +
          (err instanceof Error ? err.message : 'erreur'),
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authStatus === 'authenticated') void refresh()
  }, [authStatus, refresh])

  function exportCsv(): void {
    downloadCsv(
      'prospects-container.csv',
      toCsv(leads, [
        { header: 'email', value: (l: NotifyLead) => l.email },
        { header: 'source', value: (l: NotifyLead) => l.source },
        { header: 'created_at', value: (l: NotifyLead) => l.createdAt },
      ]),
    )
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-[color:var(--sand-deep)] bg-card p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Chargement des prospects…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">
          Prospects « prochain container » ({leads.length})
        </h2>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => void refresh()}>
            Rafraîchir
          </Button>
          <Button
            type="button"
            size="sm"
            className="gap-1.5"
            disabled={leads.length === 0}
            onClick={exportCsv}
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {leads.length === 0 ? (
        <div className="rounded-md border border-[color:var(--sand-deep)] bg-card p-6 text-sm text-muted-foreground">
          Aucun prospect pour le moment.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[color:var(--sand-deep)] text-left text-xs text-muted-foreground">
                <th className="px-2 py-2">Email</th>
                <th className="px-2 py-2">Source</th>
                <th className="px-2 py-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr
                  key={lead.id}
                  className="border-b border-[color:var(--sand-deep)]/60"
                >
                  <td className="px-2 py-2">{lead.email}</td>
                  <td className="px-2 py-2 text-xs text-muted-foreground">
                    {lead.source ?? '—'}
                  </td>
                  <td className="px-2 py-2 text-xs text-muted-foreground">
                    {new Date(lead.createdAt).toLocaleDateString('fr-FR')}
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
