// Moteur de découverte Studio — point d'entrée (lot 2).
//
// V0 est un moteur HEURISTIQUE assumé : il sert à développer l'UX, garantir
// la diversité, apprendre des j'aime / pas pour moi simples, tester les
// transitions et l'Undo, enregistrer les interactions. Il ne prétend pas
// comprendre un goût et l'interface ne doit jamais le dire.
//
// Règles absolues :
// - le prix n'est JAMAIS lu : ni score, ni filtre, ni ordre ;
// - aucun fait commercial n'est produit ici : le moteur classe et compare,
//   la base reste la vérité ;
// - déterministe pour un sessionId + un historique identiques ;
// - seules les familles VÉRIFIÉES influencent le score ;
// - aucun duel sans paire diagnostique explicite.

export { ALGORITHM_VERSION, nextCard, initialOrder, remainingCandidates } from './v0'
export type { AlgorithmVersion, NextCard, NextCardReason } from './v0'
export {
  affinityFromHistory,
  scoreCandidate,
  emptyAffinity,
  MAX_FINALISTS,
  selectFinalists,
  moreFinalistCandidates,
} from './scoring'
export type { Affinity, FinalistSelection } from './scoring'
export { interleaveByDiversity, repetitionPenalty, noveltyBonus } from './diversity'
export { findDiagnosticDuel } from './duels'
export type { DiagnosticDuel } from './duels'
export type {
  EngineCatalogue,
  EngineSeat,
  EngineState,
  Interaction,
  InteractionAction,
} from './types'
export { toEngineSeat } from './types'
