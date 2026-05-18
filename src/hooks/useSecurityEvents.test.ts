import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useSecurityEvents } from './useSecurityEvents'

describe('useSecurityEvents', () => {
  it('stays no-op locally until Supabase env keys are present', async () => {
    const { result } = renderHook(() => useSecurityEvents())

    expect(result.current.isConfigured).toBe(false)
    await expect(
      result.current.logEvent({ eventType: 'magic_link_rate_limited' }),
    ).resolves.toMatchObject({
      ok: false,
      skipped: true,
    })
  })
})
