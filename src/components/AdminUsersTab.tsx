import { useEffect, useMemo, useState } from 'react'
import { Handshake, Shield, ShieldOff, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'
import { logAdminAction } from '@/lib/admin/audit-log'
import {
  linkUserToPartner,
  listLinkableApplications,
  listPartnerLinks,
  unlinkUserFromPartner,
  type LinkableApplication,
  type PartnerLink,
  type PartnerLinksClient,
} from '@/lib/admin/partner-links.repository'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'
import type { AuthStatus } from '@/hooks/useAuth'
import type { Database, UserRole } from '@/lib/supabase/types'

type UserRow = Database['public']['Tables']['users_profile']['Row']

interface AdminUserRow {
  readonly id: string
  readonly email: string
  readonly firstName: string | null
  readonly lastName: string | null
  readonly role: UserRole
  readonly lastLoginAt: string | null
  readonly createdAt: string
}

function toRow(row: UserRow): AdminUserRow {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    role: row.role,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
  }
}

const ROLE_LABEL: Record<UserRole, string> = {
  buyer: 'Acheteur',
  admin: 'Admin',
  super_admin: 'Super admin',
}

const ROLE_STYLE: Record<UserRole, string> = {
  buyer: 'bg-[color:var(--sand-deep)] text-foreground/70',
  admin: 'bg-[color:var(--forest)]/15 text-[color:var(--forest)]',
  super_admin: 'bg-[color:var(--ember)]/15 text-[color:var(--ember)]',
}

export interface AdminUsersTabProps {
  readonly authStatus: AuthStatus
}

