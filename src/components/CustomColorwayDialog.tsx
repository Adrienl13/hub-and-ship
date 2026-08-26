import { useState } from 'react'
import { Palette, Send } from 'lucide-react'
import { toast } from 'sonner'

import { SafeImage } from '@/components/SafeImage'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { AnalyticsEvent, track } from '@/lib/analytics'
import { getAttributionFields } from '@/lib/analytics/attribution'
import { buildContactMessageDraft } from '@/lib/contact'
import type { DesignVariant, Product } from '@/lib/products'

// Demande de coloris sur mesure SANS quitter la fiche : le produit reste
// sous les yeux (photo du design regardé au moment du clic), la demande se
// décrit en 3 champs guidés au lieu d'un message libre sur /contact —
// moins de friction pour l'acheteur, informations structurées pour nous
// (coloris rêvé + volume + échéance = de quoi qualifier le projet usine).

const QUANTITY_CHOICES = ['Moins de 50', '50 – 100', '100 – 300', '300 +']
const TIMELINE_CHOICES = [
  'Prochain container',
  'Dans 1 à 3 mois',
  'Plus tard',
  'Je me renseigne',
]

const inputClass =
  'h-10 rounded-sm border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]'

function ChoiceChips({
  label,
  choices,
  value,
  onChange,
}: {
  readonly label: string
  readonly choices: ReadonlyArray<string>
  readonly value: string
  readonly onChange: (value: string) => void
}) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {choices.map((choice) => {
          const selected = value === choice
          return (
            <button
              key={choice}
              type="button"
              aria-pressed={selected}
              // Re-cliquer désélectionne : ces champs restent optionnels.
              onClick={() => onChange(selected ? '' : choice)}
              className={`h-8 rounded-full border px-3 text-xs font-medium transition-colors ${
                selected
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-[color:var(--sand-deep)] bg-card hover:border-foreground/40'
              }`}
            >
              {choice}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function CustomColorwayDialog({
  product,
  variant,
  open,
  onOpenChange,
}: {
  readonly product: Product
  /** Design affiché au moment du clic — sa photo sert de référence visuelle. */
  readonly variant?: DesignVariant
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}) {
  const [colorway, setColorway] = useState('')
  const [quantity, setQuantity] = useState('')
  const [timeline, setTimeline] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const imageUrl = variant?.imageUrl ?? product.mainImageUrl
  const existingColorways = product.variants.map((v) => v.name).join(' · ')

  const submit = async () => {
    if (!colorway.trim()) {
      toast.error('Décrivez le coloris souhaité', {
        description:
          'Une couleur, un nuancier (RAL/Pantone) ou même « comme la photo mais en vert » suffit.',
      })
      return
    }

    // Message structuré : tout le contexte produit voyage avec la demande,
    // l'acheteur n'a rien à ré-expliquer.
    const message = [
      `Demande de personnalisation — ${product.name} (réf. ${product.sku})`,
      variant ? `Design regardé : ${variant.name}` : null,
      `Coloris / tressage souhaité : ${colorway.trim()}`,
      quantity ? `Quantité envisagée : ${quantity}` : null,
      timeline ? `Échéance : ${timeline}` : null,
    ]
      .filter(Boolean)
      .join('\n')

    const draftResult = buildContactMessageDraft({
      name,
      email,
      phone,
      topic: 'produit',
      message,
    })
    if (!draftResult.ok) {
      toast.error('Demande à compléter', { description: draftResult.error })
      return
    }

    setSubmitting(true)
    let sent = false
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          phone,
          topic: 'produit',
          message,
          attribution: getAttributionFields(Date.now()),
        }),
      })
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean
        error?: string
      } | null
      sent = response.ok && payload?.ok === true
      if (!sent) {
        toast.error('Demande non envoyée', {
          description:
            payload?.error ??
            'Réessayez dans un instant, ou écrivez-nous à adrienlaniez1@gmail.com.',
        })
      }
    } catch {
      toast.error('Demande non envoyée', {
        description:
          'Connexion impossible. Écrivez-nous à adrienlaniez1@gmail.com.',
      })
    }
    setSubmitting(false)
    if (!sent) return

    track(AnalyticsEvent.CustomColorwayRequest, { sku: product.sku })
    toast.success('Demande de personnalisation envoyée', {
      description:
        'Nous revenons vers vous sous 24 h ouvrées avec la faisabilité et le tarif.',
    })
    setColorway('')
    setQuantity('')
    setTimeline('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-md border-[color:var(--sand-deep)] p-0 sm:max-w-md">
        <DialogHeader className="space-y-1 px-5 pt-5 text-left">
          <DialogTitle className="flex items-center gap-2 font-display text-lg tracking-tight">
            <Palette className="h-4 w-4 text-[color:var(--ember)]" />
            Votre coloris sur mesure
          </DialogTitle>
          <DialogDescription className="text-xs leading-5">
            Fabrication à vos couleurs (nuancier Pantone / RAL) directement à
            l&apos;usine — réponse sous 24 h ouvrées.
          </DialogDescription>
        </DialogHeader>

        {/* Rappel visuel : la personne décrit sa demande EN regardant le
            produit — plus besoin de se souvenir de la référence. min-w-0 :
            sans lui, la ligne « Déjà dispo » (truncate) impose sa largeur
            intrinsèque à la colonne du DialogContent (grid) et tout le
            dialogue déborde à droite. */}
        <div className="mx-5 flex min-w-0 items-center gap-3 rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] p-2.5">
          <span className="h-16 w-16 shrink-0 overflow-hidden rounded-[3px] bg-white">
            <SafeImage
              src={imageUrl}
              alt={product.name}
              className="h-full w-full"
              imgClassName="h-full w-full object-contain"
            />
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{product.name}</div>
            <div className="text-[11px] text-muted-foreground">
              Réf. {product.sku}
              {variant ? ` · design regardé : ${variant.name}` : ''}
            </div>
            {existingColorways && (
              <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                Déjà dispo : {existingColorways}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3.5 px-5 pb-5">
          <div>
            <label
              htmlFor="custom-colorway"
              className="text-xs font-medium text-muted-foreground"
            >
              Le coloris / tressage que vous imaginez *
            </label>
            <textarea
              id="custom-colorway"
              value={colorway}
              onChange={(e) => setColorway(e.target.value)}
              placeholder="Ex. tressage vert sapin / crème, structure noire — une référence RAL ou Pantone si vous l'avez."
              className="mt-1.5 min-h-[64px] w-full resize-y rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-foreground"
            />
          </div>

          <ChoiceChips
            label="Quantité envisagée (optionnel)"
            choices={QUANTITY_CHOICES}
            value={quantity}
            onChange={setQuantity}
          />
          <ChoiceChips
            label="Pour quand ? (optionnel)"
            choices={TIMELINE_CHOICES}
            value={timeline}
            onChange={setTimeline}
          />

          <div className="grid gap-2.5 border-t border-[color:var(--sand-deep)] pt-3.5 sm:grid-cols-2">
            <Input
              className={inputClass}
              value={name}
              placeholder="Votre nom *"
              autoComplete="name"
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              className={inputClass}
              type="email"
              value={email}
              placeholder="Email professionnel *"
              autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              className={`${inputClass} sm:col-span-2`}
              type="tel"
              value={phone}
              placeholder="Téléphone (optionnel — pour en parler de vive voix)"
              autoComplete="tel"
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <Button
            type="button"
            onClick={() => void submit()}
            disabled={submitting}
            className="h-11 w-full gap-2 rounded-sm bg-foreground text-background"
          >
            <Send className="h-4 w-4" />
            {submitting ? 'Envoi…' : 'Envoyer ma demande'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
