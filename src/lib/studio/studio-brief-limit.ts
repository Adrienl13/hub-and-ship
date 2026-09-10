/** Client summaries stay well below the strict server intake limit. */
export const STUDIO_BRIEF_SERVER_LIMIT = 200000
export const STUDIO_BRIEF_LIMIT = 20000
export const STUDIO_BRIEF_TRUNCATION =
  '[Résumé Studio tronqué — reprendre le projet avec le client]'
export function boundStudioBrief(brief: string): string {
  if (brief.length <= STUDIO_BRIEF_LIMIT) return brief
  const budget = STUDIO_BRIEF_LIMIT - STUDIO_BRIEF_TRUNCATION.length - 2
  let prefix = brief.slice(0, budget)
  const boundary = prefix.lastIndexOf('\n')
  // Prefer a complete line; a single oversized line still cannot block a lead.
  if (boundary >= budget / 2) prefix = prefix.slice(0, boundary)
  else if (/[\uD800-\uDBFF]$/.test(prefix)) prefix = prefix.slice(0, -1)
  return `${prefix.trimEnd()}\n\n${STUDIO_BRIEF_TRUNCATION}`
}
