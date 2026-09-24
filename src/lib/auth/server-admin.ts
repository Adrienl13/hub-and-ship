// Garde d'authentification des server-functions ADMIN. Toute fonction qui
// écrit ou déclenche des effets avec le client service-role doit vérifier
// elle-même l'appelant : l'AdminGuard côté client ne protège que l'affichage,
// jamais l'endpoint HTTP. Session lue depuis les cookies Supabase, rôle
// vérifié via is_admin() avec le JWT de l'appelant (source de vérité RLS).

import { getRequest } from '@tanstack/react-start/server'

import { parseCookieHeader } from '@/lib/auth/cookies'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * Identifiant de l'admin qui appelle, ou `null` si l'appelant n'est pas
 * connecté, n'est pas admin, ou si la vérification échoue. Sert aux écritures
 * qui doivent porter l'auteur (sent_by, journal d'audit).
 */
export async function callerAdminId(): Promise<string | null> {
  try {
    const request = getRequest()
    const cookieEntries = parseCookieHeader(request.headers.get('cookie'))
    const sessionClient = createSupabaseServerClient({
      cookies: { getAll: () => cookieEntries },
    })
    const { data: userData } = await sessionClient.auth.getUser()
    if (!userData.user) return null
    const { data: isAdmin, error } = await sessionClient.rpc('is_admin')
    return !error && isAdmin === true ? userData.user.id : null
  } catch (error) {
    console.warn('callerAdminId: auth check failed', error)
    return null
  }
}

export async function callerIsAdmin(): Promise<boolean> {
  return (await callerAdminId()) !== null
}
