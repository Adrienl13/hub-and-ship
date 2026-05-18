declare const Deno:
  | {
      readonly env: { get: (key: string) => string | undefined }
      readonly serve: (
        handler: (request: Request) => Response | Promise<Response>,
      ) => void
    }
  | undefined

type VerificationStatus =
  | 'invalid_format'
  | 'not_found'
  | 'inactive'
  | 'duplicate'
  | 'verified'
  | 'verification_unavailable'

interface RuntimeEnv {
  readonly supabaseUrl: string
  readonly supabaseAnonKey: string
  readonly supabaseServiceRoleKey: string
  readonly inseeApiBaseUrl: string
  readonly inseeOauthUrl: string
  readonly inseeApiKey?: string
  readonly inseeClientId?: string
  readonly inseeClientSecret?: string
}

interface RateLimitStatus {
  readonly allowed: boolean
  readonly retryAfterSeconds: number
}

interface SiretData {
  readonly siret: string
  readonly siren: string
  readonly legal_name: string
  readonly trading_name?: string
  readonly legal_form?: string
  readonly legal_form_code?: string
  readonly naf_code?: string
  readonly address: {
    readonly street: string
    readonly postal_code: string
    readonly city: string
    readonly country: string
  }
  readonly creation_date?: string
  readonly is_active: boolean
  readonly raw_response: unknown
}

interface VerificationResponse {
  readonly status: VerificationStatus
  readonly reason?: string
  readonly data?: SiretData | { readonly format_ok: true }
  readonly existing_company_id?: string
}

interface InseeEtablissement {
  readonly siret?: string
  readonly uniteLegale?: {
    readonly denominationUniteLegale?: string
    readonly nomUniteLegale?: string
    readonly prenom1UniteLegale?: string
    readonly categorieJuridiqueUniteLegale?: string
    readonly dateCreationUniteLegale?: string
  }
  readonly etatAdministratifEtablissement?: string
  readonly dateFermetureEtablissement?: string
  readonly activitePrincipaleEtablissement?: string
  readonly enseigne1Etablissement?: string
  readonly adresseEtablissement?: {
    readonly numeroVoieEtablissement?: string
    readonly typeVoieEtablissement?: string
    readonly libelleVoieEtablissement?: string
    readonly codePostalEtablissement?: string
    readonly libelleCommuneEtablissement?: string
  }
}

interface InseeResponse {
  readonly etablissement?: InseeEtablissement
}

interface SupabaseUserResponse {
  readonly id?: string
}

interface CacheRow {
  readonly siret: string
  readonly insee_response: InseeResponse
  readonly is_valid: boolean
  readonly is_active: boolean
}

interface CompanyRow {
  readonly id: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const rateLimitHits = new Map<string, ReadonlyArray<number>>()
const rateLimitRule = {
  limit: 30,
  windowMs: 60_000,
}

async function handleVerifySiret(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return json({ status: 'verified' }, 204)
  }

  if (request.method !== 'POST') {
    return json({ status: 'invalid_format', reason: 'Méthode non autorisée' }, 405)
  }

  const env = getRuntimeEnv()
  if (!env) {
    return json(
      {
        status: 'verification_unavailable',
        reason: 'Configuration serveur incomplète',
        data: { format_ok: true },
      },
      200,
    )
  }

  const authorization = request.headers.get('Authorization')
  if (!authorization) {
    return json({ status: 'invalid_format', reason: 'Authentification requise' }, 401)
  }

  const userId = await getUserIdFromToken(env, authorization)
  if (!userId) {
    return json({ status: 'invalid_format', reason: 'Session invalide' }, 401)
  }

  const rateLimit = consumeRateLimit(`siret:${userId}`)
  if (!rateLimit.allowed) {
    await logSecurityEvent(env, {
      event_type: 'rate_limit_hit',
      user_id: userId,
      metadata: { endpoint: 'verify-siret', retryAfterSeconds: rateLimit.retryAfterSeconds },
      severity: 'warning',
    })

    return json(
      {
        status: 'verification_unavailable',
        reason: 'Trop de tentatives. Réessayez dans quelques instants.',
        data: { format_ok: true },
      },
      429,
    )
  }

  const body = await parseJsonBody(request)
  const siret = typeof body.siret === 'string' ? body.siret.replace(/\s/g, '') : ''
  const formatCheck = validateSiretFormat(siret)

  if (!formatCheck.valid) {
    await logSecurityEvent(env, {
      event_type: 'siret_lookup_invalid',
      user_id: userId,
      metadata: { siret, reason: formatCheck.reason },
      severity: 'warning',
    })

    return json({ status: 'invalid_format', reason: formatCheck.reason }, 400)
  }

  const cached = await getCachedSiret(env, siret)
  if (cached) {
    return json(await buildVerificationFromInsee(env, siret, cached.insee_response))
  }

