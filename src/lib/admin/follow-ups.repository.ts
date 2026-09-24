// Lecture des relances envoyées depuis l'admin (table public.admin_follow_ups,
// migration 59). Client AUTHENTIFIÉ du navigateur : la politique RLS « Admins
// read follow ups » réserve la lecture aux admins. L'écriture, elle, ne passe
// que par la fonction serveur (follow-ups.server.ts).
//
// Le client Supabase du navigateur n'est pas typé pour cette table : on décrit
// la surface étroite utilisée et on caste à l'appel, comme les autres dépôts
// admin.

import type { FollowUpTargetKind } from '@/lib/admin/follow-ups'

export interface FollowUpDbRow {
  readonly id: string
  readonly target_kind: string
  readonly target_id: string
  readonly recipient_email: string
  readonly subject: string
  readonly body: string
  readonly template: string
  readonly sent_by: string | null
  readonly sent_at: string
  readonly delivery_id: string | null
}

export interface FollowUpRow {
  readonly id: string
  readonly targetKind: FollowUpTargetKind
  readonly targetId: string
  readonly recipientEmail: string
  readonly subject: string
  readonly body: string
  readonly template: string
  readonly sentBy: string | null
  readonly sentAt: string
  readonly deliveryId: string | null
}

interface QueryResult<T> {
  readonly data: T
  readonly error: { readonly message: string } | null
}

export interface FollowUpListQuery extends PromiseLike<
  QueryResult<ReadonlyArray<FollowUpDbRow> | null>
> {
  eq: (column: 'target_kind', value: string) => FollowUpListQuery
  in: (column: 'target_id', values: ReadonlyArray<string>) => FollowUpListQuery
  ilike: (column: 'recipient_email', pattern: string) => FollowUpListQuery
  order: (
    column: 'sent_at',
    options: { readonly ascending: boolean },
  ) => FollowUpListQuery
  limit: (count: number) => FollowUpListQuery
}

export interface FollowUpsClient {
  from: (table: 'admin_follow_ups') => {
    select: (columns: '*') => FollowUpListQuery
  }
}

export function toFollowUpRow(row: FollowUpDbRow): FollowUpRow {
  return {
    id: row.id,
    targetKind: row.target_kind as FollowUpTargetKind,
    targetId: row.target_id,
    recipientEmail: row.recipient_email,
    subject: row.subject,
    body: row.body,
    template: row.template,
    sentBy: row.sent_by,
    sentAt: row.sent_at,
    deliveryId: row.delivery_id,
  }
}

// Un filtre `in` sur 500 uuid ferait une URL de ~20 Ko : on découpe.
const TARGETS_CHUNK = 100
export const FOLLOW_UPS_BY_EMAIL_LIMIT = 200

/**
 * Relances par cible, la plus récente en tête de chaque liste. Les cibles sans
 * relance sont absentes de la Map. Une liste d'identifiants vide ne fait
 * aucune requête.
 */
export async function listFollowUpsForTargets(
  client: FollowUpsClient,
  kind: FollowUpTargetKind,
  ids: ReadonlyArray<string>,
): Promise<Map<string, FollowUpRow[]>> {
  const result = new Map<string, FollowUpRow[]>()
  const unique = [...new Set(ids)]
  for (let start = 0; start < unique.length; start += TARGETS_CHUNK) {
    const chunk = unique.slice(start, start + TARGETS_CHUNK)
    const { data, error } = await client
      .from('admin_follow_ups')
      .select('*')
      .eq('target_kind', kind)
      .in('target_id', chunk)
      .order('sent_at', { ascending: false })
    if (error) throw new Error(error.message)
    for (const raw of data ?? []) {
      const row = toFollowUpRow(raw)
      const list = result.get(row.targetId)
      if (list) list.push(row)
      else result.set(row.targetId, [row])
    }
  }
  return result
}

/**
 * Toutes les relances reçues par une adresse (insensible à la casse), la plus
 * récente en tête — chronologie de la fiche client.
 */
export async function listFollowUpsByEmail(
  client: FollowUpsClient,
  email: string,
): Promise<ReadonlyArray<FollowUpRow>> {
  const needle = email.trim()
  if (needle === '') return []
  const { data, error } = await client
    .from('admin_follow_ups')
    .select('*')
    .ilike('recipient_email', escapeLikePattern(needle))
    .order('sent_at', { ascending: false })
    .limit(FOLLOW_UPS_BY_EMAIL_LIMIT)
  if (error) throw new Error(error.message)
  return (data ?? []).map(toFollowUpRow)
}

// `ilike` sans joker = égalité insensible à la casse, à condition d'échapper
// les jokers que l'adresse pourrait contenir.
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}
