import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, Handshake, Percent, Timer } from 'lucide-react'

import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { Button } from '@/components/ui/button'
import { buildSeoHead } from '@/lib/seo'

// Le parrainage B2C −100 € est retiré : le programme apporteur d'affaires
// (8 % du CA encaissé pendant 12 mois) le remplace. La route est conservée
// pour les anciens liens/emails et redirige la valeur vers /partenaires.
export const Route = createFileRoute('/account/parrainage')({
  component: ReferralRetiredPage,
  head: () =>
    buildSeoHead({
      title: 'Le parrainage devient le programme apporteur',
      description:
        'Le parrainage Container Club évolue : recommandez des professionnels et touchez 8 % de commission sur le CA encaissé pendant 12 mois.',
      path: '/account/parrainage',
      noindex: true,
    }),
})

const PILLARS: ReadonlyArray<{
  readonly icon: typeof Percent
  readonly title: string
  readonly text: string
}> = [
  {
    icon: Percent,
    title: '8 % du CA encaissé',
    text: 'Commission sur chaque commande payée de vos filleuls — un revenu récurrent, pas un forfait unique.',
  },
  {
    icon: Timer,
    title: 'Pendant 12 mois',
    text: 'La fenêtre démarre à la première commande du client recommandé (premier contact conservé).',
  },
  {
    icon: Handshake,
    title: 'Code + lien traçables',
    text: 'Votre code apporteur est saisissable au paiement et traqué via votre lien — rien ne se perd.',
  },
]

function ReferralRetiredPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header onReserve={() => window.location.assign('/catalogue')} />

      <main className="mx-auto max-w-2xl px-6 py-10">
        <div className="label-eyebrow text-[color:var(--ember)]">
          Mon espace
        </div>
        <h1 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">
          Le parrainage devient le programme apporteur
        </h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          Le parrainage à 100 € est terminé. À la place, un vrai statut
          d'apporteur d'affaires :{' '}
          <strong className="text-foreground">
            8 % de commission sur le CA encaissé
          </strong>{' '}
          de chaque professionnel que vous recommandez, pendant 12 mois. Sans
          plafond.
        </p>

        <div className="mt-6 grid gap-3">
          {PILLARS.map((pillar) => (
            <div
              key={pillar.title}
              className="flex items-start gap-3 rounded-md border border-[color:var(--sand-deep)] bg-card p-4"
            >
              <pillar.icon className="mt-0.5 h-5 w-5 flex-none text-[color:var(--ember)]" />
              <div>
                <div className="text-sm font-semibold">{pillar.title}</div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {pillar.text}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button
            asChild
            className="h-11 gap-2 rounded-sm bg-foreground px-5 text-background"
          >
            <Link to="/partenaires">
              Devenir apporteur d'affaires
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Link
            to="/account"
            className="text-sm text-muted-foreground underline underline-offset-4"
          >
            Retour au tableau de bord
          </Link>
        </div>

        <p className="mt-6 text-xs leading-5 text-muted-foreground">
          Vous aviez des gains « à valoir » du précédent programme ? Ils
          restent dus et sont appliqués par notre équipe sur votre prochaine
          commande — écrivez-nous si besoin.
        </p>
      </main>

      <Footer />
    </div>
  )
}
