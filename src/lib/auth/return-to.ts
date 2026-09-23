// Destination après connexion (`returnTo`).
//
// Une seule règle, partagée par la page de connexion, la page de retour du
// lien magique et le hook d'envoi d'email (qui construit le lien) : seule une
// destination INTERNE est acceptée. Un `returnTo` absolu ferait sortir le
// visiteur du site depuis un lien partagé ou intercepté — sur le seul mode de
// connexion du site, c'est la définition d'un open redirect.

/** Tableau de bord : la porte d'entrée de l'espace client. */
export const DEFAULT_RETURN_TO = '/account'

// Espaces et caractères de contrôle : les navigateurs les retirent en
// résolvant l'URL, ils masqueraient donc un préfixe hostile.
function hasUnsafeChar(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code <= 0x20 || code === 0x7f) return true
  }
  return false
}

/**
 * Rend la destination si elle est un chemin interne, sinon `fallback`.
 * Les navigateurs assimilent l'antislash à un slash, donc « /\evil.example »
 * vaut « //evil.example » — d'où la normalisation AVANT les contrôles.
 */
export function sanitizeReturnTo<F extends string | undefined>(
  value: string | null | undefined,
  fallback: F,
): string | F {
  if (!value) return fallback
  if (hasUnsafeChar(value)) return fallback
  const normalized = value.replace(/\\/g, '/')
  if (!normalized.startsWith('/')) return fallback
  if (normalized.startsWith('//')) return fallback
  try {
    const url = new URL(normalized, 'https://terrassea.invalid')
    if (url.host !== 'terrassea.invalid') return fallback
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return fallback
  }
}

/**
 * Extrait le `returnTo` porté par l'URL de redirection que le navigateur a
 * demandée (`emailRedirectTo` = `…/auth/callback?returnTo=…`). Supabase
 * remplace cette URL par la Site URL quand elle n'est pas autorisée : dans ce
 * cas il n'y a pas de `returnTo`, et l'on retombe sur le tableau de bord.
 */
export function returnToFromRedirectUrl(
  redirectTo: string | null | undefined,
): string {
  if (!redirectTo) return DEFAULT_RETURN_TO
  try {
    const url = new URL(redirectTo)
    return sanitizeReturnTo(url.searchParams.get('returnTo'), DEFAULT_RETURN_TO)
  } catch {
    return DEFAULT_RETURN_TO
  }
}
