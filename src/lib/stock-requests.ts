import { z } from 'zod'

import type { StockLine } from '@/lib/stock'
import type { Database, Json, StockRequestStatus } from '@/lib/supabase/types'

export const LOCAL_STOCK_REQUESTS_KEY = 'container-club-stock-requests'

export type StockRequestInsertPayload =
  Database['public']['Tables']['stock_requests']['Insert']

export type StockRequestRow =
  Database['public']['Tables']['stock_requests']['Row']

export const STOCK_REQUEST_STATUS_LABEL: Record<StockRequestStatus, string> = {
  new: 'Nouveau',
  contacted: 'Contacte',
  reserved: 'Reserve',
  converted: 'Converti',
  closed: 'Clos',
}

export interface StockRequestInput {
  readonly line: StockLine
  readonly companyName: string
  readonly contactEmail: string
  readonly contactPhone: string
  readonly requestedQuantity: number
  readonly customerNote?: string
  readonly now?: Date
}

export interface StockRequestDraft {
  readonly localId: string
  readonly status: StockRequestStatus
  readonly stockLineId: string
  readonly productId: string
  readonly sku: string
  readonly productName: string
  readonly variantId: string
  readonly variantName: string
  readonly requestedQuantity: number
  readonly availableUnitsSnapshot: number
  readonly unitPriceHt: number
  readonly estimatedTotalHt: number
  readonly companyName: string
  readonly contactEmail: string
  readonly contactPhone: string
  readonly location: string
  readonly customerNote: string | null
  readonly productSnapshot: {
    readonly category: string
    readonly dimensions: StockLine['product']['dimensions']
    readonly cbmPerUnit: number
    readonly weightKg: number
    readonly imageUrl: string
    readonly condition: StockLine['condition']
  }
  readonly createdAt: string
}

export interface StockRequestValidationIssue {
  readonly path: string
  readonly message: string
}

export type StockRequestDraftResult =
  | { readonly ok: true; readonly draft: StockRequestDraft }
  | {
      readonly ok: false
      readonly issues: ReadonlyArray<StockRequestValidationIssue>
    }

export interface StockRequestStorage {
  readonly getItem: (key: string) => string | null
  readonly setItem: (key: string, value: string) => void
}

const stockRequestSchema = z.object({
  companyName: z.string().trim().min(2, 'Société obligatoire'),
  contactEmail: z.string().trim().email('Email professionnel invalide'),
  contactPhone: z.string().trim().min(6, 'Téléphone obligatoire'),
  requestedQuantity: z
    .number()
    .int('Quantité entière obligatoire')
    .positive('Quantité obligatoire'),
  customerNote: z.string().trim().max(500).optional(),
})

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function createLocalId({
  stockLineId,
  now,
}: {
  readonly stockLineId: string
  readonly now: Date
}): string {
  const compactTimestamp = now
    .toISOString()
    .replaceAll('-', '')
    .replaceAll(':', '')
    .replaceAll('.', '')
    .replaceAll('T', '')
    .replaceAll('Z', '')
    .slice(0, 14)

  return `stock-${stockLineId}-${compactTimestamp}`
}

function isStockRequestDraft(value: unknown): value is StockRequestDraft {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Partial<StockRequestDraft>
  return (
    typeof candidate.localId === 'string' &&
    typeof candidate.stockLineId === 'string' &&
    typeof candidate.companyName === 'string' &&
    typeof candidate.contactEmail === 'string' &&
    typeof candidate.requestedQuantity === 'number'
  )
}

export function buildStockRequestDraft(
  input: StockRequestInput,
): StockRequestDraftResult {
  const parsed = stockRequestSchema.safeParse({
    companyName: input.companyName,
    contactEmail: input.contactEmail,
    contactPhone: input.contactPhone,
    requestedQuantity: input.requestedQuantity,
    customerNote: input.customerNote,
  })

  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.') || 'stockRequest',
        message: issue.message,
      })),
    }
  }

  const now = input.now ?? new Date()
  const requestedQuantity = Math.min(
    parsed.data.requestedQuantity,
    input.line.availableUnits,
  )

  return {
    ok: true,
    draft: {
      localId: createLocalId({ stockLineId: input.line.id, now }),
      status: 'new',
      stockLineId: input.line.id,
      productId: input.line.product.id,
      sku: input.line.product.sku,
      productName: input.line.product.name,
      variantId: input.line.variant.id,
      variantName: input.line.variant.name,
      requestedQuantity,
      availableUnitsSnapshot: input.line.availableUnits,
      unitPriceHt: input.line.stockPriceHt,
      estimatedTotalHt: round2(requestedQuantity * input.line.stockPriceHt),
      companyName: parsed.data.companyName,
      contactEmail: parsed.data.contactEmail.toLocaleLowerCase('fr-FR'),
      contactPhone: parsed.data.contactPhone,
      location: input.line.location,
      customerNote: parsed.data.customerNote || null,
      productSnapshot: {
        category: input.line.product.category,
        dimensions: input.line.product.dimensions,
        cbmPerUnit: input.line.product.cbmPerUnit,
        weightKg: input.line.product.weightKg,
        imageUrl: input.line.product.mainImageUrl,
        condition: input.line.condition,
      },
      createdAt: now.toISOString(),
    },
  }
}

export function toStockRequestInsertPayload(
  draft: StockRequestDraft,
): StockRequestInsertPayload {
  return {
    status: draft.status,
    stock_line_id: draft.stockLineId,
    product_id: draft.productId,
    sku: draft.sku,
    product_name: draft.productName,
    variant_id: draft.variantId,
    variant_name: draft.variantName,
    requested_quantity: draft.requestedQuantity,
    available_units_snapshot: draft.availableUnitsSnapshot,
    unit_price_ht: draft.unitPriceHt,
    estimated_total_ht: draft.estimatedTotalHt,
    company_name: draft.companyName,
    contact_email: draft.contactEmail,
    contact_phone: draft.contactPhone,
    location: draft.location,
    customer_note: draft.customerNote,
    product_snapshot: draft.productSnapshot as Json,
    source: 'stock_24h_page',
    created_at: draft.createdAt,
    updated_at: draft.createdAt,
  }
}

export function readLocalStockRequests(
  storage: StockRequestStorage,
): ReadonlyArray<StockRequestDraft> {
  const raw = storage.getItem(LOCAL_STOCK_REQUESTS_KEY)
  if (!raw) return []

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed.filter(isStockRequestDraft)
  } catch {
    return []
  }
}

export function writeLocalStockRequests({
  storage,
  requests,
}: {
  readonly storage: StockRequestStorage
  readonly requests: ReadonlyArray<StockRequestDraft>
}): void {
  storage.setItem(LOCAL_STOCK_REQUESTS_KEY, JSON.stringify(requests))
}

export function saveStockRequestToLocalHistory({
  storage,
  draft,
}: {
  readonly storage: StockRequestStorage
  readonly draft: StockRequestDraft
}): StockRequestDraft {
  const previous = readLocalStockRequests(storage).filter(
    (request) => request.localId !== draft.localId,
  )

  writeLocalStockRequests({
    storage,
    requests: [draft, ...previous].slice(0, 50),
  })

  return draft
}
