import { createFileRoute } from '@tanstack/react-router'
import { ArrowRight, ShieldCheck, Ship, Users } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/Button'
import {
  DEFAULT_PRICING_TIERS,
  calculateOrderPricing,
} from '@/lib/pricing/tiers'

export const Route = createFileRoute('/')({
  component: HomeRoute,
})

const demoPricing = calculateOrderPricing(
  [
    {
      productId: 'demo-chair',
      variantId: 'teak',
      variantCombinationId: null,
      quantity: 18,
      cbmPerUnit: 0.08,
      costLanded: 46,
      ecoContribution: 0.5,
    },
  ],
  DEFAULT_PRICING_TIERS,
)

function HomeRoute() {
  return (
    <main className="min-h-screen bg-bg-base">
      <section className="mx-auto grid min-h-screen max-w-6xl content-center gap-10 px-6 py-10 md:grid-cols-[1.2fr_0.8fr] md:items-center">
        <div className="space-y-8">
          <div className="inline-flex min-h-touch items-center gap-2 border border-border-strong bg-bg-alt px-3 py-2 text-sm text-text-secondary">
            <Ship size={18} aria-hidden="true" />
              Container 20 ft HC mutualise entre pros
          </div>

          <div className="space-y-5">
            <h1 className="max-w-3xl text-h1 font-semibold">
              Container Club
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-text-secondary">
              La plateforme B2B francaise de pre-commande groupee pour du
              mobilier outdoor premium, avec pricing degressif, SIRET
              obligatoire et qualite documentee.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button>
              Initialisation Session 0
              <ArrowRight size={18} aria-hidden="true" />
            </Button>
            <Button variant="outline">Voir la spec</Button>
          </div>
        </div>

        <aside className="border border-border-base bg-bg-elevated p-6 shadow-soft">
          <div className="space-y-5">
            <div>
              <p className="text-label uppercase text-text-muted">
                Demo pricing
              </p>
              <p className="mt-2 text-3xl font-semibold">
                {demoPricing.totalHt.toLocaleString('fr-FR', {
                  style: 'currency',
                  currency: 'EUR',
                })}
              </p>
            </div>

            <dl className="grid gap-3 text-sm text-text-secondary">
              <div className="flex items-center justify-between border-t pt-3">
                <dt>Volume reserve</dt>
                <dd>{demoPricing.totalCbm} m3</dd>
              </div>
              <div className="flex items-center justify-between border-t pt-3">
                <dt>Marge effective</dt>
                <dd>{demoPricing.effectiveMarginPercent}%</dd>
              </div>
              <div className="flex items-center justify-between border-t pt-3">
                <dt>Eco-contribution</dt>
                <dd>{demoPricing.ecoContributionTotal} EUR</dd>
              </div>
            </dl>

            <div className="grid gap-3 pt-2">
              <TrustLine icon={<Users size={18} />} label="6-12 pros" />
              <TrustLine icon={<ShieldCheck size={18} />} label="B2B verifie" />
              <TrustLine icon={<Ship size={18} />} label="Rendu port V1" />
            </div>
          </div>
        </aside>
      </section>
    </main>
  )
}

function TrustLine(props: { icon: ReactNode; label: string }) {
  return (
    <div className="flex min-h-touch items-center gap-3 bg-bg-alt px-3 text-sm text-text-secondary">
      {props.icon}
      <span>{props.label}</span>
    </div>
  )
}
