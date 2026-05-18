import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useSiretVerification } from './useSiretVerification'

describe('useSiretVerification', () => {
  it('keeps local checkout non-blocking until Supabase env keys are present', async () => {
    const { result } = renderHook(() => useSiretVerification())

    expect(result.current.isConfigured).toBe(false)
    await expect(result.current.verify('55208131701750')).resolves.toMatchObject({
      status: 'verification_unavailable',
      data: { format_ok: true },
    })
  })
})
