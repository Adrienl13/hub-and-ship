import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'

import {
  AnimatedNumber,
  RevealItem,
  RevealStagger,
} from '@/components/motion-helpers'
import {
  ArrowRight,
  BadgeEuro,
  Copy,
  Handshake,
  Link2,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Trophy,
} from 'lucide-react'

import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { PartnerGuard } from '@/components/PartnerGuard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  createPartnerDeal,
  loadPartnerWorkspace,
  type CreatePartnerDealInput,
  type PartnerDealInsertClient,
  type PartnerPortalClient,
  type PartnerWorkspace,
} from '@/lib/partners/portal'
import { buildPartnerSharePath } from '@/lib/partners/link'
import { computePartnerReport } from '@/lib/partners/reporting'
import { PARTNER_DEAL_STATUS_LABEL } from '@/lib/partners/types'
import { ACCOUNT_RESERVATION_STATUS_LABEL } from '@/lib/account/reservations'
import { formatEUR } from '@/lib/order'
import { buildSeoHead } from '@/lib/seo'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'

export const Route = createFileRoute('/partner')({
  component: PartnerRoute,
  head: () =>
    buildSeoHead({
      title: 'Espace partenaire',
      description:
        'Espace partenaire Pros Import : deals protégés, lien co-brandé et réservations attribuées. Accès réservé aux partenaires approuvés.',
      path: '/partner',
      noindex: true,
    }),
})

function PartnerRoute() {
  return (
    <PartnerGuard>
      <PartnerDashboard />
    </PartnerGuard>
  )
}

function reservationStatusLabel(status: string): string {
  const labels = ACCOUNT_RESERVATION_STATUS_LABEL as Record<string, string>
  return labels[status] ?? status
}

function PartnerDashboard() {
  const config = useMemo(() => getSupabasePublicConfig(), [])
  const [workspace, setWorkspace] = useState<PartnerWorkspace | null>(null)
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>('loading')

  const load = useCallback(async () => {
    try {
      const client = createSupabaseBrowserClient(
        config,
      ) as unknown as PartnerPortalClient
      const data = await loadPartnerWorkspace(client)
      setWorkspace(data)
      setState('loaded')
    } catch {
      setState('error')
    }
  }, [config])

  useEffect(() => {
    void load()
  }, [load])

  const application = workspace?.applications[0] ?? null
  const partnerName = application?.companyName ?? 'Partenaire'
  const report = useMemo(
    () =>
      workspace
        ? computePartnerReport(workspace.deals, workspace.reservations)
        : null,
    [workspace],
  )

  async function createDeal(
    fields: Omit<
      CreatePartnerDealInput,
      'applicationId' | 'partnerCompanyName' | 'partnerContactEmail'
    >,
  ): Promise<void> {
    if (!application) throw new Error('Candidature partenaire introuvable')
    const client = createSupabaseBrowserClient(
      config,
    ) as unknown as PartnerDealInsertClient
    await createPartnerDeal(client, {
      applicationId: application.id,
      partnerCompanyName: application.companyName,
      partnerContactEmail: application.contactEmail,
      ...fields,
    })
    await load()
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header onReserve={() => window.location.assign('/catalogue')} />

      <main className="mx-auto max-w-5xl px-6 py-8">
        <PartnerHero partnerName={partnerName} report={report} />

        {state === 'loading' ? (
          <div className="mt-8 space-y-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]/50"
              />
            ))}
          </div>
        ) : state === 'error' ? (
          <div className="mt-8 rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900">
            Impossible de charger votre espace partenaire pour le moment.
            Réessayez dans un instant.
          </div>
        ) : workspace ? (
          <div className="mt-6 space-y-6">
            <ShareLinkCard
              slug={application?.referralSlug ?? null}
              partnerName={partnerName}
            />
            <DealsCard deals={workspace.deals} onCreateDeal={createDeal} />
            <AttributedReservationsCard
              reservations={workspace.reservations}
            />
          </div>
        ) : null}
      </main>

      <Footer />
    </div>
  )
}

