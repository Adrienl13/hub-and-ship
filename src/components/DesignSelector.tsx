import { Check, ImageOff, Palette } from 'lucide-react'
import { Link } from '@tanstack/react-router'

import type { DesignVariant, Product } from '@/lib/products'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?'
}

function DesignThumb({
  variant,
  selected,
  onClick,
  size,
  fallbackImageUrl,
}: {
  variant: DesignVariant
  selected: boolean
  onClick: () => void
  size: 'sm' | 'lg'
  fallbackImageUrl?: string
}) {
  const dimensions = size === 'lg' ? 'h-12 w-12' : 'h-10 w-10'
  // Resolve the image to display in this order:
  //   1) the design's own hero photo (when the admin has uploaded one);
  //   2) the parent product's main image (so the selector doesn't go grey
  //      just because no design-specific photo has been uploaded yet);
  //   3) nothing — show the ImageOff placeholder.
  const displayUrl = variant.imageUrl ?? fallbackImageUrl
  // When we fall back to the product image, every thumbnail in the row
  // looks identical, so we overlay a small initials badge that still lets
  // the client tell the designs apart while admins build up the per-design
  // photo set.
  const showInitialsBadge = !variant.imageUrl && Boolean(fallbackImageUrl)

  return (
    <button
      type="button"
      onClick={onClick}
      title={variant.name}
      aria-label={variant.name}
      aria-pressed={selected}
      className={`relative ${dimensions} ring-foreground/15 shrink-0 overflow-hidden rounded-sm ring-1 transition-all hover:scale-[1.03] ${
        selected ? 'ring-2 ring-foreground ring-offset-2 ring-offset-card' : ''
      }`}
    >
      {displayUrl ? (
        <img
          src={displayUrl}
          alt={variant.name}
          className="h-full w-full bg-white object-contain"
          loading="lazy"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center bg-[color:var(--sand-soft)] text-[10px] font-semibold text-muted-foreground">
          <ImageOff className="h-3 w-3 opacity-60" />
          <span className="sr-only">{initials(variant.name)}</span>
        </span>
      )}
      {showInitialsBadge && (
        <span className="absolute inset-x-0 bottom-0 bg-black/55 px-1 py-0.5 text-center text-[9px] font-semibold uppercase tracking-wider text-white">
          {initials(variant.name)}
        </span>
      )}
      {selected && (
        <span className="bg-foreground/35 absolute inset-0 flex items-center justify-center">
          <Check className="h-4 w-4 text-white drop-shadow" strokeWidth={2.5} />
        </span>
      )}
    </button>
  )
}

export function DesignSelector({
  variants,
  selectedVariantId,
  onChange,
  size = 'sm',
  showLabel = true,
  showSelectedName = true,
  fallbackImageUrl,
  customizeProduct,
}: {
  variants: DesignVariant[]
  selectedVariantId: string
  onChange: (variantId: string) => void
  size?: 'sm' | 'lg'
  showLabel?: boolean
  showSelectedName?: boolean
  /** Used when a variant has no `imageUrl` yet — typically the product's
   * main image, so the selector stays visual instead of greying out. */
  fallbackImageUrl?: string
  /** Pastille « personnalisation » en fin de rangée : ouvre /contact
   *  pré-rempli avec la référence — le coloris rêvé se demande en un clic,
   *  même quand il n'est pas en photo. */
  customizeProduct?: Product
}) {
  const selected = variants.find((v) => v.id === selectedVariantId)
  const thumbDimensions = size === 'lg' ? 'h-12 w-12' : 'h-10 w-10'

  return (
    <div>
      {showLabel && (
        <div className="label-eyebrow mb-2 text-muted-foreground">Design</div>
      )}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {variants.map((variant) => (
          <DesignThumb
            key={variant.id}
            variant={variant}
            selected={variant.id === selectedVariantId}
            onClick={() => onChange(variant.id)}
            size={size}
            fallbackImageUrl={fallbackImageUrl}
          />
        ))}
        {customizeProduct && (
          <Link
            to="/contact"
            search={{
              topic: 'produit',
              message: `Bonjour, je suis intéressé par ${customizeProduct.name} (réf. ${customizeProduct.sku}) dans un coloris ou tressage différent de ceux affichés. Coloris souhaité : `,
            }}
            title="Demander un autre coloris (nuancier Pantone/RAL)"
            aria-label={`Demander un autre coloris pour ${customizeProduct.name}`}
            className={`${thumbDimensions} ring-foreground/15 flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-sm border border-dashed border-[color:var(--ember)]/50 bg-[color:var(--ember)]/5 ring-1 transition-all hover:scale-[1.03] hover:bg-[color:var(--ember)]/10`}
          >
            <Palette className="h-3.5 w-3.5 text-[color:var(--ember)]" />
            <span className="text-[7px] font-bold uppercase tracking-wide text-[color:var(--ember)]">
              Perso
            </span>
          </Link>
        )}
      </div>
      {selected && showSelectedName && (
        <div className="text-foreground/80 mt-1 text-xs">
          Sélectionné : <span className="font-medium">{selected.name}</span>
        </div>
      )}
    </div>
  )
}
