import { useEffect, useMemo, useState } from 'react'

import { SafeImage } from '@/components/SafeImage'
import type { StockLine } from '@/lib/stock'

// Galerie du lot dans le panneau de demande /stock-24h : photo principale +
// vignettes cliquables. Chaîne de repli : photos du lot (admin) → photo du
// design → photo produit. Aucune photo = placeholder honnête.

export function StockLotGallery({ line }: { readonly line: StockLine }) {
  const photos = useMemo(() => {
    const urls = [
      line.imageUrl,
      ...(line.imageUrls ?? []),
      line.variant.imageUrl,
      line.product.mainImageUrl,
    ].filter((url): url is string => Boolean(url && url.trim()))
    return [...new Set(urls)]
  }, [line])

  const [activeIndex, setActiveIndex] = useState(0)

  // Changement de lot sélectionné → retour à la première photo.
  useEffect(() => {
    setActiveIndex(0)
  }, [line.id])

  const active = photos[Math.min(activeIndex, photos.length - 1)] ?? null

  return (
    <div className="mt-3 space-y-2">
      <div className="aspect-[4/3] overflow-hidden rounded-md border border-[color:var(--sand-deep)]">
        <SafeImage
          src={active}
          alt={`${line.product.name} — photo du lot`}
          className="h-full w-full"
          imgClassName="h-full w-full object-cover"
        />
      </div>
      {photos.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {photos.map((url, index) => (
            <button
              key={url}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`Photo ${index + 1}`}
              aria-current={index === activeIndex}
              className={`h-12 w-12 shrink-0 overflow-hidden rounded-sm border transition-colors ${
                index === activeIndex
                  ? 'border-[color:var(--ember)] ring-1 ring-[color:var(--ember)]/40'
                  : 'border-[color:var(--sand-deep)] hover:border-foreground/40'
              }`}
            >
              <SafeImage
                src={url}
                alt=""
                className="h-full w-full"
                imgClassName="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
