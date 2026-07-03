import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { Loader2, Mail, ShieldOff } from 'lucide-react'

import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { ApporteurDashboard } from '@/components/partenaire/ApporteurDashboard'
import { RevendeurDashboard } from '@/components/partenaire/RevendeurDashboard'
import { Button } from '@/components/ui/button'
import { usePartnerSpace } from '@/hooks/usePartnerSpace'
import { SALES_CHANNEL_LABEL, type SalesChannel } from '@/lib/pricing/channel'

export const Route = createFileRoute('/partenaire')({
  head: () => ({
    meta: [
      { title: 'Espace partenaire — Container Club' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: PartenairePage,
})

function PartenairePage() {
  const navigate = useNavigate()
  const space = usePartnerSpace()
  const onReserve = () => void navigate({ to: '/catalogue' })

  if (space.status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (space.status === 'unconfigured') {
    return (
      <GuardShell onReserve={onReserve} title="Espace indisponible">
        La connexion Supabase n&apos;est pas configurée localement. Définissez
        VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY puis redémarrez.
      </GuardShell>
    )
  }

  if (space.status === 'anonymous') {
    return (
      <GuardShell
        onReserve={onReserve}
        title="Espace partenaire"
        cta={
          <Button
            asChild
            className="hover:bg-foreground/90 mt-6 h-11 w-full rounded-sm bg-foreground text-background"
          >
            <Link to="/auth/login">Se connecter</Link>
          </Button>
        }
      >
        Connectez-vous avec votre compte partenaire pour accéder à votre espace.
      </GuardShell>
    )
  }

  if (space.status === 'not_partner') {
    return (
      <GuardShell onReserve={onReserve} title="Réservé aux partenaires">
        Votre compte n&apos;a pas encore de statut partenaire actif. Déposez une
        candidature sur{' '}
        <Link to="/partenaires" className="text-foreground underline">
          la page partenaires
        </Link>{' '}
        ou contactez votre référent.
      </GuardShell>
    )
  }

  if (space.status === 'error') {
    return (
      <GuardShell
        onReserve={onReserve}
        title="Espace momentanément indisponible"
        cta={
          <Button onClick={space.reload} className="mt-6 h-11 w-full rounded-sm">
            Réessayer
          </Button>
        }
      >
        {space.error ??
          'Impossible de charger votre espace partenaire pour le moment.'}
      </GuardShell>
    )
  }

  const showApporteur = space.data.codes.length > 0
  const showRevendeur = space.channel === 'revendeur'
  const showReferent =
    space.channel === 'grand_compte' || space.channel === 'distributeur'

  return (
    <div className="min-h-screen bg-[color:var(--sand)] text-foreground">
      <Header onReserve={onReserve} />
      <main className="mx-auto max-w-4xl space-y-12 px-6 py-12">
        {/* Additive: a partner can be both an apporteur (holds a code) and a
            revendeur/grand compte (channel) — show every applicable view. */}
        {showApporteur && <ApporteurDashboard data={space.data} />}
        {showRevendeur && <RevendeurDashboard />}
        {showReferent && <ReferentRecap channel={space.channel} />}
      </main>
      <Footer />
    </div>
  )
}

function ReferentRecap({ channel }: { readonly channel: SalesChannel }) {
  return (
    <div className="space-y-4">
      <div>
        <span className="mono text-[11px] uppercase tracking-[0.14em] text-[color:var(--ink-soft)]">
          Espace {SALES_CHANNEL_LABEL[channel].toLowerCase()}
        </span>
        <h1 className="mt-1 font-display text-2xl font-black tracking-tight">
          Vos conditions {SALES_CHANNEL_LABEL[channel].toLowerCase()}
        </h1>
      </div>
      <div className="rounded-lg border border-[color:var(--sand-deep)] bg-card p-5 text-sm text-muted-foreground">
        <p>
          Votre compte bénéficie des conditions{' '}
          <b className="text-foreground">{SALES_CHANNEL_LABEL[channel]}</b> :
          meilleures conditions de la grille
          {channel === 'distributeur'
            ? ', exclusivité territoriale et priorité production.'
            : ', palier direct garanti et interlocuteur dédié.'}
        </p>
        <p className="mt-3">
          Le détail de vos conditions et votre calendrier de containers sont
          suivis avec votre référent Container Club.
        </p>
        <Button asChild className="mt-4 gap-1.5">
          <a href="mailto:adrienlaniez1@gmail.com?subject=Espace%20partenaire">
            <Mail className="h-4 w-4" />
            Contactez votre référent
          </a>
        </Button>
      </div>
    </div>
  )
}

function GuardShell({
  title,
  children,
  cta,
  onReserve,
}: {
  readonly title: string
  readonly children: React.ReactNode
  readonly cta?: React.ReactNode
  readonly onReserve: () => void
}) {
  return (
    <div className="min-h-screen bg-background">
      <Header onReserve={onReserve} />
      <main className="mx-auto max-w-md px-6 py-24 text-center">
        <ShieldOff className="mx-auto h-8 w-8 text-muted-foreground" />
        <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight">
          {title}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">{children}</p>
        {cta}
        <Link
          to="/"
          className="mt-4 inline-block text-xs text-muted-foreground hover:text-foreground"
        >
          Retour à l&apos;accueil
        </Link>
      </main>
      <Footer />
    </div>
  )
}
