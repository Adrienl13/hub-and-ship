import type {
  ContainerStatus,
  GalleryItem,
  ProductBreakdown,
  TimelineStep,
} from './types'
import type { SupabaseBrowserClient } from '@/lib/supabase/client'
import { PAST_CONTAINERS } from '@/lib/products'
import type { Database, Json } from '@/lib/supabase/types'

type ContainerRow = Database['public']['Tables']['containers']['Row']

export type DeliveredContainersClient = SupabaseBrowserClient

export interface DeliveredContainerTestimonial {
  readonly quote: string | null
  readonly longQuote: string | null
  readonly author: string | null
  readonly role: string | null
  readonly location: string | null
  readonly rating: number | null
}

export interface DeliveredContainer {
  readonly id: string
  readonly reference: string
  readonly slug: string
  readonly port: string
  readonly originPort: string | null
  readonly status: ContainerStatus
  readonly deliveredAt: string | null
  readonly publishedAt: string
  readonly professionalsServed: number | null
  readonly totalItems: number | null
  readonly savingsTotalEur: number | null
  readonly savingsPercent: number | null
  readonly plannedDays: number | null
  readonly actualDays: number | null
  readonly photoUrl: string | null
  readonly story: string | null
  readonly certifications: ReadonlyArray<string>
  readonly timeline: ReadonlyArray<TimelineStep>
  readonly productBreakdown: ReadonlyArray<ProductBreakdown>
  readonly gallery: ReadonlyArray<GalleryItem>
  readonly testimonial: DeliveredContainerTestimonial
}

export interface DeliveredContainersListItem {
  readonly id: string
  readonly reference: string
  readonly slug: string
  readonly port: string
  readonly deliveredAt: string | null
  readonly professionalsServed: number | null
  readonly totalItems: number | null
  readonly plannedDays: number | null
  readonly actualDays: number | null
  readonly photoUrl: string | null
  readonly savingsTotalEur: number | null
  readonly savingsPercent: number | null
  readonly testimonial: Pick<
    DeliveredContainerTestimonial,
    'quote' | 'author' | 'location' | 'rating'
  >
}

function asArray<T>(value: Json | null | undefined): ReadonlyArray<T> {
  if (Array.isArray(value)) {
    return value as ReadonlyArray<T>
  }
  return []
}

