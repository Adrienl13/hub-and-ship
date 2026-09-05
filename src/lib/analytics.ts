// Lightweight analytics wrapper: Plausible (cookieless) + Google Tag Manager.
//
// Activation is env-gated: VITE_PLAUSIBLE_DOMAIN loads Plausible,
// VITE_GTM_ID loads the Tag Manager container (see __root). Until then every
// track() call is a safe no-op, so instrumentation can be wired now and
// switched on later without code changes. Every funnel event is pushed to
// BOTH destinations with the same name, so GA4 goals and Plausible goals
// stay aligned. GA4 e-commerce reports get the standard `ecommerce` payload
// via trackEcommerce().

type AnalyticsProps = Record<string, string | number | boolean>

declare global {
  interface Window {
    plausible?: ((
      event: string,
      options?: { props?: AnalyticsProps },
    ) => void) & { q?: unknown[] }
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

/** Canonical funnel event names — keep them stable (used as Plausible goals
 *  and as GTM custom-event triggers). */
export const AnalyticsEvent = {
  ReserveOpen: 'reserve_open',
  ReserveStep: 'reserve_step',
  AddToCart: 'add_to_cart',
  ReservationSubmit: 'reservation_submit',
  CheckoutRedirect: 'checkout_redirect',
  CheckoutCancel: 'checkout_cancel',
  ReservationPaid: 'reservation_paid',
  ReservationFeePaid: 'reservation_fee_paid',
  SiretBlocked: 'siret_blocked',
  PartnerRequest: 'partner_request_submit',
  StockRequest: 'stock_request_submit',
  ContactSubmit: 'contact_submit',
  CustomColorwayRequest: 'custom_colorway_request',
  ReviewSubmit: 'review_submit',
  ShareSelection: 'share_selection',
  QuotePdf: 'quote_pdf',
  NotifySignup: 'notify_signup',
} as const

export type AnalyticsEventName =
  (typeof AnalyticsEvent)[keyof typeof AnalyticsEvent]

function pushToDataLayer(payload: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  window.dataLayer = window.dataLayer ?? []
  window.dataLayer.push(payload)
}

export function track(event: AnalyticsEventName, props?: AnalyticsProps): void {
  if (typeof window === 'undefined') return
  try {
    window.plausible?.(event, props ? { props } : undefined)
    pushToDataLayer({ event, ...(props ?? {}) })
  } catch {
    // analytics must never break a user flow
  }
}

/** Ligne produit au format GA4 (items[]). */
export interface EcommerceItem {
  readonly item_id: string
  readonly item_name: string
  readonly item_variant?: string
  readonly item_category?: string
  readonly price: number
  readonly quantity: number
}

export type EcommerceEventName =
  | 'view_item'
  | 'add_to_cart'
  | 'begin_checkout'
  | 'purchase'

export interface EcommercePayload {
  readonly currency: 'EUR'
  readonly value: number
  readonly transaction_id?: string
  readonly items?: ReadonlyArray<EcommerceItem>
}

/** Événement e-commerce GA4 standard (add_to_cart, begin_checkout, purchase…).
 *  Le `ecommerce: null` préalable évite qu'un ancien panier ne « colle » aux
 *  événements suivants, comme le recommande Google. */
export function trackEcommerce(
  event: EcommerceEventName,
  payload: EcommercePayload,
): void {
  if (typeof window === 'undefined') return
  try {
    pushToDataLayer({ ecommerce: null })
    pushToDataLayer({ event, ecommerce: payload })
  } catch {
    // never break a user flow
  }
}
