// Garde-fou de déploiement : un build de production sans variables Supabase
// publiques doit être refusé AVANT le build (incident du 07/09/2026).

import { describe, expect, it } from 'vitest'

import {
  REQUIRED_PUBLIC_ENV,
  findMissingPublicEnv,
  findStudioFlagProblem,
  formatMissingEnvMessage,
  parseDotenv,
  resolveViteEnv,
  viteEnvFilesForMode,
} from '../../scripts/lib/deploy-env.mjs'

const files = (map: Record<string, string>) => (name: string) =>
  map[name] ?? null

describe('garde-fou de déploiement', () => {
  it('exige exactement les deux variables publiques Supabase', () => {
    expect(REQUIRED_PUBLIC_ENV).toEqual([
      'VITE_SUPABASE_URL',
      'VITE_SUPABASE_ANON_KEY',
    ])
  })

  it('refuse un environnement vide et nomme les variables manquantes sans valeur', () => {
    const missing = findMissingPublicEnv({})
    expect(missing).toEqual(['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'])
    const message = formatMissingEnvMessage(missing)
    expect(message).toContain('VITE_SUPABASE_URL')
    expect(message).toContain('6 produits')
    expect(message).not.toMatch(/eyJ|https:\/\/[a-z]+\.supabase\.co/)
  })

  it('refuse une valeur vide ou faite d’espaces', () => {
    expect(
      findMissingPublicEnv({
        VITE_SUPABASE_URL: '  ',
        VITE_SUPABASE_ANON_KEY: 'k',
      }),
    ).toEqual(['VITE_SUPABASE_URL'])
  })

  it('accepte les variables fournies par le shell', () => {
    const env = resolveViteEnv({
      processEnv: {
        VITE_SUPABASE_URL: 'https://x.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'anon',
      },
      readFile: files({}),
    })
    expect(findMissingPublicEnv(env)).toEqual([])
  })

  it('lit les fichiers .env dans l’ordre de priorité de Vite (mode production)', () => {
    expect(viteEnvFilesForMode('production')).toEqual([
      '.env',
      '.env.local',
      '.env.production',
      '.env.production.local',
    ])
    const env = resolveViteEnv({
      processEnv: {},
      readFile: files({
        '.env':
          'VITE_SUPABASE_URL=https://base.supabase.co\nVITE_SUPABASE_ANON_KEY=base',
        '.env.production': 'VITE_SUPABASE_URL="https://prod.supabase.co"',
      }),
    })
    expect(env.VITE_SUPABASE_URL).toBe('https://prod.supabase.co')
    expect(env.VITE_SUPABASE_ANON_KEY).toBe('base')
    expect(findMissingPublicEnv(env)).toEqual([])
  })

  it('le shell l’emporte sur les fichiers', () => {
    const env = resolveViteEnv({
      processEnv: { VITE_SUPABASE_ANON_KEY: 'shell' },
      readFile: files({
        '.env': 'VITE_SUPABASE_ANON_KEY=file\nVITE_SUPABASE_URL=u',
      }),
    })
    expect(env.VITE_SUPABASE_ANON_KEY).toBe('shell')
  })

  it('ne considère pas .env.example comme une source', () => {
    const env = resolveViteEnv({
      processEnv: {},
      readFile: files({
        '.env.example': 'VITE_SUPABASE_URL=\nVITE_SUPABASE_ANON_KEY=',
      }),
    })
    expect(findMissingPublicEnv(env)).toHaveLength(2)
  })

  it('parse un dotenv réaliste : commentaires, export, guillemets', () => {
    expect(
      parseDotenv(`# commentaire
export VITE_A=1
VITE_B='deux'
VITE_C="trois # pas un commentaire"
VITE_D=quatre # commentaire
INVALIDE
`),
    ).toEqual({
      VITE_A: '1',
      VITE_B: 'deux',
      VITE_C: 'trois # pas un commentaire',
      VITE_D: 'quatre',
    })
  })
})

describe('garde-fou de déploiement — ouverture du Studio', () => {
  // Régression du 22/09/2026 : un build sans le flag a refermé le Studio en
  // silence ; « Le Studio » et « Commencer un projet » retombaient sur les
  // ancres de la page d'accueil.
  it('refuse un build sans VITE_STUDIO_ENABLED=true et dit quoi faire', () => {
    const message = findStudioFlagProblem({})
    expect(message).toContain('VITE_STUDIO_ENABLED')
    expect(message).toContain('absent')
    expect(message).toContain('.env.local')
    expect(findStudioFlagProblem({ VITE_STUDIO_ENABLED: 'false' })).toContain(
      '« false »',
    )
    expect(findStudioFlagProblem({ VITE_STUDIO_ENABLED: '  ' })).toContain(
      'absent',
    )
  })

  it('accepte les mêmes valeurs vraies que le flag lui-même', () => {
    for (const value of ['true', 'TRUE', '1', 'on', 'yes']) {
      expect(findStudioFlagProblem({ VITE_STUDIO_ENABLED: value })).toBeNull()
    }
  })

  it('laisse refermer le Studio, mais seulement en le disant', () => {
    expect(findStudioFlagProblem({ STUDIO_CLOSED: '1' })).toBeNull()
    expect(findStudioFlagProblem({ STUDIO_CLOSED: 'oui' })).not.toBeNull()
  })

  it('lit le flag depuis les fichiers .env comme le fera Vite', () => {
    const env = resolveViteEnv({
      processEnv: {},
      readFile: files({ '.env.local': 'VITE_STUDIO_ENABLED=true' }),
    })
    expect(findStudioFlagProblem(env)).toBeNull()
  })
})
