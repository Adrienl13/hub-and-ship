import { validateSiretFormat } from './siret'

export interface VerifiedSiretData {
  readonly siret: string
  readonly siren: string
  readonly legal_name: string
  readonly trading_name?: string
  readonly naf_code?: string
  readonly legal_form?: string
  readonly legal_form_code?: string
  readonly address?: {
    readonly street: string
    readonly postal_code: string
    readonly city: string
    readonly country: string
  }
  readonly creation_date?: string
  readonly is_active: boolean
}

export type RemoteSiretVerificationResult =
  | { readonly status: 'invalid_format'; readonly reason: string }
  | { readonly status: 'not_found'; readonly reason: string }
  | { readonly status: 'inactive'; readonly reason: string }
  | {
      readonly status: 'duplicate'
      readonly reason: string
      readonly existing_company_id?: string
    }
  | { readonly status: 'verified'; readonly data: VerifiedSiretData }
  | {
      readonly status: 'verification_unavailable'
      readonly reason: string
      readonly data?: { readonly format_ok: true }
    }

export interface SiretVerificationClient {
  readonly functions: {
    readonly invoke: <T>(
      functionName: string,
      options: { readonly body: { readonly siret: string } },
    ) => Promise<{
      readonly data: T | null
      readonly error: { readonly message: string } | null
    }>
  }
}

export async function verifySiretWithEdgeFunction({
  siret,
  client,
}: {
  readonly siret: string
  readonly client: SiretVerificationClient | null
}): Promise<RemoteSiretVerificationResult> {
  const formatCheck = validateSiretFormat(siret)

  if (!formatCheck.valid) {
    return {
      status: 'invalid_format',
      reason: formatCheck.reason ?? 'SIRET invalide',
    }
  }

  if (!client) {
    return {
      status: 'verification_unavailable',
      reason:
        'Vérification INSEE serveur indisponible en local. Le format SIRET est valide et sera recontrôlé dès activation Supabase.',
      data: { format_ok: true },
    }
  }

  const { data, error } =
    await client.functions.invoke<RemoteSiretVerificationResult>(
      'verify-siret',
      {
        body: { siret: formatCheck.cleaned },
      },
    )

  if (error) {
    return {
      status: 'verification_unavailable',
      reason: error.message,
      data: { format_ok: true },
    }
  }

  return (
    data ?? {
      status: 'verification_unavailable',
      reason: 'Réponse de vérification vide',
      data: { format_ok: true },
    }
  )
}
