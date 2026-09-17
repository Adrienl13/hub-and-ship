// Contrôle du slug d'une page co-brandée `/p/<slug>`.
//
// La page affirme « <Marque> vous ouvre son accès Terrassea » et mémorise ce
// contexte 120 jours : elle ne doit s'ouvrir que pour un partenaire réel.
// Mais une 404 sur une panne de base fermerait TOUTES les pages partenaires
// d'un coup, y compris celles qui sont légitimes et déjà partagées. D'où trois
// réponses distinctes, et une seule qui ferme la porte.

import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'
import { normalizePartnerSlug } from '@/lib/partners/link'

export type PartnerSlugVerdict =
  /** Partenaire qualifié ou approuvé : la page s'affiche. */
  | 'active'
  /** Réponse ferme de la base : ce partenaire n'existe pas → 404. */
  | 'unknown'
  /** Base injoignable ou non configurée : on n'invente pas une 404. */
  | 'unavailable'

type BooleanRpc = {
  rpc: (
    name: string,
    params: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>
}

async function callBooleanRpc(
  name: string,
  params: Record<string, unknown>,
): Promise<boolean | null> {
  const config = getSupabasePublicConfig()
  if (!config.isConfigured) return null
  try {
    const client = createSupabaseBrowserClient(config) as unknown as BooleanRpc
    const { data, error } = await client.rpc(name, params)
    if (error) {
      console.error(`${name} failed`, error)
      return null
    }
    return data === true
  } catch (error) {
    console.error(`${name} threw`, error)
    return null
  }
}

export async function checkPartnerSlug(
  rawSlug: string,
): Promise<PartnerSlugVerdict> {
  // Un slug malformé est rejeté sans aller jusqu'à la base : la normalisation
  // est la même que la contrainte SQL.
  const slug = normalizePartnerSlug(rawSlug)
  if (!slug) return 'unknown'

  const active = await callBooleanRpc('partner_slug_is_active', {
    p_slug: slug,
  })
  if (active === null) return 'unavailable'
  return active ? 'active' : 'unknown'
}

/**
 * La sélection publiée appartient-elle bien à ce partenaire ? Sans ce
 * contrôle, `/p/<slug arbitraire>?selection=<uuid>` ré-affichait le devis
 * co-brandé d'un vrai partenaire sous un autre nom. En cas d'indisponibilité
 * on ne montre PAS la sélection : contrairement à la page elle-même, elle
 * n'est jamais attendue par un visiteur qui n'a pas le lien complet.
 */
export async function selectionBelongsToPartner(
  selectionId: string,
  rawSlug: string,
): Promise<boolean> {
  const slug = normalizePartnerSlug(rawSlug)
  if (!slug) return false
  const belongs = await callBooleanRpc('published_selection_belongs_to_slug', {
    p_selection: selectionId,
    p_slug: slug,
  })
  return belongs === true
}
