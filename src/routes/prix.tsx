import { Link, createFileRoute } from '@tanstack/react-router'
import {
  ArrowRight,
  BadgeCheck,
  Container,
  Factory,
  FileCheck,
  Percent,
  Ship,
  ShieldCheck,
} from 'lucide-react'

import { ContainerNotifySection } from '@/components/ContainerNotifyForm'
import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import {
  breadcrumbJsonLd,
  buildSeoHead,
  faqJsonLd,
  jsonLdScript,
} from '@/lib/seo'

// « Prix prouvé » — page pilier : on montre COMMENT le prix est construit
// (méthode + règles publiques), jamais les coûts d'achat ni les marges
// (décision #4 : ces données ne quittent pas le serveur).

const PRICE_FAQ: ReadonlyArray<{ readonly q: string; readonly a: string }> = [
  {
    q: 'Pourquoi le mobilier CHR coûte-t-il 2 à 3 fois plus cher en showroom ?',
    a: "Un meuble importé passe classiquement par 4 à 5 intermédiaires (usine, importateur, grossiste, distributeur, showroom) qui empilent chacun leur marge, plus le coût des stocks et des salles d'exposition. Container Club suprime ces étapes : achat direct usine, container mutualisé entre professionnels, une seule marge. L'écart est visible sur chaque fiche produit via le prix public conseillé affiché en référence.",
  },
  {
    q: 'Quelles remises de volume sont appliquées chez Container Club ?',
    a: 'Les paliers sont publics et automatiques sur le canal direct : −6 % dès 100 pièces cumulées dans la commande, −10 % dès 150 pièces. Ils s’appliquent au panier, sans négociation ni code.',
  },
  {
    q: 'Comment se passe le paiement d’une commande par container ?',
    a: "En 3 temps, calés sur la vie du container : 3 % à la réservation (minimum 150 €, plafonné à 500 €, déduits du total), 27 % quand le container atteint 80 % de remplissage, et le solde de 70 % avant expédition. Vous ne payez jamais la totalité d'un mobilier qui n'a pas encore de date de départ.",
  },
  {
    q: 'Le prix affiché inclut-il le transport et la douane ?',
    a: "Le prix est « rendu port » : achat usine, fret maritime mutualisé, dédouanement et conformité UE inclus, jusqu'à Marseille-Fos ou Le Havre. Le post-acheminement est au choix du client : enlèvement libre gratuit, votre transporteur, ou mise en relation avec nos transporteurs partenaires. Aucun frais caché.",
  },
]

export const Route = createFileRoute('/prix')({
  component: PrixPage,
  head: () => ({
    ...buildSeoHead({
      title: 'Le prix prouvé — comment nos prix sont construits',
      description:
        'Mobilier CHR 2 à 3× moins cher qu’en showroom : achat direct usine, container mutualisé, une seule marge. Méthode transparente, remises volume publiques (−6 % dès 100 pièces, −10 % dès 150), paiement séquencé 3/27/70.',
      path: '/prix',
    }),
    scripts: [
      jsonLdScript(faqJsonLd(PRICE_FAQ)),
      jsonLdScript(
        breadcrumbJsonLd([
          { name: 'Accueil', path: '/' },
          { name: 'Le prix prouvé', path: '/prix' },
        ]),
      ),
    ],
  }),
})

