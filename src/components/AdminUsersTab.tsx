import { useEffect, useMemo, useState } from 'react'
import {
  Download,
  Handshake,
  RefreshCw,
  Shield,
  ShieldOff,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth, type AuthStatus } from '@/hooks/useAuth'
import { logAdminAction } from '@/lib/admin/audit-log'
import { downloadCsv, toCsv } from '@/lib/admin/csv'
import {
  formatAdminDate,
  formatAdminDateTime,
  telHref,
} from '@/lib/admin/format'
import {
  linkUserToPartner,
  listLinkableApplications,
  listPartnerLinks,
  unlinkUserFromPartner,
  type LinkableApplication,
  type PartnerLink,
  type PartnerLinksClient,
} from '@/lib/admin/partner-links.repository'
import { SALES_CHANNEL_LABEL } from '@/lib/pricing/channel'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'
import type { SalesChannel, UserRole } from '@/lib/supabase/types'

// Fiche client 360° côté admin : le profil (users_profile) joint à son
// établissement (companies via company_id, migration 57) — canal tarifaire,
// SIRET, téléphone, consentement marketing daté, dernière connexion (désormais
// alimentée par le déclencheur on_auth_user_signed_in) et inscription.

const USERS_SELECT =
  'id, email, first_name, last_name, phone, role, last_login_at, email_marketing_consent, email_marketing_consent_at, cgv_version_accepted, created_at, companies:company_id(legal_name, trading_name, channel, siret, siret_verified)'

interface CompanyJoinRaw {
  readonly legal_name: string
  readonly trading_name: string | null
  readonly channel: SalesChannel
  readonly siret: string | null
  readonly siret_verified: boolean
}

interface UserJoinRaw {
  readonly id: string
  readonly email: string
  readonly first_name: string | null
  readonly last_name: string | null
  readonly phone: string | null
  readonly role: UserRole
  readonly last_login_at: string | null
  readonly email_marketing_consent: boolean | null
  readonly email_marketing_consent_at: string | null
  readonly cgv_version_accepted: string | null
  readonly created_at: string
  // PostgREST renvoie l'objet joint (FK simple) ; on reste tolérant à un
  // tableau comme pour partner_users.
  readonly companies?: CompanyJoinRaw | ReadonlyArray<CompanyJoinRaw> | null
}

interface QueryResult<T> {
  readonly data: T | null
  readonly error: { readonly message: string } | null
}

// Surface étroite du client navigateur : la jointure n'est pas décrite dans
// les types Database, on caste à l'appel comme les autres dépôts admin.
export interface AdminUsersClient {
  from: (table: 'users_profile') => {
    select: (columns: string) => {
      order: (
        column: 'created_at',
        options: { readonly ascending: boolean },
      ) => {
        limit: (
          count: number,
        ) => PromiseLike<QueryResult<ReadonlyArray<UserJoinRaw>>>
      }
    }
  }
}

export interface AdminUserCompany {
  readonly legalName: string
  readonly tradingName: string | null
  readonly channel: SalesChannel
  readonly siret: string | null
  readonly siretVerified: boolean
}

export interface AdminUserRow {
  readonly id: string
  readonly email: string
  readonly firstName: string | null
  readonly lastName: string | null
  readonly phone: string | null
  readonly role: UserRole
  readonly lastLoginAt: string | null
  readonly marketingConsent: boolean
  readonly marketingConsentAt: string | null
  readonly cgvVersionAccepted: string | null
  readonly createdAt: string
  readonly company: AdminUserCompany | null
}

function toCompany(
  raw: UserJoinRaw['companies'] | undefined,
): AdminUserCompany | null {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value || typeof value !== 'object') return null
  const company = value as CompanyJoinRaw
  return {
    legalName: company.legal_name,
    tradingName: company.trading_name,
    channel: company.channel,
    siret: company.siret,
    siretVerified: Boolean(company.siret_verified),
  }
}

export function toAdminUserRow(row: UserJoinRaw): AdminUserRow {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    role: row.role,
    lastLoginAt: row.last_login_at,
    marketingConsent: Boolean(row.email_marketing_consent),
    marketingConsentAt: row.email_marketing_consent_at,
    cgvVersionAccepted: row.cgv_version_accepted,
    createdAt: row.created_at,
    company: toCompany(row.companies),
  }
}

export async function adminListUsers(
  client: AdminUsersClient,
): Promise<ReadonlyArray<AdminUserRow>> {
  const { data, error } = await client
    .from('users_profile')
    .select(USERS_SELECT)
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) throw new Error(error.message)
  return (data ?? []).map(toAdminUserRow)
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

