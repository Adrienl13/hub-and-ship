// Duels (lot 2) : DÉSACTIVÉS par défaut. Un duel n'existe que si une paire
// diagnostique EXPLICITE (saisie admin ou produite au lot 3, statut vérifié)
// relie deux finalistes en présence. Aucune paire = aucun duel, jamais de
// paire générée.

import type { DiagnosticPair } from '../types'

export interface DiagnosticDuel {
  readonly pairId: string
  readonly axis: string
  readonly leftId: string
  readonly rightId: string
}

export function findDiagnosticDuel(
  finalistIds: ReadonlyArray<string>,
  pairs: ReadonlyArray<DiagnosticPair>,
  options: { readonly enabled?: boolean } = {},
): DiagnosticDuel | null {
  if (options.enabled !== true) return null
  const finalists = new Set(finalistIds)
  for (const pair of pairs) {
    if (pair.productAId === pair.productBId) continue
    if (finalists.has(pair.productAId) && finalists.has(pair.productBId)) {
      return {
        pairId: pair.id,
        axis: pair.axis,
        leftId: pair.productAId,
        rightId: pair.productBId,
      }
    }
  }
  return null
}
