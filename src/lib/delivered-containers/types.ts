import type { ProductCategory } from '@/lib/products'

export type ContainerStatus =
  | 'open'
  | 'locked'
  | 'shipping'
  | 'delivered'
  | 'cancelled'

export type TimelineStatus = 'done' | 'delay'

export interface TimelineStep {
  readonly date: string
  readonly label: string
  readonly description: string
  readonly status: TimelineStatus
}

export interface ProductBreakdown {
  readonly category: ProductCategory
  readonly units: number
  readonly modelLabel: string
}

export interface GalleryItem {
  readonly url: string
  readonly caption: string
}
