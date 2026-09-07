// Feature flag Studio (lot 1).
//
// VITE_STUDIO_ENABLED est une variable de BUILD (inlinée par Vite, publique
// par nature) : elle n'ouvre le Studio que lorsqu'il est prêt à être vu de
// tous. Tant qu'elle est absente ou différente de 'true', les routes /studio
// n'existent pas (404) sauf preview sécurisée (voir preview-cookie.ts et
// preview-server.ts). Aucun secret ne transite par une variable VITE_*.

interface StudioFlagEnv {
  readonly VITE_STUDIO_ENABLED?: string
}

const TRUE_VALUES: ReadonlySet<string> = new Set(['true', '1', 'on', 'yes'])

export function parseStudioEnabled(value: string | undefined): boolean {
  return TRUE_VALUES.has((value ?? '').trim().toLowerCase())
}

export function isStudioEnabled(
  env: StudioFlagEnv = { VITE_STUDIO_ENABLED: import.meta.env.VITE_STUDIO_ENABLED },
): boolean {
  return parseStudioEnabled(env.VITE_STUDIO_ENABLED)
}
