import { useEffect, useState } from 'react'
import { ImageOff } from 'lucide-react'

// Image tolérante aux fiches incomplètes : une URL vide OU un fichier
// disparu du storage (404 après remplacement/purge) affiche un placeholder
// honnête au lieu de l'icône « image cassée » du navigateur.

export function SafeImage({
  src,
  alt,
  className,
  imgClassName,
  label = 'Photo à venir',
  loading = 'lazy',
}: {
  readonly src: string | null | undefined
  readonly alt: string
  /** Classes du conteneur placeholder (mêmes dimensions que l'image). */
  readonly className?: string
  /** Classes de l'élément <img> quand l'image charge. */
  readonly imgClassName?: string
  readonly label?: string
  readonly loading?: 'lazy' | 'eager'
}) {
  const [failed, setFailed] = useState(false)

  // Une nouvelle URL mérite une nouvelle chance (remplacement admin).
  useEffect(() => {
    setFailed(false)
  }, [src])

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-1 bg-[color:var(--sand-soft)] text-muted-foreground ${className ?? ''}`}
      >
        <ImageOff className="h-5 w-5" />
        <span className="text-[10px] font-medium">{label}</span>
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      decoding="async"
      onError={() => setFailed(true)}
      className={imgClassName ?? className}
    />
  )
}
