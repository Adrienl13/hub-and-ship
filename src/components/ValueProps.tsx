import { Factory, ShieldCheck, UsersRound } from 'lucide-react'
import { motion } from 'framer-motion'

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
        <RevealStagger className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {VALUE_PROPS.map(({ Icon, title, description }, i) => (
            <RevealItem key={title}>
              <div className="group h-full rounded-md border border-[color:var(--sand-deep)] bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-[color:var(--ember)]/40 hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.25)]">
                <motion.div
                  className="mb-6 flex h-12 w-12 items-center justify-center rounded-md bg-[length:200%_auto] text-white shadow-sm"
                  style={{
                    backgroundImage:
                      'linear-gradient(90deg, var(--ember), #efb15a 45%, var(--ember))',
                  }}
                  animate={{
                    y: [0, -9, 0],
                    scale: [1, 1.08, 1],
                    backgroundPosition: ['0% 50%', '200% 50%'],
                  }}
                  transition={{
                    y: {
                      duration: 2.4,
                      repeat: Infinity,
                      ease: 'easeInOut',
                      delay: i * 0.3,
                    },
                    scale: {
                      duration: 2.4,
                      repeat: Infinity,
                      ease: 'easeInOut',
                      delay: i * 0.3,
                    },
                    backgroundPosition: {
                      duration: 4,
                      repeat: Infinity,
                      ease: 'linear',
                    },
                  }}
                >
                  <Icon
                    className="h-5 w-5 transition-transform duration-500 group-hover:rotate-[12deg]"
                    strokeWidth={1.8}
                  />
                </motion.div>
                <h2 className="font-display text-lg font-semibold tracking-tight">
                  {title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[color:var(--ink-soft)]">
                  {description}
                </p>
              </div>
            </RevealItem>
          ))}
        </RevealStagger>
      </div>
    </section>
  )
}
