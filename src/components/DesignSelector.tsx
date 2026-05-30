import { Check, ImageOff } from 'lucide-react'

import type { DesignVariant } from '@/lib/products'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?'
}

function DesignThumb({
  variant,
  selected,
  onClick,
  size,
}: {
  variant: DesignVariant
  selected: boolean
  onClick: () => void
  size: 'sm' | 'lg'
}) {
  const dimensions = size === 'lg' ? 'h-12 w-12' : 'h-10 w-10'

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
      {variant.imageUrl ? (
        <img
          src={variant.imageUrl}
          alt={variant.name}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center bg-[color:var(--sand-soft)] text-[10px] font-semibold text-muted-foreground">
          <ImageOff className="h-3 w-3 opacity-60" />
          <span className="sr-only">{initials(variant.name)}</span>
        </span>
      )}
      {selected && (
        <span className="absolute inset-0 flex items-center justify-center bg-foreground/35">
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
}: {
  variants: DesignVariant[]
  selectedVariantId: string
  onChange: (variantId: string) => void
  size?: 'sm' | 'lg'
  showLabel?: boolean
  showSelectedName?: boolean
}) {
  const selected = variants.find((v) => v.id === selectedVariantId)

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
          />
        ))}
      </div>
      {selected && showSelectedName && (
        <div className="text-foreground/80 mt-1 text-xs">
          Sélectionné : <span className="font-medium">{selected.name}</span>
        </div>
      )}
    </div>
  )
}
