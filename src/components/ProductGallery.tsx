import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Images, Maximize2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { Product } from '@/lib/products'

const GALLERY_LABELS = ['Vue produit', 'Ambiance', 'Matière', 'Détail']

function uniqueImages(urls: string[]): string[] {
  return Array.from(new Set(urls.filter(Boolean)))
}

export function ProductGallery({ product }: { product: Product }) {
  const images = useMemo(
    () => uniqueImages([product.mainImageUrl, ...product.galleryUrls]),
    [product.galleryUrls, product.mainImageUrl],
  )
  const [selectedIndex, setSelectedIndex] = useState(0)
  const selectedImage = images[selectedIndex] ?? product.mainImageUrl
  const hasMultipleImages = images.length > 1

  useEffect(() => {
    setSelectedIndex(0)
  }, [product.id])

  function goToPrevious() {
    if (!hasMultipleImages) return
    setSelectedIndex((current) =>
      current === 0 ? images.length - 1 : current - 1,
    )
  }

  function goToNext() {
    if (!hasMultipleImages) return
    setSelectedIndex((current) => (current + 1) % images.length)
  }

  return (
    <section className="space-y-2" aria-label={`Galerie ${product.name}`}>
      <div className="ring-foreground/10 group relative aspect-[4/3] overflow-hidden rounded-md bg-[color:var(--sand)] ring-1 md:aspect-square">
        <img
          src={selectedImage}
          alt={`${product.name} — ${GALLERY_LABELS[selectedIndex] ?? 'vue produit'}`}
          className="h-full w-full object-cover"
        />

        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-black/45 to-transparent p-3 text-white">
          <span className="inline-flex items-center gap-1.5 rounded-sm bg-black/35 px-2 py-1 text-[11px] font-medium backdrop-blur">
            <Images className="h-3.5 w-3.5" />
            {selectedIndex + 1}/{images.length}
          </span>
          <span className="rounded-sm bg-black/35 px-2 py-1 text-[11px] font-medium backdrop-blur">
            {GALLERY_LABELS[selectedIndex] ?? 'Vue'}
          </span>
        </div>

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent p-3 text-white">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-xs font-medium">{product.sku}</div>
              <div className="mt-0.5 text-[11px] text-white/80">
                {product.dimensions.l}x{product.dimensions.w}x
                {product.dimensions.h} cm
              </div>
            </div>
            <span className="inline-flex items-center gap-1 rounded-sm bg-white/15 px-2 py-1 text-[11px] backdrop-blur">
              <Maximize2 className="h-3 w-3" />
              Visuel
            </span>
          </div>
        </div>

        {hasMultipleImages && (
          <>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="absolute left-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full border-white/35 bg-black/20 text-white opacity-0 backdrop-blur transition-opacity hover:bg-black/35 focus-visible:opacity-100 group-hover:opacity-100"
              onClick={goToPrevious}
              aria-label="Image précédente"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full border-white/35 bg-black/20 text-white opacity-0 backdrop-blur transition-opacity hover:bg-black/35 focus-visible:opacity-100 group-hover:opacity-100"
              onClick={goToNext}
              aria-label="Image suivante"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2">
        {images.slice(0, 4).map((url, index) => {
          const selected = index === selectedIndex
          return (
            <button
              key={url}
              type="button"
              onClick={() => setSelectedIndex(index)}
              aria-label={`Afficher ${GALLERY_LABELS[index] ?? `image ${index + 1}`}`}
              aria-pressed={selected}
              className={`relative aspect-square overflow-hidden rounded-sm bg-[color:var(--sand)] ring-1 transition ${
                selected
                  ? 'ring-2 ring-foreground'
                  : 'ring-foreground/10 hover:ring-foreground/35'
              }`}
            >
              <img
                src={url}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
              <span className="absolute inset-x-0 bottom-0 bg-black/45 px-1.5 py-1 text-left text-[10px] font-medium text-white">
                {GALLERY_LABELS[index] ?? `Vue ${index + 1}`}
              </span>
            </button>
          )
        })}
      </div>

      {!hasMultipleImages && (
        <div className="rounded-sm border border-dashed border-[color:var(--sand-deep)] bg-card px-3 py-2 text-xs text-muted-foreground">
          Galerie fournisseur à compléter : vue matière, vue usage et détail
          empilage.
        </div>
      )}
    </section>
  )
}
