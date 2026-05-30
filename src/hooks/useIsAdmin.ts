import { useEffect, useMemo, useState } from 'react'

import { useAuth } from '@/hooks/useAuth'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'

export interface UseIsAdminResult {
  readonly isAdmin: boolean
  readonly isLoading: boolean
}

/**
 * Calls the `public.is_admin()` Postgres helper to decide whether the current
 * user is admin. That helper is the same source of truth used by the RLS
 * policies on containers / products / variants / seed commitments, and it
 * accepts admin status from EITHER `users_profile.role IN ('admin',
 * 'super_admin')` OR `professionals.is_admin = true`. Reading the role
 * column directly here would diverge from RLS for users who are admin only
 * via the `professionals` table (cf. migration
 * 20260525093000_align_is_admin_with_profile_role.sql).
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
    void client.rpc('is_admin').then(({ data, error }) => {
      if (cancelled) return
      if (error) {
        setIsAdmin(false)
      } else {
        setIsAdmin(data === true)
      }
      setIsLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [client, auth.status, auth.user])

  return { isAdmin, isLoading }
}
