// Surfacing the 40' GP offer to clients without breaking the 20'
// group-buy flow. Shows up only once a cart is large enough to justify
// the upgrade — distributors get the cue, smaller pros never see it.
//
// The CTA opens the user's mail client with a pre-filled message
// summarising what they've already configured, so the ops team can
// reply with a tailored quote without having to ask them everything
// again.

import { Mail, Truck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { CartItem } from '@/lib/order'

const QUOTE_RECIPIENT = 'adrienlaniez1@gmail.com'

export interface FortyFootUpgradeBannerProps {
  readonly usedCbm: number
  readonly items: ReadonlyArray<CartItem>
}

function buildMailto(items: ReadonlyArray<CartItem>, usedCbm: number): string {
  const lineSummary = items
    .filter((line) => line.quantity > 0)
    .map(
      (line) =>
        `- ${line.product.name} × ${line.quantity}` +
        (line.variant?.name ? ` (${line.variant.name})` : ''),
    )
    .join('\n')

  const subject = `Demande de devis 40' GP — ${usedCbm.toFixed(1)} m³ configurés`
  const body = [
    'Bonjour,',
    '',
    `Ma commande atteint ${usedCbm.toFixed(1)} m³, je souhaite étudier un container 40' General Purpose (68 m³ utiles).`,
    '',
    'Détail de ma configuration actuelle :',
    lineSummary || '- (panier en cours)',
    '',
    'Pouvez-vous me préparer un devis pour cette quantité (ou plus selon vos conseils) au format 40' + "' GP ?",
    '',
    'Cordialement,',
  ].join('\n')

  return `mailto:${QUOTE_RECIPIENT}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`
}

export function FortyFootUpgradeBanner({
  usedCbm,
  items,
}: FortyFootUpgradeBannerProps) {
  return (
    <div className="space-y-2 rounded-md border border-[color:var(--ember)]/30 bg-[color:var(--ember)]/5 p-3 text-xs">
      <div className="flex items-start gap-2">
        <Truck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--ember)]" />
        <div className="min-w-0">
          <div className="font-medium text-foreground">
            Volume distributeur ?
          </div>
          <p className="text-foreground/75 mt-1 leading-relaxed">
            Votre commande de{' '}
            <span className="font-medium tabular-nums">
              {usedCbm.toFixed(1)} m³
            </span>{' '}
            approche la capacité d'un 20'. Un 40' GP (68 m³ utiles) double
            quasiment le volume pour ~60 % de transport en plus — souvent
            rentable au-delà de 25 m³.
          </p>
        </div>
      </div>
      <Button
        asChild
        variant="outline"
        size="sm"
        className="h-9 w-full justify-center gap-1.5 rounded-sm border-[color:var(--ember)]/40 text-[color:var(--ember)] hover:bg-[color:var(--ember)]/10"
      >
        <a href={buildMailto(items, usedCbm)}>
          <Mail className="h-3.5 w-3.5" />
          Demander un devis 40' GP
        </a>
      </Button>
    </div>
  )
}
