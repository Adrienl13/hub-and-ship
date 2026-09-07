// Garde-fou de déploiement : un build de production sans variables Supabase
// publiques doit être refusé AVANT le build (incident du 07/09/2026).

import { describe, expect, it } from 'vitest'

import {
  REQUIRED_PUBLIC_ENV,
  findMissingPublicEnv,
  formatMissingEnvMessage,
  parseDotenv,
  resolveViteEnv,
  viteEnvFilesForMode,
} from '../../scripts/lib/deploy-env.mjs'

const files = (map: Record<string, string>) => (name: string) => map[name] ?? null

describe('garde-fou de déploiement', () => {
  it('exige exactement les deux variables publiques Supabase', () => {
    expect(REQUIRED_PUBLIC_ENV).toEqual(['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'])
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
    expect(findMissingPublicEnv({ VITE_SUPABASE_URL: '  ', VITE_SUPABASE_ANON_KEY: 'k' })).toEqual([
      'VITE_SUPABASE_URL',
    ])
  })

  it('accepte les variables fournies par le shell', () => {
    const env = resolveViteEnv({
      processEnv: { VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: 'anon' },
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
        '.env': 'VITE_SUPABASE_URL=https://base.supabase.co\nVITE_SUPABASE_ANON_KEY=base',
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
      readFile: files({ '.env': 'VITE_SUPABASE_ANON_KEY=file\nVITE_SUPABASE_URL=u' }),
    })
    expect(env.VITE_SUPABASE_ANON_KEY).toBe('shell')
  })

  it('ne considère pas .env.example comme une source', () => {
    const env = resolveViteEnv({
      processEnv: {},
      readFile: files({ '.env.example': 'VITE_SUPABASE_URL=\nVITE_SUPABASE_ANON_KEY=' }),
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
    ).toEqual({ VITE_A: '1', VITE_B: 'deux', VITE_C: 'trois # pas un commentaire', VITE_D: 'quatre' })
  })
})