function PartnerHero({
  partnerName,
  report,
}: {
  readonly partnerName: string
  readonly report: ReturnType<typeof computePartnerReport> | null
}) {
  return (
    <section className="relative overflow-hidden rounded-xl border border-[color:var(--forest)]/30 shadow-paper">
      {/* Base gradient — assumed (franc) */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-br from-[color:var(--forest)]/40 via-[color:var(--sand-soft)] to-[color:var(--ember)]/35"
      />
      {/* Aura animée */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <motion.div
          className="absolute -left-16 -top-24 h-60 w-60 rounded-full bg-[color:var(--forest)]/35 blur-3xl"
          animate={{ x: [0, 45, 0], y: [0, 22, 0], scale: [1, 1.18, 1] }}
          transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute right-[-6%] top-1/3 h-72 w-72 rounded-full bg-[color:var(--ember)]/25 blur-3xl"
          animate={{ x: [0, -45, 0], y: [0, -18, 0], scale: [1, 1.22, 1] }}
          transition={{ duration: 21, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-[-20%] left-1/3 h-52 w-52 rounded-full bg-[color:var(--ochre)]/25 blur-3xl"
          animate={{ x: [0, -25, 0], y: [0, -30, 0], scale: [1, 1.12, 1] }}
          transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <div className="relative p-6 sm:p-8">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          className="flex flex-wrap items-start justify-between gap-4"
        >
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--forest)]/40 bg-[color:var(--forest)]/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--forest)] shadow-sm backdrop-blur">
              <Handshake className="h-3.5 w-3.5" />
              Espace partenaire
            </span>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-[2.6rem] sm:leading-[1.05]">
              {partnerName}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Pilotez les ventes que vous apportez, protégez vos opportunités et
              partagez votre lien co-brandé. Vos prix nets et marges restent
              privés.
            </p>
          </div>
          <Button
            asChild
            size="sm"
            className="h-9 gap-1.5 rounded-sm bg-[color:var(--forest)] px-3 text-xs text-[color:var(--sand)] hover:opacity-90"
          >
            <a href="/partner/selections">
              Mes sélections co-brandées
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </Button>
        </motion.div>

        {report && (
          <RevealStagger className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <RevealItem>
              <PartnerStat
                icon={<BadgeEuro className="h-4 w-4" />}
                label="CA apporté HT"
                value={report.attributedTotalHt}
                format={(n) => formatEUR(n)}
                targetId="partner-attributed"
                highlight
              />
            </RevealItem>
            <RevealItem>
              <PartnerStat
                icon={<ShoppingBag className="h-4 w-4" />}
                label="Ventes attribuées"
                value={report.attributedReservations}
                targetId="partner-attributed"
              />
            </RevealItem>
            <RevealItem>
              <PartnerStat
                icon={<Trophy className="h-4 w-4" />}
                label="Deals gagnés"
                value={report.wonDeals}
                targetId="partner-deals"
              />
            </RevealItem>
            <RevealItem>
              <PartnerStat
                icon={<ShieldCheck className="h-4 w-4" />}
                label="Deals protégés"
                value={report.protectedDeals}
                targetId="partner-deals"
              />
            </RevealItem>
          </RevealStagger>
        )}
      </div>
    </section>
  )
}

