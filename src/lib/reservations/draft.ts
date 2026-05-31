import type { CartItem, OrderTotals } from '@/lib/order'
import { calculateOrder } from '@/lib/order'
import type { ReferralApplication } from '@/lib/pricing/referral'
import { getQuantityRule, sanitizeOrderQuantity } from '@/lib/quantity'
import {
  reservationCheckoutSchema,
  type ReservationCheckoutInput,
} from '@/lib/validation/schemas'

export type ReservationDraftStatus = 'draft' | 'ready_for_payment'

export interface ReservationContactInput {
  readonly name: string
  readonly company: string
  readonly email: string
  readonly phone: string
}

export interface ReservationDeliveryInput {
  readonly deliveryMode:
    | 'pickup_at_port'
    | 'self_arranged'
    | 'partner_carrier_needed'
  readonly deliveryNote?: string
}

export interface ReservationDraftInput {
  readonly siret: string
  readonly contact: ReservationContactInput
  readonly delivery: ReservationDeliveryInput
  readonly referralCode?: string
  readonly cgvAccepted: boolean
  readonly cgvVersion: string
  readonly items: ReadonlyArray<CartItem>
  readonly containerReference: string
  readonly containerId?: string
  readonly referralApplication?: ReferralApplication
  readonly now?: Date
  readonly sequence?: number
  readonly id?: string
  readonly requestedContainerType?: '20_dv' | '20_hc' | '40_gp' | '40_hc' | null
}

export interface ReservationDraftLine {
  readonly productId: string
  readonly sku: string
  readonly productName: string
  readonly category: string
  readonly variantId: string
  readonly variantName: string
  readonly quantity: number
  readonly unitPriceHt: number
  readonly unitEcoContribution: number
  readonly subtotalHt: number
  readonly ecoContributionTotal: number
  readonly cbmTotal: number
  readonly productSnapshot: {
    readonly dimensions: CartItem['product']['dimensions']
    readonly cbmPerUnit: number
    readonly weightKg: number
    readonly retailPriceRef: number
    readonly imageUrl: string
  }
}

export interface ReservationPaymentSchedule {
  readonly reservationFee: number
  readonly payNow: number
  readonly depositAmount: number
  readonly payAt80Percent: number
  readonly balanceAmount: number
}

export interface ReservationDraft {
  readonly id: string
  readonly reference: string
  readonly status: ReservationDraftStatus
  readonly containerReference: string
  readonly containerId: string | null
  readonly siret: string
  readonly contact: ReservationCheckoutInput['contact']
  readonly delivery: ReservationCheckoutInput['delivery']
  readonly cgvVersion: string
  readonly cgvAcceptedAt: string
  readonly lines: ReadonlyArray<ReservationDraftLine>
  readonly totals: OrderTotals
  readonly payment: ReservationPaymentSchedule
  readonly referral: {
    readonly code: string | null
    readonly status: ReferralApplication['status'] | 'none'
    readonly discountAmount: number
  }
  /** ISO container format the buyer explicitly picked at checkout
   *  (via the sidebar toggle). `null` = accepted the active default
   *  (typically a 20' HC group-buy). Persisted on the reservation
   *  row so ops can spot distributor-scale demand orders. */
  readonly requestedContainerType: '20_dv' | '20_hc' | '40_gp' | '40_hc' | null
}

export interface ReservationDraftValidationIssue {
  readonly path: string
  readonly message: string
}

export type ReservationDraftResult =
  | { readonly ok: true; readonly draft: ReservationDraft }
  | {
      readonly ok: false
      readonly issues: ReadonlyArray<ReservationDraftValidationIssue>
    }

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function toIssue(
  path: string,
  message: string,
): ReservationDraftValidationIssue {
  return { path, message }
}

export function createReservationReference({
  containerReference,
  now = new Date(),
  sequence = 1,
}: {
  readonly containerReference: string
  readonly now?: Date
  readonly sequence?: number
}): string {
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '')
  const sequencePart = String(Math.max(1, Math.trunc(sequence))).padStart(
    4,
    '0',
  )

  return `${containerReference}-${datePart}-${sequencePart}`
}

