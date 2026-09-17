// Chargement d'une fiche container pour le RENDU SERVEUR.
//
// La fiche se résolvait jusqu'ici dans un `useEffect`, et son `head()` lisait
// la liste de démonstration. Conséquences, toutes visibles en production :
// `/livres/<slug inconnu>` répondait **200** avec l'écran d'erreur anglais de
// TanStack Router (« Something went wrong! »), et les containers réellement
// publiés recevaient tous `noindex`, aucun canonical et le même titre
// générique — le contenu de preuve le plus différenciant du site n'était pas
// indexable.
//
// Même remède que la fiche produit (`catalogue_.p.$slug.tsx`) : on résout
// dans un `loader`, on lève `notFound()`, et le `head` se construit depuis
// `loaderData`.

import {
  getDeliveredContainerBySlug,
  getFallbackDeliveredContainerBySlug,
  listPublishedDeliveredContainers,
  type DeliveredContainer,
} from '@/lib/delivered-containers/repository'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'

/**
 * Fiche publiée, ou null. Ne jette jamais : une panne base doit donner une
 * 404 propre, pas une page d'erreur — et surtout pas un 200.
 */
export async function loadPublishedContainer(
  slug: string,
): Promise<DeliveredContainer | null> {
  const config = getSupabasePublicConfig()
  if (!config.isConfigured) {
    return getFallbackDeliveredContainerBySlug(slug) ?? null
  }

  try {
    const client = createSupabaseBrowserClient(config)
    return await getDeliveredContainerBySlug(client, slug)
  } catch (error) {
    console.error('registry: container fetch failed', error)
    return null
  }
}

/** Slugs publiés, pour le sitemap. Liste vide plutôt qu'une erreur. */
export async function listPublishedContainerSlugs(): Promise<
  ReadonlyArray<{ readonly slug: string; readonly deliveredAt: string | null }>
> {
  const config = getSupabasePublicConfig()
  if (!config.isConfigured) return []

  try {
    const client = createSupabaseBrowserClient(config)
    const rows = await listPublishedDeliveredContainers(client)
    return rows.map((row) => ({
      slug: row.slug,
      deliveredAt: row.deliveredAt,
    }))
  } catch (error) {
    console.error('registry: slug list failed', error)
    return []
  }
}
