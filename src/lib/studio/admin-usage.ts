// Usage du Studio côté admin : ce que les sessions de découverte racontent.
//
// Les tables studio_sessions et studio_events (migration 40) sont écrites par
// le serveur seulement et lisibles par les admins (RLS is_admin()). Aucune
// PII : un identifiant de session anonyme, un produit, une action. Ce module
// agrège ces lignes en indicateurs lisibles — sessions par semaine, décisions,
// produits les plus aimés ou refusés, part des sessions arrivant aux
// finalistes. Le calcul est pur et testé ; la lecture paginée est à part.

export interface StudioSessionUsageRow {
  readonly id: string
  readonly created_at: string
}

export interface StudioEventUsageRow {
  readonly session_id: string
  readonly event_type: string
  readonly product_id: string | null
}

export interface StudioProductNameRow {
  readonly id: string
  readonly name: string | null
}

export interface StudioWeekUsage {
  /** Lundi de la semaine, au format AAAA-MM-JJ (UTC). */
  readonly weekStart: string
  readonly sessions: number
}

export interface StudioProductUsage {
  readonly productId: string
  readonly name: string
  readonly count: number
}

export interface StudioUsageSummary {
  readonly sessions: number
  readonly sessionsByWeek: ReadonlyArray<StudioWeekUsage>
  readonly decisions: {
    readonly likes: number
    readonly dislikes: number
    readonly passes: number
  }
  readonly topLiked: ReadonlyArray<StudioProductUsage>
  readonly topDisliked: ReadonlyArray<StudioProductUsage>
  readonly sessionsReachingFinalists: number
  /** Part des sessions ayant vu leurs finalistes, en pourcentage (0–100). */
  readonly finalistsRate: number
}

export const STUDIO_USAGE_TOP_SIZE = 10
export const STUDIO_USAGE_WEEKS = 12

const DAY_MS = 24 * 60 * 60 * 1000

/** Lundi (UTC) de la semaine contenant la date, au format AAAA-MM-JJ. */
export function weekStartOf(iso: string): string | null {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  // getUTCDay : 0 = dimanche ; on ramène au lundi précédent.
  const offset = (date.getUTCDay() + 6) % 7
  const monday = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) -
      offset * DAY_MS,
  )
  return monday.toISOString().slice(0, 10)
}

function topProducts(
  counts: ReadonlyMap<string, number>,
  names: ReadonlyMap<string, string>,
  size: number,
): ReadonlyArray<StudioProductUsage> {
  return [...counts.entries()]
    .sort(([idA, a], [idB, b]) => b - a || idA.localeCompare(idB))
    .slice(0, size)
    .map(([productId, count]) => ({
      productId,
      name: names.get(productId) ?? productId,
      count,
    }))
}

export function summarizeStudioUsage(
  input: {
    readonly sessions: ReadonlyArray<StudioSessionUsageRow>
    readonly events: ReadonlyArray<StudioEventUsageRow>
    readonly products: ReadonlyArray<StudioProductNameRow>
  },
  options: { readonly now?: Date; readonly weeks?: number } = {},
): StudioUsageSummary {
  const now = options.now ?? new Date()
  const weeks = options.weeks ?? STUDIO_USAGE_WEEKS

  // Semaines glissantes, la plus ancienne en premier, à zéro quand vides.
  const currentWeek = weekStartOf(now.toISOString()) ?? ''
  const weekCounts = new Map<string, number>()
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const start = new Date(new Date(currentWeek).getTime() - i * 7 * DAY_MS)
    weekCounts.set(start.toISOString().slice(0, 10), 0)
  }
  for (const session of input.sessions) {
    const week = weekStartOf(session.created_at)
    if (week !== null && weekCounts.has(week)) {
      weekCounts.set(week, (weekCounts.get(week) ?? 0) + 1)
    }
  }

  const names = new Map(
    input.products.map((p) => [p.id, p.name?.trim() || p.id] as const),
  )
  const liked = new Map<string, number>()
  const disliked = new Map<string, number>()
  const finalistsSessions = new Set<string>()
  let likes = 0
  let dislikes = 0
  let passes = 0

  for (const event of input.events) {
    switch (event.event_type) {
      case 'card_liked':
        likes += 1
        if (event.product_id) {
          liked.set(event.product_id, (liked.get(event.product_id) ?? 0) + 1)
        }
        break
      case 'card_disliked':
        dislikes += 1
        if (event.product_id) {
          disliked.set(
            event.product_id,
            (disliked.get(event.product_id) ?? 0) + 1,
          )
        }
        break
      case 'card_passed':
        passes += 1
        break
      case 'finalists_viewed':
        finalistsSessions.add(event.session_id)
        break
      default:
        break
    }
  }

  // Une session ne compte qu'une fois, et seulement si elle existe encore
  // (les événements orphelins d'une session purgée n'entrent pas au taux).
  const knownSessions = new Set(input.sessions.map((s) => s.id))
  const sessionsReachingFinalists = [...finalistsSessions].filter((id) =>
    knownSessions.has(id),
  ).length
  const sessions = input.sessions.length

  return {
    sessions,
    sessionsByWeek: [...weekCounts.entries()].map(([weekStart, count]) => ({
      weekStart,
      sessions: count,
    })),
    decisions: { likes, dislikes, passes },
    topLiked: topProducts(liked, names, STUDIO_USAGE_TOP_SIZE),
    topDisliked: topProducts(disliked, names, STUDIO_USAGE_TOP_SIZE),
    sessionsReachingFinalists,
    finalistsRate:
      sessions > 0 ? (sessionsReachingFinalists / sessions) * 100 : 0,
  }
}

// ---------------------------------------------------------------------------
// Lecture paginée (client injecté, interface étroite)
// ---------------------------------------------------------------------------

interface UsageResult {
  readonly data: ReadonlyArray<Record<string, unknown>> | null
  readonly error: { readonly message: string } | null
}

interface UsageQuery {
  order: (
    column: string,
    options: { readonly ascending: boolean },
  ) => UsageQuery
  range: (from: number, to: number) => PromiseLike<UsageResult>
}

export interface StudioUsageClient {
  from: (table: string) => {
    select: (columns: string) => UsageQuery
  }
}

export const STUDIO_USAGE_PAGE_SIZE = 1000

async function fetchAll<Row>(
  client: StudioUsageClient,
  table: string,
  columns: string,
): Promise<ReadonlyArray<Row>> {
  const all: Row[] = []
  for (let offset = 0; ; offset += STUDIO_USAGE_PAGE_SIZE) {
    // Ordre stable (date puis id) pour que la pagination ne saute ni ne
    // duplique de ligne.
    const { data, error } = await client
      .from(table)
      .select(columns)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + STUDIO_USAGE_PAGE_SIZE - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    const page = (data ?? []) as unknown as ReadonlyArray<Row>
    all.push(...page)
    if (page.length < STUDIO_USAGE_PAGE_SIZE) break
  }
  return all
}

export async function loadStudioUsage(
  client: StudioUsageClient,
  options: { readonly now?: Date } = {},
): Promise<StudioUsageSummary> {
  const [sessions, events, products] = await Promise.all([
    fetchAll<StudioSessionUsageRow>(client, 'studio_sessions', 'id,created_at'),
    fetchAll<StudioEventUsageRow>(
      client,
      'studio_events',
      'session_id,event_type,product_id',
    ),
    fetchAll<StudioProductNameRow>(client, 'products', 'id,name'),
  ])
  return summarizeStudioUsage({ sessions, events, products }, options)
}