function PartnerStat({
  icon,
  label,
  value,
  format,
  targetId,
  highlight = false,
}: {
  readonly icon: ReactNode
  readonly label: string
  readonly value: number
  readonly format?: (n: number) => string
  readonly targetId?: string
  readonly highlight?: boolean
}) {
  const goToTarget = () => {
    if (!targetId) return
    document
      .getElementById(targetId)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  return (
    <button
      type="button"
      onClick={goToTarget}
      className={`group h-full w-full rounded-md border bg-card/80 p-3 text-left backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-14px_rgba(0,0,0,0.3)] ${
        highlight
          ? 'border-[color:var(--ember)]/50'
          : 'border-[color:var(--sand-deep)]'
      }`}
    >
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <span
          className={`transition-transform duration-300 group-hover:scale-110 ${
            highlight
              ? 'text-[color:var(--ember)]'
              : 'text-[color:var(--forest)]'
          }`}
        >
          {icon}
        </span>
        <span className="text-[11px] font-medium uppercase tracking-[0.06em]">
          {label}
        </span>
      </div>
      <div className="mt-1.5 font-display text-2xl font-semibold tabular-nums">
        <AnimatedNumber value={value} format={format} />
      </div>
    </button>
  )
}

function ShareLinkCard({
  slug,
  partnerName,
}: {
  readonly slug: string | null
  readonly partnerName: string
}) {
  const sharePath = slug ? buildPartnerSharePath({ slug }) : null
  const shareUrl =
    sharePath && typeof window !== 'undefined'
      ? `${window.location.origin}${sharePath}`
      : sharePath
        ? `https://prosimport.com${sharePath}`
        : null

  async function copy(): Promise<void> {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      toast.success('Lien copié', { description: shareUrl })
    } catch {
      toast.error('Copie impossible', { description: shareUrl })
    }
  }

  return (
    <section className="rounded-md border border-[color:var(--sand-deep)] bg-card p-5">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-[color:var(--ember)]" />
        <h2 className="font-display text-lg font-semibold">
          Votre lien co-brandé
        </h2>
      </div>
      {shareUrl ? (
        <>
          <p className="mt-2 text-sm text-muted-foreground">
            Partagez ce lien : le projet reste rattaché à {partnerName}, sans
            jamais exposer vos prix nets.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="truncate rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]/50 px-2 py-1.5 text-xs">
              {shareUrl}
            </code>
            <Button
              type="button"
              size="sm"
              onClick={() => void copy()}
              className="h-8 gap-1 px-2 text-xs"
            >
              <Copy className="h-3.5 w-3.5" />
              Copier
            </Button>
            <Button
              asChild
              size="sm"
              variant="outline"
              className="h-8 gap-1 px-2 text-xs"
            >
              <a href={sharePath ?? '#'} target="_blank" rel="noreferrer">
                Aperçu
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          Votre lien co-brandé sera activé par notre équipe dès la validation de
          votre dossier. Vous pourrez alors le partager à vos clients.
        </p>
      )}
    </section>
  )
}

