import { describe, expect, it, vi } from 'vitest'

import {
  buildSecurityEventPayload,
  logSecurityEvent,
  type SecurityEventClient,
} from './events'

describe('security event logging', () => {
  it('builds a Supabase insert payload with safe defaults', () => {
    expect(
      buildSecurityEventPayload({
        eventType: 'magic_link_sent',
        metadata: { email: 'direction@hotel.fr' },
      }),
    ).toMatchObject({
      event_type: 'magic_link_sent',
      severity: 'info',
      user_id: null,
      company_id: null,
      ip_address: null,
      request_id: null,
      metadata: { email: 'direction@hotel.fr' },
    })
  })

  it('skips logging when Supabase is not configured', async () => {
    await expect(
      logSecurityEvent(null, { eventType: 'magic_link_rate_limited' }),
    ).resolves.toEqual({
      ok: false,
      skipped: true,
      error: 'Supabase non configuré',
    })
  })

  it('inserts security events through the provided client', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    const from = vi.fn().mockReturnValue({ insert })
    const client = { from } as unknown as SecurityEventClient

    await expect(
      logSecurityEvent(client, {
        eventType: 'magic_link_rate_limited',
        severity: 'warning',
        metadata: { retryAfterMs: 60_000 },
      }),
    ).resolves.toEqual({ ok: true, skipped: false })

    expect(from).toHaveBeenCalledWith('security_events')
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'magic_link_rate_limited',
        severity: 'warning',
        metadata: { retryAfterMs: 60_000 },
      }),
    )
  })

  it('returns Supabase insert errors without throwing', async () => {
    const insert = vi.fn().mockResolvedValue({
      error: { message: 'RLS denied insert' },
    })
    const client = {
      from: vi.fn().mockReturnValue({ insert }),
    } as unknown as SecurityEventClient

    await expect(
      logSecurityEvent(client, { eventType: 'magic_link_sent' }),
    ).resolves.toEqual({
      ok: false,
      skipped: false,
      error: 'RLS denied insert',
    })
  })
})
