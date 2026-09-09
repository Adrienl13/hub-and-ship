import type { CustomTabletopRequest } from '@/lib/studio/table-project'
import { useState } from 'react'
import { Ruler, Send } from 'lucide-react'
import { toast } from 'sonner'

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

// Plateau découpé sur mesure : les dimensions et le prix dépendent du projet,
// donc pas de prix affiché — une demande structurée part par email (même
// canal que le coloris sur mesure), le piètement déjà choisi voyage avec.
// Une fois le tarif convenu, l'admin crée le plateau comme produit « sur
// demande » et envoie un lien de panier pré-rempli.

const SHAPE_CHOICES = ['Rectangulaire / carré', 'Rond'] as const
const QUANTITY_CHOICES = ['1 – 10', '10 – 30', '30 – 100', '100 +']

const inputClass =
  'h-10 rounded-sm border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]'

function Chips({
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
              onClick={() => onChange(selected ? '' : choice)}
              className={`h-8 rounded-full border px-3 text-xs font-medium transition-colors ${
                selected
                  ? 'border-foreground bg-foreground text-background'
                  : 'hover:border-foreground/40 border-[color:var(--sand-deep)] bg-card'
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

export function CustomTableTopDialog({
  open,
  onOpenChange,
  base,
  baseVariant,
  onSaveProject,
  onCloseAutoFocus,
}: {
  readonly onCloseAutoFocus?: (event: Event) => void
  readonly onSaveProject?: (request: CustomTabletopRequest) => void
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  /** Piètement déjà choisi dans le composeur, s'il y en a un. */
  readonly base?: Product | null
  readonly baseVariant?: DesignVariant | null
}) {
  const [length, setLength] = useState('')
  const [width, setWidth] = useState('')
  const [shape, setShape] = useState<string>(SHAPE_CHOICES[0])
  const [finish, setFinish] = useState('')
  const [quantity, setQuantity] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const isRound = shape === 'Rond'

  const submit = async () => {
    const l = Number(length)
    const w = isRound ? l : Number(width)
    if (!(l > 0) || !(w > 0)) {
      toast.error('Indiquez les dimensions du plateau', {
        description: isRound
          ? 'Le diamètre en centimètres.'
          : 'Longueur et largeur en centimètres.',
      })
      return
    }

    if (onSaveProject) {
      if (!Number.isFinite(l) || !Number.isFinite(w) || l > 9999 || w > 9999) {
        toast.error('Dimensions invalides (maximum 9999 cm).')
        return
      }
      onSaveProject({
        shape: isRound ? 'round' : 'rectangular',
        length: l,
        width: w,
        finish: finish.trim().slice(0, 160),
      })
      onOpenChange(false)
      return
    }
    const message = [
      'Demande de plateau sur mesure',
      base
        ? `Piètement choisi : ${base.name} (réf. ${base.sku})${baseVariant ? ` — ${baseVariant.name}` : ''}`
        : null,
      `Forme : ${shape}`,
      isRound ? `Dimensions : Ø ${l} cm` : `Dimensions : ${l} × ${w} cm`,
      finish.trim() ? `Matière / coloris souhaité : ${finish.trim()}` : null,
      quantity ? `Quantité envisagée : ${quantity}` : null,
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

    track(AnalyticsEvent.CustomTableTopRequest, {
      base: base?.sku ?? 'none',
    })
    toast.success('Demande de plateau sur mesure envoyée', {
      description:
        'Nous revenons vers vous sous 24 h ouvrées avec le tarif ; vous pourrez ensuite réserver en ligne au prix convenu.',
    })
    setLength('')
    setWidth('')
    setFinish('')
    setQuantity('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onCloseAutoFocus={onCloseAutoFocus}
        className="max-h-[90dvh] overflow-y-auto rounded-md border-[color:var(--sand-deep)] p-0 sm:max-w-md [&>button]:min-w-[44px] [&_button]:min-h-[44px] [&_input]:min-h-[44px]"
      >
        <DialogHeader className="space-y-1 px-5 pt-5 text-left">
          <DialogTitle className="flex items-center gap-2 font-display text-lg tracking-tight">
            <Ruler className="h-4 w-4 text-[color:var(--ember)]" />
            Plateau sur mesure
          </DialogTitle>
          <DialogDescription className="text-xs leading-5">
            {onSaveProject
              ? 'Conservez les dimensions souhaitées dans votre projet. La faisabilité et le prix restent à confirmer.'
              : 'Nos plateaux se découpent à la dimension de votre projet. Décrivez le besoin : tarif sous 24 h ouvrées, puis réservation en ligne au prix convenu.'}
          </DialogDescription>
        </DialogHeader>

        {base && (
          <div className="mx-5 rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-3 py-2 text-xs">
            <span className="text-muted-foreground">Piètement choisi : </span>
            <span className="font-medium">{base.name}</span>
            {baseVariant ? (
              <span className="text-muted-foreground">
                {' '}
                · {baseVariant.name}
              </span>
            ) : null}
          </div>
        )}

        <div className="space-y-3.5 px-5 pb-5">
          <Chips
            label="Forme"
            choices={SHAPE_CHOICES}
            value={shape}
            onChange={(value) => setShape(value || SHAPE_CHOICES[0])}
          />

          <div className="grid gap-2.5 sm:grid-cols-2">
            <Input
              className={inputClass}
              type="number"
              min={1}
              inputMode="numeric"
              value={length}
              aria-label={isRound ? 'Diamètre (cm)' : 'Longueur (cm)'}
              placeholder={isRound ? 'Diamètre (cm) *' : 'Longueur (cm) *'}
              onChange={(e) => setLength(e.target.value)}
            />
            {!isRound && (
              <Input
                className={inputClass}
                type="number"
                min={1}
                inputMode="numeric"
                value={width}
                aria-label="Largeur (cm)"
                placeholder="Largeur (cm) *"
                onChange={(e) => setWidth(e.target.value)}
              />
            )}
          </div>

          <Input
            className={inputClass}
            value={finish}
            aria-label="Matière / coloris souhaité"
            placeholder="Matière / coloris souhaité (ex. HPL chêne clair)"
            onChange={(e) => setFinish(e.target.value)}
          />

          {!onSaveProject && (
            <Chips
              label="Quantité envisagée (optionnel)"
              choices={QUANTITY_CHOICES}
              value={quantity}
              onChange={setQuantity}
            />
          )}

          {!onSaveProject && (
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
                placeholder="Téléphone (optionnel)"
                autoComplete="tel"
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          )}

          <Button
            type="button"
            onClick={() => void submit()}
            disabled={submitting}
            className="h-11 w-full gap-2 rounded-sm bg-foreground text-background"
          >
            <Send className="h-4 w-4" />
            {onSaveProject
              ? 'Conserver dans mon projet'
              : submitting
                ? 'Envoi…'
                : 'Demander un tarif'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
