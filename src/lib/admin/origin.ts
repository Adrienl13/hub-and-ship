// Origine lisible d'une demande / réservation / candidature côté admin.
//
// Quatre onglets affichaient chacun leur propre variante (« ref X », « partenaire
// X », valeur brute de la source…). Un seul helper : partenaire (?ref=) puis
// UTM, sinon le libellé lisible du point de capture, sinon « Direct ». Sert aux
// lignes admin et aux exports CSV.

export interface OriginInput {
  readonly partnerRef?: string | null
  readonly utmSource?: string | null
  readonly utmMedium?: string | null
  readonly utmCampaign?: string | null
  /** Libellé lisible du point de capture (déjà traduit), vide si inconnu. */
  readonly sourceLabel?: string | null
}

export const DIRECT_ORIGIN_LABEL = 'Direct'

export function describeOrigin(input: OriginInput): string {
  const parts: string[] = []
  const partnerRef = input.partnerRef?.trim()
  if (partnerRef) parts.push(`Partenaire ${partnerRef}`)
  const utm = [input.utmSource, input.utmMedium, input.utmCampaign]
    .map((value) => value?.trim() ?? '')
    .filter((value) => value !== '')
  if (utm.length > 0) parts.push(utm.join(' / '))
  if (parts.length > 0) return parts.join(' · ')
  const sourceLabel = input.sourceLabel?.trim()
  return sourceLabel ? sourceLabel : DIRECT_ORIGIN_LABEL
}

// Points de capture des demandes stock 24h (colonne stock_requests.source,
// texte libre côté base) : libellé lisible, la valeur brute sinon.
export const STOCK_REQUEST_SOURCE_LABEL: Record<string, string> = {
  stock_24h_page: 'Page stock 24h',
}

export function stockRequestSourceLabel(
  source: string | null | undefined,
): string {
  if (!source) return ''
  return STOCK_REQUEST_SOURCE_LABEL[source] ?? source
}

// Points de capture partenaires (candidatures et opportunités).
export const PARTNER_SOURCE_LABEL: Record<string, string> = {
  partners_page: 'Page partenaires',
  partners_deal_form: 'Formulaire opportunité',
  partner_space: 'Espace partenaire',
}

export function partnerSourceLabel(source: string | null | undefined): string {
  if (!source) return ''
  return PARTNER_SOURCE_LABEL[source] ?? source
}
