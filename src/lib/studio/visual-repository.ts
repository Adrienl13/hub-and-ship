import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'
import {
  ALGORITHM_PUBLIC_COLUMNS,
  EMPTY_VISUAL_DATA,
  neighborSchema,
  VISUAL_MEDIA_COLUMNS,
  VISUAL_NEIGHBOR_COLUMNS,
} from './visual'
import { V1_MODEL_VERSION } from './engine/versions'
import type { StudioCatalog } from './repository'

/** Owner views are minimal, active-only and validated-only. Paginate the compact
 * graph: PostgREST's default 1000-row cap must not silently truncate coverage. */
export async function enrichVisualCatalog(
  catalog: StudioCatalog,
): Promise<StudioCatalog> {
  const config = getSupabasePublicConfig()
  if (!config.isConfigured) return catalog
  const client = createSupabaseBrowserClient(config)
  async function rows(
    table: string,
    columns: readonly string[],
    order: string,
  ) {
    const all: Record<string, unknown>[] = []
    for (let offset = 0; ; offset += 500) {
      let query = client.from(table).select(columns.join(','))
      if (table === 'studio_product_neighbors_public')
        query = query.eq('model_version', V1_MODEL_VERSION)
      for (const column of order.split(','))
        query = query.order(column, { ascending: true })
      const { data, error } = await query.range(offset, offset + 499)
      if (error) return [] // migration absent / unavailable: V0 and original images
      all.push(...(data as unknown as Record<string, unknown>[]))
      if (!data || data.length < 500) return all
    }
  }
  try {
    const [media, edges, versions] = await Promise.all([
      rows(
        'studio_product_media_public',
        VISUAL_MEDIA_COLUMNS,
        'product_id,role',
      ),
      rows(
        'studio_product_neighbors_public',
        VISUAL_NEIGHBOR_COLUMNS,
        'product_id,model_version,rank',
      ),
      rows(
        'studio_algorithm_versions_public',
        ALGORITHM_PUBLIC_COLUMNS,
        'version',
      ),
    ])
    const allowed = new Set(
      catalog.products.filter((p) => p.isActive).map((p) => p.id),
    )
    const images = new Map<string, { decision?: string; thumb?: string }>()
    for (const m of media) {
      if (
        typeof m.product_id !== 'string' ||
        !allowed.has(m.product_id) ||
        (m.role !== 'decision' && m.role !== 'thumb') ||
        typeof m.url !== 'string'
      )
        continue
      let url: URL
      try {
        url = new URL(m.url)
      } catch {
        continue
      }
      if (url.protocol !== 'https:' || url.username || url.password) continue
      images.set(m.product_id, { ...images.get(m.product_id), [m.role]: m.url })
    }
    return {
      ...catalog,
      products: catalog.products.map((p) => ({
        ...p,
        decisionImageUrl: images.get(p.id)?.decision,
        decisionThumbUrl: images.get(p.id)?.thumb,
      })),
      visual: {
        neighbors: edges.flatMap((e) => {
          const parsed = neighborSchema.safeParse(e)
          return parsed.success &&
            allowed.has(parsed.data.product_id) &&
            allowed.has(parsed.data.neighbor_product_id)
            ? [parsed.data]
            : []
        }),
        versions: versions.flatMap((v) =>
          typeof v.version === 'string' &&
          typeof v.engine === 'string' &&
          typeof v.status === 'string'
            ? [
                {
                  version: v.version,
                  engine: v.engine,
                  status: v.status,
                  model_version:
                    typeof v.model_version === 'string'
                      ? v.model_version
                      : null,
                },
              ]
            : [],
        ),
      },
    }
  } catch {
    return { ...catalog, visual: EMPTY_VISUAL_DATA }
  }
}