export function createReservationId(): string {
  // crypto.randomUUID is available in modern browsers and in Node 19+.
  // Falls back to a v4-ish UUID built from Math.random for the rare
  // legacy runtime (jsdom test envs without crypto, very old browsers).
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  const bytes = new Uint8Array(16)
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Math.floor(Math.random() * 256)
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x40
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function buildReservationDraft(
  input: ReservationDraftInput,
): ReservationDraftResult {
  const issues: Array<ReservationDraftValidationIssue> = []

  if (input.items.length === 0) {
    issues.push(toIssue('items', 'Le panier ne peut pas être vide.'))
  }

  for (const item of input.items) {
    const rule = getQuantityRule(item.product)
    const sanitized = sanitizeOrderQuantity(item.quantity, rule)

    if (item.quantity !== sanitized) {
      issues.push(
        toIssue(
          `items.${item.product.id}.quantity`,
          `Quantité invalide pour ${item.product.name} : ${rule.label}.`,
        ),
      )
    }
  }

  const parsedCheckout = reservationCheckoutSchema.safeParse({
    siret: input.siret,
    contact: input.contact,
    delivery: input.delivery,
    referralCode: input.referralCode,
    cgvAccepted: input.cgvAccepted,
  })

  if (!parsedCheckout.success) {
    issues.push(
      ...parsedCheckout.error.issues.map((issue) =>
        toIssue(issue.path.join('.') || 'checkout', issue.message),
      ),
    )
  }

  if (!input.cgvVersion.trim()) {
    issues.push(toIssue('cgvVersion', 'Version CGV obligatoire.'))
  }

  if (issues.length > 0 || !parsedCheckout.success) {
    return { ok: false, issues }
  }

  const totals = calculateOrder([...input.items])
  const referralDiscount =
    input.referralApplication?.status === 'applied'
      ? input.referralApplication.discountAmount
      : 0
  const payNow =
    input.referralApplication?.status === 'applied'
      ? input.referralApplication.payNow
      : totals.reservationFee
  const depositAmount = round2(totals.subtotalHt * 0.3)

  return {
    ok: true,
    draft: {
      id: input.id ?? createReservationId(),
      reference: createReservationReference({
        containerReference: input.containerReference,
        now: input.now,
        sequence: input.sequence,
      }),
      status: 'ready_for_payment',
      containerReference: input.containerReference,
      containerId: input.containerId ?? null,
      siret: parsedCheckout.data.siret,
      contact: parsedCheckout.data.contact,
      delivery: parsedCheckout.data.delivery,
      cgvVersion: input.cgvVersion,
      cgvAcceptedAt: (input.now ?? new Date()).toISOString(),
      lines: input.items.map((item) => buildReservationDraftLine(item)),
      totals,
      payment: {
        reservationFee: totals.reservationFee,
        payNow: round2(payNow),
        depositAmount,
        payAt80Percent: totals.payAt80Percent,
        balanceAmount: totals.payBeforeShipping,
      },
      referral: {
        code: parsedCheckout.data.referralCode ?? null,
        status: input.referralApplication?.status ?? 'none',
        discountAmount: round2(referralDiscount),
      },
      requestedContainerType: input.requestedContainerType ?? null,
    },
  }
}

function buildReservationDraftLine(item: CartItem): ReservationDraftLine {
  return {
    productId: item.product.id,
    sku: item.product.sku,
    productName: item.product.name,
    category: item.product.category,
    variantId: item.variant.id,
    variantName: item.variant.name,
    quantity: item.quantity,
    unitPriceHt: item.product.basePriceHt,
    unitEcoContribution: item.product.ecoContribution,
    subtotalHt: round2(item.product.basePriceHt * item.quantity),
    ecoContributionTotal: round2(item.product.ecoContribution * item.quantity),
    cbmTotal: round2(item.product.cbmPerUnit * item.quantity),
    productSnapshot: {
      dimensions: item.product.dimensions,
      cbmPerUnit: item.product.cbmPerUnit,
      weightKg: item.product.weightKg,
      retailPriceRef: item.product.retailPriceRef,
      imageUrl: item.product.mainImageUrl,
    },
  }
}
