import { createFileRoute } from '@tanstack/react-router'
import {
  ArrowRight,
  Clock,
  Handshake,
  Mail,
  MapPin,
  Package,
} from 'lucide-react'

import { ContactForm } from '@/components/ContactForm'
import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { breadcrumbJsonLd, buildSeoHead, jsonLdScript } from '@/lib/seo'

export const Route = createFileRoute('/contact')({
  component: ContactPage,
  head: () => ({
    ...buildSeoHead({
      title: 'Contact',
      description:
        'Contacter Pros Import / Container Club : import de mobilier CHR par container, achat groupé, programme revendeur et stock disponible sous 24h.',
      path: '/contact',
    }),
    scripts: [
      jsonLdScript(
        breadcrumbJsonLd([
          { name: 'Accueil', path: '/' },
          { name: 'Contact', path: '/contact' },
        ]),
      ),
    ],
  }),
})

function ContactPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header onReserve={() => window.location.assign('/catalogue')} />

      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="label-eyebrow text-[color:var(--ember)]">Contact</div>
        <h1 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">
          Parler à Pros Import
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
          Une question sur un produit, un container, une réservation ou le
          programme revendeur ? Choisissez le canal le plus adapté.
        </p>

        <ContactForm />

        <section className="mt-4 rounded-md border border-[color:var(--sand-deep)] bg-card p-5">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-[color:var(--ember)]" />
            <a
              href="mailto:contact@prosimport.com"
              className="text-sm font-medium underline"
            >
              contact@prosimport.com
            </a>
          </div>
          <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Lundi – Vendredi · 9h – 18h · réponse sous 1 jour ouvré
          </p>
          <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            Pros Import EURL · 60 Rue François Ier, 75008 Paris
          </p>
        </section>

        <section className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            {
              Icon: Package,
              title: 'Acheter / réserver',
              text: 'Parcourez le catalogue et réservez une place sur le container actif.',
              href: '/catalogue',
              cta: 'Catalogue',
            },
            {
              Icon: Handshake,
              title: 'Devenir revendeur',
              text: 'Protégez vos clients et accédez à des conditions partenaires.',
              href: '/partenaires',
              cta: 'Partenaires',
            },
            {
              Icon: ArrowRight,
              title: 'Besoin urgent',
              text: 'Du mobilier déjà disponible en France, expédiable rapidement.',
              href: '/stock-24h',
              cta: 'Stock 24h',
            },
          ].map(({ Icon, title, text, href, cta }) => (
            <a
              key={href}
              href={href}
              className="rounded-md border border-[color:var(--sand-deep)] bg-card p-4 transition-colors hover:border-[color:var(--ember)]/40"
            >
              <Icon className="h-5 w-5 text-[color:var(--ember)]" />
              <h2 className="mt-3 font-display text-base font-semibold">
                {title}
              </h2>
              <p className="mt-1.5 text-xs leading-6 text-muted-foreground">
                {text}
              </p>
              <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[color:var(--ember)]">
                {cta}
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </a>
          ))}
        </section>

        <p className="mt-6 text-xs leading-6 text-muted-foreground">
          Pros Import EURL · RCS Paris 988 269 981 · SIRET 98826998100011 · TVA
          FR08988269981.
        </p>
      </main>

      <Footer />
    </div>
  )
}
