import {
  sanitizeCustomization,
  projectTargets,
  type CustomizationDraft,
} from './customization'
import type { StudioProjectItem } from './types'
import { sanitizeTables, type TableConfiguration } from './table-project'
export function configurationSnapshot(
  items: ReadonlyArray<StudioProjectItem>,
  tables: ReadonlyArray<TableConfiguration>,
  draft: CustomizationDraft,
) {
  const active = new Set(projectTargets(items, tables).map((t) => t.key))
  return {
    version: 1,
    items: items.map((i) => ({
      productId: i.productId,
      variantId: i.variantId,
      role: i.role,
      requestedQuantity: i.requestedQuantity,
    })),
    tables: sanitizeTables(tables),
    choices: Object.fromEntries(
      Object.entries(sanitizeCustomization(draft)).filter(([key]) =>
        active.has(key),
      ),
    ),
  }
}
export function canonicalConfiguration(value: unknown): string {
  if (Array.isArray(value))
    return '[' + value.map(canonicalConfiguration).join(',') + ']'
  if (value !== null && typeof value === 'object')
    return (
      '{' +
      Object.keys(value)
        .sort()
        .map(
          (k) =>
            JSON.stringify(k) +
            ':' +
            canonicalConfiguration((value as Record<string, unknown>)[k]),
        )
        .join(',') +
      '}'
    )
  return JSON.stringify(value)
}
export async function configurationReference(snapshot: unknown) {
  const bytes = new TextEncoder().encode(canonicalConfiguration(snapshot))
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return (
    'PI-C-' +
    Array.from(new Uint8Array(hash))
      .slice(0, 12)
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  )
}