export function AdminUsersTab({ authStatus }: AdminUsersTabProps) {
  const [rows, setRows] = useState<ReadonlyArray<AdminUserRow>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all')
  const [partnerLinks, setPartnerLinks] = useState<
    ReadonlyMap<string, PartnerLink>
  >(new Map())
  const [linkableApps, setLinkableApps] = useState<
    ReadonlyArray<LinkableApplication>
  >([])

  const auth = useAuth()
  const currentUserId = auth.user?.id ?? null

  const config = useMemo(() => getSupabasePublicConfig(), [])
  const isConfigured = config.isConfigured

  const refresh = useMemo(() => {
    return async () => {
      if (!isConfigured) {
        setRows([])
        setError('Supabase non configuré.')
        setLoading(false)
        return
      }
      setLoading(true)
      const client = createSupabaseBrowserClient(config)
      const { data, error: queryError } = await client
        .from('users_profile')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)
      if (queryError) {
        setError(queryError.message)
      } else {
        setError(null)
        setRows(((data ?? []) as ReadonlyArray<UserRow>).map(toRow))
      }

      // Partner links are best-effort: never block the user list on them.
      try {
        const linkClient = client as unknown as PartnerLinksClient
        const [links, apps] = await Promise.all([
          listPartnerLinks(linkClient),
          listLinkableApplications(linkClient),
        ])
        setPartnerLinks(new Map(links.map((l) => [l.userId, l])))
        setLinkableApps(apps)
      } catch {
        /* ignore */
      }

      setLoading(false)
    }
  }, [config, isConfigured])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function setRole(row: AdminUserRow, nextRole: UserRole): Promise<void> {
    if (!isConfigured) return
    if (
      !window.confirm(
        nextRole === 'admin'
          ? `Promouvoir ${row.email} en admin ? Cet utilisateur aura accès au back-office.`
          : `Rétrograder ${row.email} en acheteur ? Cet utilisateur perdra l'accès admin.`,
      )
    ) {
      return
    }
    setBusyId(row.id)
    const client = createSupabaseBrowserClient(config)
    const { error: updateError } = await client
      .from('users_profile')
      .update({ role: nextRole } as never)
      .eq('id', row.id)
    if (updateError) {
      setError(updateError.message)
    } else {
      await logAdminAction(client, currentUserId, {
        action: 'user.role_change',
        target: row.id,
        previousValue: row.role,
        nextValue: nextRole,
        extra: { email: row.email },
      })
      await refresh()
    }
    setBusyId(null)
  }

  async function linkPartner(
    row: AdminUserRow,
    applicationId: string,
  ): Promise<void> {
    if (!isConfigured || !applicationId) return
    setBusyId(row.id)
    const browser = createSupabaseBrowserClient(config)
    try {
      await linkUserToPartner(
        browser as unknown as PartnerLinksClient,
        row.id,
        applicationId,
      )
      await logAdminAction(browser, currentUserId, {
        action: 'partner_user.link',
        target: row.id,
        nextValue: applicationId,
        extra: { email: row.email },
      })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    }
    setBusyId(null)
  }

  async function unlinkPartner(
    row: AdminUserRow,
    link: PartnerLink,
  ): Promise<void> {
    if (!isConfigured) return
    if (!window.confirm(`Délier ${row.email} de ${link.companyName} ?`)) return
    setBusyId(row.id)
    const browser = createSupabaseBrowserClient(config)
    try {
      await unlinkUserFromPartner(
        browser as unknown as PartnerLinksClient,
        row.id,
        link.applicationId,
      )
      await logAdminAction(browser, currentUserId, {
        action: 'partner_user.unlink',
        target: row.id,
        previousValue: link.applicationId,
        extra: { email: row.email },
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
      if (roleFilter !== 'all' && row.role !== roleFilter) return false
      if (!needle) return true
      return (
        row.email.toLowerCase().includes(needle) ||
        (row.firstName?.toLowerCase().includes(needle) ?? false) ||
        (row.lastName?.toLowerCase().includes(needle) ?? false)
      )
    })
  }, [rows, search, roleFilter])

  if (!isConfigured) {
    return (
      <div className="border-[color:var(--ochre)]/40 bg-[color:var(--ochre)]/10 rounded-md border p-6 text-sm">
        Supabase non configuré : impossible de charger les utilisateurs.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {authStatus !== 'authenticated' && (
        <div className="border-[color:var(--ochre)]/40 bg-[color:var(--ochre)]/10 rounded-md border p-3 text-xs text-foreground">
          Vous n&apos;êtes pas connecté en tant qu&apos;admin. Les actions de
          changement de rôle seront refusées par RLS.
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-900">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          placeholder="Rechercher email / prénom / nom"
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 max-w-xs text-xs"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as UserRole | 'all')}
          className="h-9 rounded-md border border-input bg-transparent px-2 text-xs"
        >
          <option value="all">Tous rôles</option>
          {(['buyer', 'admin', 'super_admin'] as UserRole[]).map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground">
          {filteredRows.length} / {rows.length}
        </span>
      </div>

      <div className="overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card">
        <div className="hidden border-b border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-4 py-2 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground md:grid md:grid-cols-[1.6fr_1fr_140px_180px_220px] md:gap-3">
          <span>Email / Nom</span>
          <span>Créé</span>
          <span>Rôle</span>
          <span>Dernière connexion</span>
          <span>Actions</span>
        </div>
        <div className="divide-[color:var(--sand-deep)]/70 divide-y">
          {loading ? (
            <div className="px-4 py-8 text-sm text-muted-foreground">
              Chargement…
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="px-4 py-8 text-sm text-muted-foreground">
              Aucun utilisateur.
            </div>
          ) : (
            filteredRows.map((row) => {
              const fullName = [row.firstName, row.lastName]
                .filter(Boolean)
                .join(' ')
              const busy = busyId === row.id
              const isSelf = currentUserId === row.id
              const link = partnerLinks.get(row.id)
              return (
                <article
                  key={row.id}
                  className="grid gap-3 px-4 py-3 text-sm md:grid-cols-[1.6fr_1fr_140px_180px_220px] md:items-center md:gap-3"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{row.email}</div>
                    {fullName && (
                      <div className="mt-1 truncate text-xs text-muted-foreground">
                        {fullName}
                      </div>
                    )}
                    {link ? (
                      <div className="mt-1 flex items-center gap-1.5 text-xs">
                        <Handshake className="h-3 w-3 text-[color:var(--forest)]" />
                        <span className="truncate text-[color:var(--forest)]">
                          {link.companyName}
                        </span>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void unlinkPartner(row, link)}
                          className="text-muted-foreground hover:text-red-700"
                          aria-label="Délier le partenaire"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      linkableApps.length > 0 && (
                        <select
                          value=""
                          disabled={busy}
                          onChange={(e) => void linkPartner(row, e.target.value)}
                          className="mt-1 h-7 max-w-[180px] rounded-sm border border-input bg-transparent px-1 text-[11px] text-muted-foreground"
                          aria-label="Lier à un partenaire"
                        >
                          <option value="">Lier à un partenaire…</option>
                          {linkableApps.map((app) => (
                            <option key={app.id} value={app.id}>
                              {app.companyName}
                            </option>
                          ))}
                        </select>
                      )
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {row.createdAt.slice(0, 10)}
                  </span>
                  <span
                    className={`inline-flex w-fit items-center rounded-sm px-2 py-0.5 text-[11px] font-medium ${ROLE_STYLE[row.role]}`}
                  >
                    {ROLE_LABEL[row.role]}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {row.lastLoginAt
                      ? row.lastLoginAt.slice(0, 16).replace('T', ' ')
                      : '—'}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {row.role === 'super_admin' ? (
                      <span className="text-xs text-muted-foreground">
                        Géré en BD
                      </span>
                    ) : isSelf ? (
                      <span className="text-xs text-muted-foreground">
                        Vous-même
                      </span>
                    ) : row.role === 'buyer' ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5 rounded-sm"
                        disabled={busy}
                        onClick={() => void setRole(row, 'admin')}
                      >
                        <Shield className="h-3.5 w-3.5" />
                        Promouvoir admin
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5 rounded-sm"
                        disabled={busy}
                        onClick={() => void setRole(row, 'buyer')}
                      >
                        <ShieldOff className="h-3.5 w-3.5" />
                        Rétrograder
                      </Button>
                    )}
                  </div>
                </article>
              )
            })
          )}
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Les changements de rôle prennent effet à la prochaine connexion de
        l&apos;utilisateur (la session active conserve son JWT jusqu&apos;à
        expiration).
      </p>
    </div>
  )
}
