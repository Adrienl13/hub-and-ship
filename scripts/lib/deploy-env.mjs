// Garde-fou de déploiement : logique pure, testée (tests/unit/deploy-env).
//
// Incident du 07/09/2026 : un build de production déployé sans
// VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY a fait tomber le catalogue sur
// son fallback local de 6 produits. `bun run deploy` refuse désormais de
// construire si ces variables ne sont résolues ni par l'environnement du
// processus ni par les fichiers .env que Vite lira pour le mode production.
// Les valeurs ne sont jamais affichées ; seuls les noms manquants le sont.
// Le développement local (bun run dev) n'est pas concerné : le fallback
// mock reste utile sans Supabase.

export const REQUIRED_PUBLIC_ENV = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']

/** Ordre de priorité croissante de Vite pour `vite build` (mode production). */
export function viteEnvFilesForMode(mode = 'production') {
  return ['.env', '.env.local', `.env.${mode}`, `.env.${mode}.local`]
}

/** Parse minimal d'un fichier dotenv : KEY=value, commentaires #, guillemets
 *  simples/doubles, `export KEY=`. Pas d'interpolation. */
export function parseDotenv(text) {
  const result = {}
  for (const rawLine of String(text ?? '').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!match) continue
    let value = match[2].trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    } else {
      const hash = value.indexOf(' #')
      if (hash >= 0) value = value.slice(0, hash).trim()
    }
    result[match[1]] = value
  }
  return result
}

/**
 * Résout l'environnement tel que Vite le verra : fichiers dans l'ordre
 * croissant de priorité, puis process.env qui gagne toujours.
 * `readFile(name)` renvoie le contenu ou null si absent.
 */
export function resolveViteEnv({ processEnv = {}, readFile, mode = 'production' }) {
  const merged = {}
  for (const file of viteEnvFilesForMode(mode)) {
    const content = readFile(file)
    if (content == null) continue
    Object.assign(merged, parseDotenv(content))
  }
  for (const key of Object.keys(processEnv)) {
    const value = processEnv[key]
    if (typeof value === 'string') merged[key] = value
  }
  return merged
}

export function findMissingPublicEnv(env, required = REQUIRED_PUBLIC_ENV) {
  return required.filter((key) => !(typeof env[key] === 'string' && env[key].trim().length > 0))
}

/** Message d'erreur sans aucune valeur, uniquement les noms manquants. */
export function formatMissingEnvMessage(missing) {
  return [
    'Déploiement refusé : variables publiques Supabase absentes du build :',
    ...missing.map((key) => `  - ${key}`),
    'Sans elles, le site en ligne retombe sur le catalogue mock (6 produits).',
    'Renseigne-les dans .env.production (non commité) ou dans l’environnement du shell,',
    'puis relance `bun run deploy`. Détails : docs/RUNBOOK_FUSION_DEPLOY.md.',
  ].join('\n')
}
