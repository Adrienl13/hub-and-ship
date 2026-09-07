// Types du moteur (lot 2). Le moteur ne voit qu'une projection MINIMALE
// d'une assise : identifiant, matière, sous-type, famille vérifiée. Aucun
// prix, aucune dimension, aucun stock : ce qu'il ne reçoit pas ne peut pas
// influencer l'ordre.

import type { DiagnosticPair, SeatKind, SeatMaterial, StudioProduct } from '../types'

export type InteractionAction = 'like' | 'dislike' | 'pass'

export interface Interaction {
  readonly productId: string
  readonly action: InteractionAction
}

/** Projection d'une assise pour le moteur. `familyId` n'est renseigné que si
 *  la famille est vérifiée (voir toEngineSeat). */
export interface EngineSeat {
  readonly id: string
  readonly material: SeatMaterial | null
  readonly seatKind: SeatKind | null
  readonly familyId: string | null
}

export interface EngineCatalogue {
  /** Assises discovery_ready, dans un ordre stable (celui de la base). */
  readonly seats: ReadonlyArray<EngineSeat>
  /** Paires diagnostiques explicites (vides par défaut). */
  readonly diagnosticPairs: ReadonlyArray<DiagnosticPair>
}

export interface EngineState {
  readonly sessionId: string
  /** Historique complet, dans l'ordre : une entrée par carte décidée. */
  readonly history: ReadonlyArray<Interaction>
}

/**
 * Projette un produit Studio vers le moteur. La famille n'est transmise que
 * si son identifiant figure dans l'ensemble des familles vérifiées fourni
 * par l'appelant : la surface publique masque déjà les familles non
 * vérifiées (lot 1), mais le moteur reste défensif.
 */
export function toEngineSeat(
  product: StudioProduct,
  verifiedFamilyIds: ReadonlySet<string>,
): EngineSeat {
  const familyId = product.studio.modelFamilyId
  return {
    id: product.id,
    material: product.studio.material,
    seatKind: product.studio.seatKind,
    familyId: familyId !== null && verifiedFamilyIds.has(familyId) ? familyId : null,
  }
}
