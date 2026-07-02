/**
 * Thin wrapper around the Plausible `plausible()` queue function injected by
 * the script in `__root.tsx`. All calls are safe no-ops during SSR or when the
 * script has not loaded (ad-blocked, analytics disabled), so callers can fire
 * events unconditionally.
 */

/** Custom events tracked across the funnel. */
export type PlausibleEvent =
  | 'reservation_started'
  | 'reservation_paid'
  | 'partner_application_submitted'
  | 'stock_request_submitted'
  | 'quote_pdf_opened'

type PlausibleFn = (
  event: string,
  options?: { props?: Record<string, string | number | boolean> },
) => void

interface PlausibleWindow extends Window {
  plausible?: PlausibleFn & { q?: unknown[] }
}

/**
 * Fire a Plausible custom event. Extra `props` are optional custom properties.
 * Never throws — analytics must not break the user flow.
 */
export function trackEvent(
  event: PlausibleEvent,
  props?: Record<string, string | number | boolean>,
): void {
  if (typeof window === 'undefined') return
  try {
    const w = window as PlausibleWindow
    if (typeof w.plausible !== 'function') return
    w.plausible(event, props ? { props } : undefined)
  } catch {
    // Swallow — a failed analytics call must never surface to the user.
  }
}
