// Libellés d'affichage des données Studio (lot 2). Descriptifs et neutres :
// une matière est une matière, jamais un « style ».

import type { SeatKind, SeatMaterial } from './types'

export const SEAT_MATERIAL_LABEL: Record<SeatMaterial, string> = {
  pe_weave: 'Tressage PE',
  cane: 'Cannage',
  rope: 'Cordage',
  textilene: 'Textilène',
  aluminium: 'Aluminium',
  hpl: 'HPL',
  metal: 'Métal',
  other: 'Autre matière',
}

export const SEAT_KIND_LABEL: Record<SeatKind, string> = {
  chair: 'Chaise',
  armchair: 'Fauteuil',
  stool: 'Chaise haute',
  lounger: 'Bain de soleil',
  other: 'Assise',
}

export function materialLabel(material: SeatMaterial | null): string | null {
  return material ? SEAT_MATERIAL_LABEL[material] : null
}

export function seatKindLabel(kind: SeatKind | null): string | null {
  return kind ? SEAT_KIND_LABEL[kind] : null
}