  const token = await getInseeAccessToken(env)
  const inseeResponse = await fetch(`${env.inseeApiBaseUrl}/siret/${siret}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (inseeResponse.status === 404) {
    await logSecurityEvent(env, {
      event_type: 'siret_lookup_failed',
      user_id: userId,
      metadata: { siret, status: 404 },
      severity: 'warning',
    })

    return json(
      {
        status: 'not_found',
        reason: "Ce SIRET n'existe pas dans le répertoire INSEE Sirene",
      },
      404,
    )
  }

  if (!inseeResponse.ok) {
    return json(
      {
        status: 'verification_unavailable',
        reason: 'Service de vérification temporairement indisponible',
        data: { format_ok: true },
      },
      200,
    )
  }

  const inseeData = (await inseeResponse.json()) as InseeResponse
  await cacheSiretResponse(env, siret, inseeData)
  await logSecurityEvent(env, {
    event_type: 'siret_lookup_success',
    user_id: userId,
    metadata: { siret },
  })

  return json(await buildVerificationFromInsee(env, siret, inseeData))
}

function getRuntimeEnv(): RuntimeEnv | null {
  const env = typeof Deno === 'undefined' ? null : Deno.env
  if (!env) return null

  const supabaseUrl = env.get('SUPABASE_URL') ?? ''
  const supabaseAnonKey = env.get('SUPABASE_ANON_KEY') ?? ''
  const supabaseServiceRoleKey = env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const inseeApiBaseUrl =
    env.get('INSEE_API_BASE_URL') ?? 'https://api.insee.fr/api-sirene/3.11'
  const inseeOauthUrl = env.get('INSEE_OAUTH_URL') ?? 'https://api.insee.fr/token'

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return null
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceRoleKey,
    inseeApiBaseUrl,
    inseeOauthUrl,
    inseeApiKey: env.get('INSEE_API_KEY'),
    inseeClientId: env.get('INSEE_CLIENT_ID'),
    inseeClientSecret: env.get('INSEE_CLIENT_SECRET'),
  }
}

async function getUserIdFromToken(
  env: RuntimeEnv,
  authorization: string,
): Promise<string | null> {
  const response = await fetch(`${env.supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: env.supabaseAnonKey,
      Authorization: authorization,
    },
  })

  if (!response.ok) return null

  const user = (await response.json()) as SupabaseUserResponse
  return user.id ?? null
}

function consumeRateLimit(key: string, now = Date.now()): RateLimitStatus {
  const windowStart = now - rateLimitRule.windowMs
  const activeHits = (rateLimitHits.get(key) ?? []).filter((hit) => hit > windowStart)

  if (activeHits.length >= rateLimitRule.limit) {
    const resetAt = (activeHits[0] ?? now) + rateLimitRule.windowMs
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
    }
  }

  rateLimitHits.set(key, [...activeHits, now])
  return { allowed: true, retryAfterSeconds: 0 }
}

function validateSiretFormat(siret: string): { readonly valid: boolean; readonly reason?: string } {
  if (!/^\d{14}$/.test(siret)) {
    return { valid: false, reason: 'Le SIRET doit contenir exactement 14 chiffres' }
  }

  let sum = 0
  for (let index = 0; index < siret.length; index += 1) {
    const rawDigit = Number(siret[index])
    let digit = index % 2 === 0 ? rawDigit * 2 : rawDigit
    if (digit > 9) digit -= 9
    sum += digit
  }

  if (sum % 10 !== 0) {
    return { valid: false, reason: 'Numéro SIRET invalide' }
  }

  return { valid: true }
}

async function getCachedSiret(env: RuntimeEnv, siret: string): Promise<CacheRow | null> {
  const url = new URL(`${env.supabaseUrl}/rest/v1/siret_cache`)
  url.searchParams.set('siret', `eq.${siret}`)
  url.searchParams.set('expires_at', `gt.${new Date().toISOString()}`)
  url.searchParams.set('select', '*')
  url.searchParams.set('limit', '1')

  const rows = await fetchSupabaseRows<CacheRow>(env, url)
  return rows[0] ?? null
}

async function cacheSiretResponse(
  env: RuntimeEnv,
  siret: string,
  inseeResponse: InseeResponse,
): Promise<void> {
  const active = isEtablissementActive(inseeResponse)
  await fetch(`${env.supabaseUrl}/rest/v1/siret_cache`, {
    method: 'POST',
    headers: supabaseServiceHeaders(env, {
      Prefer: 'resolution=merge-duplicates',
    }),
    body: JSON.stringify({
      siret,
      insee_response: inseeResponse,
      is_valid: true,
      is_active: active,
      fetched_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }),
  })
}

