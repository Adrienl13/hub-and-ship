import { Palette } from 'lucide-react'

import { SafeImage } from '@/components/SafeImage'
import type { SiteMediaItem } from '@/lib/site-media'

// Bannière « Personnalisation incluse » en tête de grille (handoff design
// 08/2026, validé) : la personnalisation est un ARGUMENT du catalogue, pas
// une option cachée — photo du même modèle en plusieurs coloris, 3 étapes,
// renvoi vers le bouton « ＋ Votre couleur » présent sur chaque fiche.

const STEPS = [
  '1 · Choisissez le modèle',
  '2 · Décrivez votre couleur',
  '3 · Prix + visuel sous 24 h',
] as const

export function CataloguePersoBanner({
  media,
}: {
  readonly media: SiteMediaItem
}) {
  return (
    <section
      aria-label="Personnalisation incluse"
      className="mb-4 overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card"
    >
      <div className="grid md:grid-cols-[minmax(220px,340px)_1fr]">
        <SafeImage
          src={media.url}
          alt={media.alt}
          className="h-full max-h-[210px] w-full md:max-h-none"
          imgClassName="h-full max-h-[210px] w-full object-cover md:max-h-none"
        />
        <div className="p-5 sm:p-6">
          <div className="label-eyebrow text-[color:var(--ember)]">
            Personnalisation incluse
          </div>
          <h2 className="mt-1.5 font-display text-xl font-semibold tracking-tight sm:text-2xl">
            Le même modèle, dans vos couleurs.
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Tressage, textilène, laquage : si le coloris de votre terrasse
            n&apos;est pas au catalogue, la série part en production à votre
            couleur. Dès 50 pièces, sans surcoût.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {STEPS.map((step) => (
              <span
                key={step}
                className="inline-flex h-8 items-center rounded-full border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-3 text-xs font-medium"
              >
                {step}
              </span>
            ))}
          </div>
          <p className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            → Cliquez
            <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-[color:var(--ember)]/60 px-2.5 py-1 text-[11px] font-bold text-[color:var(--ember)]">
              <Palette className="h-3 w-3" />＋ Votre couleur
            </span>
            sur n&apos;importe quelle fiche.
          </p>
        </div>
      </div>
    </section>
  )
}
