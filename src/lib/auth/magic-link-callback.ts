// Lecture du retour de lien magique.
//
// Le lien magique est le SEUL mode de connexion du site : quand il échoue, il
// faut le dire et proposer une sortie, pas laisser tourner un spinner. Trois
// échecs sont courants :
//
//   1. lien expiré ou déjà cliqué — Supabase renvoie `error=access_denied`
//      avec `error_code=otp_expired`, tantôt en query, tantôt en fragment
//      selon la version ; on lit les deux ;
//   2. lien demandé sur l'ordinateur et ouvert sur le téléphone — le flux
//      PKCE exige le `code_verifier` du navigateur DEMANDEUR, absent ailleurs.
//      Rien n'est renvoyé : l'échange reste simplement en suspens. C'est le
//      cas normal en CHR (« je lis mes mails sur mon téléphone ») ;
//   3. lien ouvert sans aucun paramètre (copié à la main, tronqué par un
//      client mail).
//
// Le cas 2 se règle pour de bon côté template Supabase : passer le modèle
// « Magic Link » sur `{{ .TokenHash }}` fait pointer l'e-mail directement ici
// avec `?token_hash=…&type=magiclink`, qui se vérifie sans code_verifier.
// `parseMagicLinkCallback` reconnaît déjà cette forme — voir
// docs/RUNBOOK_MAGIC_LINK.md.

const OTP_TYPES = [
  'magiclink',
  'email',
  'signup',
  'invite',
  'recovery',
  'email_change',
] as const

export type MagicLinkOtpType = (typeof OTP_TYPES)[number]

export interface MagicLinkFailure {
  readonly title: string
  readonly detail: string
  /** Code technique, journalisé mais jamais affiché tel quel. */
  readonly code: string
}

export interface MagicLinkCallback {
  /** Échec annoncé par Supabase dans l'URL, sinon null. */
  readonly failure: MagicLinkFailure | null
  /** Jeton d'un lien `{{ .TokenHash }}` : vérifiable depuis n'importe quel appareil. */
  readonly tokenHash: string | null
  readonly otpType: MagicLinkOtpType | null
  /** Échange PKCE en cours : ne réussit que dans le navigateur demandeur. */
  readonly hasPkceCode: boolean
}

function isOtpType(value: string | null): value is MagicLinkOtpType {
  return value !== null && OTP_TYPES.includes(value as MagicLinkOtpType)
}

/** Query et fragment portent les mêmes clés selon les versions : on fusionne. */
function readParams(search: string, hash: string): URLSearchParams {
  const merged = new URLSearchParams(search.replace(/^\?/, ''))
  for (const [key, value] of new URLSearchParams(hash.replace(/^#/, ''))) {
    if (!merged.has(key)) merged.set(key, value)
  }
  return merged
}

function describeFailure(
  code: string,
  description: string | null,
): MagicLinkFailure {
  if (code === 'otp_expired' || code === 'access_denied') {
    return {
      code,
      title: 'Ce lien a expiré.',
      detail:
        'Un lien de connexion ne sert qu’une fois et reste valable une heure. Demandez-en un nouveau, il arrive dans la minute.',
    }
  }

  if (code === 'email_not_confirmed' || code === 'otp_disabled') {
    return {
      code,
      title: 'Connexion refusée.',
      detail:
        'Cette adresse n’est pas autorisée à se connecter. Écrivez-nous depuis la page contact et nous réglons ça.',
    }
  }

  return {
    code,
    title: 'La connexion n’a pas abouti.',
    detail:
      description?.replace(/\+/g, ' ') ??
      'Le lien n’a pas pu être validé. Demandez un nouveau lien depuis ce navigateur.',
  }
}

export function parseMagicLinkCallback(
  search: string,
  hash: string,
): MagicLinkCallback {
  const params = readParams(search, hash)

  const errorCode = params.get('error_code') ?? params.get('error')
  const failure = errorCode
    ? describeFailure(errorCode, params.get('error_description'))
    : null

  const otpType = params.get('type')
  const tokenHash = params.get('token_hash')

  return {
    failure,
    tokenHash: tokenHash && tokenHash.length > 0 ? tokenHash : null,
    otpType: isOtpType(otpType) ? otpType : null,
    hasPkceCode: (params.get('code')?.length ?? 0) > 0,
  }
}

/**
 * Rien n'a répondu dans le délai de garde. Avec un `code` en attente, c'est
 * presque toujours le lien ouvert sur un autre appareil que celui qui l'a
 * demandé — on le dit, parce que « réessayez » n'aide pas dans ce cas.
 */
export function describeStalledCallback(
  hasPkceCode: boolean,
): MagicLinkFailure {
  if (hasPkceCode) {
    return {
      code: 'pkce_verifier_missing',
      title: 'Ce lien a été ouvert sur un autre appareil.',
      detail:
        'Pour des raisons de sécurité, un lien de connexion ne s’ouvre que dans le navigateur qui l’a demandé. Demandez-en un nouveau ici, sur cet appareil.',
    }
  }

  return {
    code: 'callback_timeout',
    title: 'La connexion n’a pas abouti.',
    detail:
      'Le lien semble incomplet — certains clients mail le coupent. Demandez un nouveau lien et ouvrez-le d’un seul clic.',
  }
}