function DealsCard({
  deals,
  onCreateDeal,
}: {
  readonly deals: PartnerWorkspace['deals']
  readonly onCreateDeal: (
    fields: Omit<
      CreatePartnerDealInput,
      'applicationId' | 'partnerCompanyName' | 'partnerContactEmail'
    >,
  ) => Promise<void>
}) {
  const [formOpen, setFormOpen] = useState(false)

  return (
    <section
      id="partner-deals"
      className="scroll-mt-24 overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card"
    >
      <div className="flex items-center justify-between gap-2 border-b border-[color:var(--sand-deep)] px-5 py-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[color:var(--forest)]" />
          <h2 className="font-display text-lg font-semibold">
            Deals protégés ({deals.length})
          </h2>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setFormOpen((open) => !open)}
          className="h-8 gap-1 px-2 text-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          {formOpen ? 'Fermer' : 'Protéger une opportunité'}
        </Button>
      </div>

      {formOpen && (
        <DealForm
          onSubmit={async (fields) => {
            await onCreateDeal(fields)
            setFormOpen(false)
          }}
          onCancel={() => setFormOpen(false)}
        />
      )}

      {deals.length === 0 ? (
        <p className="px-5 py-8 text-sm text-muted-foreground">
          Aucune opportunité protégée pour l'instant. Déclarez un projet client
          pour le sécuriser sur votre canal.
        </p>
      ) : (
        <ul className="divide-[color:var(--sand-deep)]/70 divide-y">
          {deals.map((deal) => (
            <li
              key={deal.id}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm"
            >
              <div>
                <div className="font-medium">{deal.clientCompanyName}</div>
                <div className="text-xs text-muted-foreground">
                  {deal.projectType} · {deal.projectCity ?? 'ville à cadrer'}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {deal.protectedUntil && (
                  <span className="text-[11px] text-muted-foreground">
                    Protégé jusqu'au{' '}
                    {new Date(deal.protectedUntil).toLocaleDateString('fr-FR')}
                  </span>
                )}
                <span className="border-[color:var(--ochre)]/30 bg-[color:var(--ochre)]/10 inline-flex h-7 items-center rounded-sm border px-2 text-[11px] font-medium">
                  {PARTNER_DEAL_STATUS_LABEL[deal.status]}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function DealForm({
  onSubmit,
  onCancel,
}: {
  readonly onSubmit: (
    fields: Omit<
      CreatePartnerDealInput,
      'applicationId' | 'partnerCompanyName' | 'partnerContactEmail'
    >,
  ) => Promise<void>
  readonly onCancel: () => void
}) {
  const [clientCompanyName, setClientCompanyName] = useState('')
  const [projectType, setProjectType] = useState('')
  const [projectCity, setProjectCity] = useState('')
  const [clientSiret, setClientSiret] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  function nullable(value: string): string | null {
    const trimmed = value.trim()
    return trimmed === '' ? null : trimmed
  }

  async function submit(): Promise<void> {
    if (clientCompanyName.trim() === '' || projectType.trim() === '') {
      toast.error('Renseignez au moins le client et le type de projet.')
      return
    }
    setBusy(true)
    try {
      await onSubmit({
        clientCompanyName: clientCompanyName.trim(),
        projectType: projectType.trim(),
        projectCity: nullable(projectCity),
        clientSiret: nullable(clientSiret),
        clientEmail: nullable(clientEmail),
        message: nullable(message),
        expectedBudgetHt: null,
        expectedPurchaseWindow: null,
        productInterest: null,
      })
      toast.success('Opportunité soumise', {
        description: 'Notre équipe la protégera après vérification.',
      })
    } catch (err) {
      toast.error('Soumission impossible', {
        description: err instanceof Error ? err.message : undefined,
      })
    }
    setBusy(false)
  }

  return (
    <div className="border-b border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]/30 px-5 py-4">
      <p className="mb-3 text-xs text-muted-foreground">
        Déclarez un projet client pour le rattacher à votre canal. La protection
        (durée, statut) est validée ensuite par notre équipe.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Client (société) *">
          <Input
            value={clientCompanyName}
            disabled={busy}
            onChange={(e) => setClientCompanyName(e.target.value)}
            className="h-9 text-sm"
          />
        </Field>
        <Field label="Type de projet *">
          <Input
            value={projectType}
            disabled={busy}
            placeholder="Ex. terrasse restaurant, hôtel, camping"
            onChange={(e) => setProjectType(e.target.value)}
            className="h-9 text-sm"
          />
        </Field>
        <Field label="Ville du projet">
          <Input
            value={projectCity}
            disabled={busy}
            onChange={(e) => setProjectCity(e.target.value)}
            className="h-9 text-sm"
          />
        </Field>
        <Field label="SIRET client">
          <Input
            value={clientSiret}
            disabled={busy}
            onChange={(e) => setClientSiret(e.target.value)}
            className="h-9 text-sm"
          />
        </Field>
        <Field label="Email client">
          <Input
            value={clientEmail}
            disabled={busy}
            onChange={(e) => setClientEmail(e.target.value)}
            className="h-9 text-sm"
          />
        </Field>
        <Field label="Note (optionnel)">
          <Input
            value={message}
            disabled={busy}
            onChange={(e) => setMessage(e.target.value)}
            className="h-9 text-sm"
          />
        </Field>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          disabled={busy}
          onClick={onCancel}
          className="h-9 px-3 text-sm"
        >
          Annuler
        </Button>
        <Button
          type="button"
          disabled={busy}
          onClick={() => void submit()}
          className="h-9 rounded-sm bg-foreground px-3 text-sm text-background"
        >
          Soumettre l'opportunité
        </Button>
      </div>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  readonly label: string
  readonly children: ReactNode
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  )
}

function AttributedReservationsCard({
  reservations,
}: {
  readonly reservations: PartnerWorkspace['reservations']
}) {
  return (
    <section
      id="partner-attributed"
      className="scroll-mt-24 overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card"
    >
      <div className="border-b border-[color:var(--sand-deep)] px-5 py-3">
        <h2 className="font-display text-lg font-semibold">
          Réservations attribuées ({reservations.length})
        </h2>
      </div>
      {reservations.length === 0 ? (
        <p className="px-5 py-8 text-sm text-muted-foreground">
          Aucune réservation attribuée pour l'instant. Les commandes issues de
          votre lien ou de vos clients protégés apparaîtront ici.
        </p>
      ) : (
        <ul className="divide-[color:var(--sand-deep)]/70 divide-y">
          {reservations.map((res) => (
            <li
              key={res.id}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm"
            >
              <div className="flex flex-col">
                <span className="font-mono font-medium">{res.reference}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(res.createdAt).toLocaleDateString('fr-FR')}
                  {res.attributionReason ? ` · ${res.attributionReason}` : ''}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  {formatEUR(res.totalHt)}
                </span>
                <span className="border-[color:var(--ochre)]/30 bg-[color:var(--ochre)]/10 inline-flex h-7 items-center rounded-sm border px-2 text-[11px] font-medium">
                  {reservationStatusLabel(res.status)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
