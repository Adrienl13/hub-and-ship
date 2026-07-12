import { Anchor, Camera, Factory, Ship, Sofa } from 'lucide-react'

import { Reveal, RevealItem, RevealStagger } from '@/components/motion-helpers'

// D2 — la version visuelle de la page /prix : usine → container → port →
// terrasse. Les emplacements photo sont volontairement des slots « à
// venir » : ils seront remplis par les VRAIES photos du prochain container
// (contrôle SGS, chargement, déchargement, installation) — jamais par des
// visuels de substitution, pour rester cohérent avec « on vous montre la
// méthode » (audit C8 : zéro preuve fictive).

const STEPS = [
  {
    Icon: Factory,
    title: 'Usine & contrôle SGS',
    text: 'Inspection qualité indépendante avant chargement, rapport à l’appui.',
  },
  {
    Icon: Ship,
    title: 'Chargement du container',
    text: 'Empotage optimisé, scellé douanier, photos du manifeste.',
  },
  {
    Icon: Anchor,
    title: 'Arrivée au port',
    text: 'Dédouanement par nos soins — importateur officiel enregistré.',
  },
  {
    Icon: Sofa,
    title: 'Votre terrasse',
    text: 'Enlèvement port ou livraison — le mobilier entre en service.',
  },
] as const

export function ProofTimeline({ compact = false }: { compact?: boolean }) {
  return (
    <section
      aria-label="Le trajet de votre container en images"
      className={compact ? '' : 'border-y border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]'}
    >
      <div
        className={
          compact ? 'py-2' : 'mx-auto max-w-7xl px-6 py-12'
        }
      >
        {!compact && (
          <Reveal>
            <div className="label-eyebrow text-[color:var(--ember)]">
              La preuve par l&apos;image
            </div>
            <h2 className="mt-2 max-w-2xl font-display text-2xl tracking-tight sm:text-3xl">
              Chaque container documente son propre trajet.
            </h2>
          </Reveal>
        )}
        <RevealStagger
          className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-4 ${compact ? '' : 'mt-8'}`}
        >
          {STEPS.map(({ Icon, title, text }, index) => (
            <RevealItem key={title}>
              <div className="h-full rounded-md border border-[color:var(--sand-deep)] bg-card p-4">
                <div className="flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-sm bg-[color:var(--sand-soft)]">
                    <Icon className="h-[18px] w-[18px] text-[color:var(--ember)]" />
                  </span>
                  <span className="mono text-[11px] text-muted-foreground">
                    {index + 1}/4
                  </span>
                </div>
                <h3 className="mt-3 font-display text-sm font-semibold">
                  {title}
                </h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {text}
                </p>
                <div className="mt-3 flex items-center gap-1.5 rounded-sm border border-dashed border-[color:var(--border-strong)] px-2 py-1.5 text-[11px] text-muted-foreground">
                  <Camera className="h-3.5 w-3.5 shrink-0" />
                  Photos publiées à cette étape du container en cours
                </div>
              </div>
            </RevealItem>
          ))}
        </RevealStagger>
      </div>
    </section>
  )
}
