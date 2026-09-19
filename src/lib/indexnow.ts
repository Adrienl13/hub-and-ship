// IndexNow — prévenir Bing qu'une page a changé, au lieu d'attendre son
// passage.
//
// Bing (et Yandex, Seznam, Naver) réindexe en heures au lieu de semaines
// quand on lui signale l'URL. Sur un catalogue qui bouge — un prix corrigé,
// une fiche enfin rédigée, un produit activé — c'est la différence entre un
// changement visible demain et visible le mois prochain. Google n'utilise
// pas IndexNow, mais il a son propre rythme de recrawl ; ce protocole est un
// gain net côté Bing, donc côté Copilot et des IA qui s'appuient sur son
// index.
//
// La clé n'est PAS un secret : le protocole exige qu'elle soit publiée à la
// racine du site (public/<clé>.txt) pour prouver qu'on en contrôle le
// domaine. La poser dans le dépôt est normal — ce qui protège l'endpoint de
// déclenchement, c'est CRON_SECRET, pas cette clé.

/** Clé publiée dans public/dad4d7620f7ce9f465ba22a0f9a13421.txt. */
export const INDEXNOW_KEY = 'dad4d7620f7ce9f465ba22a0f9a13421'

export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow'

/** Le protocole plafonne à 10 000 URLs par requête. */
export const INDEXNOW_MAX_URLS = 10000

export interface IndexNowPayload {
  readonly host: string
  readonly key: string
  readonly keyLocation: string
  readonly urlList: ReadonlyArray<string>
}

/**
 * Filtre et normalise les URLs à soumettre.
 *
 * IndexNow REJETTE tout le lot si une seule URL n'appartient pas au domaine
 * déclaré : on écarte donc les intruses ici plutôt que de perdre la
 * soumission entière. Les doublons sont retirés (une URL soumise deux fois
 * compte deux fois dans le quota) et l'ordre d'entrée est conservé, pour que
 * deux exécutions identiques envoient exactement la même chose.
 */
export function buildUrlList(
  siteUrl: string,
  urls: ReadonlyArray<string>,
): string[] {
  const site = new URL(siteUrl)
  const seen = new Set<string>()
  const kept: string[] = []
  for (const raw of urls) {
    const candidate = raw.trim()
    // `new URL('n importe quoi', site)` NE LÈVE PAS : il fabrique
    // https://site/n%20importe%20quoi. Une entrée bancale deviendrait donc
    // une URL de notre domaine, soumise à Bing, et crawlée en 404 — du
    // budget d'exploration gaspillé. On n'accepte que ce qui ressemble
    // vraiment à une adresse : un chemin absolu, ou une URL http(s).
    if (!candidate.startsWith('/') && !/^https?:\/\//i.test(candidate)) {
      continue
    }
    let url: URL
    try {
      // Une entrée relative (« /catalogue ») est résolue sur le site ; une
      // entrée absolue d'un autre domaine est écartée juste après.
      url = new URL(candidate, site)
    } catch {
      continue
    }
    if (url.hostname !== site.hostname || url.protocol !== site.protocol) {
      continue
    }
    const href = url.toString()
    if (seen.has(href)) continue
    seen.add(href)
    kept.push(href)
    if (kept.length >= INDEXNOW_MAX_URLS) break
  }
  return kept
}

export function buildPayload(
  siteUrl: string,
  urls: ReadonlyArray<string>,
): IndexNowPayload | null {
  const urlList = buildUrlList(siteUrl, urls)
  if (urlList.length === 0) return null
  const site = new URL(siteUrl)
  return {
    host: site.hostname,
    key: INDEXNOW_KEY,
    keyLocation: `${site.origin}/${INDEXNOW_KEY}.txt`,
    urlList,
  }
}

export interface IndexNowResult {
  readonly ok: boolean
  readonly submitted: number
  readonly status: number | null
  readonly error?: string
}

/**
 * Soumet le lot. Ne lève jamais : une indisponibilité d'IndexNow ne doit pas
 * faire échouer ce qui l'a déclenchée — au pire la page sera recrawlée au
 * rythme habituel.
 *
 * 200 et 202 sont des succès (202 = clé en cours de validation).
 */
export async function submitToIndexNow(
  siteUrl: string,
  urls: ReadonlyArray<string>,
  fetchImpl: typeof fetch = fetch,
): Promise<IndexNowResult> {
  const payload = buildPayload(siteUrl, urls)
  if (!payload) {
    return { ok: false, submitted: 0, status: null, error: 'aucune URL valide' }
  }
  try {
    const response = await fetchImpl(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    })
    return {
      ok: response.status === 200 || response.status === 202,
      submitted: payload.urlList.length,
      status: response.status,
    }
  } catch (error) {
    return {
      ok: false,
      submitted: 0,
      status: null,
      error: error instanceof Error ? error.message : 'échec réseau',
    }
  }
}
