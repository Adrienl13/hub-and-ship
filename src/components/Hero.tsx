import { useEffect, useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'

import { CountdownBadge } from '@/components/CountdownBadge'
import { AnimatedNumber } from '@/components/motion-helpers'
import { CURRENT_CONTAINER, type ContainerSummary } from '@/lib/products'
import type { SiteMediaItem } from '@/lib/site-media'

// Hero v2 (handoff design 07/2026) : carrousel photo à droite (56 %),
// texte à gauche, carte « Container en cours » en verre dépoli — données
// temps réel. Auto-avance 5,5 s, flèches, pastilles, swipe tactile ; toute
// interaction manuelle stoppe l'auto-play (comme le prototype).

const AUTOPLAY_MS = 5500
const SWIPE_THRESHOLD_PX = 40

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
  slides,
}: {
  fillPercent: number
  seriesReached: number
  totalSeries: number
  professionalsEngaged: number
  container?: ContainerSummary
  slides: ReadonlyArray<SiteMediaItem>
}) {
  const count = Math.max(1, slides.length)
  const [index, setIndex] = useState(0)
  const [autoplay, setAutoplay] = useState(true)
  const touchStartX = useRef<number | null>(null)

  // Le nombre de slides peut changer quand l'admin en ajoute/retire.
  const safeIndex = index % count

  useEffect(() => {
    if (!autoplay || count <= 1) return
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % count)
    }, AUTOPLAY_MS)
    return () => clearInterval(timer)
  }, [autoplay, count])

  const goTo = (next: number) => {
    setAutoplay(false)
    setIndex(((next % count) + count) % count)
  }

  const onTouchStart = (event: React.TouchEvent) => {
    touchStartX.current = event.touches[0]?.clientX ?? null
  }
  const onTouchEnd = (event: React.TouchEvent) => {
    const start = touchStartX.current
    touchStartX.current = null
    const end = event.changedTouches[0]?.clientX
    if (start === null || end === undefined) return
    const delta = end - start
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return
    goTo(delta < 0 ? safeIndex + 1 : safeIndex - 1)
  }

  return (
    <section id="top" className="mx-auto max-w-[1240px] px-5 pt-7 sm:px-10">
      <div className="relative overflow-hidden rounded-[22px] bg-[color:var(--sand)] shadow-[0_30px_80px_-34px_rgba(26,24,21,.4)] lg:h-[660px]">
        {/* Carrousel photo */}
        <div
          className="relative h-[300px] w-full sm:h-[400px] lg:absolute lg:bottom-0 lg:right-0 lg:top-0 lg:h-auto lg:w-[56%]"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {slides.map((slide, i) => (
            <div
              key={slide.id}
              className="absolute inset-0 transition-opacity duration-[550ms] ease-in-out"
              style={{ opacity: i === safeIndex ? 1 : 0 }}
              aria-hidden={i !== safeIndex}
            >
              <img
                src={slide.url}
                alt={slide.alt}
                className="h-full w-full object-cover"
                loading={i === 0 ? 'eager' : 'lazy'}
                draggable={false}
              />
            </div>
          ))}

          {/* Fondu crème vers le texte (gauche en desktop, bas en mobile) */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(0deg,rgba(244,239,231,1)_0%,rgba(244,239,231,0)_20%)] lg:bg-[linear-gradient(90deg,rgba(244,239,231,1)_0%,rgba(244,239,231,.35)_14%,rgba(244,239,231,0)_36%)]"
          />

          {count > 1 && (
            <>
              {/* Flèches */}
              <div className="absolute right-[22px] top-[22px] z-[4] flex gap-2.5">
                <button
                  type="button"
                  onClick={() => goTo(safeIndex - 1)}
                  aria-label="Photo précédente"
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-white/50 bg-[rgba(28,25,22,.42)] text-[19px] text-white backdrop-blur transition-colors hover:bg-[rgba(28,25,22,.72)]"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => goTo(safeIndex + 1)}
                  aria-label="Photo suivante"
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-white/50 bg-[rgba(28,25,22,.42)] text-[19px] text-white backdrop-blur transition-colors hover:bg-[rgba(28,25,22,.72)]"
                >
                  ›
                </button>
              </div>

              {/* Pastilles */}
              <div className="absolute right-[22px] top-[78px] z-[4] flex justify-end gap-[7px]">
                {slides.map((slide, i) => (
                  <button
                    key={slide.id}
                    type="button"
                    onClick={() => goTo(i)}
                    aria-label={`Photo ${i + 1}`}
                    aria-current={i === safeIndex}
                    className="h-[7px] rounded-full transition-all duration-300"
                    style={{
                      width: i === safeIndex ? 22 : 7,
                      background:
                        i === safeIndex
                          ? 'var(--ember)'
                          : 'rgba(255,255,255,.65)',
                    }}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Texte */}
        <div className="relative z-[2] flex flex-col gap-6 px-5 pt-6 sm:px-8 lg:absolute lg:left-11 lg:top-16 lg:w-[540px] lg:p-0">
          <div className="inline-flex w-max max-w-full items-center gap-2 rounded-full border border-[color:var(--border-strong)] bg-white px-3.5 py-[7px]">
            <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-[#7BB661] shadow-[0_0_0_3px_rgba(123,182,97,.22)]" />
            <span className="truncate text-[12.5px] font-semibold text-[#4a443c]">
              Container {container.reference} ouvert · Clôture estimée{' '}
              {formatDate(container.expectedCloseAt)}
            </span>
            <CountdownBadge
              target={container.expectedCloseAt}
              withIcon={false}
              className="hidden shrink-0 items-center rounded-full bg-[color:var(--ember-soft)] px-2 py-0.5 text-[11px] font-bold text-[color:var(--ember)] sm:inline-flex"
            />
          </div>

          <h1 className="m-0 text-[38px] font-extrabold leading-[0.96] tracking-[-0.03em] text-foreground sm:text-[50px] lg:text-[66px]">
            Mobilier outdoor pro,
            <br className="hidden lg:block" />{' '}
            <span className="text-[color:var(--ember)]">
              direct usine,&nbsp;
            </span>
            sans intermédiaire.
          </h1>

          <p className="m-0 max-w-[430px] text-[17px] leading-normal text-[color:var(--ink-soft)] lg:text-lg">
            Pré-commande groupée par container 20&apos; entre professionnels.
            Jusqu&apos;à{' '}
            <strong className="font-bold text-foreground">−40%</strong> vs
            retail français. Import, douane et garantie 2 ans inclus.
          </p>

          <div className="flex flex-wrap gap-3.5">
            <a
              href="/catalogue"
              className="inline-flex items-center gap-2 rounded-[11px] bg-foreground px-6 py-[15px] text-base font-bold text-[color:var(--sand)] transition-colors hover:bg-[color:var(--color-cta-primary-hover)]"
            >
              Voir le catalogue
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="#comment"
              className="inline-flex items-center rounded-[11px] border border-[color:var(--border-strong)] bg-white px-6 py-[15px] text-base font-semibold text-foreground transition-colors hover:border-foreground/40"
            >
              Comment ça marche
            </a>
          </div>

          <div className="mt-1.5 flex flex-wrap gap-2.5">
            {[
              'Importateur officiel FR',
              'Contrôle SGS',
              'Garantie 2 ans',
            ].map((label) => (
              <span
                key={label}
                className="inline-flex items-center gap-2 rounded-lg border border-[color:var(--border-strong)] px-3.5 py-2 text-[12.5px] font-semibold text-[#4a443c]"
              >
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Carte container — verre dépoli, données temps réel */}
        <div className="relative z-[2] m-5 flex flex-col gap-3.5 rounded-2xl border border-white/60 bg-white/90 p-5 shadow-[0_20px_40px_-18px_rgba(26,24,21,.45)] backdrop-blur-md sm:m-7 lg:absolute lg:bottom-8 lg:right-8 lg:m-0 lg:w-[280px]">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-[color:var(--muted)]">
              Container en cours
            </span>
            <span className="inline-flex items-center gap-[5px] text-xs font-bold text-[color:var(--forest)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--forest)]" />
              {container.status === 'open' ? 'Ouvert' : 'Clôturé'}
            </span>
          </div>
          <div className="text-[22px] font-extrabold text-foreground">
            {container.reference}
          </div>
          <div className="flex flex-col gap-[7px]">
            <div className="flex items-baseline justify-between">
              <span className="text-[12.5px] text-[color:var(--color-text-secondary)]">
                Votre sélection
              </span>
              <span className="text-lg font-extrabold text-foreground">
                <AnimatedNumber value={fillPercent} suffix="%" />
              </span>
            </div>
            <div className="relative h-1.5 rounded-full bg-[color:var(--sand-deep)]">
              <div
                className="absolute bottom-0 left-0 top-0 rounded-full bg-[color:var(--ember)] transition-[width] duration-700"
                style={{ width: `${Math.min(100, fillPercent)}%` }}
              />
              <div
                className="absolute -bottom-[3px] -top-[3px] w-0.5 bg-[#b7ac98]"
                style={{ left: `${container.thresholdPercent}%` }}
              />
            </div>
            <div className="text-[11px] text-[color:var(--muted)]">
              Départ du container à {container.thresholdPercent}%
            </div>
          </div>
          <div className="flex gap-[22px] border-t border-[color:var(--sand-deep)] pt-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--muted)]">
                Séries
              </div>
              <div className="text-[17px] font-extrabold text-foreground">
                <AnimatedNumber value={seriesReached} />/{totalSeries}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--muted)]">
                Pros
              </div>
              <div className="text-[17px] font-extrabold text-foreground">
                <AnimatedNumber value={professionalsEngaged} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
