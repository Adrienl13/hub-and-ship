// Lightweight, privacy-friendly analytics wrapper (Plausible).
//
// Activation is env-gated: set VITE_PLAUSIBLE_DOMAIN (and optionally
// VITE_PLAUSIBLE_SRC) to load the script in __root. Until then every track()
// call is a safe no-op, so instrumentation can be wired now and switched on
// later without code changes. No cookies, no PII — RGPD-friendly.

type AnalyticsProps = Record<string, string | number | boolean>

declare global {
  interface Window {
    plausible?: ((
      event: string,
      options?: { props?: AnalyticsProps },
    ) => void) & { q?: unknown[] }
  }
}

/** Canonical funnel event names — keep them stable (used as Plausible goals). */
export const AnalyticsEvent = {
  ReserveOpen: 'reserve_open',
  AddToCart: 'add_to_cart',
  ReservationSubmit: 'reservation_submit',
  CheckoutRedirect: 'checkout_redirect',
  PartnerRequest: 'partner_request_submit',
  StockRequest: 'stock_request_submit',
  ReviewSubmit: 'review_submit',
  ShareSelection: 'share_selection',
  QuotePdf: 'quote_pdf',
  NotifySignup: 'notify_signup',
} as const

export type AnalyticsEventName =
  (typeof AnalyticsEvent)[keyof typeof AnalyticsEvent]

export function track(event: AnalyticsEventName, props?: AnalyticsProps): void {
  if (typeof window === 'undefined') return
  try {
    window.plausible?.(event, props ? { props } : undefined)
  } catch {
    // analytics must never break a user flow
  }
}
