import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'

// Médias administrables de la home (handoff design 07/2026). Chaque slot a
// des valeurs par défaut embarquées : le site reste complet même si l'admin
// n'a encore rien téléversé (ou si la DB est injoignable).

export type SiteMediaSlot =
  | 'hero'
  | 'collections'
  | 'clientele-band'
  | 'prix-hero'
  | 'trajet-1'
  | 'trajet-2'
  | 'trajet-3'
  | 'trajet-4'

export interface SiteMediaItem {
  readonly id: string
  readonly slot: SiteMediaSlot
  readonly url: string
  readonly alt: string
  readonly sortOrder: number
}

export interface SiteMediaSet {
  /** Slides du carrousel hero, ordonnées. Toujours ≥ 1 élément. */
  readonly hero: ReadonlyArray<SiteMediaItem>
  readonly collections: SiteMediaItem
  readonly clienteleBand: SiteMediaItem
  /** Fond du hero « Le prix prouvé » (voile brun par-dessus). */
  readonly prixHero: SiteMediaItem
  /**
   * Frise « le trajet du container » — index 0..3. `null` = pas encore de
   * vraie photo : le site affiche un slot « à venir » honnête, JAMAIS un
   * visuel de substitution (cohérence audit C8).
   */
  readonly trajet: ReadonlyArray<SiteMediaItem | null>
}

function fallback(
  slot: SiteMediaSlot,
  url: string,
  alt: string,
  sortOrder = 0,
): SiteMediaItem {
  return { id: `default-${slot}-${sortOrder}`, slot, url, alt, sortOrder }
}

export const DEFAULT_SITE_MEDIA: SiteMediaSet = {
  hero: [
    fallback(
      'hero',
      '/images/home/hero-salon-vue-mer.webp',
      'Salon outdoor en corde tressée face à la mer',
      0,
    ),
    fallback(
      'hero',
      '/images/home/fauteuils-tresses-dessus.webp',
      'Fauteuils tressés outdoor, coloris variés',
      1,
    ),
    fallback(
      'hero',
      '/images/home/collage-terrasses.webp',
      'Terrasses de restaurants équipées',
      2,
    ),
  ],
  collections: fallback(
    'collections',
    '/images/home/fauteuils-tresses-dessus.webp',
    'Assises tressées — coloris au choix',
  ),
  clienteleBand: fallback(
    'clientele-band',
    '/images/home/collage-terrasses.webp',
    'Terrasses de restaurants, bars et hôtels équipés',
  ),
  prixHero: fallback(
    'prix-hero',
    '/images/home/collage-terrasses.webp',
    'Terrasses de professionnels équipées par Container Club',
  ),
  trajet: [null, null, null, null],
}

interface SiteMediaRow {
  readonly id: string
  readonly slot: string
  readonly url: string
  readonly alt: string
  readonly sort_order: number
}

function itemFromRow(row: SiteMediaRow): SiteMediaItem {
  return {
    id: row.id,
    slot: row.slot as SiteMediaSlot,
    url: row.url,
    alt: row.alt,
    sortOrder: row.sort_order,
  }
}

/** Charge les médias définis par l'admin, complétés par les défauts. */
export async function loadSiteMedia(): Promise<SiteMediaSet> {
  const config = getSupabasePublicConfig()
  if (!config.isConfigured) return DEFAULT_SITE_MEDIA

  try {
    const client = createSupabaseBrowserClient(config) as unknown as {
      from: (table: 'site_media') => {
        select: (columns: '*') => {
          order: (
            column: 'sort_order',
            options: { ascending: boolean },
          ) => PromiseLike<{
            data: SiteMediaRow[] | null
            error: { message: string } | null
          }>
        }
      }
    }
    const { data, error } = await client
      .from('site_media')
      .select('*')
      .order('sort_order', { ascending: true })
    if (error || !data) return DEFAULT_SITE_MEDIA

    const hero = data.filter((r) => r.slot === 'hero').map(itemFromRow)
    const collections = data.find((r) => r.slot === 'collections')
    const band = data.find((r) => r.slot === 'clientele-band')
    const prixHero = data.find((r) => r.slot === 'prix-hero')
    const trajet = ([1, 2, 3, 4] as const).map((n) => {
      const row = data.find((r) => r.slot === `trajet-${n}`)
      return row ? itemFromRow(row) : null
    })

    return {
      hero: hero.length > 0 ? hero : DEFAULT_SITE_MEDIA.hero,
      collections: collections
        ? itemFromRow(collections)
        : DEFAULT_SITE_MEDIA.collections,
      clienteleBand: band
        ? itemFromRow(band)
        : DEFAULT_SITE_MEDIA.clienteleBand,
      prixHero: prixHero ? itemFromRow(prixHero) : DEFAULT_SITE_MEDIA.prixHero,
      trajet,
    }
  } catch {
    return DEFAULT_SITE_MEDIA
  }
}
