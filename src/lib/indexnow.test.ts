import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

import {
  INDEXNOW_ENDPOINT,
  INDEXNOW_KEY,
  INDEXNOW_MAX_URLS,
  buildPayload,
  buildUrlList,
  submitToIndexNow,
} from './indexnow'

const SITE = 'https://terrassea.com'

describe('clé IndexNow', () => {
  it('est publiée à la racine, et le fichier contient exactement la clé', () => {
    // Le protocole vérifie https://<site>/<clé>.txt : si le fichier manque ou
    // ne contient pas la clé, Bing rejette TOUTES les soumissions.
    const file = readFileSync(`public/${INDEXNOW_KEY}.txt`, 'utf8')
    expect(file.trim()).toBe(INDEXNOW_KEY)
  })

  it('a le format attendu : hexadécimal, 8 à 128 caractères', () => {
    expect(INDEXNOW_KEY).toMatch(/^[a-f0-9]{8,128}$/)
  })
})

describe('construction du lot', () => {
  it('résout les chemins relatifs sur le site', () => {
    expect(buildUrlList(SITE, ['/catalogue', '/prix'])).toEqual([
      'https://terrassea.com/catalogue',
      'https://terrassea.com/prix',
    ])
  })

  it('écarte les URLs d’un autre domaine', () => {
    // IndexNow rejette le LOT ENTIER si une seule URL n'appartient pas au
    // domaine déclaré : une intruse ferait perdre toute la soumission.
    expect(
      buildUrlList(SITE, [
        '/catalogue',
        'https://exemple.test/piege',
        'http://terrassea.com/en-clair',
      ]),
    ).toEqual(['https://terrassea.com/catalogue'])
  })

  it('déduplique en conservant l’ordre d’entrée', () => {
    // Deux exécutions identiques doivent envoyer exactement la même chose.
    expect(
      buildUrlList(SITE, ['/b', '/a', '/b', 'https://terrassea.com/a']),
    ).toEqual(['https://terrassea.com/b', 'https://terrassea.com/a'])
  })

  it('ignore une entrée qui n’est pas une adresse, sans perdre le reste', () => {
    // `new URL('n importe quoi', site)` ne lève pas : il fabriquerait
    // https://terrassea.com/n%20importe%20quoi, soumis à Bing puis crawlé
    // en 404. Seuls un chemin absolu ou une URL http(s) sont acceptés.
    expect(
      buildUrlList(SITE, ['::pas une url', 'catalogue', '', '  ', '/prix']),
    ).toEqual(['https://terrassea.com/prix'])
  })

  it('plafonne à la limite du protocole', () => {
    const many = Array.from({ length: INDEXNOW_MAX_URLS + 50 }, (_, i) => `/p/${i}`)
    expect(buildUrlList(SITE, many)).toHaveLength(INDEXNOW_MAX_URLS)
  })

  it('déclare l’hôte et l’emplacement de la clé', () => {
    const payload = buildPayload(SITE, ['/catalogue'])
    expect(payload).toEqual({
      host: 'terrassea.com',
      key: INDEXNOW_KEY,
      keyLocation: `https://terrassea.com/${INDEXNOW_KEY}.txt`,
      urlList: ['https://terrassea.com/catalogue'],
    })
  })

  it('ne construit rien s’il ne reste aucune URL valide', () => {
    expect(buildPayload(SITE, ['https://exemple.test/x'])).toBeNull()
  })
})

describe('soumission', () => {
  it('poste le lot et accepte 200 comme 202', async () => {
    for (const status of [200, 202]) {
      const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status }))
      const result = await submitToIndexNow(SITE, ['/catalogue'], fetchImpl)
      expect(result).toEqual({ ok: true, submitted: 1, status })
      expect(fetchImpl).toHaveBeenCalledWith(
        INDEXNOW_ENDPOINT,
        expect.objectContaining({ method: 'POST' }),
      )
    }
  })

  it('signale un refus sans lever', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 403 }))
    const result = await submitToIndexNow(SITE, ['/catalogue'], fetchImpl)
    expect(result.ok).toBe(false)
    expect(result.status).toBe(403)
  })

  it('avale une panne réseau', async () => {
    // Une indisponibilité d'IndexNow ne doit pas faire échouer ce qui l'a
    // déclenchée : au pire la page sera recrawlée au rythme habituel.
    const fetchImpl = vi.fn().mockRejectedValue(new Error('socket coupé'))
    const result = await submitToIndexNow(SITE, ['/catalogue'], fetchImpl)
    expect(result.ok).toBe(false)
    expect(result.error).toBe('socket coupé')
  })

  it('n’appelle pas le réseau sans URL valide', async () => {
    const fetchImpl = vi.fn()
    const result = await submitToIndexNow(SITE, ['https://exemple.test/x'], fetchImpl)
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(result.ok).toBe(false)
  })
})
