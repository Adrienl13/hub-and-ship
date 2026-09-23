import { useCallback, useEffect, useMemo, useState } from 'react'
import type { EmailOtpType, User } from '@supabase/supabase-js'

import {
  classifyAuthError,
  describeAuthError,
  type AuthErrorLike,
} from '@/lib/auth/password'
import { DEFAULT_RETURN_TO } from '@/lib/auth/return-to'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'

export type AuthStatus =
  'loading' | 'anonymous' | 'authenticated' | 'unconfigured'

export interface AuthActionResult {
  readonly ok: boolean
  readonly message: string
}

export type MagicLinkResult = AuthActionResult

/**
 * Pourquoi une action a échoué, quand la page doit réagir autrement qu'en
 * affichant le message : proposer de renvoyer l'email d'activation, renvoyer
 * vers la connexion quand l'adresse a déjà un espace, etc.
 */
export type AuthErrorReason =
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'already_registered'
  | 'weak_password'
  | 'rate_limited'
  | 'unconfigured'
  | 'unknown'

export interface PasswordSignInResult extends AuthActionResult {
  readonly reason?: AuthErrorReason
  /** L'utilisateur connecté, pour lire sa fiche et choisir la destination. */
  readonly user: User | null
}

/**
 * - `session` : la session est ouverte (confirmation d'adresse désactivée).
 * - `confirm` : un email d'activation vient de partir.
 * - `already_registered` : l'adresse a déjà un espace. Le serveur répond de
 *   façon neutre (utilisateur sans identité) pour ne rien révéler ; la page
 *   affiche le même écran, avec un texte qui couvre les deux cas.
 */
export type SignUpOutcome = 'session' | 'confirm' | 'already_registered'

export interface SignUpResult extends AuthActionResult {
  readonly reason?: AuthErrorReason
  readonly outcome?: SignUpOutcome
  /** Identifiant du nouvel utilisateur, quand le service le renvoie. */
  readonly userId?: string
}

export interface SignUpInput {
  readonly email: string
  readonly password: string
  readonly metadata: Record<string, string | boolean>
  readonly returnTo?: string
}

const UNCONFIGURED_MESSAGE =
  'La connexion est momentanément indisponible. Merci de réessayer dans quelques minutes.'

/**
 * Raison d'un échec, pour que la page réagisse (renvoyer l'email
 * d'activation, proposer la connexion…). Dérivée de la même classification
 * que le message affiché (src/lib/auth/password.ts) : les deux ne peuvent
 * pas diverger.
 */