const COST_STEPS: ReadonlyArray<{
  readonly icon: typeof Factory
  readonly title: string
  readonly text: string
}> = [
  {
    icon: Factory,
    title: '1 · Achat direct usine',
    text: 'Prix FOB négocié en direct avec les fabricants, sans agent ni bureau d’achat intermédiaire. Les mêmes usines qui produisent pour les grandes marques européennes.',
  },
  {
    icon: Ship,
    title: '2 · Fret maritime mutualisé',
    text: 'Le coût du container (40 pieds HC) est réparti entre tous les professionnels de la commande groupée, au prorata du volume (m³) de chacun. Plus le container se remplit, plus la part de fret par chaise baisse.',
  },
  {
    icon: FileCheck,
    title: '3 · Douane et conformité UE',
    text: 'Dédouanement, taxes d’importation et conformité (normes feu, fiches techniques) traités par Pros Import EURL, importateur officiel enregistré en France.',
  },
  {
    icon: ShieldCheck,
    title: '4 · Contrôle qualité SGS',
    text: 'Inspection indépendante SGS avant départ usine, rapport consultable pour chaque container livré. Le coût du contrôle est inclus dans le prix, pas facturé en option.',
  },
  {
    icon: Percent,
    title: '5 · Une seule marge, transparente',
    text: 'Une marge unique couvre notre travail : sourcing, négociation, logistique, SAV France et garantie 2 ans. Pas de grossiste, pas de distributeur, pas de showroom à financer.',
  },
]

const PUBLIC_RULES: ReadonlyArray<{
  readonly label: string
  readonly value: string
}> = [
  { label: 'Remise volume — dès 100 pièces', value: '−6 %' },
  { label: 'Remise volume — dès 150 pièces', value: '−10 %' },
  {
    label: 'Frais de réservation (déduits du total)',
    value: '3 % · min 150 € · max 500 €',
  },
  { label: 'Acompte à 80 % de remplissage du container', value: '27 %' },
  { label: 'Solde avant expédition', value: '70 %' },
  { label: 'Enlèvement au port (Marseille-Fos / Le Havre)', value: 'Gratuit' },
  { label: 'Garantie fabricant + SAV France', value: '2 ans' },
]

function PrixPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header onReserve={() => window.location.assign('/catalogue')} />

      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="label-eyebrow text-[color:var(--ember)]">
          Le prix prouvé
        </div>
        <h1 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">
          On ne vous demande pas de nous croire. On vous montre la méthode.
        </h1>

        {/* Bloc réponse directe — citable tel quel par un moteur ou une IA. */}
        <section className="mt-6 rounded-md border-l-4 border-[color:var(--ember)] bg-card p-5">
          <p className="text-sm leading-7">
            <strong>En résumé :</strong> un meuble CHR vendu en showroom passe
            par 4 à 5 intermédiaires qui multiplient le prix usine par 2,5 à 3.
            Container Club achète en direct usine, mutualise un container entre
            professionnels et applique une seule marge — d'où des prix 2 à 3×
            plus bas, à produit comparable. Chaque fiche produit affiche le
            prix public conseillé en référence : l'écart se vérifie ligne par
            ligne, et la qualité se vérifie dans les{' '}
            <Link to="/qualite" className="underline underline-offset-4">
              rapports SGS
            </Link>{' '}
            de chaque container.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-2xl tracking-tight">
            D'où vient le prix — les 5 étapes
          </h2>
          <div className="mt-4 grid gap-3">
            {COST_STEPS.map((step) => (
              <div
                key={step.title}
                className="flex items-start gap-3 rounded-md border border-[color:var(--sand-deep)] bg-card p-4"
              >
                <step.icon className="mt-0.5 h-5 w-5 flex-none text-[color:var(--ember)]" />
                <div>
                  <div className="text-sm font-semibold">{step.title}</div>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {step.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-2xl tracking-tight">
            Circuit classique vs Container Club
          </h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[color:var(--sand-deep)] text-left">
                  <th className="py-2 pr-4 font-semibold">Étape</th>
                  <th className="py-2 pr-4 font-semibold">Circuit showroom</th>
                  <th className="py-2 font-semibold">Container Club</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b border-[color:var(--sand-deep)]/60">
                  <td className="py-2 pr-4">Intermédiaires</td>
                  <td className="py-2 pr-4">
                    Usine → importateur → grossiste → distributeur → showroom
                  </td>
                  <td className="py-2 text-foreground">
                    Usine → vous (container mutualisé)
                  </td>
                </tr>
                <tr className="border-b border-[color:var(--sand-deep)]/60">
                  <td className="py-2 pr-4">Marges empilées</td>
                  <td className="py-2 pr-4">4 à 5 marges successives</td>
                  <td className="py-2 text-foreground">1 marge unique</td>
                </tr>
                <tr className="border-b border-[color:var(--sand-deep)]/60">
                  <td className="py-2 pr-4">Coûts de structure</td>
                  <td className="py-2 pr-4">
                    Showrooms, stocks dormants, forces de vente
                  </td>
                  <td className="py-2 text-foreground">
                    Plateforme en ligne, containers à la demande
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Prix final, à produit égal</td>
                  <td className="py-2 pr-4">×2,5 à ×3 le prix usine</td>
                  <td className="py-2 font-medium text-foreground">
                    Prix direct pro affiché au catalogue
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            La référence « prix public conseillé » affichée sur chaque fiche
            produit correspond au tarif constaté en circuit de distribution
            classique pour un produit comparable. L'économie est calculée
            produit par produit, pas sur une moyenne marketing.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-2xl tracking-tight">
            Les règles publiques du prix
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Les mêmes règles pour tous les professionnels du canal direct —
            publiées ici, appliquées automatiquement au panier.
          </p>
          <div className="mt-4 grid gap-2">
            {PUBLIC_RULES.map((rule) => (
              <div
                key={rule.label}
                className="flex items-baseline justify-between gap-4 rounded-md border border-[color:var(--sand-deep)] bg-card px-4 py-3"
              >
                <span className="text-sm text-muted-foreground">
                  {rule.label}
                </span>
                <span className="text-sm font-semibold tabular-nums">
                  {rule.value}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-2xl tracking-tight">
            Pourquoi on peut le prouver
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Link
              to="/qualite"
              className="group rounded-md border border-[color:var(--sand-deep)] bg-card p-4 transition-colors hover:border-foreground"
            >
              <ShieldCheck className="h-5 w-5 text-[color:var(--ember)]" />
              <div className="mt-2 text-sm font-semibold">Rapports SGS</div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Contrôle indépendant avant chaque départ, rapports consultables.
              </p>
            </Link>
            <Link
              to="/avis"
              className="group rounded-md border border-[color:var(--sand-deep)] bg-card p-4 transition-colors hover:border-foreground"
            >
              <BadgeCheck className="h-5 w-5 text-[color:var(--ember)]" />
              <div className="mt-2 text-sm font-semibold">
                Avis d'achat vérifié
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Seuls les professionnels ayant commandé peuvent noter.
              </p>
            </Link>
            <Link
              to="/livres"
              className="group rounded-md border border-[color:var(--sand-deep)] bg-card p-4 transition-colors hover:border-foreground"
            >
              <Container className="h-5 w-5 text-[color:var(--ember)]" />
              <div className="mt-2 text-sm font-semibold">
                Containers livrés
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                L'historique réel des commandes groupées déjà servies.
              </p>
            </Link>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-2xl tracking-tight">
            Questions fréquentes sur nos prix
          </h2>
          <div className="mt-4 space-y-4">
            {PRICE_FAQ.map((item) => (
              <details
                key={item.q}
                className="rounded-md border border-[color:var(--sand-deep)] bg-card p-4"
              >
                <summary className="cursor-pointer text-sm font-semibold">
                  {item.q}
                </summary>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link
            to="/catalogue"
            className="inline-flex h-11 items-center gap-2 rounded-sm bg-foreground px-5 text-sm font-medium text-background"
          >
            Voir les prix au catalogue
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/stock-24h"
            className="inline-flex h-11 items-center gap-2 rounded-sm border border-[color:var(--sand-deep)] px-5 text-sm font-medium"
          >
            Stock disponible sous 24 h
          </Link>
        </div>

        <ContainerNotifySection source="prix" />
      </main>

      <Footer />
    </div>
  )
}
