export interface RateLimitRule {
  readonly limit: number
  readonly windowMs: number
}

export interface RateLimitInput extends RateLimitRule {
  readonly key: string
  readonly now?: number
  readonly store?: RateLimitStore
}

export interface RateLimitStatus {
  readonly allowed: boolean
  readonly key: string
  readonly limit: number
  readonly remaining: number
  readonly resetAt: number
  readonly retryAfterMs: number
}

export type RateLimitStore = Map<string, ReadonlyArray<number>>

export const MAGIC_LINK_RATE_LIMIT: RateLimitRule = {
  limit: 3,
  windowMs: 15 * 60 * 1000,
}

const defaultStore: RateLimitStore = new Map()

export function createRateLimitStore(): RateLimitStore {
  return new Map()
}

export function consumeRateLimit({
  key,
  limit,
  windowMs,
  now = Date.now(),
  store = defaultStore,
}: RateLimitInput): RateLimitStatus {
  const normalizedKey = normalizeRateLimitKey(key)
  const activeHits = getActiveHits(store, normalizedKey, now, windowMs)
  const oldestHit = activeHits[0] ?? now
  const blockedResetAt = oldestHit + windowMs

  if (activeHits.length >= limit) {
    return {
      allowed: false,
      key: normalizedKey,
      limit,
      remaining: 0,
      resetAt: blockedResetAt,
      retryAfterMs: Math.max(0, blockedResetAt - now),
    }
  }

  const nextHits = [...activeHits, now]
  const resetAt = (nextHits[0] ?? now) + windowMs
  store.set(normalizedKey, nextHits)

  return {
    allowed: true,
    key: normalizedKey,
    limit,
    remaining: Math.max(0, limit - nextHits.length),
    resetAt,
    retryAfterMs: 0,
  }
}

export function formatRetryAfter(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / 60_000))

  return minutes === 1 ? '1 minute' : `${minutes} minutes`
}

function normalizeRateLimitKey(key: string): string {
  return key.trim().toLowerCase()
}

function getActiveHits(
  store: RateLimitStore,
  key: string,
  now: number,
  windowMs: number,
): ReadonlyArray<number> {
  const windowStart = now - windowMs
  const activeHits = (store.get(key) ?? []).filter((hit) => hit > windowStart)

  if (activeHits.length === 0) {
    store.delete(key)
  } else {
    store.set(key, activeHits)
  }

  return activeHits
}
