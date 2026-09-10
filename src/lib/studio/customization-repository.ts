import { z } from 'zod'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'
import type { TableRulesClient } from './table-repository'
import {
  capabilitySchema,
  EMPTY_CAPABILITIES,
  type CapabilityData,
} from './customization'
export const CAPABILITY_PUBLIC_COLUMNS = [
  'id',
  'product_id',
  'scope',
  'kind',
  'status',
  'values',
  'allows_free_text',
  'requires_review',
  'min_quantity',
  'max_quantity',
] as const
export async function fetchCustomizationCapabilities(
  client: TableRulesClient,
): Promise<CapabilityData> {
  try {
    const rows: unknown[] = []
    for (let offset = 0; ; offset += 500) {
      const result = await client
        .from('studio_customization_capabilities_public')
        .select(CAPABILITY_PUBLIC_COLUMNS.join(','))
        .order('id')
        .range(offset, offset + 499)
      if (result.error || !result.data) return EMPTY_CAPABILITIES
      rows.push(...result.data)
      if (result.data.length < 500) break
    }
    return {
      available: true,
      capabilities: z.array(capabilitySchema).parse(rows),
    }
  } catch {
    return EMPTY_CAPABILITIES
  }
}
export async function loadCustomizationCapabilities(): Promise<CapabilityData> {
  const config = getSupabasePublicConfig()
  return config.isConfigured
    ? fetchCustomizationCapabilities(
        createSupabaseBrowserClient(config) as unknown as TableRulesClient,
      )
    : EMPTY_CAPABILITIES
}