async function buildVerificationFromInsee(
  env: RuntimeEnv,
  siret: string,
  inseeResponse: InseeResponse,
): Promise<VerificationResponse> {
  if (!isEtablissementActive(inseeResponse)) {
    return {
      status: 'inactive',
      reason: "Cet établissement est fermé selon l'INSEE",
    }
  }

  const existing = await findCompanyBySiret(env, siret)
  if (existing) {
    await logSecurityEvent(env, {
      event_type: 'siret_duplicate_attempt',
      metadata: { siret, existingCompanyId: existing.id },
      severity: 'warning',
    })

    return {
      status: 'duplicate',
      reason: 'Ce SIRET est déjà associé à un compte existant',
      existing_company_id: existing.id,
    }
  }

  return {
    status: 'verified',
    data: extractSiretData(siret, inseeResponse),
  }
}

async function findCompanyBySiret(env: RuntimeEnv, siret: string): Promise<CompanyRow | null> {
  const url = new URL(`${env.supabaseUrl}/rest/v1/companies`)
  url.searchParams.set('siret', `eq.${siret}`)
  url.searchParams.set('select', 'id')
  url.searchParams.set('limit', '1')

  const rows = await fetchSupabaseRows<CompanyRow>(env, url)
  return rows[0] ?? null
}

async function getInseeAccessToken(env: RuntimeEnv): Promise<string> {
  if (env.inseeApiKey) return env.inseeApiKey
  if (!env.inseeClientId || !env.inseeClientSecret) {
    throw new Error('INSEE credentials missing')
  }

  const credentials = btoa(`${env.inseeClientId}:${env.inseeClientSecret}`)
  const response = await fetch(env.inseeOauthUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  })

  if (!response.ok) {
    throw new Error('INSEE OAuth failed')
  }

  const data = (await response.json()) as { readonly access_token?: string }
  if (!data.access_token) throw new Error('INSEE OAuth token missing')

  return data.access_token
}

function extractSiretData(siret: string, inseeResponse: InseeResponse): SiretData {
  const etablissement = inseeResponse.etablissement ?? {}
  const uniteLegale = etablissement.uniteLegale ?? {}
  const adresse = etablissement.adresseEtablissement ?? {}
  const street = [
    adresse.numeroVoieEtablissement,
    adresse.typeVoieEtablissement,
    adresse.libelleVoieEtablissement,
  ]
    .filter(Boolean)
    .join(' ')

  return {
    siret,
    siren: siret.slice(0, 9),
    legal_name:
      uniteLegale.denominationUniteLegale ??
      [uniteLegale.prenom1UniteLegale, uniteLegale.nomUniteLegale]
        .filter(Boolean)
        .join(' ') ??
      'Entreprise',
    trading_name: etablissement.enseigne1Etablissement,
    legal_form_code: uniteLegale.categorieJuridiqueUniteLegale,
    naf_code: etablissement.activitePrincipaleEtablissement,
    address: {
      street,
      postal_code: adresse.codePostalEtablissement ?? '',
      city: adresse.libelleCommuneEtablissement ?? '',
      country: 'FR',
    },
    creation_date: uniteLegale.dateCreationUniteLegale,
    is_active: isEtablissementActive(inseeResponse),
    raw_response: inseeResponse,
  }
}

function isEtablissementActive(inseeResponse: InseeResponse): boolean {
  return inseeResponse.etablissement?.etatAdministratifEtablissement !== 'F'
}

async function logSecurityEvent(
  env: RuntimeEnv,
  input: {
    readonly event_type:
      | 'rate_limit_hit'
      | 'siret_lookup_success'
      | 'siret_lookup_failed'
      | 'siret_lookup_invalid'
      | 'siret_duplicate_attempt'
    readonly user_id?: string
    readonly metadata?: Record<string, unknown>
    readonly severity?: 'info' | 'warning' | 'error' | 'critical'
  },
): Promise<void> {
  await fetch(`${env.supabaseUrl}/rest/v1/security_events`, {
    method: 'POST',
    headers: supabaseServiceHeaders(env),
    body: JSON.stringify({
      event_type: input.event_type,
      user_id: input.user_id ?? null,
      metadata: input.metadata ?? null,
      severity: input.severity ?? 'info',
    }),
  })
}

async function fetchSupabaseRows<T>(
  env: RuntimeEnv,
  url: URL,
): Promise<ReadonlyArray<T>> {
  const response = await fetch(url, {
    headers: supabaseServiceHeaders(env),
  })

  if (!response.ok) return []
  return (await response.json()) as ReadonlyArray<T>
}

function supabaseServiceHeaders(
  env: RuntimeEnv,
  extra?: Record<string, string>,
): HeadersInit {
  return {
    apikey: env.supabaseServiceRoleKey,
    Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

async function parseJsonBody(request: Request): Promise<{ readonly siret?: unknown }> {
  try {
    return (await request.json()) as { readonly siret?: unknown }
  } catch {
    return {}
  }
}

function json(body: VerificationResponse, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

if (typeof Deno !== 'undefined') {
  Deno.serve(handleVerifySiret)
}
