import { z } from 'zod'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'
import {
  BASE_PROFILE_PUBLIC_COLUMNS,
  EMPTY_COMPATIBILITY,
  TABLE_RULE_PUBLIC_COLUMNS,
  tableRuleSchema,
  type TableCompatibilityData,
} from './compatibility'
interface Query extends PromiseLike<{
  data: unknown[] | null
  error: unknown
}> {
  range(from: number, to: number): Query
  order(column: string): Query
}
export interface TableRulesClient {
  from(table: string): { select(columns: string): Query }
}
async function rows(
  client: TableRulesClient,
  table: string,
  columns: readonly string[],
  order: string,
): Promise<unknown[]> {
  const all: unknown[] = []
  for (let offset = 0; ; offset += 500) {
    const result = await client
      .from(table)
      .select(columns.join(','))
      .order(order)
      .range(offset, offset + 499)
    if (result.error) throw new Error('Compatibility unavailable')
    all.push(...(result.data ?? []))
    if ((result.data?.length ?? 0) < 500) return all
  }
}
export async function fetchTableCompatibility(
  client: TableRulesClient,
): Promise<TableCompatibilityData> {
  try {
    const [rules, profiles] = await Promise.all([
      rows(
        client,
        'studio_tabletop_base_rules_public',
        TABLE_RULE_PUBLIC_COLUMNS,
        'id',
      ),
      rows(
        client,
        'studio_table_base_profiles_public',
        BASE_PROFILE_PUBLIC_COLUMNS,
        'base_id',
      ),
    ])
    // A malformed/conflicting read never silently removes an exception.
    const parsedRules = z.array(tableRuleSchema).parse(rules)
    const baseProfiles = z
      .array(
        z.object({
          base_id: z.string().min(1),
          base_type_id: z.string().min(1),
        }),
      )
      .parse(profiles)
    return { rules: parsedRules, baseProfiles, available: true }
  } catch {
    return EMPTY_COMPATIBILITY
  }
}
export async function loadTableCompatibility(): Promise<TableCompatibilityData> {
  const config = getSupabasePublicConfig()
  if (!config.isConfigured) return EMPTY_COMPATIBILITY
  return fetchTableCompatibility(
    createSupabaseBrowserClient(config) as unknown as TableRulesClient,
  )
}
