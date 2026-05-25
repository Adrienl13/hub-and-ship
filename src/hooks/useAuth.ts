import { useCallback, useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'

import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'

export type AuthStatus =
  | 'loading'
  | 'anonymous'
  | 'authenticated'
  | 'unconfigured'

export interface MagicLinkResult {
  readonly ok: boolean
  readonly message: string
}

export function useAuth() {
  const config = useMemo(() => getSupabasePublicConfig(), [])
  const [status, setStatus] = useState<AuthStatus>(
    config.isConfigured ? 'loading' : 'unconfigured',
  )
  const [user, setUser] = useState<User | null>(null)

  const client = useMemo(() => {
    if (!config.isConfigured) return null
    return createSupabaseBrowserClient(config)
  }, [config])

  useEffect(() => {
    if (!client) return undefined

    let mounted = true

    const init = async () => {
      // Implicit-flow magic links (e.g. links minted via the Supabase admin
      // API) deliver the session as URL hash tokens. The PKCE browser client
      // only auto-detects `?code=`, so adopt the hash session explicitly.
      if (
        typeof window !== 'undefined' &&
        window.location.hash.includes('access_token')
      ) {
        const params = new URLSearchParams(window.location.hash.slice(1))
        const access_token = params.get('access_token')
        const refresh_token = params.get('refresh_token')
        if (access_token && refresh_token) {
          await client.auth.setSession({ access_token, refresh_token })
          window.history.replaceState(
            null,
            '',
            window.location.pathname + window.location.search,
          )
        }
      }

      const { data } = await client.auth.getUser()
      if (!mounted) return
      setUser(data.user)
      setStatus(data.user ? 'authenticated' : 'anonymous')
    }

    void init()

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setStatus(session?.user ? 'authenticated' : 'anonymous')
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [client])

  const signInWithMagicLink = useCallback(
    async (
      email: string,
      options: { readonly returnTo?: string } = {},
    ): Promise<MagicLinkResult> => {
      if (!client) {
        return {
          ok: false,
          message:
            "Supabase Auth n'est pas encore configuré. Renseignez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.",
        }
      }

      const base = `${config.appUrl.replace(/\/$/, '')}/auth/callback`
      const redirectTo = options.returnTo
        ? `${base}?returnTo=${encodeURIComponent(options.returnTo)}`
        : base
      const { error } = await client.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo,
        },
      })

      if (error) {
        return { ok: false, message: error.message }
      }

      return {
        ok: true,
        message: 'Lien magique envoyé. Vérifiez votre boite email.',
      }
    },
    [client, config.appUrl],
  )

  const signOut = useCallback(async (): Promise<void> => {
    if (!client) return
    await client.auth.signOut()
  }, [client])

  return {
    status,
    user,
    isConfigured: config.isConfigured,
    missingConfig: config.missing,
    signInWithMagicLink,
    signOut,
  }
}
