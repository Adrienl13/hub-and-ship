// Transport pricing per ISO container format.
//
// Why this file exists: the per-cbm cost of shipping is dominated by
// the fixed container fee, so doubling the format barely raises the
// invoice while almost doubling the available volume. The cart and the
// sidebar use these numbers to surface a real per-m³ rate to the
// client instead of asking them to read between the lines.
//
// All values are indicative (Marseille-Fos / Le Havre routes, current
// market). They feed the toggle UX, not the actual invoice — the
// definitive price still comes from the booking flow downstream.

import type { ContainerType } from '@/lib/supabase/types'

/** Door-to-port transport cost for one container of each ISO format. */
export const CONTAINER_TRANSPORT_COST_EUR: Record<ContainerType, number> = {
  '20_dv': 3200,
  '20_hc': 3300,
  '40_gp': 3800,
  '40_hc': 4000,
}

/** Commercial usable cbm per format (≈ 85% of the gross internal
 *  volume — the rest is lost to dunnage, lashing, and irregular
 *  package shapes). */
export const CONTAINER_USABLE_CBM: Record<ContainerType, number> = {
  '20_dv': 28,
  '20_hc': 32,
  '40_gp': 58,
  '40_hc': 67,
}

export function getContainerTransportCost(type: ContainerType): number {
  return CONTAINER_TRANSPORT_COST_EUR[type]
}

export function getContainerUsableCbm(type: ContainerType): number {
  return CONTAINER_USABLE_CBM[type]
}

/** Effective €/m³ rate for a fully-loaded container — the simplest way
 *  to convey that a 40' GP is roughly half the price of a 20' DV. */
export function getCostPerCbm(type: ContainerType): number {
  return (
    CONTAINER_TRANSPORT_COST_EUR[type] / CONTAINER_USABLE_CBM[type]
  )
}

/** Difference (positive = saving, negative = surcharge) when moving the
 *  same `usedCbm` from `from` to `to`. Pro-rated by the actually used
 *  volume so a half-empty container doesn't claim impossible savings. */
export function getTransportDelta(
  from: ContainerType,
  to: ContainerType,
  usedCbm: number,
): number {
  const fromRate = getCostPerCbm(from)
  const toRate = getCostPerCbm(to)
  return Math.round((fromRate - toRate) * Math.max(0, usedCbm))
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
