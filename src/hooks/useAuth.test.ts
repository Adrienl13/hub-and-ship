import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { getSupabasePublicConfig } from '@/lib/supabase/env'
import { useAuth } from './useAuth'

describe('Supabase auth helpers', () => {
  it('detects missing public Supabase config', () => {
    expect(getSupabasePublicConfig({}).isConfigured).toBe(false)
    expect(getSupabasePublicConfig({}).missing).toEqual([
      'VITE_SUPABASE_URL',
      'VITE_SUPABASE_ANON_KEY',
    ])
  })

  it('accepts complete public Supabase config', () => {
    expect(
      getSupabasePublicConfig({
        VITE_SUPABASE_URL: 'https://project.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'anon-key',
        VITE_APP_URL: 'http://localhost:5173',
      }),
    ).toMatchObject({
      isConfigured: true,
      missing: [],
      appUrl: 'http://localhost:5173',
    })
  })

  it('starts in unconfigured mode locally until env keys are present', () => {
    const { result } = renderHook(() => useAuth())

    expect(result.current.status).toBe('unconfigured')
    expect(result.current.user).toBeNull()
    expect(result.current.isConfigured).toBe(false)
  })
})