function fallbackSlug(reference: string, port?: string): string {
  return [reference, port]
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function listFallbackDeliveredContainers(): ReadonlyArray<DeliveredContainersListItem> {
  return PAST_CONTAINERS.map((c, index) => ({
    id: `fallback-${index}`,
    reference: c.reference,
    slug: fallbackSlug(c.reference),
    port: c.port,
    deliveredAt: c.deliveredAt,
    professionalsServed: c.professionalsServed,
    totalItems: c.totalItems,
    plannedDays: c.plannedDays,
    actualDays: c.actualDays,
    photoUrl: c.photoUrl,
    savingsTotalEur: null,
    savingsPercent: null,
    testimonial: {
      quote: c.testimonial.quote,
      author: c.testimonial.author,
      location: c.testimonial.location,
      rating: c.testimonial.rating,
    },
  }))
}

export function getFallbackDeliveredContainerBySlug(
  slug: string,
): DeliveredContainer | null {
  const item = PAST_CONTAINERS.find(
    (c) =>
      fallbackSlug(c.reference) === slug ||
      fallbackSlug(c.reference, c.port) === slug,
  )
  if (!item) return null

  return {
    id: `fallback-${fallbackSlug(item.reference)}`,
    reference: item.reference,
    slug: fallbackSlug(item.reference),
    port: item.port,
    originPort: 'Ningbo',
    status: 'delivered',
    deliveredAt: item.deliveredAt,
    publishedAt: item.deliveredAt,
    professionalsServed: item.professionalsServed,
    totalItems: item.totalItems,
    savingsTotalEur: null,
    savingsPercent: null,
    plannedDays: item.plannedDays,
    actualDays: item.actualDays,
    photoUrl: item.photoUrl,
    story:
      "Container témoin publié en mode démonstration locale. Les métriques détaillées seront remplacées par les données Supabase de production dès que l'intégration est configurée.",
    certifications: [
      'Contrôle qualité pré-expédition',
      'Documents import vérifiés',
    ],
    timeline: [
      {
        date: item.deliveredAt,
        label: 'Arrivée portuaire',
        description:
          'Container livré et réceptionné au port, avec suivi des délais réels.',
        status: item.actualDays <= item.plannedDays ? 'done' : 'delay',
      },
      {
        date: item.deliveredAt,
        label: 'Réception client',
        description:
          'Les professionnels participants récupèrent ou organisent leur transport post-port.',
        status: 'done',
      },
    ],
    productBreakdown: [
      {
        category: 'chair',
        units: Math.round(item.totalItems * 0.62),
        modelLabel: 'Assises outdoor',
      },
      {
        category: 'table',
        units: Math.round(item.totalItems * 0.25),
        modelLabel: 'Tables terrasse',
      },
      {
        category: 'armchair',
        units: Math.max(
          0,
          item.totalItems - Math.round(item.totalItems * 0.87),
        ),
        modelLabel: 'Fauteuils et compléments',
      },
    ],
    gallery: [
      {
        url: item.photoUrl,
        caption: `Container ${item.reference} livré à ${item.port}`,
      },
    ],
    testimonial: {
      quote: item.testimonial.quote,
      longQuote: item.testimonial.quote,
      author: item.testimonial.author,
      role: 'Client professionnel',
      location: item.testimonial.location,
      rating: item.testimonial.rating,
    },
  }
}

function toListItem(row: ContainerRow): DeliveredContainersListItem {
  return {
    id: row.id,
    reference: row.reference,
    slug: row.slug ?? row.reference.toLowerCase(),
    port: row.port,
    deliveredAt: row.delivered_at,
    professionalsServed: row.professionals_served,
    totalItems: row.total_items,
    plannedDays: row.planned_days,
    actualDays: row.actual_days,
    photoUrl: row.photo_url,
    savingsTotalEur:
      row.savings_total_eur != null ? Number(row.savings_total_eur) : null,
    savingsPercent: row.savings_percent,
    testimonial: {
      quote: row.testimonial_quote,
      author: row.testimonial_author,
      location: row.testimonial_location,
      rating: row.testimonial_rating,
    },
  }
}

function toDeliveredContainer(row: ContainerRow): DeliveredContainer {
  return {
    id: row.id,
    reference: row.reference,
    slug: row.slug ?? row.reference.toLowerCase(),
    port: row.port,
    originPort: row.origin_port,
    status: row.status,
    deliveredAt: row.delivered_at,
    publishedAt: row.published_at ?? '',
    professionalsServed: row.professionals_served,
    totalItems: row.total_items,
    savingsTotalEur:
      row.savings_total_eur != null ? Number(row.savings_total_eur) : null,
    savingsPercent: row.savings_percent,
    plannedDays: row.planned_days,
    actualDays: row.actual_days,
    photoUrl: row.photo_url,
    story: row.story,
    certifications: asArray<string>(row.certifications),
    timeline: asArray<TimelineStep>(row.timeline),
    productBreakdown: asArray<ProductBreakdown>(row.product_breakdown),
    gallery: asArray<GalleryItem>(row.gallery),
    testimonial: {
      quote: row.testimonial_quote,
      longQuote: row.testimonial_long_quote,
      author: row.testimonial_author,
      role: row.testimonial_role,
      location: row.testimonial_location,
      rating: row.testimonial_rating,
    },
  }
}

export async function listPublishedDeliveredContainers(
  client: DeliveredContainersClient,
): Promise<ReadonlyArray<DeliveredContainersListItem>> {
  const { data, error } = await client
    .from('containers')
    .select('*')
    .eq('status', 'delivered')
    .not('published_at', 'is', null)
    .order('delivered_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data ?? []) as ReadonlyArray<ContainerRow>
  return rows.map((row) => toListItem(row))
}

export async function getDeliveredContainerBySlug(
  client: DeliveredContainersClient,
  slug: string,
): Promise<DeliveredContainer | null> {
  const { data, error } = await client
    .from('containers')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (!data) return null
  const row = data as ContainerRow
  if (row.status !== 'delivered') return null
  if (!row.published_at) return null
  return toDeliveredContainer(row)
}

export interface DeliveredContainersStats {
  readonly totalContainers: number
  readonly totalPros: number
  readonly totalArticles: number
  readonly totalSavings: number
  readonly onTimeRate: number
  readonly avgSavingsPercent: number
}

export function computeStats(
  containers: ReadonlyArray<DeliveredContainersListItem>,
): DeliveredContainersStats {
  if (containers.length === 0) {
    return {
      totalContainers: 0,
      totalPros: 0,
      totalArticles: 0,
      totalSavings: 0,
      onTimeRate: 0,
      avgSavingsPercent: 0,
    }
  }

  const totalPros = containers.reduce(
    (sum, c) => sum + (c.professionalsServed ?? 0),
    0,
  )
  const totalArticles = containers.reduce(
    (sum, c) => sum + (c.totalItems ?? 0),
    0,
  )
  const totalSavings = containers.reduce(
    (sum, c) => sum + (c.savingsTotalEur ?? 0),
    0,
  )

  const measurable = containers.filter(
    (c) => c.plannedDays != null && c.actualDays != null,
  )
  const onTime = measurable.filter(
    (c) => (c.actualDays as number) <= (c.plannedDays as number),
  )
  const onTimeRate =
    measurable.length === 0
      ? 0
      : Math.round((onTime.length / measurable.length) * 100)

  const savingsItems = containers.filter((c) => c.savingsPercent != null)
  const avgSavingsPercent =
    savingsItems.length === 0
      ? 0
      : Math.round(
          savingsItems.reduce((sum, c) => sum + (c.savingsPercent ?? 0), 0) /
            savingsItems.length,
        )

  return {
    totalContainers: containers.length,
    totalPros,
    totalArticles,
    totalSavings,
    onTimeRate,
    avgSavingsPercent,
  }
}
