import { useEffect, useState } from 'react'
import { Palette, X } from 'lucide-react'

import { SafeImage } from '@/components/SafeImage'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import type { SiteMediaItem } from '@/lib/site-media'

// « Personnalisation incluse » — v2 allégée (retour validation Adrien
// 08/2026) : la grande bannière écrasait la grille. À la place :
//   1. une FENÊTRE qui s'affiche à l'arrivée sur le catalogue, UNE seule
//      fois par visiteur (localStorage, jamais bloquante) ;
//   2. un RAPPEL compact sur le côté (sidebar) qui peut la rouvrir à tout
//      moment.
// Le message reste identique au prototype validé.

const SEEN_KEY = 'terrassea-perso-intro-v1'

const STEPS = [
  '1 · Choisissez le modèle',
  '2 · Décrivez votre couleur',
  '3 · Prix + visuel sous 24 h',
] as const

function markSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, '1')
  } catch {
    // stockage indisponible (navigation privée) : la fenêtre reviendra,
    // tant pis — ne jamais casser la page pour ça.
  }
}

function hasSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return true
  }
}

export function CataloguePersoDialog({
  media,
  open,
  onOpenChange,
}: {
  readonly media: SiteMediaItem
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) markSeen()
        onOpenChange(next)
      }}
    >
      <DialogContent className="overflow-hidden rounded-md border-[color:var(--sand-deep)] p-0 sm:max-w-lg">
        <SafeImage
          src={media.url}
          alt={media.alt}
          loading="eager"
          className="h-44 w-full sm:h-52"
          imgClassName="h-44 w-full object-cover sm:h-52"
        />
        <div className="p-5 pt-4 sm:p-6 sm:pt-4">
          <div className="label-eyebrow text-[color:var(--ember)]">
            Personnalisation incluse
          </div>
          <DialogTitle className="mt-1.5 font-display text-xl font-semibold tracking-tight sm:text-2xl">
            Le même modèle, dans vos couleurs.
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm leading-6 text-muted-foreground">
            Tressage, textilène, laquage : si le coloris de votre terrasse
            n&apos;est pas au catalogue, la série part en production à votre
            couleur. Dès 50 pièces, sans surcoût.
          </DialogDescription>
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
          <button
            type="button"
            onClick={() => {
              markSeen()
              onOpenChange(false)
            }}
            className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-sm bg-foreground text-sm font-medium text-background transition-colors hover:bg-[color:var(--ink-soft)]"
          >
            Compris — je repère la pastille
            <span className="relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-dashed border-[color:var(--ember)]/70 bg-background/10 text-[color:var(--ember)]">
              <Palette className="h-3.5 w-3.5" />
              <span
                aria-hidden
                className="absolute right-0 top-[-1px] text-[9px] font-bold leading-none"
              >
                ＋
              </span>
            </span>
            sur les fiches
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Ouvre la fenêtre automatiquement à la première visite du catalogue. */
export function usePersoIntroAutoOpen(onOpen: () => void): void {
  useEffect(() => {
    if (hasSeen()) return
    // Petit délai : la grille se peint d'abord, la fenêtre n'interrompt
    // jamais le premier rendu.
    const timer = window.setTimeout(onOpen, 900)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

/** Rappel compact côté sidebar — rouvre la fenêtre au clic. */
export function PersoSidebarReminder({
  onOpen,
}: {
  readonly onOpen: () => void
}) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  return (
    <div className="relative rounded-md border border-dashed border-[color:var(--ember)]/50 bg-[color:var(--ember)]/5 p-3 pr-8">
      <button
        type="button"
        onClick={onOpen}
        className="block w-full text-left"
        aria-label="Voir comment personnaliser les coloris"
      >
        <span className="flex items-center gap-1.5 text-xs font-bold text-[color:var(--ember)]">
          <Palette className="h-3.5 w-3.5" />
          Vos couleurs, sans surcoût
        </span>
        <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">
          Le même modèle, dans vos coloris dès 50 pièces — cliquez la pastille
          orange en fin de rangée de coloris, sur n&apos;importe quelle fiche.
        </span>
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Masquer ce rappel"
        className="absolute right-2 top-2 text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
