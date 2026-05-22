import { useEffect, useMemo, useState } from 'react'

import { useAuth } from '@/hooks/useAuth'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'

export interface UseIsAdminResult {
  readonly isAdmin: boolean
  readonly isLoading: boolean
}

/**
 * Reads the current user's role from `public.users_profile`.
 * Returns `isAdmin = true` when role is `admin` or `super_admin`.
 *
 * Returns `isLoading=false, isAdmin=false` when Supabase is not configured
 * or the visitor is anonymous so AdminGuard can short-circuit quickly.
 */
export function useIsAdmin(): UseIsAdminResult {
  const auth = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(auth.status === 'loading')

  const client = useMemo(() => {
    const config = getSupabasePublicConfig()
    if (!config.isConfigured) return null
    return createSupabaseBrowserClient(config)
  }, [])

  useEffect(() => {
    if (!client) {
      setIsAdmin(false)
      setIsLoading(false)
      return
    }
    if (auth.status === 'loading') {
      setIsLoading(true)
      return
    }
    if (auth.status !== 'authenticated' || !auth.user) {
      setIsAdmin(false)
      setIsLoading(false)
      return
    }

    let cancelled = false
    setIsLoading(true)
    void client
      .from('users_profile')
      .select('role')
      .eq('id', auth.user.id)
      .maybeSingle<{ role: string | null }>()
      .then(({ data }) => {
        if (cancelled) return
        const role = data?.role
        setIsAdmin(role === 'admin' || role === 'super_admin')
        setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [client, auth.status, auth.user])

  return { isAdmin, isLoading }
}
