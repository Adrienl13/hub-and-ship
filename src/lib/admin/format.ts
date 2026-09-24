// Formats partagés des onglets admin : dates « jj/mm/aaaa », date-heure
// « jj/mm/aaaa hh:mm » et lien téléphone. Le fuseau est fixé à Europe/Paris
// (le back-office est lu depuis la France) pour que l'affichage et les CSV
// soient identiques quel que soit le poste.

const ADMIN_TIME_ZONE = 'Europe/Paris'

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  timeZone: ADMIN_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const timeFormatter = new Intl.DateTimeFormat('fr-FR', {
  timeZone: ADMIN_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

function parseIso(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date
}

/** « jj/mm/aaaa » ; une date illisible garde ses dix premiers caractères. */
export function formatAdminDate(iso: string | null | undefined): string {
  const date = parseIso(iso)
  if (!date) return iso ? iso.slice(0, 10) : ''
  return dateFormatter.format(date)
}

/** « jj/mm/aaaa hh:mm » ; une date illisible est rendue telle quelle. */
export function formatAdminDateTime(iso: string | null | undefined): string {
  const date = parseIso(iso)
  if (!date) return iso ?? ''
  return `${dateFormatter.format(date)} ${timeFormatter.format(date)}`
}

/** Lien `tel:` sans espaces ni ponctuation (le + international est conservé). */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[\s.\-()]/g, '')}`
}
