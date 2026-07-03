import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'
import { logAdminAction } from '@/lib/admin/audit-log'
import {
  listAllCompanies,
  updateCompanyChannel,
  type CompanyAdminClient,
  type CompanyAdminRow,
} from '@/lib/companies/admin-repository'
import { SALES_CHANNELS, SALES_CHANNEL_LABEL } from '@/lib/pricing/channel'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'
import type { SalesChannel } from '@/lib/supabase/types'

export function AdminCompaniesTab({
  authStatus,
}: {
  readonly authStatus: string
}) {
  const auth = useAuth()
  const [rows, setRows] = useState<ReadonlyArray<CompanyAdminRow>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [channelFilter, setChannelFilter] = useState<SalesChannel | 'all'>('all')
  const [search, setSearch] = useState('')

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
      const client = createSupabaseBrowserClient(config) as CompanyAdminClient
      try {
        setRows(await listAllCompanies(client))
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

  async function setChannel(
    row: CompanyAdminRow,
    channel: SalesChannel,
  ): Promise<void> {
    if (!isConfigured || channel === row.channel) return
    setBusyId(row.id)
    const client = createSupabaseBrowserClient(config) as CompanyAdminClient
    try {
      await updateCompanyChannel(client, row.id, channel)
      await logAdminAction(client, auth.user?.id ?? null, {
        action: 'company.channel_change',
        target: row.id,
        previousValue: row.channel,
        nextValue: channel,
        extra: { company: row.legalName },
      })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    }
    setBusyId(null)
  }

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (channelFilter !== 'all' && row.channel !== channelFilter) return false
      if (!needle) return true
      return (
        row.legalName.toLowerCase().includes(needle) ||
        (row.tradingName?.toLowerCase().includes(needle) ?? false) ||
        (row.siret?.includes(needle) ?? false)
      )
    })
  }, [rows, channelFilter, search])

  if (!isConfigured) {
    return (
      <div className="border-[color:var(--ochre)]/40 bg-[color:var(--ochre)]/10 rounded-md border p-6 text-sm">
        Supabase non configuré : les comptes ne sont pas consultables ici.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {authStatus !== 'authenticated' && (
        <div className="border-[color:var(--ochre)]/40 bg-[color:var(--ochre)]/10 rounded-md border p-3 text-xs text-foreground">
          Vous n&apos;êtes pas connecté en tant qu&apos;admin. Les changements de
          canal seront refusés par RLS + trigger.
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-900">
          {error}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Le canal est un attribut de compte attribué par l&apos;admin uniquement.
        Il détermine la grille tarifaire résolue côté serveur pour ce compte.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          placeholder="Rechercher raison sociale / SIRET"
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 max-w-xs text-xs"
        />
        <select
          value={channelFilter}
          onChange={(e) =>
            setChannelFilter(e.target.value as SalesChannel | 'all')
          }
          className="h-9 rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-2 text-xs"
        >
          <option value="all">Tous canaux</option>
          {SALES_CHANNELS.map((channel) => (
            <option key={channel} value={channel}>
              {SALES_CHANNEL_LABEL[channel]}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">
          {filteredRows.length} / {rows.length}
        </span>
      </div>

      {loading ? (
        <div className="rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] p-6 text-sm text-muted-foreground">
          Chargement…
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] p-6 text-sm text-muted-foreground">
          Aucun compte.
        </div>
      ) : (
        <div className="space-y-2">
          {filteredRows.map((row) => (
            <div
              key={row.id}
              className="rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-sm font-semibold">
                      {row.legalName}
                    </span>
                    {row.isVerified && (
                      <span className="text-[10px] text-[color:var(--forest)]">
                        ✓ vérifié
                      </span>
                    )}
                  </div>
                  <div className="mono text-[11px] text-muted-foreground">
                    {row.siret ?? '— SIRET'}
                    {row.channelSetAt
                      ? ` · canal posé le ${new Date(row.channelSetAt).toLocaleDateString('fr-FR')}`
                      : ''}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {SALES_CHANNELS.map((channel) => {
                    const active = channel === row.channel
                    return (
                      <Button
                        key={channel}
                        size="sm"
                        variant={active ? 'default' : 'outline'}
                        disabled={busyId === row.id || active}
                        onClick={() => setChannel(row, channel)}
                        className="h-8 text-xs"
                      >
                        {SALES_CHANNEL_LABEL[channel]}
                      </Button>
                    )
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
