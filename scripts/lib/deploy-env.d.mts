// Déclarations de types du garde-fou de déploiement (logique en .mjs pour
// rester exécutable sans build ; typée ici pour les tests Vitest).

export const REQUIRED_PUBLIC_ENV: ReadonlyArray<string>
export function viteEnvFilesForMode(mode?: string): ReadonlyArray<string>
export function parseDotenv(
  text: string | null | undefined,
): Record<string, string>
export function resolveViteEnv(input: {
  readonly processEnv?: Record<string, string | undefined>
  readonly readFile: (name: string) => string | null
  readonly mode?: string
}): Record<string, string>
export function findMissingPublicEnv(
  env: Record<string, string | undefined>,
  required?: ReadonlyArray<string>,
): ReadonlyArray<string>
export function formatMissingEnvMessage(missing: ReadonlyArray<string>): string
export const STUDIO_FLAG: string
export const STUDIO_CLOSED_OVERRIDE: string
export function findStudioFlagProblem(
  env: Record<string, string | undefined>,
): string | null
