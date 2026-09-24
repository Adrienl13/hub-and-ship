import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Banknote,
  Boxes,
  ClipboardList,
  Clock,
  ExternalLink,
  Handshake,
  Inbox,
  LogIn,
  Package,
  RefreshCw,
  Send,
  UserPlus,
  type LucideIcon,
} from 'lucide-react'

import { Kpi } from '@/components/admin/Kpi'
import { Button } from '@/components/ui/button'
import {
  CUSTOMER_EVENT_KIND_LABEL,
  CUSTOMER_TAB_LABEL,
  buildCustomerFile,
  customerTabHref,
  formatHt,
  loadCustomerFile,
  type CustomerEventKind,
  type CustomerFile as CustomerFileModel,
  type CustomerFileClient,
  isBusinessInteraction,
  type CustomerFileData,
  type CustomerProfile,
} from '@/lib/admin/customer-file'
import {
  formatAdminDate,
  formatAdminDateTime,
  telHref,
} from '@/lib/admin/format'
import { SALES_CHANNEL_LABEL } from '@/lib/pricing/channel'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'

// Panneau « Fiche client » déplié sous une ligne de l'onglet Utilisateurs :
// en-tête de contact, quatre indicateurs, chronologie de tout ce que le
// contact a laissé (demandes, réservations, stock 24h, candidature, relances,
// inscription, dernière connexion) avec renvoi vers l'onglet concerné.

const EVENT_ICON: Record<CustomerEventKind, LucideIcon> = {
  contact_request: Inbox,
  reservation: Package,
  stock_request: Boxes,
  partner_application: Handshake,
  follow_up: Send,
  signup: UserPlus,
  last_login: LogIn,
}

function companyLabel(company: CustomerProfile['company']): string {
  if (!company) return 'Aucun établissement rattaché'
  return company.tradingName && company.tradingName !== company.legalName
    ? `${company.tradingName} (${company.legalName})`
    : company.legalName
}

export interface CustomerFileProps {
  readonly userId: string
  readonly email: string
  readonly profile: CustomerProfile
}

type FileState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | {
      readonly status: 'ready'
      readonly data: CustomerFileData
      readonly file: CustomerFileModel
    }