export function authErrorReason(error: AuthErrorLike | null): AuthErrorReason {
  switch (classifyAuthError(error)) {
    case 'invalid_credentials':
      return 'invalid_credentials'
    case 'email_not_confirmed':
      return 'email_not_confirmed'
    case 'user_already_exists':
      return 'already_registered'
    case 'password_too_short':
    case 'weak_password':
      return 'weak_password'
    case 'rate_limited':
    case 'email_rate_limited':
      return 'rate_limited'
    default:
      return 'unknown'
  }
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

  /**
   * Adresse de retour des emails (lien de connexion, activation, nouveau mot
   * de passe). L'origine réelle du navigateur prime sur VITE_APP_URL : un
   * bundle construit sans cette variable renvoyait les liens vers localhost.
   * `returnTo` est TOUJOURS présent, même à sa valeur par défaut : le modèle
   * d'e-mail « Magic Link » concatène `{{ .RedirectTo }}` avec `&token_hash=…`
   * (voir docs/RUNBOOK_MAGIC_LINK.md), ce qui exige une chaîne de requête déjà
   * ouverte. Le hook « Send Email » lit ce même paramètre pour construire le
   * lien de l'email de marque.
   */
  const callbackRedirect = useCallback(
    (returnTo: string | undefined): string => {
      const origin =
        typeof window !== 'undefined' && window.location?.origin
          ? window.location.origin
          : config.appUrl
      const base = `${origin.replace(/\/$/, '')}/auth/callback`
      return `${base}?returnTo=${encodeURIComponent(
        returnTo ?? DEFAULT_RETURN_TO,
      )}`
    },
    [config.appUrl],
  )

  const signInWithMagicLink = useCallback(
    async (
      email: string,
      options: { readonly returnTo?: string } = {},
    ): Promise<MagicLinkResult> => {
      if (!client) {
        return { ok: false, message: UNCONFIGURED_MESSAGE }
      }

      const { error } = await client.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: callbackRedirect(options.returnTo),
        },
      })

      if (error) {
        return { ok: false, message: describeAuthError(error) }
      }

      return {
        ok: true,
        message: 'Lien de connexion envoyé. Vérifiez votre boîte email.',
      }
    },
    [client, callbackRedirect],
  )

  /**
   * Connexion classique. La page choisit ensuite la destination (création
   * de l'espace si la fiche est incomplète), d'où l'utilisateur renvoyé.
   */
  const signInWithPassword = useCallback(
    async (email: string, password: string): Promise<PasswordSignInResult> => {
      if (!client) {
        return {
          ok: false,
          reason: 'unconfigured',
          message: UNCONFIGURED_MESSAGE,
          user: null,
        }
      }
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password,
      })
      if (error) {
        return {
          ok: false,
          reason: authErrorReason(error),
          message: describeAuthError(error),
          user: null,
        }
      }
      return { ok: true, message: 'Session ouverte.', user: data.user }
    },
    [client],
  )

  /**
   * Création de l'espace avec mot de passe. Les métadonnées (prénom, nom,
   * établissement, téléphone) partent avec l'inscription : le déclencheur
   * côté base crée la fiche à partir d'elles, et l'email d'activation ramène
   * le client sur `/auth/callback` puis vers `returnTo`.
   */
  const signUpWithPassword = useCallback(
    async (input: SignUpInput): Promise<SignUpResult> => {
      if (!client) {
        return {
          ok: false,
          reason: 'unconfigured',
          message: UNCONFIGURED_MESSAGE,
        }
      }
      const { data, error } = await client.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: input.metadata,
          emailRedirectTo: callbackRedirect(input.returnTo),
        },
      })
      if (error) {
        return {
          ok: false,
          reason: authErrorReason(error),
          message: describeAuthError(error),
        }
      }
      if (data.session) {
        return {
          ok: true,
          outcome: 'session',
          message: 'Espace créé.',
          userId: data.user?.id,
        }
      }
      // Adresse déjà connue : la réponse est un utilisateur sans identité.
      const identities = data.user?.identities
      if (Array.isArray(identities) && identities.length === 0) {
        return {
          ok: true,
          outcome: 'already_registered',
          message: 'Cette adresse a peut-être déjà un espace.',
        }
      }
      return {
        ok: true,
        outcome: 'confirm',
        message: "Email d'activation envoyé.",
      }
    },
    [client, callbackRedirect],
  )

  /** Renvoie l'email d'activation d'un espace créé mais jamais activé. */
  const resendSignupEmail = useCallback(
    async (email: string, returnTo?: string): Promise<AuthActionResult> => {
      if (!client) {
        return { ok: false, message: UNCONFIGURED_MESSAGE }
      }
      const { error } = await client.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: callbackRedirect(returnTo) },
      })
      if (error) return { ok: false, message: describeAuthError(error) }
      return { ok: true, message: "Email d'activation renvoyé." }
    },
    [client, callbackRedirect],
  )

  /**
   * Email « nouveau mot de passe ». Le lien ouvre une session puis mène à la
   * page de choix du mot de passe. Réponse neutre : le serveur ne dit pas si
   * l'adresse est connue, la page non plus.
   */
  const requestPasswordReset = useCallback(
    async (email: string): Promise<AuthActionResult> => {
      if (!client) {
        return { ok: false, message: UNCONFIGURED_MESSAGE }
      }
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: callbackRedirect('/account/mot-de-passe'),
      })
      if (error) return { ok: false, message: describeAuthError(error) }
      return { ok: true, message: 'Email envoyé.' }
    },
    [client, callbackRedirect],
  )

  /** Nouveau mot de passe pour la session ouverte (choix ou changement). */
  const updatePassword = useCallback(
    async (password: string): Promise<AuthActionResult> => {
      if (!client) {
        return { ok: false, message: UNCONFIGURED_MESSAGE }
      }
      const { error } = await client.auth.updateUser({ password })
      if (error) return { ok: false, message: describeAuthError(error) }
      return { ok: true, message: 'Mot de passe enregistré.' }
    },
    [client],
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
        return { ok: false, message: UNCONFIGURED_MESSAGE }
      }
      const { error } = await client.auth.verifyOtp({
        token_hash: tokenHash,
        type,
      })
      if (error) return { ok: false, message: describeAuthError(error) }
      return { ok: true, message: 'Session ouverte.' }
    },
    [client],
  )

  /**
   * Complète les métadonnées utilisateur (`user.user_metadata`) : c'est là
   * que vit le nom de l'établissement, que la fiche `users_profile` ne peut
   * pas porter pour un acheteur. Supabase fusionne les clés fournies avec les
   * métadonnées existantes et réémet la session : `user` se met à jour seul.
   */
  const updateUserMetadata = useCallback(
    async (data: Record<string, string>): Promise<AuthActionResult> => {
      if (!client) {
        return { ok: false, message: UNCONFIGURED_MESSAGE }
      }
      const { error } = await client.auth.updateUser({ data })
      if (error) return { ok: false, message: describeAuthError(error) }
      return { ok: true, message: 'Informations enregistrées.' }
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
    signInWithPassword,
    signUpWithPassword,
    resendSignupEmail,
    requestPasswordReset,
    updatePassword,
    verifyMagicLinkToken,
    updateUserMetadata,
    signOut,
  }
}
