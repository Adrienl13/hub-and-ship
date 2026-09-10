import {
  visualSelectionSchema,
  visualAssociationStatus,
  type VisualAssociation,
} from './visual-library'
import { z } from 'zod'
import type { ProjectState, StudioProjectItem } from './types'
import type { TableConfiguration } from './table-project'
export const CUSTOMIZATION_FIELDS = {
  seat: {
    structure_color: 'Couleur de structure',
    weave_color: 'Couleur de tressage',
    weave_pattern: 'Motif de tressage',
    textilene_color: 'Couleur de textilène',
    rope_color: 'Couleur de corde',
    finish: 'Finition',
    note: 'Note sur l’assise',
  },
  tabletop: {
    tabletop_finish: 'Finition du plateau',
    tabletop_color: 'Couleur du plateau',
    cerclage: 'Chant / cerclage',
  },
  base: {
    base_color: 'Couleur du piètement',
    base_finish: 'Finition du piètement',
  },
  line_item: {
    desired_delivery_window: 'Période de livraison souhaitée',
    logo_request: 'Logo',
    ral_request: 'Teinte RAL',
    custom_dimensions_request: 'Dimensions spéciales',
    special_request_note: 'Note sur la ligne',
  },
  project: {
    desired_delivery_window: 'Période de livraison souhaitée',
    logo_request: 'Logo',
    ral_request: 'Teinte RAL',
    custom_dimensions_request: 'Dimensions spéciales',
    special_request_note: 'Note sur le projet',
  },
} as const
export const scopeSchema = z.enum([
  'seat',
  'tabletop',
  'base',
  'line_item',
  'project',
])
export type CustomizationScope = z.infer<typeof scopeSchema>
export const kindSchema = z.enum([
  'structure_color',
  'weave_color',
  'weave_pattern',
  'textilene_color',
  'rope_color',
  'finish',
  'note',
  'tabletop_finish',
  'tabletop_color',
  'cerclage',
  'base_color',
  'base_finish',
  'desired_delivery_window',
  'logo_request',
  'ral_request',
  'custom_dimensions_request',
  'special_request_note',
])
export type CustomizationKind = z.infer<typeof kindSchema>
export const statusSchema = z.enum([
  'verified',
  'on_request',
  'unavailable',
  'unknown',
])
export type CustomizationStatus = z.infer<typeof statusSchema>
export const STATUS_LABEL = {
  verified: 'Validé',
  on_request: 'Sur demande',
  unavailable: 'Indisponible',
  unknown: 'À confirmer',
} as const
export const capabilitySchema = z
  .object({
    id: z.string().min(1),
    product_id: z.string().nullable(),
    scope: scopeSchema,
    kind: kindSchema,
    status: statusSchema,
    values: z.array(z.string().trim().min(1).max(120)).max(100),
    allows_free_text: z.boolean(),
    requires_review: z.boolean(),
    min_quantity: z.number().int().positive().nullable(),
    max_quantity: z.number().int().positive().nullable(),
  })
  .refine(
    (c) =>
      c.kind in CUSTOMIZATION_FIELDS[c.scope] &&
      (['seat', 'tabletop', 'base'].includes(c.scope)
        ? Boolean(c.product_id)
        : c.product_id === null) &&
      (c.min_quantity === null ||
        c.max_quantity === null ||
        c.min_quantity <= c.max_quantity),
  )
export type CustomizationCapability = z.infer<typeof capabilitySchema>
export interface CapabilityData {
  visualAssociations?: ReadonlyArray<VisualAssociation>
  available: boolean
  capabilities: ReadonlyArray<CustomizationCapability>
}
export const EMPTY_CAPABILITIES: CapabilityData = {
  available: false,
  capabilities: [],
}
export const selectionSchema = z.object({
  visual: visualSelectionSchema.optional(),
  kind: kindSchema,
  value: z.string().max(120).default(''),
  note: z.string().max(600).default(''),
  requested: z.boolean().default(false),
})
export type CustomerSelection = z.infer<typeof selectionSchema>
export type CustomizationDraft = Record<string, CustomerSelection[]>
export function sanitizeCustomization(raw: unknown): CustomizationDraft {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  return Object.fromEntries(
    Object.entries(raw)
      .slice(0, 300)
      .flatMap(([key, value]) => {
        if (key.length > 500 || !Array.isArray(value)) return []
        const seen = new Set<string>()
        const rows = value.slice(0, 20).flatMap((row) => {
          const parsed = selectionSchema.safeParse(row)
          if (!parsed.success || seen.has(parsed.data.kind)) return []
          seen.add(parsed.data.kind)
          return [parsed.data]
        })
        return [[key, rows]]
      }),
  )
}
export interface CustomizationTarget {
  key: string
  scope: CustomizationScope
  productId: string | null
  quantity: number
}
export const seatKey = (
  item: Pick<StudioProjectItem, 'productId' | 'variantId'>,
) => JSON.stringify(['seat', item.productId, item.variantId])
export const tableKey = (table: Pick<TableConfiguration, 'id'>) =>
  JSON.stringify(['table', table.id])
