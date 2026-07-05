import { Anchor, ClipboardCheck, Factory, Gauge, Ship } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { Reveal, RevealItem, RevealStagger } from '@/components/motion-helpers'

const STEPS: ReadonlyArray<{
  n: string
  title: string
  desc: string
  Icon: LucideIcon
}> = [
  {
    n: '01',
    title: 'Réservation',
    desc: 'Vous engagez votre commande avec 3% de frais (min 150€, max 500€). Non-remboursables sauf si Container Club annule.',
    Icon: ClipboardCheck,
  },
  {
    n: '02',
    title: 'Container à 80%',
    desc: "Quand le seuil de remplissage et le minimum de séries sont atteints, la production est lancée et l'acompte 27% complémentaire est appelé.",
    Icon: Gauge,
  },
  {
    n: '03',
    title: 'Production usine',
    desc: '45 jours de production en Asie, contrôle qualité SGS indépendant avant chargement.',
    Icon: Factory,
  },
  {
    n: '04',
    title: 'Expédition + douane',
    desc: '30 jours de transit maritime + dédouanement géré par Pros Import EURL, votre importateur officiel.',
    Icon: Ship,
  },
  {
    n: '05',
    title: 'Rendu port',
    desc: 'Enlèvement libre au port, transporteur déjà choisi, ou mise en relation avec des transporteurs recommandés.',
    Icon: Anchor,
  },
]

export function HowItWorks() {
  return (
    <section
      id="comment"
      className="border-t border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]"
    >
      <div className="mx-auto max-w-7xl px-6 py-20">
        <Reveal className="mb-12 max-w-2xl">
          <div className="label-eyebrow text-[color:var(--ember)]">
            Le processus
          </div>
          <h2 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">
            Comment se déroule une commande container.
          </h2>
        </Reveal>

        {/* Timeline horizontale desktop, verticale mobile */}
        <RevealStagger className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-5">
          {STEPS.map((s) => (
            <RevealItem key={s.n}>
              <div className="group relative h-full overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card p-5 transition-all duration-300 hover:-translate-y-1 hover:border-[color:var(--ember)]/40 hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.25)]">
                <span className="absolute -right-1 top-1 select-none font-display text-5xl font-bold text-[color:var(--sand-deep)]/40 transition-colors duration-300 group-hover:text-[color:var(--ember)]/20">
                  {s.n}
                </span>
                <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--ember)]/10 text-[color:var(--ember)] transition-transform duration-300 group-hover:scale-110">
                  <s.Icon className="h-5 w-5" />
                </div>
                <h3 className="relative mt-4 font-display text-base font-semibold tracking-tight">
                  {s.title}
                </h3>
                <p className="relative mt-2 text-xs leading-relaxed text-[color:var(--ink-soft)]">
                  {s.desc}
                </p>
              </div>
            </RevealItem>
          ))}
        </RevealStagger>

        <div className="mt-6 text-xs">
          <a
            href="#faq"
            className="text-[color:var(--ember)] underline-offset-4 hover:underline"
          >
            Politique de remboursement complète →
          </a>
        </div>
      </div>
    </section>
  )
}
