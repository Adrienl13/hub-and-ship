#!/usr/bin/env node
/* global console, process */
// Garde-fou exécuté en tête de `bun run deploy` : refuse de construire un
// bundle de production sans VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.
// N'affiche jamais une valeur. Logique testée dans scripts/lib/deploy-env.mjs.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  findMissingPublicEnv,
  formatMissingEnvMessage,
  resolveViteEnv,
} from './lib/deploy-env.mjs'

const cwd = process.cwd()
const env = resolveViteEnv({
  processEnv: process.env,
  mode: process.env.DEPLOY_ENV_MODE ?? 'production',
  readFile: (name) => {
    const path = join(cwd, name)
    return existsSync(path) ? readFileSync(path, 'utf8') : null
  },
})

const missing = findMissingPublicEnv(env)
if (missing.length > 0) {
  console.error(formatMissingEnvMessage(missing))
  process.exit(1)
}
console.log('Garde-fou déploiement : variables publiques Supabase présentes.')