export function lineTargets(
  key: string,
  quantity: number,
  products: Partial<Record<'seat' | 'tabletop' | 'base', string>>,
): CustomizationTarget[] {
  return [
    {
      key: JSON.stringify([key, 'line_item']),
      scope: 'line_item',
      productId: null,
      quantity,
    },
    ...Object.entries(products).map(([scope, productId]) => ({
      key: JSON.stringify([key, scope, productId]),
      scope: scope as CustomizationScope,
      productId,
      quantity,
    })),
  ]
}
export const projectTarget: CustomizationTarget = {
  key: 'project',
  scope: 'project',
  productId: null,
  quantity: 1,
}
export function projectTargets(
  items: ReadonlyArray<StudioProjectItem>,
  tables: ReadonlyArray<TableConfiguration>,
): CustomizationTarget[] {
  return [
    {
      ...projectTarget,
      quantity:
        items.reduce((n, i) => n + i.requestedQuantity, 0) +
        tables.reduce((n, t) => n + t.quantity, 0),
    },
    ...items.flatMap((i) =>
      lineTargets(seatKey(i), i.requestedQuantity, { seat: i.productId }),
    ),
    ...tables.flatMap((t) =>
      lineTargets(tableKey(t), t.quantity, {
        ...(t.top ? { tabletop: t.top.productId } : {}),
        ...(t.base ? { base: t.base.productId } : {}),
      }),
    ),
  ]
}
export function capabilityFor(
  target: CustomizationTarget,
  kind: CustomizationKind,
  data: CapabilityData,
): CustomizationCapability | undefined {
  if (!data.available) return undefined
  const matches = data.capabilities.filter(
    (c) =>
      c.scope === target.scope &&
      c.product_id === target.productId &&
      c.kind === kind,
  )
  return matches.length === 1 ? matches[0] : undefined
}
export interface SelectionEvaluation {
  target: CustomizationTarget
  selection: CustomerSelection
  status: CustomizationStatus
  review: boolean
  special: boolean
  reason: string
}
export function evaluateCustomization(
  targets: ReadonlyArray<CustomizationTarget>,
  draft: CustomizationDraft,
  data: CapabilityData,
) {
  const selections: SelectionEvaluation[] = targets.flatMap((target) =>
    (draft[target.key] ?? [])
      .filter((s) => s.value || s.note.trim() || s.requested)
      .map((selection) => {
        const capability = capabilityFor(target, selection.kind, data)
        const special = [
          'logo_request',
          'ral_request',
          'custom_dimensions_request',
        ].includes(selection.kind)
        let status = capability?.status ?? 'unknown'
        let reason = 'capability_unconfirmed'
        if (!(selection.kind in CUSTOMIZATION_FIELDS[target.scope]))
          status = 'unknown'
        else if (capability) {
          const outside =
            (capability.min_quantity !== null &&
              target.quantity < capability.min_quantity) ||
            (capability.max_quantity !== null &&
              target.quantity > capability.max_quantity)
          if (status === 'unavailable') reason = 'option_unavailable'
          else if (
            outside ||
            (!selection.visual &&
              selection.value &&
              !capability.values.includes(selection.value)) ||
            (selection.note.trim() && !capability.allows_free_text)
          ) {
            status = 'unknown'
            reason = 'selection_unconfirmed'
          } else
            reason = capability.requires_review
              ? 'review_required'
              : 'capability_' + status
        }
        if (selection.visual) {
          const association = visualAssociationStatus(
            target.productId,
            selection.visual.public_ref,
            data.visualAssociations ?? [],
          )
          if (association === 'unavailable') status = 'unavailable'
          else if (
            status !== 'unavailable' &&
            (association === 'unknown' || selection.visual.weave_colors.length)
          )
            status = 'unknown'
          else if (status === 'verified' && association === 'on_request')
            status = 'on_request'
          reason = 'visual_association_' + association
        }
        const review =
          Boolean(selection.note.trim()) ||
          special ||
          status !== 'verified' ||
          Boolean(capability?.requires_review)
        return { target, selection, status, review, special, reason }
      }),
  )
  const state: ProjectState | null = selections.some(
    (s) => s.status === 'unknown' || s.status === 'unavailable',
  )
    ? 'feasibility_review'
    : selections.some((s) => s.review)
      ? 'manual_quote_required'
      : selections.length
        ? 'auto_quote_ready'
        : null
  return {
    selections,
    state,
    special: selections.some((s) => s.special),
    canSend: true as const,
  }
}
export function withCustomizationState(
  state: ProjectState | null,
  custom: ProjectState | null,
): ProjectState | null {
  const states = [state, custom]
  return states.includes('manual_quote_required')
    ? 'manual_quote_required'
    : states.includes('feasibility_review')
      ? 'feasibility_review'
      : states.includes('auto_quote_ready')
        ? 'auto_quote_ready'
        : state
}
export function selectionLabel(row: SelectionEvaluation): string {
  const fields = CUSTOMIZATION_FIELDS[row.target.scope] as Partial<
    Record<CustomizationKind, string>
  >
  return `${fields[row.selection.kind] ?? row.selection.kind} : ${[row.selection.value, row.selection.visual?.weave_colors.length ? `Couleurs souhaitées : ${row.selection.visual.weave_colors.join(' / ')}` : '', row.selection.note, row.selection.requested ? 'demandé' : ''].filter(Boolean).join(' · ')} — ${STATUS_LABEL[row.status]}${row.review ? ' · validation requise' : ''}`
}
