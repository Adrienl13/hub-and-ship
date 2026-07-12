import { ShieldCheck, ArrowRight, Award, FileBadge } from 'lucide-react'
import { motion, type Variants } from 'framer-motion'
import { CURRENT_CONTAINER, type ContainerSummary } from '@/lib/products'
import { AnimatedNumber } from '@/components/motion-helpers'
import { ContainerStatusBadge } from '@/components/ContainerStatusBadge'
import { CountdownBadge } from '@/components/CountdownBadge'

const LINE_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: 'easeOut' },
  },
}

function formatDate(iso: string | null) {
  if (!iso) return 'date à confirmer'
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function Hero({
  fillPercent,
  seriesReached,
  totalSeries,
  professionalsEngaged,
  container = CURRENT_CONTAINER,
}: {
  fillPercent: number
  seriesReached: number
  totalSeries: number
  professionalsEngaged: number
  container?: ContainerSummary
}) {
  return (
    <section id="top" className="relative overflow-hidden">
      {/* Aura animée en fond — dérive lente, derrière le contenu */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <motion.div
          className="absolute -left-20 -top-28 h-80 w-80 rounded-full bg-[color:var(--ember)]/25 blur-3xl"
          animate={{ x: [0, 60, 0], y: [0, 30, 0], scale: [1, 1.18, 1] }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute right-[-6%] top-1/4 h-96 w-96 rounded-full bg-[color:var(--forest)]/18 blur-3xl"
          animate={{ x: [0, -60, 0], y: [0, -25, 0], scale: [1, 1.22, 1] }}
          transition={{ duration: 19, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute left-1/3 top-[-20%] h-72 w-72 rounded-full bg-[color:var(--ochre)]/15 blur-3xl"
          animate={{ x: [0, -30, 0], y: [0, 40, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 pb-16 pt-12 sm:pt-16">
        {/* Bandeau pré-header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="border-[color:var(--ember)]/30 bg-[color:var(--ember)]/8 mb-10 inline-flex items-center gap-2 rounded-sm border px-3 py-1.5 text-xs"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[color:var(--forest)] opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[color:var(--forest)]" />
          </span>
          <span className="font-medium text-foreground">
            Container {container.reference} ouvert
          </span>
          <span className="text-foreground/60">·</span>
          <span className="text-foreground/70">
            Destination {container.port}
          </span>
          <span className="text-foreground/60">·</span>
          <span className="text-foreground/70">
            Clôture estimée {formatDate(container.expectedCloseAt)}
          </span>
          <CountdownBadge
            target={container.expectedCloseAt}
            withIcon={false}
            className="border-[color:var(--ember)]/40 bg-[color:var(--ember)]/15 ml-1 inline-flex animate-pulse items-center rounded-sm border px-2 py-0.5 text-[11px] font-semibold text-[color:var(--ember)]"
          />
        </motion.div>

        <div className="grid gap-12 lg:grid-cols-12 lg:gap-10">
          {/* Texte */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="lg:col-span-7"
          >
            <motion.h1
              className="font-display text-4xl leading-[1.05] sm:text-5xl md:text-6xl"
              initial="hidden"
              animate="show"
              variants={{
                show: {
                  transition: { staggerChildren: 0.13, delayChildren: 0.15 },
                },
              }}
            >
              <motion.span className="block" variants={LINE_VARIANTS}>
                Mobilier outdoor pro,
              </motion.span>
              <motion.span className="block" variants={LINE_VARIANTS}>
                <motion.span
                  className="inline-block bg-[length:200%_auto] bg-clip-text text-transparent"
                  style={{
                    backgroundImage:
                      'linear-gradient(90deg, var(--ember), #efb15a 45%, var(--ember))',
                  }}
                  animate={{ backgroundPosition: ['0% 50%', '200% 50%'] }}
                  transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
                >
                  direct usine,
                </motion.span>
              </motion.span>
              <motion.span className="block" variants={LINE_VARIANTS}>
                sans intermédiaire.
              </motion.span>
            </motion.h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-[color:var(--ink-soft)]">
              Pré-commande groupée par container 20' avec d'autres
              professionnels. Jusqu'à{' '}
              <strong className="font-semibold text-foreground">−40%</strong> vs
              retail français. Importation, douane et garantie 2 ans incluses.
            </p>

            {/* UN CTA principal (D1) : le hero doit avoir une action évidente. */}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="/catalogue"
                className="inline-flex h-12 items-center gap-2 rounded-sm bg-[color:var(--foreground)] px-6 text-sm font-medium text-[color:var(--background)] transition-colors hover:bg-[color:var(--ink-soft)]"
              >
                Voir le catalogue
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="#comment"
                className="inline-flex h-12 items-center rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-5 text-sm font-medium transition-colors hover:border-foreground/40"
              >
                Comment ça marche
              </a>
            </div>

            {/* Chips réassurance */}
            <div className="mt-8 flex flex-wrap gap-2">
              {[
                { Icon: FileBadge, label: 'Importateur officiel français' },
                { Icon: Award, label: 'Contrôle qualité SGS avant expédition' },
                { Icon: ShieldCheck, label: 'Garantie 2 ans + SAV France' },
              ].map(({ Icon, label }) => (
                <span
                  key={label}
                  className="text-foreground/80 inline-flex items-center gap-1.5 rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-3 py-1.5 text-xs"
                >
                  <Icon
                    className="text-foreground/60 h-3.5 w-3.5"
                    strokeWidth={1.5}
                  />
                  {label}
                </span>
              ))}
            </div>
          </motion.div>

          {/* Mini-card container */}
          <motion.aside
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="lg:col-span-5"
          >
            <div className="shadow-paper rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] p-5">
              <div className="flex items-center justify-between">
                <span className="label-eyebrow text-muted-foreground">
                  Container en cours
                </span>
                <ContainerStatusBadge
                  status={container.status}
                  fillPercent={fillPercent}
                  thresholdPercent={container.thresholdPercent}
                />
              </div>
              <div className="mt-3 font-display text-xl font-semibold tracking-tight">
                {container.reference}
              </div>
              <div className="text-xs text-muted-foreground">
                Destination {container.port} · 20' High Cube
              </div>

              {/* Progress — jauge honnête : elle mesure la sélection du
                  visiteur (son panier), pas un remplissage global inventé. */}
              <div className="mt-5">
                <div className="mb-1.5 flex items-baseline justify-between text-xs">
                  <span className="text-muted-foreground">
                    Votre sélection
                  </span>
                  <span className="font-display text-lg font-semibold tabular-nums">
                    <AnimatedNumber value={fillPercent} suffix="%" />
                  </span>
                </div>
                <div className="relative h-1 w-full overflow-hidden rounded-full bg-[color:var(--sand-deep)]">
                  <motion.div
                    className="h-full bg-[color:var(--foreground)]"
                    initial={{ width: 0 }}
                    animate={{ width: `${fillPercent}%` }}
                    transition={{
                      duration: 1.1,
                      ease: [0.22, 1, 0.36, 1],
                      delay: 0.25,
                    }}
                  />
                  <motion.div
                    className="absolute inset-y-[-3px] w-[40%] -translate-x-full bg-gradient-to-r from-transparent via-white/60 to-transparent"
                    animate={{ x: ['-100%', '260%'] }}
                    transition={{
                      duration: 2.6,
                      ease: 'easeInOut',
                      repeat: Infinity,
                      repeatDelay: 1.4,
                    }}
                  />
                  <div
                    className="absolute inset-y-0 w-px bg-[color:var(--ember)]"
                    style={{ left: `${container.thresholdPercent}%` }}
                  />
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                  <span>0%</span>
                  <span>Seuil départ {container.thresholdPercent}%</span>
                  <span>100%</span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[color:var(--sand-deep)] pt-4 text-xs">
                <div>
                  <div className="label-eyebrow text-muted-foreground">
                    Séries
                  </div>
                  <div className="mt-0.5 font-display text-base font-semibold tabular-nums">
                    <AnimatedNumber value={seriesReached} />/{totalSeries}
                  </div>
                </div>
                <div>
                  <div className="label-eyebrow text-muted-foreground">
                    Pros engagés
                  </div>
                  <div className="mt-0.5 font-display text-base font-semibold tabular-nums">
                    <AnimatedNumber value={professionalsEngaged} />
                  </div>
                </div>
              </div>
            </div>
          </motion.aside>
        </div>
      </div>
    </section>
  )
}