// Formats partagés (lib/admin/format) ; un tiret quand la date est absente.
function formatDate(iso: string | null): string {
  return iso ? formatAdminDate(iso) : '—'
}

function formatDateTime(iso: string | null): string {
  return iso ? formatAdminDateTime(iso) : '—'
}

function companyDisplayName(company: AdminUserCompany): string {
  return company.tradingName && company.tradingName !== company.legalName
    ? `${company.tradingName} (${company.legalName})`
    : company.legalName
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
  const [consentFilter, setConsentFilter] = useState<'all' | 'yes' | 'no'>(
    'all',
  )
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
      try {
        setRows(await adminListUsers(client as unknown as AdminUsersClient))
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue')
      }

      // Les liens partenaires sont optionnels : ils ne bloquent jamais la liste.
      try {
        const linkClient = client as unknown as PartnerLinksClient
        const [links, apps] = await Promise.all([
          listPartnerLinks(linkClient),
          listLinkableApplications(linkClient),
        ])
        setPartnerLinks(new Map(links.map((l) => [l.userId, l])))
        setLinkableApps(apps)
      } catch {
        /* ignorer */
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
      if (consentFilter === 'yes' && !row.marketingConsent) return false
      if (consentFilter === 'no' && row.marketingConsent) return false
      if (!needle) return true
      return [
        row.email,
        row.firstName ?? '',
        row.lastName ?? '',
        row.phone ?? '',
        row.company?.legalName ?? '',
        row.company?.tradingName ?? '',
        row.company?.siret ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    })
  }, [rows, search, roleFilter, consentFilter])

  function exportCsv(): void {
    downloadCsv(
      `utilisateurs-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(filteredRows, [
        { header: 'Email', value: (r) => r.email },
        { header: 'Prénom', value: (r) => r.firstName ?? '' },
        { header: 'Nom', value: (r) => r.lastName ?? '' },
        { header: 'Téléphone', value: (r) => r.phone ?? '' },
        { header: 'Établissement', value: (r) => r.company?.legalName ?? '' },
        {
          header: 'Nom commercial',
          value: (r) => r.company?.tradingName ?? '',
        },
        {
          header: 'Canal',
          value: (r) =>
            r.company ? SALES_CHANNEL_LABEL[r.company.channel] : '',
        },
        { header: 'SIRET', value: (r) => r.company?.siret ?? '' },
        {
          header: 'SIRET vérifié',
          value: (r) => (r.company?.siretVerified ? 'oui' : 'non'),
        },
        { header: 'Rôle', value: (r) => ROLE_LABEL[r.role] },
        {
          header: 'Consentement marketing',
          value: (r) => (r.marketingConsent ? 'oui' : 'non'),
        },
        {
          header: 'Consentement le',
          value: (r) => formatAdminDate(r.marketingConsentAt),
        },
        { header: 'CGV acceptées', value: (r) => r.cgvVersionAccepted ?? '' },
        {
          header: 'Dernière connexion',
          value: (r) => formatAdminDateTime(r.lastLoginAt),
        },
        { header: 'Inscription', value: (r) => formatAdminDate(r.createdAt) },
        {
          header: 'Partenaire lié',
          value: (r) => partnerLinks.get(r.id)?.companyName ?? '',
        },
      ]),
    )
  }

  if (!isConfigured) {
    return (
      <div className="border-[color:var(--ochre)]/40 bg-[color:var(--ochre)]/10 rounded-md border p-6 text-sm">
        Supabase non configuré : impossible de charger les utilisateurs.
      </div>
    )
  }

  const consentCount = rows.filter((row) => row.marketingConsent).length
  const hasActiveFilter =
    search.trim() !== '' || roleFilter !== 'all' || consentFilter !== 'all'

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
          placeholder="Rechercher email / nom / établissement / SIRET"
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 max-w-xs text-xs"
          aria-label="Rechercher un utilisateur"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as UserRole | 'all')}
          className="h-9 rounded-md border border-input bg-transparent px-2 text-xs"
          aria-label="Filtrer par rôle"
        >
          <option value="all">Tous rôles</option>
          {(['buyer', 'admin', 'super_admin'] as UserRole[]).map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
        <select
          value={consentFilter}
          onChange={(e) =>
            setConsentFilter(e.target.value as 'all' | 'yes' | 'no')
          }
          className="h-9 rounded-md border border-input bg-transparent px-2 text-xs"
          aria-label="Filtrer par consentement marketing"
        >
          <option value="all">Consentement : tous</option>
          <option value="yes">Consentement marketing</option>
          <option value="no">Sans consentement</option>
        </select>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void refresh()}
          disabled={loading}
          className="h-9 gap-1.5 px-2 text-xs"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Rafraîchir
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={filteredRows.length === 0}
          onClick={exportCsv}
          className="h-9 gap-1.5 px-2 text-xs"
        >
          <Download className="h-3.5 w-3.5" />
          Exporter CSV
        </Button>
        <span className="text-xs text-muted-foreground">
          {filteredRows.length} / {rows.length} · {consentCount} consentement
          {consentCount > 1 ? 's' : ''} marketing
        </span>
      </div>

      <div className="overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card">
        <div className="hidden border-b border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-4 py-2 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground lg:grid lg:grid-cols-[1.6fr_1.3fr_150px_170px_110px_200px] lg:gap-3">
          <span>Contact</span>
          <span>Établissement</span>
          <span>Marketing</span>
          <span>Connexion / inscription</span>
          <span>Rôle</span>
          <span>Actions</span>
        </div>
        <div className="divide-[color:var(--sand-deep)]/70 divide-y">
          {loading ? (
            <div className="px-4 py-8 text-sm text-muted-foreground">
              Chargement…
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="px-4 py-8 text-sm text-muted-foreground">
              {hasActiveFilter
                ? 'Aucun utilisateur ne correspond aux filtres.'
                : 'Aucun utilisateur.'}
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
                  className="grid gap-3 px-4 py-3 text-sm lg:grid-cols-[1.6fr_1.3fr_150px_170px_110px_200px] lg:items-start lg:gap-3"
                >
                  <div className="min-w-0">
                    <a
                      href={`mailto:${row.email}`}
                      className="block truncate font-medium hover:underline"
                    >
                      {row.email}
                    </a>
                    {fullName && (
                      <div className="mt-1 truncate text-xs text-muted-foreground">
                        {fullName}
                      </div>
                    )}
                    {row.phone ? (
                      <a
                        href={telHref(row.phone)}
                        className="mt-1 block text-xs text-[color:var(--ember)] hover:underline"
                      >
                        {row.phone}
                      </a>
                    ) : (
                      <div className="mt-1 text-xs text-muted-foreground">
                        Téléphone non renseigné
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
                          onChange={(e) =>
                            void linkPartner(row, e.target.value)
                          }
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

                  <div className="min-w-0 text-xs">
                    {row.company ? (
                      <>
                        <div className="truncate font-medium">
                          {companyDisplayName(row.company)}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-muted-foreground">
                          <span className="inline-flex items-center rounded-sm border border-[color:var(--sand-deep)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                            {SALES_CHANNEL_LABEL[row.company.channel]}
                          </span>
                          <span className="font-mono text-[11px]">
                            {row.company.siret ?? 'SIRET à compléter'}
                          </span>
                          {row.company.siretVerified && (
                            <span className="text-[10px] text-[color:var(--forest)]">
                              ✓ vérifié
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <span className="text-muted-foreground">
                        Aucun établissement rattaché
                      </span>
                    )}
                  </div>

                  <div className="text-xs">
                    {row.marketingConsent ? (
                      <>
                        <div className="font-medium text-[color:var(--forest)]">
                          Consentement
                        </div>
                        <div className="mt-0.5 text-muted-foreground">
                          le {formatDate(row.marketingConsentAt)}
                        </div>
                      </>
                    ) : (
                      <span className="text-muted-foreground">
                        Sans consentement
                      </span>
                    )}
                    {row.cgvVersionAccepted && (
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        CGV {row.cgvVersionAccepted}
                      </div>
                    )}
                  </div>

                  <div className="text-xs text-muted-foreground">
                    <div>
                      <span className="text-[10px] uppercase tracking-wide">
                        Connexion
                      </span>{' '}
                      {formatDateTime(row.lastLoginAt)}
                    </div>
                    <div className="mt-0.5">
                      <span className="text-[10px] uppercase tracking-wide">
                        Inscrit
                      </span>{' '}
                      {formatDate(row.createdAt)}
                    </div>
                  </div>

                  <span
                    className={`inline-flex w-fit items-center rounded-sm px-2 py-0.5 text-[11px] font-medium ${ROLE_STYLE[row.role]}`}
                  >
                    {ROLE_LABEL[row.role]}
                  </span>

                  <div className="flex flex-wrap gap-2">
                    {row.role === 'super_admin' ? (
                      <span className="text-xs text-muted-foreground">
                        Rôle géré en base
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
        expiration). Le canal tarifaire se change dans l&apos;onglet Comptes.
      </p>
    </div>
  )
}
