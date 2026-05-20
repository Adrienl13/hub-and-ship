import { ArrowRight, FileBadge, ShieldCheck } from 'lucide-react'

import { Reveal } from '@/components/motion-helpers'
import { Button } from '@/components/ui/button'

export function FinalCta({ onReserve }: { onReserve: () => void }) {
  return (
    <section className="border-t border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <Reveal className="grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
          <div className="max-w-2xl">
            <div className="label-eyebrow text-[color:var(--ember)]">
              Prêt à rejoindre
            </div>
            <h2 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">
              Réservez votre volume sur le prochain container.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[color:var(--ink-soft)]">
              Les frais de réservation bloquent votre place. Le complément n'est
              appelé que lorsque le container atteint son seuil de remplissage.
            </p>
            <div className="text-foreground/75 mt-5 flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-sm border border-[color:var(--sand-deep)] px-3 py-1.5">
                <ShieldCheck className="h-3.5 w-3.5" />
                Remboursement si Container Club annule
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-sm border border-[color:var(--sand-deep)] px-3 py-1.5">
                <FileBadge className="h-3.5 w-3.5" />
                Facture française et import officiel
              </span>
            </div>
          </div>

          <Button
            type="button"
            className="h-12 rounded-sm bg-[color:var(--foreground)] px-5 text-[color:var(--background)] hover:bg-[color:var(--ink-soft)]"
            onClick={onReserve}
          >
            Confirmer ma réservation
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Reveal>
      </div>
    </section>
  )
}
