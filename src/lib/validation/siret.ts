export interface BasicSiretValidation {
  readonly valid: boolean
  readonly cleaned: string
  readonly reason?: string
}

export type SiretValidationResult =
  | { readonly status: 'invalid_format'; readonly reason: string }
  | { readonly status: 'invalid_checksum'; readonly reason: string }
  | { readonly status: 'not_found'; readonly reason: string }
  | {
      readonly status: 'inactive'
      readonly reason: string
      readonly inactive_since?: string
    }
  | {
      readonly status: 'duplicate'
      readonly reason: string
      readonly existing_company_id: string
    }
  | { readonly status: 'verified'; readonly data: SiretData }
  | {
      readonly status: 'verification_unavailable'
      readonly data: { readonly format_ok: true }
      readonly reason: string
    }

export interface SiretData {
  readonly siret: string
  readonly siren: string
  readonly legal_name: string
  readonly trading_name?: string
  readonly legal_form: string
  readonly legal_form_code: string
  readonly naf_code: string
  readonly naf_label: string
  readonly address: {
    readonly street: string
    readonly postal_code: string
    readonly city: string
    readonly country: string
  }
  readonly creation_date: string
  readonly is_active: boolean
  readonly is_diffusable: boolean
  readonly raw_response: unknown
}

export function cleanSiret(siret: string): string {
  return siret.replace(/\s/g, '')
}

export function validateSiretFormat(siret: string): BasicSiretValidation {
  const cleaned = cleanSiret(siret)

  if (!/^\d{14}$/.test(cleaned)) {
    return {
      valid: false,
      cleaned,
      reason: 'Le SIRET doit contenir exactement 14 chiffres',
    }
  }

  if (!validateSiretChecksum(cleaned)) {
    return {
      valid: false,
      cleaned,
      reason: 'Numero SIRET invalide (cle de controle incorrecte)',
    }
  }

  return { valid: true, cleaned }
}

export function validateSiretChecksum(siret: string): boolean {
  const cleaned = cleanSiret(siret)

  if (!/^\d{14}$/.test(cleaned)) {
    return false
  }

  let sum = 0

  for (let index = 0; index < cleaned.length; index += 1) {
    const rawDigit = cleaned[index]

    if (rawDigit === undefined) {
      return false
    }

    let digit = Number.parseInt(rawDigit, 10)

    if (index % 2 === 0) {
      digit *= 2
    }

    if (digit > 9) {
      digit -= 9
    }

    sum += digit
  }

  return sum % 10 === 0
}
