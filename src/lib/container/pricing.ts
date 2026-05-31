// Container pricing module — kept on PURPOSE without hard-coded € prices.
//
// Import freight rates swing too much (FX, fuel surcharges, route
// congestion) for us to commit a number in the codebase that would
// quickly go stale and mislead the client. The cart only quotes
// *volume* and the relative gap between formats, so the message stays
// truthful no matter the spot rate: a 40' offers >2× the room of a
// 20', which is the actual lever for distributor pricing.
//
// When the ops team needs to give a specific quote, they reply on the
// reservation thread with the day's number — the front-end never
// pretends to know it.

import type { ContainerType } from '@/lib/supabase/types'

/** Commercial usable cbm per format. These are the volumes the cart
 *  treats as "100% full"; the gross internal volume is larger but the
 *  remaining 10–15% is unusable (dunnage, irregular package shapes,
 *  lashing margins). */
export const CONTAINER_USABLE_CBM: Record<ContainerType, number> = {
  '20_dv': 28,
  '20_hc': 32,
  '40_gp': 58,
  '40_hc': 66,
}

export function getContainerUsableCbm(type: ContainerType): number {
  return CONTAINER_USABLE_CBM[type]
}

const FORMAT_LABEL: Record<ContainerType, string> = {
  '20_dv': "20' Dry Van",
  '20_hc': "20' High Cube",
  '40_gp': "40' General Purpose",
  '40_hc': "40' High Cube",
}

export function getContainerLabel(type: ContainerType): string {
  return FORMAT_LABEL[type]
}

/** Volume gap to the largest "next step up" format. Used to nudge a
 *  distributor on a 20' toward a 40' — we don't quote € savings,
 *  we quote the m³ of headroom they'd unlock. */
export function getVolumeUpgradeDelta(
  current: ContainerType,
  target: ContainerType,
): { extraCbm: number; gainPercent: number } {
  const here = CONTAINER_USABLE_CBM[current]
  const there = CONTAINER_USABLE_CBM[target]
  const extraCbm = there - here
  const gainPercent = here > 0 ? Math.round((extraCbm / here) * 100) : 0
  return { extraCbm, gainPercent }
}

/** Remaining cbm in the active container at a given used volume. */
export function getRemainingCbm(type: ContainerType, usedCbm: number): number {
  return Math.max(0, CONTAINER_USABLE_CBM[type] - usedCbm)
}
