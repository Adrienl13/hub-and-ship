// Consentement cookies (mesure d'audience Google Analytics via Tag Manager).
//
// Logique pure + stockage local : le bandeau (CookieConsentBanner) et le
// snippet de consentement par défaut (__root) s'appuient dessus. Refus par
// défaut (Consent Mode v2 « denied ») tant que le visiteur n'a pas décidé ;
// la décision vaut 6 mois, conformément à la politique cookies publiée.

export const CONSENT_STORAGE_KEY = 'cc_consent'
export const CONSENT_TTL_MS = 6 * 30 * 24 * 60 * 60 * 1000

export interface StoredConsent {
  readonly analytics: boolean
  readonly decidedAt: number
}

export interface ConsentStorage {
  readonly getItem: (key: string) => string | null
  readonly setItem: (key: string, value: string) => void
}

export function parseStoredConsent(
  raw: string | null,
  now: number,
): StoredConsent | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const candidate = parsed as Partial<StoredConsent>
    if (
      typeof candidate.analytics !== 'boolean' ||
      typeof candidate.decidedAt !== 'number'
    ) {
      return null
    }
    if (now - candidate.decidedAt > CONSENT_TTL_MS) return null
    return { analytics: candidate.analytics, decidedAt: candidate.decidedAt }
  } catch {
    return null
  }
}

export function readStoredConsent(
  storage: ConsentStorage,
  now: number,
): StoredConsent | null {
  return parseStoredConsent(storage.getItem(CONSENT_STORAGE_KEY), now)
}

export function writeStoredConsent(
  storage: ConsentStorage,
  analytics: boolean,
  now: number,
): StoredConsent {
  const record: StoredConsent = { analytics, decidedAt: now }
  storage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record))
  return record
}

/** Paramètres Consent Mode v2 correspondant à la décision. Seule la mesure
 *  d'audience est concernée : aucun cookie publicitaire (politique cookies). */
export function buildConsentUpdate(analytics: boolean): Record<string, string> {
  return {
    analytics_storage: analytics ? 'granted' : 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  }
}

/** Applique la décision à Google Tag Manager (no-op sans conteneur). */
export function applyConsent(analytics: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.gtag?.('consent', 'update', buildConsentUpdate(analytics))
    window.dataLayer?.push({
      event: 'cookie_consent',
      consent_analytics: analytics,
    })
  } catch {
    // le consentement ne doit jamais casser la page
  }
}
