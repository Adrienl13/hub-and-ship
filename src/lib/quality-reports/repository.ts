// Quality reports data access. Mirrors the pattern used by
// `delivered-containers/repository.ts`: a single browser-friendly module
// that maps DB rows to public types and never leaks `file_path`.
//
// The signed-URL helper takes a server-side client (authenticated via
// cookies or the service role); see `access.server.ts` for the actual
// gating logic used by the page.

import type { SupabaseClient } from '@supabase/supabase-js'

import {
  ORGANIZATION_LABEL,
  REPORT_TYPE_LABEL,
  type ProductCategory,
  type QualityHighlight,
  type QualityReportDetail,
  type QualityReportListItem,
} from './types'
import type { SupabaseBrowserClient } from '@/lib/supabase/client'
import type { Database, Json } from '@/lib/supabase/types'

type QualityReportRow = Database['public']['Tables']['quality_reports']['Row']

export type QualityReportsClient = SupabaseBrowserClient

const VALID_PRODUCT_CATEGORIES: ReadonlySet<ProductCategory> = new Set([
  'chair',
  'armchair',
  'table',
  'bench',
])

function asHighlights(value: Json | null | undefined): QualityHighlight[] {
  if (!Array.isArray(value)) return []
  const out: QualityHighlight[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
    const obj = entry as Record<string, Json | undefined>
    const label = obj.label
    const val = obj.value
    if (typeof label === 'string' && typeof val === 'string') {
      out.push({ label, value: val })
    }
  }
  return out
}

function asProductCategories(
  value: ReadonlyArray<string> | string[] | null | undefined,
): ProductCategory[] {
  if (!Array.isArray(value)) return []
  const out: ProductCategory[] = []
  for (const raw of value) {
    if (typeof raw !== 'string') continue
    if (VALID_PRODUCT_CATEGORIES.has(raw as ProductCategory)) {
      out.push(raw as ProductCategory)
    }
  }
  return out
}

interface JoinedRow extends QualityReportRow {
  readonly containers?: { reference: string; slug: string | null } | null
}

function toListItem(row: JoinedRow): QualityReportListItem {
  return {
    id: row.id,
    organization: row.organization,
    organizationLabel: ORGANIZATION_LABEL[row.organization],
    reportType: row.report_type,
    reportTypeLabel: REPORT_TYPE_LABEL[row.report_type],
    referenceNumber: row.reference_number,
    issuedAt: row.issued_at,
    productCategories: asProductCategories(row.product_categories),
    title: row.title,
    summary: row.summary,
    highlights: asHighlights(row.highlights),
    previewImageUrl: row.preview_image_url,
    containerReference: row.containers?.reference ?? null,
    containerSlug: row.containers?.slug ?? null,
    hasFile: Boolean(row.file_path),
  }
}

function toDetail(row: JoinedRow): QualityReportDetail {
  return {
    ...toListItem(row),
    filePath: row.file_path,
    fileSizeBytes: row.file_size_bytes,
    fileMime: row.file_mime,
    publishedAt: row.published_at ?? '',
  }
}

const SELECT_WITH_CONTAINER =
  '*, containers:container_id(reference, slug)' as const

export async function listPublishedQualityReports(
  client: QualityReportsClient,
): Promise<ReadonlyArray<QualityReportListItem>> {
  const { data, error } = await client
    .from('quality_reports')
    .select(SELECT_WITH_CONTAINER)
    .eq('is_active', true)
    .not('published_at', 'is', null)
    .order('issued_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data ?? []) as ReadonlyArray<JoinedRow>
  return rows.map((row) => toListItem(row))
}

export async function getQualityReportById(
  client: QualityReportsClient,
  id: string,
): Promise<QualityReportDetail | null> {
  const { data, error } = await client
    .from('quality_reports')
    .select(SELECT_WITH_CONTAINER)
    .eq('id', id)
    .eq('is_active', true)
    .not('published_at', 'is', null)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (!data) return null
  return toDetail(data as JoinedRow)
}

/**
 * Returns ALL reports including drafts and deactivated. Requires an
 * admin-grade client (RLS gated to `admin`/`super_admin`).
 */
export async function listAllQualityReportsForAdmin(
  client: QualityReportsClient,
): Promise<ReadonlyArray<QualityReportDetail>> {
  const { data, error } = await client
    .from('quality_reports')
    .select(SELECT_WITH_CONTAINER)
    .order('issued_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data ?? []) as ReadonlyArray<JoinedRow>
  return rows.map((row) => toDetail(row))
}

/**
 * Generates a short-lived signed URL for a private file stored in the
 * `quality-reports` Supabase Storage bucket.
 *
 * IMPORTANT: the bucket `quality-reports` must be created MANUALLY via the
 * Supabase Dashboard before this works:
 *   Storage → New bucket → name `quality-reports` → Private (no public
 *   access) → file size limit 10MB → allowed MIME `application/pdf`.
 *
 * Returns `null` on any error (bucket missing, file missing, etc.) so the
 * caller can render a graceful "report being digitised" message instead
 * of leaking infra details to the user.
 */
export async function generateSignedFileUrl(
  serverClient: SupabaseClient<Database>,
  filePath: string,
  ttlSeconds = 60,
): Promise<string | null> {
  const { data, error } = await serverClient.storage
    .from('quality-reports')
    .createSignedUrl(filePath, ttlSeconds)

  if (error || !data?.signedUrl) {
    return null
  }
  return data.signedUrl
}
