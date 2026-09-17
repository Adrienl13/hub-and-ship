// Hygiène du registre « preuve ».
//
// /livres est la page qui porte la crédibilité du site : on y montre ce
// qu'on a réellement livré. Deux choses n'y ont donc pas leur place, et le
// code les refuse plutôt que de compter sur la vigilance de l'admin.
//
//   1. Une photo de banque d'images. Elle illustre, elle ne prouve rien —
//      et légendée « Container 20' HC sur quai Marseille-Fos », elle ment.
//      Le dépôt écrit déjà la règle en toutes lettres (src/lib/products.ts,
//      « aucune preuve inventée ») ; ici on l'applique.
//   2. Un témoignage sans auteur. Une citation que personne ne signe n'est
//      pas un avis client : c'est du texte. On garde la note et la fiche,
//      on retire la citation.
//
// Rien n'est supprimé en base : ces valeurs restent saisies, elles ne sont
// simplement pas servies au public tant qu'elles ne sont pas remplaçables
// par du vrai. L'admin, lui, les voit toujours (il lit la ligne brute).

/** Domaines de banques d'images couramment collés dans un CMS. */
const STOCK_PHOTO_HOSTS: ReadonlyArray<string> = [
  'unsplash.com',
  'pexels.com',
  'pixabay.com',
  'istockphoto.com',
  'shutterstock.com',
  'gettyimages.com',
  'stock.adobe.com',
  'freepik.com',
  'placeholder.com',
  'placehold.co',
  'picsum.photos',
]

export function isStockPhotoUrl(url: string | null | undefined): boolean {
  if (!url) return false
  let host: string
  try {
    host = new URL(url, 'https://terrassea.invalid').hostname.toLowerCase()
  } catch {
    return false
  }
  return STOCK_PHOTO_HOSTS.some(
    (stock) => host === stock || host.endsWith(`.${stock}`),
  )
}

/** Photo principale, ou null si elle vient d'une banque d'images. */
export function keepProofPhoto(url: string | null): string | null {
  if (!url) return null
  return isStockPhotoUrl(url) ? null : url
}

export interface ProofGalleryItem {
  readonly url: string
  readonly caption?: string | null
}

export function keepProofGallery<T extends ProofGalleryItem>(
  items: ReadonlyArray<T>,
): ReadonlyArray<T> {
  return items.filter((item) => !isStockPhotoUrl(item.url))
}

export interface ProofTestimonial {
  readonly quote: string | null
  readonly author: string | null
  readonly location?: string | null
  readonly rating?: number | null
  readonly longQuote?: string | null
  readonly role?: string | null
}

/**
 * Un témoignage sans auteur n'est attribuable à personne : on retire les
 * citations et on garde le reste (note, rôle, localisation restent des
 * métadonnées, elles n'affirment rien toutes seules).
 */
export function keepAttributableTestimonial<T extends ProofTestimonial>(
  testimonial: T,
): T {
  const author = testimonial.author?.trim()
  if (author) return testimonial
  return {
    ...testimonial,
    quote: null,
    ...(testimonial.longQuote === undefined ? {} : { longQuote: null }),
  }
}
