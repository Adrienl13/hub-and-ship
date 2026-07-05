import { Link, createFileRoute } from '@tanstack/react-router'
import {
  ArrowRight,
  CheckCircle2,
  Globe,
  Mail,
  Phone,
  Ship,
  Truck,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { ReservationDialog } from '@/components/ReservationDialog'
import { Button } from '@/components/ui/button'
import { CARRIER_FAQ, CARRIERS, type Carrier } from '@/lib/carriers'
import { listPublishedCarriers } from '@/lib/carrier-partners/repository'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'
import { useCatalog } from '@/hooks/useCatalog'
import { useCart } from '@/stores/cart.store'
import { buildSeoHead } from '@/lib/seo'

export const Route = createFileRoute('/transport-partenaires')({
  head: () => ({
    ...buildSeoHead({
      title: 'Transporteurs partenaires',
      description:
        'Liste de transporteurs recommandés pour acheminer votre mobilier outdoor depuis Marseille-Fos ou Le Havre vers votre établissement. Aucune commission, contact direct, tarifs indicatifs.',
      path: '/transport-partenaires',
    }),
  }),
  component: TransportPartenairesPage,
})

function TransportPartenairesPage() {
  const [reserveOpen, setReserveOpen] = useState(false)
  const [carriers, setCarriers] = useState<ReadonlyArray<Carrier>>(CARRIERS)
  const { products, currentContainer } = useCatalog()
  const productsArray = useMemo(() => [...products], [products])
  const cart = useCart({
    products: productsArray,
    capacityCbm: currentContainer.capacityCbm,
  })

  useEffect(() => {
    const config = getSupabasePublicConfig()
    if (!config.isConfigured) return
    let cancelled = false
    void (async () => {
      try {
        const client = createSupabaseBrowserClient(config)
        const list = await listPublishedCarriers(client)
        if (!cancelled && list.length > 0) setCarriers(list)
      } catch {
        // Silently fall back to the static CARRIERS const.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header onReserve={() => setReserveOpen(true)} />

      <main>
        <HeroSection carrierCount={carriers.length} />
        <ProcessSection />
        <CarriersGrid carriers={carriers} />
        <FaqSection />
        <ContactCta />
      </main>

      <Footer />

      <ReservationDialog
        open={reserveOpen}
        onOpenChange={setReserveOpen}
        items={cart.items}
        totals={cart.totals}
        container={currentContainer}
      />
    </div>
  )
}

function HeroSection({ carrierCount }: { readonly carrierCount: number }) {
  return (
    <section className="border-b border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]">
      <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
        <div className="label-eyebrow text-[color:var(--ember)]">
          Logistique post-port
        </div>
        <h1 className="mt-3 font-display text-4xl tracking-tight sm:text-5xl">
          Transporteurs partenaires recommandés.
        </h1>
        <p className="mt-4 max-w-3xl text-base text-[color:var(--ink-soft)]">
          Container Club facture uniquement <strong>le prix rendu port</strong>{' '}
          (Marseille-Fos ou Le Havre). Pour acheminer votre mobilier depuis le
          quai jusqu'à votre établissement, voici les transporteurs avec
          lesquels nos clients travaillent.{' '}
          <strong>Aucune commission de notre part — contact direct.</strong>
        </p>
        <div className="mt-6 flex flex-wrap gap-3 text-xs">
          <Pill>{`${carrierCount} transporteurs référencés`}</Pill>
          <Pill>Contact direct sans intermédiaire</Pill>
          <Pill>Tarifs indicatifs 2025–2026</Pill>
        </div>
      </div>
    </section>
  )
}

function Pill({ children }: { readonly children: React.ReactNode }) {
  return (
    <span className="text-foreground/75 inline-flex items-center rounded-full border border-[color:var(--sand-deep)] bg-card px-3 py-1 font-medium">
      {children}
    </span>
  )
}

function ProcessSection() {
  const steps = [
    {
      Icon: Ship,
      title: '1. Arrivée au port',
      desc: 'Container dédouané à Marseille-Fos ou Le Havre. Vous recevez la confirmation 5 à 7 jours avant.',
    },
    {
      Icon: Phone,
      title: '2. Vous contactez le transporteur',
      desc: 'Choisissez un partenaire ci-dessous selon votre zone et votre volume. Demandez un devis ferme.',
    },
    {
      Icon: Truck,
      title: '3. Enlèvement et livraison',
      desc: 'Le transporteur retire la marchandise au quai et la livre sous 3 à 10 jours selon la destination.',
    },
  ] as const

  return (
    <section className="border-b border-[color:var(--sand-deep)]">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {steps.map(({ Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-md border border-[color:var(--sand-deep)] bg-card p-5"
            >
              <Icon className="h-5 w-5 text-[color:var(--ember)]" />
              <h3 className="mt-3 font-display text-base font-semibold tracking-tight">
                {title}
              </h3>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function CarriersGrid({
  carriers,
}: {
  readonly carriers: ReadonlyArray<Carrier>
}) {
  return (
    <section className="border-b border-[color:var(--sand-deep)]">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="font-display text-3xl tracking-tight">
          Partenaires recommandés
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-[color:var(--ink-soft)]">
          Liste éditoriale, mise à jour selon les retours clients. Demandez un
          devis ferme avant de vous engager — les fourchettes ci-dessous sont
          indicatives.
        </p>

        <div className="mt-8 space-y-4">
          {carriers.map((carrier) => (
            <CarrierCard key={carrier.slug} carrier={carrier} />
          ))}
        </div>
      </div>
    </section>
  )
}

function CarrierCard({ carrier }: { readonly carrier: Carrier }) {
  return (
    <article className="rounded-md border border-[color:var(--sand-deep)] bg-card p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-semibold tracking-tight">
            {carrier.name}
          </h3>
          <div className="mt-1 text-xs text-muted-foreground">
            {carrier.specialtyLabel} ·{' '}
            {carrier.source === 'partenaire-direct'
              ? 'Partenaire direct'
              : 'Plateforme publique'}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {carrier.contact.phone && (
            <a
              href={`tel:${carrier.contact.phone.replace(/\s/g, '')}`}
              className="hover:border-foreground/30 inline-flex items-center gap-1.5 rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-2.5 py-1.5"
            >
              <Phone className="h-3 w-3" />
              {carrier.contact.phone}
            </a>
          )}
          {carrier.contact.email && (
            <a
              href={`mailto:${carrier.contact.email}`}
              className="hover:border-foreground/30 inline-flex items-center gap-1.5 rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-2.5 py-1.5"
            >
              <Mail className="h-3 w-3" />
              {carrier.contact.email}
            </a>
          )}
          {carrier.contact.website && (
            <a
              href={carrier.contact.website}
              target="_blank"
              rel="noreferrer"
              className="hover:bg-foreground/90 inline-flex items-center gap-1.5 rounded-sm bg-foreground px-2.5 py-1.5 text-background"
            >
              <Globe className="h-3 w-3" />
              Site web
            </a>
          )}
        </div>
      </div>

      <p className="text-foreground/85 mt-4 text-sm leading-6">
        {carrier.summary}
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div>
          <div className="label-eyebrow text-muted-foreground">Couverture</div>
          <div className="text-foreground/80 mt-1 text-xs">
            {carrier.coverage}
          </div>
        </div>
        <div>
          <div className="label-eyebrow text-muted-foreground">
            Tarifs indicatifs
          </div>
          <div className="text-foreground/80 mt-1 text-xs">
            {carrier.indicativePricing}
          </div>
        </div>
        <div>
          <div className="label-eyebrow text-muted-foreground">
            Points forts
          </div>
          <ul className="text-foreground/80 mt-1 space-y-1 text-xs">
            {carrier.strengths.map((s) => (
              <li key={s} className="flex items-start gap-1.5">
                <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-[color:var(--forest)]" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  )
}

function FaqSection() {
  return (
    <section className="border-b border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <h2 className="font-display text-3xl tracking-tight">
          Questions fréquentes
        </h2>
        <div className="mt-6 space-y-3">
          {CARRIER_FAQ.map(({ q, a }) => (
            <details
              key={q}
              className="group rounded-md border border-[color:var(--sand-deep)] bg-card p-4 open:bg-[color:var(--sand-soft)]"
            >
              <summary className="cursor-pointer list-none text-sm font-medium">
                {q}
              </summary>
              <p className="text-foreground/75 mt-3 text-xs leading-5">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

function ContactCta() {
  return (
    <section>
      <div className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h2 className="font-display text-2xl tracking-tight">
          Aucun transporteur ne couvre votre zone&nbsp;?
        </h2>
        <p className="mt-3 text-sm text-[color:var(--ink-soft)]">
          Écrivez-nous avec votre code postal de livraison, le volume estimé et
          la date d'arrivée prévue. On vous met en relation directement avec un
          partenaire de notre réseau étendu.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button
            asChild
            className="hover:bg-foreground/90 h-11 rounded-sm bg-foreground px-5 text-background"
          >
            <a href="mailto:contact@prosimport.com?subject=Demande%20de%20mise%20en%20relation%20transporteur">
              Demander une mise en relation
              <ArrowRight className="h-4 w-4" />
            </a>
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-11 rounded-sm border-[color:var(--sand-deep)] px-5"
          >
            <Link to="/faq">Voir la FAQ logistique</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
