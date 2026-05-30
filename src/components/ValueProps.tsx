import { Factory, ShieldCheck, UsersRound } from 'lucide-react'

import { RevealItem, RevealStagger } from '@/components/motion-helpers'

const VALUE_PROPS = [
  {
    Icon: Factory,
    title: 'Direct usine',
    description:
      'Les prix sont négociés au niveau container, sans empilement de marges ni stock dormant à financer.',
  },
  {
    Icon: UsersRound,
    title: 'Groupé entre pros',
    description:
      'Chaque réservation contribue au remplissage et aux MOQ par design. Le départ se déclenche quand le seuil est atteint.',
  },
  {
    Icon: ShieldCheck,
    title: 'Tout est géré',
    description:
      'Importation, douane, conformité, contrôle SGS, facture française et garantie 2 ans restent centralisés chez Container Club.',
  },
] as const

export function ValueProps() {
  return (
    <section className="border-t border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]">
      <div className="mx-auto max-w-7xl px-6 py-14">
        <RevealStagger className="grid grid-cols-1 gap-px bg-[color:var(--sand-deep)] md:grid-cols-3">
          {VALUE_PROPS.map(({ Icon, title, description }) => (
            <RevealItem key={title} className="bg-[color:var(--sand-soft)] p-5">
              <div className="mb-6 flex h-9 w-9 items-center justify-center rounded-sm bg-[color:var(--foreground)] text-[color:var(--background)]">
                <Icon className="h-4 w-4" strokeWidth={1.7} />
              </div>
              <h2 className="font-display text-lg font-semibold tracking-tight">
                {title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[color:var(--ink-soft)]">
                {description}
              </p>
            </RevealItem>
          ))}
        </RevealStagger>
      </div>
    </section>
  )
}
