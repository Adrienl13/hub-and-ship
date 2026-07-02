/**
 * First-touch UTM / partner attribution.
 *
 * On the very first page load we capture `utm_source`, `utm_medium`,
 * `utm_campaign` and `ref` from the querystring and persist them to
 * `localStorage` for 90 days. First-touch wins: once an attribution is stored
 * (and not expired) it is never overwritten by a later visit. The stored value
 * is later written to the DB row when the visitor creates a reservation, a
 * stock request or a partner application.
 */

export const ATTRIBUTION_STORAGE_KEY = 'cc_attribution'

/** TTL of a stored attribution, in milliseconds (90 days). */
export const ATTRIBUTION_TTL_MS = 90 * 24 * 60 * 60 * 1000

/** Attribution fields as they map to DB columns (all nullable). */
export interface AttributionFields {
  readonly utm_source: string | null
  readonly utm_medium: string | null
  readonly utm_campaign: string | null
  readonly partner_ref: string | null
}

/** Stored envelope: the fields plus the capture timestamp (for TTL). */
export interface StoredAttribution extends AttributionFields {
  readonly captured_at: number
}

export const EMPTY_ATTRIBUTION: AttributionFields = {
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  partner_ref: null,
}

function normalizeValue(value: string | null): string | null {
  if (value === null) return null
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  // Guard against absurdly long injected values.
  return trimmed.slice(0, 255)
}

/**
 * Parse attribution fields from a querystring (with or without leading `?`).
 * Returns `null` when none of the tracked params are present, so callers can
 * distinguish "no attribution in this URL" from "empty attribution".
 */
export function parseAttributionFromSearch(
  search: string,
): AttributionFields | null {
  const params = new URLSearchParams(
    search.startsWith('?') ? search.slice(1) : search,
  )

  const fields: AttributionFields = {
    utm_source: normalizeValue(params.get('utm_source')),
    utm_medium: normalizeValue(params.get('utm_medium')),
    utm_campaign: normalizeValue(params.get('utm_campaign')),
    partner_ref: normalizeValue(params.get('ref')),
  }

  const hasAny =
    fields.utm_source !== null ||
    fields.utm_medium !== null ||
    fields.utm_campaign !== null ||
    fields.partner_ref !== null

  return hasAny ? fields : null
}

/** A stored attribution is expired when older than the TTL. */
export function isAttributionExpired(
  stored: StoredAttribution,
  now: number,
): boolean {
  return now - stored.captured_at >= ATTRIBUTION_TTL_MS
}

/**
 * Decide what should be stored given the currently stored value and the
 * attribution parsed from the current URL. Pure and side-effect free so it is
 * fully unit-testable.
 *
 * Rules (first-touch wins):
 * - A valid, non-expired stored attribution is kept as-is.
 * - Otherwise, if the current URL carries attribution, it becomes the new
 *   first-touch (stamped at `now`).
 * - Otherwise nothing should be stored (`null`).
 */
export function resolveFirstTouch(
  stored: StoredAttribution | null,
  incoming: AttributionFields | null,
  now: number,
): StoredAttribution | null {
  if (stored !== null && !isAttributionExpired(stored, now)) {
    return stored
  }
  if (incoming === null) {
    return null
  }
  return { ...incoming, captured_at: now }
}

function isSafeStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

/** Parse and validate a raw localStorage string into a StoredAttribution. */
export function parseStoredAttribution(
  raw: string | null,
): StoredAttribution | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed !== 'object' || parsed === null) return null
    const record = parsed as Record<string, unknown>
    if (typeof record.captured_at !== 'number') return null
    if (
      !isSafeStringOrNull(record.utm_source) ||
      !isSafeStringOrNull(record.utm_medium) ||
      !isSafeStringOrNull(record.utm_campaign) ||
      !isSafeStringOrNull(record.partner_ref)
    ) {
      return null
    }
    return {
      utm_source: record.utm_source,
      utm_medium: record.utm_medium,
      utm_campaign: record.utm_campaign,
      partner_ref: record.partner_ref,
      captured_at: record.captured_at,
    }
  } catch {
    return null
  }
}

/** Strip the storage envelope down to the DB-facing fields. */
export function toAttributionFields(
  stored: StoredAttribution | null,
): AttributionFields {
  if (stored === null) return EMPTY_ATTRIBUTION
  return {
    utm_source: stored.utm_source,
    utm_medium: stored.utm_medium,
    utm_campaign: stored.utm_campaign,
    partner_ref: stored.partner_ref,
  }
}

function getLocalStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    return window.localStorage
  } catch {
    // Access to localStorage can throw (private mode, blocked cookies).
    return null
  }
}

/** Read the stored attribution, ignoring expired/corrupt records. */
export function readStoredAttribution(now: number): StoredAttribution | null {
  const storage = getLocalStorage()
  if (!storage) return null
  const stored = parseStoredAttribution(storage.getItem(ATTRIBUTION_STORAGE_KEY))
  if (stored === null) return null
  if (isAttributionExpired(stored, now)) return null
  return stored
}

/**
 * Capture first-touch attribution from the current URL on load. Idempotent and
 * safe to call on every navigation — it only writes when there is no valid
 * stored attribution yet and the URL carries tracking params. Returns the
 * effective stored attribution (existing or freshly captured), or `null`.
 */
export function captureFirstTouchAttribution(
  search: string,
  now: number,
): StoredAttribution | null {
  const storage = getLocalStorage()
  const existing = readStoredAttribution(now)
  const incoming = parseAttributionFromSearch(search)
  const resolved = resolveFirstTouch(existing, incoming, now)

  if (
    storage &&
    resolved !== null &&
    (existing === null || resolved.captured_at !== existing.captured_at)
  ) {
    try {
      storage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(resolved))
    } catch {
      // Best-effort persistence; ignore quota/access errors.
    }
  }

  return resolved
}

/** Convenience: the current attribution fields to attach to a DB insert. */
export function getAttributionFields(now: number): AttributionFields {
  return toAttributionFields(readStoredAttribution(now))
}