export function CustomerFile({ userId, email, profile }: CustomerFileProps) {
  const [state, setState] = useState<FileState>({ status: 'loading' })
  const config = useMemo(() => getSupabasePublicConfig(), [])

  const load = useCallback(async () => {
    if (!config.isConfigured) {
      setState({ status: 'error', message: 'Supabase non configuré.' })
      return
    }
    setState({ status: 'loading' })
    try {
      const client = createSupabaseBrowserClient(
        config,
      ) as unknown as CustomerFileClient
      const data = await loadCustomerFile(client, { userId, email })
      setState({
        status: 'ready',
        data,
        file: buildCustomerFile(data, profile),
      })
    } catch (err) {
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Erreur inconnue',
      })
    }
  }, [config, userId, email, profile])

  useEffect(() => {
    void load()
  }, [load])

  const fullName = [profile.firstName, profile.lastName]
    .filter(Boolean)
    .join(' ')

  return (
    <section
      aria-label={`Fiche client ${email}`}
      className="border-[color:var(--sand-deep)]/70 bg-[color:var(--sand-soft)]/40 border-t px-4 py-4 text-sm"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-display text-lg font-semibold">
            {fullName || 'Nom non renseigné'}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {companyLabel(profile.company)}
            {profile.company && (
              <span className="ml-1.5 inline-flex items-center rounded-sm border border-[color:var(--sand-deep)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                {SALES_CHANNEL_LABEL[profile.company.channel]}
              </span>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs">
            <a href={`mailto:${email}`} className="font-medium hover:underline">
              {email}
            </a>
            {profile.phone ? (
              <a
                href={telHref(profile.phone)}
                className="text-[color:var(--ember)] hover:underline"
              >
                {profile.phone}
              </a>
            ) : (
              <span className="text-muted-foreground">
                Téléphone non renseigné
              </span>
            )}
          </div>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <dt className="text-[10px] uppercase tracking-wide">Marketing</dt>
          <dd>
            {profile.marketingConsent
              ? `Consentement le ${formatAdminDate(profile.marketingConsentAt) || '—'}`
              : 'Sans consentement'}
          </dd>
          <dt className="text-[10px] uppercase tracking-wide">Inscrit</dt>
          <dd>{formatAdminDate(profile.createdAt)}</dd>
          <dt className="text-[10px] uppercase tracking-wide">Connexion</dt>
          <dd>
            {profile.lastLoginAt
              ? formatAdminDateTime(profile.lastLoginAt)
              : 'Jamais connecté'}
          </dd>
        </dl>
      </header>

      {state.status === 'loading' && (
        <p className="mt-4 text-xs text-muted-foreground" role="status">
          Chargement de la fiche…
        </p>
      )}

      {state.status === 'error' && (
        <div
          role="alert"
          className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-900"
        >
          <span>Impossible de charger la fiche client : {state.message}</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 px-2 text-xs"
            onClick={() => void load()}
          >
            <RefreshCw className="h-3 w-3" />
            Réessayer
          </Button>
        </div>
      )}

      {state.status === 'ready' && (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              Icon={Inbox}
              label="Demandes ouvertes"
              value={`${state.file.summary.openContactRequests}`}
              detail={`${state.data.contactRequests.length} demande${state.data.contactRequests.length > 1 ? 's' : ''} au total`}
            />
            <Kpi
              Icon={ClipboardList}
              label="Réservations"
              value={`${state.file.summary.reservations}`}
              detail="Tous statuts, brouillons compris"
            />
            <Kpi
              Icon={Banknote}
              label="CA HT encaissé"
              value={formatHt(state.file.summary.paidRevenueHt)}
              detail="Réservations dont les frais sont payés"
            />
            <Kpi
              Icon={Clock}
              label="Dernière interaction"
              value={
                state.file.summary.lastInteractionAt
                  ? formatAdminDate(state.file.summary.lastInteractionAt)
                  : '—'
              }
              detail={(() => {
                const last = state.file.timeline.find(isBusinessInteraction)
                return last
                  ? CUSTOMER_EVENT_KIND_LABEL[last.kind]
                  : 'Aucun échange pour le moment'
              })()}
            />
          </div>

          {state.file.timeline.some(isBusinessInteraction) ? (
            <ol className="mt-4 space-y-2" aria-label="Chronologie">
              {state.file.timeline.map((event) => {
                const Icon = EVENT_ICON[event.kind]
                return (
                  <li
                    key={event.key}
                    className="flex flex-wrap items-start gap-3 rounded-md border border-[color:var(--sand-deep)] bg-card px-3 py-2"
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
                        <span className="text-[10px] font-medium uppercase tracking-wide">
                          {CUSTOMER_EVENT_KIND_LABEL[event.kind]}
                        </span>
                        <time dateTime={event.at}>
                          {formatAdminDateTime(event.at)}
                        </time>
                      </div>
                      <div className="truncate font-medium">{event.label}</div>
                      {event.detail && (
                        <div className="text-xs text-muted-foreground">
                          {event.detail}
                        </div>
                      )}
                    </div>
                    {event.tab && (
                      <a
                        href={customerTabHref(event.tab)}
                        className="inline-flex items-center gap-1 text-xs text-[color:var(--forest)] hover:underline"
                      >
                        Voir dans {CUSTOMER_TAB_LABEL[event.tab]}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </li>
                )
              })}
            </ol>
          ) : (
            <p className="mt-4 rounded-md border border-dashed border-[color:var(--sand-deep)] px-3 py-4 text-center text-xs text-muted-foreground">
              Aucune interaction pour le moment
            </p>
          )}
        </>
      )}
    </section>
  )
}
