import { z } from 'zod'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'
import type { TableRulesClient } from './table-repository'
import {
  libraryItemSchema,
  visualAssociationSchema,
  VISUAL_LIBRARY_COLUMNS,
  VISUAL_ASSOCIATION_COLUMNS,
  type VisualLibraryItem,
  type VisualAssociation,
} from './visual-library'
export interface VisualLibraryData {
  items: VisualLibraryItem[]
  associations: VisualAssociation[]
  source: 'database' | 'snapshot' | 'unavailable'
}
async function read(
  client: TableRulesClient,
  table: string,
  columns: readonly string[],
) {
  const all: unknown[] = []
  for (let offset = 0; ; offset += 500) {
    const r = await client
      .from(table)
      .select(columns.join(','))
      .order(columns[0]!)
      .range(offset, offset + 499)
    if (r.error || !r.data) throw Error('Unavailable')
    all.push(...r.data)
    if (r.data.length < 500) return all
  }
}
export async function loadVisualLibrary(): Promise<VisualLibraryData> {
  const config = getSupabasePublicConfig()
  if (config.isConfigured) {
    try {
      const client = createSupabaseBrowserClient(
        config,
      ) as unknown as TableRulesClient
      const [items, associations] = await Promise.all([
        read(client, 'studio_visual_library_public', VISUAL_LIBRARY_COLUMNS),
        read(
          client,
          'studio_visual_associations_public',
          VISUAL_ASSOCIATION_COLUMNS,
        ),
      ])
      return {
        items: z
          .array(libraryItemSchema)
          .parse(items)
          .filter((i) => i.active),
        associations: z.array(visualAssociationSchema).parse(associations),
        source: 'database',
      }
    } catch {
      /* Only visual inspiration is available from the reviewed public snapshot. */
    }
  }
  try {
    const response = await fetch('/studio/materials/library.json')
    if (!response.ok) throw Error('Unavailable')
    return {
      items: z
        .array(libraryItemSchema)
        .parse(await response.json())
        .filter((i) => i.active),
      associations: [],
      source: 'snapshot',
    }
  } catch {
    return { items: [], associations: [], source: 'unavailable' }
  }
}
