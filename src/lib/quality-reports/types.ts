// Public-facing types for the "Qualité & Tests" feature.
//
// The DB schema (see supabase/migrations/20260522082730_quality_reports.sql)
// stores both metadata (public) and a file_path pointing at a private
// Supabase Storage bucket called `quality-reports`. The browser only ever
// sees mapped types from this module — it never touches `file_path` directly.

export type QualityReportOrganization =
  | 'sgs'
  | 'eurofins'
  | 'tuv'
  | 'bureau_veritas'
  | 'dekra'
  | 'intertek'
  | 'other'

export type QualityReportType =
  | 'aql_inspection'
  | 'pre_shipment_inspection'
  | 'ce_compliance'
  | 'fire_rating'
  | 'material_test'
  | 'reach_compliance'
  | 'load_test'
  | 'eco_certification'
  | 'other'

export type ProductCategory = 'chair' | 'armchair' | 'table' | 'bench'

export interface QualityHighlight {
  readonly label: string
  readonly value: string
}

export interface QualityReportListItem {
  readonly id: string
  readonly organization: QualityReportOrganization
  /** Display name for the audit org (e.g. "SGS", "Eurofins"). */
  readonly organizationLabel: string
  readonly reportType: QualityReportType
  /** Display name for the report kind (e.g. "Inspection AQL 2.5"). */
  readonly reportTypeLabel: string
  readonly referenceNumber: string
  /** ISO date (YYYY-MM-DD) issued by the lab. */
  readonly issuedAt: string
  readonly productCategories: ReadonlyArray<ProductCategory>
  readonly title: string
  readonly summary: string | null
  readonly highlights: ReadonlyArray<QualityHighlight>
  readonly previewImageUrl: string | null
  /** Joined from `containers.reference` if the report is tied to a container. */
  readonly containerReference: string | null
  /** Joined from `containers.slug` (used to build `/livres/<slug>` link). */
  readonly containerSlug: string | null
  readonly hasFile: boolean
}

export interface QualityReportDetail extends QualityReportListItem {
  readonly filePath: string | null
  readonly fileSizeBytes: number | null
  readonly fileMime: string | null
  readonly publishedAt: string
}

export const ORGANIZATION_LABEL: Record<QualityReportOrganization, string> = {
  sgs: 'SGS',
  eurofins: 'Eurofins',
  tuv: 'TÜV',
  bureau_veritas: 'Bureau Veritas',
  dekra: 'DEKRA',
  intertek: 'Intertek',
  other: 'Autre organisme',
}

export const REPORT_TYPE_LABEL: Record<QualityReportType, string> = {
  aql_inspection: 'Inspection AQL 2.5',
  pre_shipment_inspection: 'Pre-shipment inspection',
  ce_compliance: 'Conformité CE',
  fire_rating: 'Tenue au feu',
  material_test: 'Test matériau',
  reach_compliance: 'Conformité REACH',
  load_test: 'Test de charge',
  eco_certification: 'Certification éco-responsable',
  other: 'Autre rapport',
}

/**
 * Brand-aligned accent class for each audit organisation badge. Tailwind
 * needs full class strings, so do NOT generate them dynamically — the JIT
 * would prune them out of the bundle.
 */
export const ORGANIZATION_BADGE_CLASS: Record<
  QualityReportOrganization,
  string
> = {
  sgs: 'bg-[#FF6B35]/15 text-[#FF6B35] border-[#FF6B35]/30',
  eurofins: 'bg-[#6E3FB5]/15 text-[#6E3FB5] border-[#6E3FB5]/30',
  tuv: 'bg-[#1F4E79]/15 text-[#1F4E79] border-[#1F4E79]/30',
  bureau_veritas: 'bg-[#C8102E]/15 text-[#C8102E] border-[#C8102E]/30',
  dekra: 'bg-[#006F3C]/15 text-[#006F3C] border-[#006F3C]/30',
  intertek: 'bg-[#F2A900]/15 text-[#A56C00] border-[#F2A900]/40',
  other:
    'bg-[color:var(--sand-deep)] text-foreground border-[color:var(--sand-deep)]',
}

export const PRODUCT_CATEGORY_LABEL: Record<ProductCategory, string> = {
  chair: 'Chaises',
  armchair: 'Fauteuils',
  table: 'Tables',
  bench: 'Banquettes',
}

export const ORGANIZATIONS: ReadonlyArray<QualityReportOrganization> = [
  'sgs',
  'eurofins',
  'tuv',
  'bureau_veritas',
  'dekra',
  'intertek',
  'other',
]

export const REPORT_TYPES: ReadonlyArray<QualityReportType> = [
  'aql_inspection',
  'pre_shipment_inspection',
  'ce_compliance',
  'fire_rating',
  'material_test',
  'reach_compliance',
  'load_test',
  'eco_certification',
  'other',
]

export const PRODUCT_CATEGORIES: ReadonlyArray<ProductCategory> = [
  'chair',
  'armchair',
  'table',
  'bench',
]
