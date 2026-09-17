// Contrôle avant publication d'une fiche du registre.
//
// /livres est une page de preuve : ce qu'on y publie doit tenir debout tout
// seul. L'audit du 17 septembre a trouvé, sur quatre containers publiés,
// des compteurs qui se contredisent (un total d'articles sans rapport avec
// le détail par famille), des chronologies impossibles (livré après la date
// annoncée, clôturé après la livraison), une référence servie sous le slug
// d'une autre, des photos de banque d'images légendées comme des livraisons
// réelles et une citation que personne ne signe.
//
// Aucun de ces défauts n'est rattrapable par un lecteur : il faut les
// attraper au moment de publier. Le contrôle est pur et testé ; l'admin
// l'affiche, et bloque sur les `blocking`.

import { isStockPhotoUrl } from './proof'

export interface PublicationIssue {
  readonly field: string
  readonly message: string
  /** true = publication refusée ; false = à regarder, mais pas bloquant. */
  readonly blocking: boolean
}

export interface ContainerPublicationInput {
  readonly reference: string
  readonly slug: string | null
  readonly status: string | null
  readonly deliveredAt: string | null
  readonly expectedCloseAt: string | null
  readonly totalItems: number | null
  readonly professionalsServed: number | null
  readonly productBreakdown: ReadonlyArray<{ readonly units: number }>
  readonly photoUrl: string | null
  readonly gallery: ReadonlyArray<{ readonly url: string }>
  readonly testimonialQuote: string | null
  readonly testimonialAuthor: string | null
  readonly timeline: ReadonlyArray<{ readonly date: string | null }>
}

function slugify(reference: string): string {
  return reference.trim().toLowerCase().replace(/\s+/g, '-')
}

function parseDate(value: string | null): number | null {
  if (!value) return null
  const time = Date.parse(value)
  return Number.isNaN(time) ? null : time
}

export function checkContainerPublication(
  input: ContainerPublicationInput,
): ReadonlyArray<PublicationIssue> {
  const issues: PublicationIssue[] = []

  // 1. Le slug doit désigner CE container. Servir CC-2025-014 sous
  //    « cc-2025-002 » casse les liens entrants et trompe le lecteur.
  const slug = input.slug?.trim()
  if (slug && slug !== slugify(input.reference)) {
    issues.push({
      field: 'slug',
      message: `Le slug « ${slug} » ne correspond pas à la référence ${input.reference} (attendu « ${slugify(input.reference)} »). Un lecteur arrivant par ce lien croira lire une autre livraison.`,
      blocking: true,
    })
  }

  // 2. Compteurs. Le détail par famille est publié à côté du total : s'ils
  //    divergent, la page se contredit à la vue de n'importe qui.
  const breakdownUnits = input.productBreakdown.reduce(
    (sum, line) => sum + (Number.isFinite(line.units) ? line.units : 0),
    0,
  )
  if (
    input.totalItems != null &&
    breakdownUnits > 0 &&
    breakdownUnits !== input.totalItems
  ) {
    issues.push({
      field: 'total_items',
      message: `Le total annoncé (${input.totalItems} articles) ne correspond pas au détail par famille (${breakdownUnits}). Corrigez l'un ou l'autre avant de publier.`,
      blocking: true,
    })
  }
  if (input.totalItems != null && input.totalItems <= 0) {
    issues.push({
      field: 'total_items',
      message:
        'Un container publié avec 0 article affiche « 0 articles livrés » sur la page de preuve.',
      blocking: true,
    })
  }
  if (input.professionalsServed != null && input.professionalsServed <= 0) {
    issues.push({
      field: 'professionals_served',
      message:
        'Un container publié avec 0 professionnel servi n’a rien à prouver.',
      blocking: true,
    })
  }

  // 3. Chronologie. Livré avant d'être clôturé, ou livré dans le futur alors
  //    que la fiche s'annonce livrée : les deux sont impossibles.
  const delivered = parseDate(input.deliveredAt)
  const closed = parseDate(input.expectedCloseAt)
  if (delivered != null && closed != null && delivered < closed) {
    issues.push({
      field: 'delivered_at',
      message: `Livraison (${input.deliveredAt}) antérieure à la clôture annoncée (${input.expectedCloseAt}).`,
      blocking: true,
    })
  }
  if (
    input.status === 'delivered' &&
    delivered != null &&
    delivered > Date.now()
  ) {
    issues.push({
      field: 'delivered_at',
      message: `La fiche est marquée livrée avec une date à venir (${input.deliveredAt}).`,
      blocking: true,
    })
  }
  const timelineDates = input.timeline
    .map((step) => parseDate(step.date))
    .filter((time): time is number => time != null)
  for (let index = 1; index < timelineDates.length; index += 1) {
    if (timelineDates[index]! < timelineDates[index - 1]!) {
      issues.push({
        field: 'timeline',
        message:
          'Les étapes de la chronologie ne sont pas dans l’ordre : une étape est datée avant celle qui la précède.',
        blocking: false,
      })
      break
    }
  }

  // 4. Photos. Une banque d'images n'est pas une preuve — et le site ne les
  //    sert plus (voir ./proof.ts), donc publier ainsi donne une fiche nue.
  if (isStockPhotoUrl(input.photoUrl)) {
    issues.push({
      field: 'photo_url',
      message:
        'La photo principale vient d’une banque d’images. Elle ne sera pas servie : la fiche s’affichera sans photo.',
      blocking: true,
    })
  }
  const stockViews = input.gallery.filter((item) => isStockPhotoUrl(item.url))
  if (stockViews.length > 0) {
    issues.push({
      field: 'gallery',
      message: `${stockViews.length} vue(s) de la galerie viennent d’une banque d’images. Elles ne seront pas servies — remplacez-les par vos photos.`,
      blocking: true,
    })
  }

  // 5. Témoignage. Une citation sans auteur n'est attribuable à personne.
  if (input.testimonialQuote?.trim() && !input.testimonialAuthor?.trim()) {
    issues.push({
      field: 'testimonial_author',
      message:
        'Témoignage sans auteur : il ne sera pas affiché. Renseignez qui le signe, ou retirez la citation.',
      blocking: false,
    })
  }

  return issues
}

export function hasBlockingIssue(
  issues: ReadonlyArray<PublicationIssue>,
): boolean {
  return issues.some((issue) => issue.blocking)
}
