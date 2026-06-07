import { createFileRoute } from '@tanstack/react-router'
import { ArrowRight, PackageCheck, ShieldCheck, Ship } from 'lucide-react'

import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import {
  breadcrumbJsonLd,
  buildSeoHead,
  jsonLdScript,
  organizationJsonLd,
} from '@/lib/seo'

export const Route = createFileRoute('/a-propos')({
  component: AProposPage,
  head: () => ({
    ...buildSeoHead({
      title: 'À propos de Pros Import',
      description:
        "Pros Import opère Container Club : une centrale d'import française de mobilier outdoor CHR par container (achat groupé), pour restaurants, hôtels, campings et revendeurs.",
      path: '/a-propos',
    }),
    scripts: [
      jsonLdScript(organizationJsonLd()),
      jsonLdScript(
        breadcrumbJsonLd([
          { name: 'Accueil', path: '/' },
          { name: 'À propos', path: '/a-propos' },
        ]),
      ),
    ],
  }),
})

function AProposPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header onReserve={() => window.location.assign('/catalogue')} />

      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="label-eyebrow text-[color:var(--ember)]">À propos</div>
        <h1 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">
          Pros Import, centrale d’import mobilier CHR
        </h1>

        <p className="mt-5 text-sm leading-7 text-[color:var(--ink-soft)]">
          Pros Import (Pros Import EURL) opère <strong>Container Club</strong>,
          une plateforme B2B française d’achat groupé de mobilier outdoor
          professionnel importé par container. Nous mutualisons les commandes de
          restaurants, hôtels, campings, beach clubs et revendeurs pour donner
          accès à des prix directs pros, des preuves qualité et une logistique
          maîtrisée.
        </p>

        <section className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            {
              Icon: Ship,
              title: 'Opérateur d’import',
              text: "Nous gérons l’import, le contrôle qualité et le transport rendu port — pas une simple marketplace.",
            },
            {
              Icon: PackageCheck,
              title: 'Achat groupé',
              text: 'Les commandes se mutualisent dans des containers actifs pour atteindre les paliers de prix volume.',
            },
            {
              Icon: ShieldCheck,
              title: 'Revendeurs protégés',
              text: 'Un canal partenaire protège les revendeurs : prix nets privés, marge libre, attribution des clients.',
            },
          ].map(({ Icon, title, text }) => (
            <div
              key={title}
              className="rounded-md border border-[color:var(--sand-deep)] bg-card p-4"
            >
              <Icon className="h-5 w-5 text-[color:var(--ember)]" />
              <h2 className="mt-3 font-display text-base font-semibold">
                {title}
              </h2>
              <p className="mt-1.5 text-xs leading-6 text-muted-foreground">
                {text}
              </p>
            </div>
          ))}
        </section>

        <section className="mt-8">
          <h2 className="font-display text-xl font-semibold tracking-tight">
            Ce que nous ne faisons pas
          </h2>
          <ul className="mt-3 space-y-1.5 text-sm leading-6 text-[color:var(--ink-soft)]">
            {[
              'Nous ne vendons pas au grand public : le modèle est strictement B2B.',
              'Nous n’exposons jamais les prix nets partenaires ni les marges internes.',
              'Nous n’imposons pas de prix de revente aux revendeurs.',
            ].map((t) => (
              <li key={t} className="flex gap-2">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[color:var(--ember)]" />
                {t}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8 rounded-md border border-[color:var(--sand-deep)] bg-card p-5 text-sm">
          <h2 className="font-display text-lg font-semibold">L’entité</h2>
          <p className="mt-2 text-muted-foreground">
            Pros Import EURL · RCS Paris 988 269 981 · SIRET 98826998100011 · TVA
            FR08988269981. Site partenaire :{' '}
            <a
              href="https://terrassea.com"
              target="_blank"
              rel="noreferrer"
              className="text-foreground underline"
            >
              terrassea.com
            </a>
            .
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href="/catalogue"
              className="inline-flex h-10 items-center gap-1.5 rounded-sm bg-foreground px-4 text-sm text-background"
            >
              Voir le catalogue
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="/contact"
              className="inline-flex h-10 items-center rounded-sm border border-[color:var(--sand-deep)] px-4 text-sm"
            >
              Nous contacter
            </a>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
