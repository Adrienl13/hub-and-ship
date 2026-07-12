// Garde d'authentification des server-functions ADMIN. Toute fonction qui
// écrit ou déclenche des effets avec le client service-role doit vérifier
// elle-même l'appelant : l'AdminGuard côté client ne protège que l'affichage,
// jamais l'endpoint HTTP. Session lue depuis les cookies Supabase, rôle
// vérifié via is_admin() avec le JWT de l'appelant (source de vérité RLS).

import { getRequest } from '@tanstack/react-start/server'

import { parseCookieHeader } from '@/lib/auth/cookies'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function callerIsAdmin(): Promise<boolean> {
  try {
    const request = getRequest()
    const cookieEntries = parseCookieHeader(request.headers.get('cookie'))
    const sessionClient = createSupabaseServerClient({
      cookies: { getAll: () => cookieEntries },
    })
    const { data: userData } = await sessionClient.auth.getUser()
    if (!userData.user) return false
    const { data: isAdmin, error } = await sessionClient.rpc('is_admin')
    return !error && isAdmin === true
  } catch (error) {
    console.warn('callerIsAdmin: auth check failed', error)
    return false
  }
}
