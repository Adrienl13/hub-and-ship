import { describe, expect, it } from 'vitest'

import {
  consumeRateLimit,
  createRateLimitStore,
  formatRetryAfter,
  MAGIC_LINK_RATE_LIMIT,
} from '@/lib/security/rate-limit'

describe('magic link rate limiting', () => {
  it('allows three magic-link requests per email in 15 minutes', () => {
    const store = createRateLimitStore()
    const baseInput = {
      key: 'AUTH:MAGIC-LINK:direction@hotel.fr',
      now: 1_000,
      store,
      ...MAGIC_LINK_RATE_LIMIT,
    }

    expect(consumeRateLimit(baseInput)).toMatchObject({
      allowed: true,
      remaining: 2,
    })
    expect(consumeRateLimit({ ...baseInput, now: 2_000 })).toMatchObject({
      allowed: true,
      remaining: 1,
    })
    expect(consumeRateLimit({ ...baseInput, now: 3_000 })).toMatchObject({
      allowed: true,
      remaining: 0,
    })
  })

  it('blocks the fourth request until the window resets', () => {
    const store = createRateLimitStore()
    const input = {
      key: 'auth:magic-link:direction@hotel.fr',
      store,
      ...MAGIC_LINK_RATE_LIMIT,
    }

    consumeRateLimit({ ...input, now: 1_000 })
    consumeRateLimit({ ...input, now: 2_000 })
    consumeRateLimit({ ...input, now: 3_000 })

    expect(consumeRateLimit({ ...input, now: 4_000 })).toMatchObject({
      allowed: false,
      remaining: 0,
      retryAfterMs: MAGIC_LINK_RATE_LIMIT.windowMs - 3_000,
    })
  })

  it('normalizes email keys to avoid case-based bypasses', () => {
    const store = createRateLimitStore()
    const input = {
      store,
      now: 1_000,
      ...MAGIC_LINK_RATE_LIMIT,
    }

    consumeRateLimit({ ...input, key: 'auth:magic-link:DIRECTION@HOTEL.FR' })
    consumeRateLimit({ ...input, key: ' auth:magic-link:direction@hotel.fr ' })
    consumeRateLimit({ ...input, key: 'auth:magic-link:direction@hotel.fr' })

    expect(
      consumeRateLimit({
        ...input,
        key: 'auth:magic-link:direction@hotel.fr',
      }),
    ).toMatchObject({ allowed: false })
  })

  it('allows a new request once the window has expired', () => {
    const store = createRateLimitStore()
    const input = {
      key: 'auth:magic-link:direction@hotel.fr',
      store,
      ...MAGIC_LINK_RATE_LIMIT,
    }

    consumeRateLimit({ ...input, now: 1_000 })
    consumeRateLimit({ ...input, now: 2_000 })
    consumeRateLimit({ ...input, now: 3_000 })

    expect(
      consumeRateLimit({
        ...input,
        now: 3_000 + MAGIC_LINK_RATE_LIMIT.windowMs + 1,
      }),
    ).toMatchObject({
      allowed: true,
      remaining: 2,
    })
  })

  it('formats retry delays for UI copy', () => {
    expect(formatRetryAfter(1)).toBe('1 minute')
    expect(formatRetryAfter(60_001)).toBe('2 minutes')
  })
})
