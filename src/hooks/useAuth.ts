import { useCallback, useEffect, useMemo, useState } from 'react'
import type { EmailOtpType, User } from '@supabase/supabase-js'

import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'

export type AuthStatus =
  'loading' | 'anonymous' | 'authenticated' | 'unconfigured'

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

      // L'origine réelle du navigateur prime sur VITE_APP_URL : un bundle
      // construit sans cette variable renvoyait les liens vers localhost.
      const origin =
        typeof window !== 'undefined' && window.location?.origin
          ? window.location.origin
          : config.appUrl
      const base = `${origin.replace(/\/$/, '')}/auth/callback`
      // `returnTo` est TOUJOURS présent, même à sa valeur par défaut : le
      // modèle d'e-mail « Magic Link » concatène `{{ .RedirectTo }}` avec
      // `&token_hash=…` (voir docs/RUNBOOK_MAGIC_LINK.md), ce qui exige une
      // chaîne de requête déjà ouverte.
      const redirectTo = `${base}?returnTo=${encodeURIComponent(
        options.returnTo ?? '/account/reservations',
      )}`
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

  /**
   * Vérifie un lien `{{ .TokenHash }}`. Contrairement à l'échange PKCE, cette
   * vérification ne dépend pas du navigateur qui a demandé le lien : c'est ce
   * qui rend la connexion possible quand on demande le lien sur l'ordinateur
   * et qu'on l'ouvre sur le téléphone.
   */
  const verifyMagicLinkToken = useCallback(
    async (tokenHash: string, type: EmailOtpType): Promise<MagicLinkResult> => {
      if (!client) {
        return { ok: false, message: "Supabase Auth n'est pas configuré." }
      }
      const { error } = await client.auth.verifyOtp({
        token_hash: tokenHash,
        type,
      })
      if (error) return { ok: false, message: error.message }
      return { ok: true, message: 'Session ouverte.' }
    },
    [client],
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
    verifyMagicLinkToken,
    signOut,
  }
}
