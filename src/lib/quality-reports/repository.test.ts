import { describe, expect, it, vi } from 'vitest'

import {
  generateSignedFileUrl,
  getQualityReportById,
  listPublishedQualityReports,
  type QualityReportsClient,
} from './repository'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

interface RawRow {
  id?: string
  organization?: string
  report_type?: string
  reference_number?: string
  issued_at?: string
  product_categories?: ReadonlyArray<string>
  title?: string
  summary?: string | null
  highlights?: unknown
  file_path?: string | null
  file_size_bytes?: number | null
  file_mime?: string | null
  preview_image_url?: string | null
  is_active?: boolean
  published_at?: string | null
  containers?: { reference: string; slug: string | null } | null
}

function makeRow(overrides: RawRow = {}): RawRow {
  return {
    id: 'q-1',
    organization: 'sgs',
    report_type: 'aql_inspection',
    reference_number: 'SGS-FR-2025-014-AQL',
    issued_at: '2025-11-10',
    product_categories: ['chair', 'armchair', 'table', 'bench'],
    title: 'Rapport SGS · Inspection AQL 2.5 — CC-2025-014',
    summary: 'Inspection AQL 2.5 standard ISO 2859-1.',
    highlights: [
      { label: 'Articles inspectés', value: '287/287' },
      { label: 'Critiques', value: '0' },
    ],
    file_path: 'reports/sgs/cc_2025_014_aql.pdf',
    file_size_bytes: 1024,
    file_mime: 'application/pdf',
    preview_image_url: 'https://example.com/preview.jpg',
    is_active: true,
    published_at: '2026-05-22T08:27:57.319234+00:00',
    containers: { reference: 'CC-2025-014', slug: 'cc-2025-014' },
    ...overrides,
  }
}

interface FakeResult<T> {
  data: T | null
  error: { message: string } | null
}

function makeClient<T>(result: FakeResult<T>): QualityReportsClient {
  const chain: Record<string, unknown> = {
    select: () => chain,
    eq: () => chain,
    not: () => chain,
    order: () => Promise.resolve(result),
    maybeSingle: () => Promise.resolve(result),
  }
  return {
    from: () => chain,
  } as unknown as QualityReportsClient
}

describe('listPublishedQualityReports', () => {
  it('maps rows including organization label, container join and highlights', async () => {
    const rows = [makeRow()]
    const client = makeClient({ data: rows, error: null })

    const list = await listPublishedQualityReports(client)
    expect(list).toHaveLength(1)
    const r = list[0]!
    expect(r.organizationLabel).toBe('SGS')
    expect(r.reportTypeLabel).toBe('Inspection AQL 2.5')
    expect(r.containerReference).toBe('CC-2025-014')
    expect(r.containerSlug).toBe('cc-2025-014')
    expect(r.highlights).toHaveLength(2)
    expect(r.highlights[0]).toEqual({
      label: 'Articles inspectés',
      value: '287/287',
    })
    expect(r.productCategories).toEqual(['chair', 'armchair', 'table', 'bench'])
    expect(r.hasFile).toBe(true)
  })

  it('drops invalid product categories and malformed highlights', async () => {
    const rows = [
      makeRow({
        product_categories: ['chair', 'unknown' as never, 'table'],
        highlights: [
          { label: 'OK', value: '1' },
          { label: 'missing-value' },
          'not-an-object',
          null,
        ] as unknown,
      }),
    ]
    const client = makeClient({ data: rows, error: null })
    const list = await listPublishedQualityReports(client)
    expect(list[0]?.productCategories).toEqual(['chair', 'table'])
    expect(list[0]?.highlights).toEqual([{ label: 'OK', value: '1' }])
  })

  it('throws when supabase returns an error', async () => {
    const client = makeClient({ data: null, error: { message: 'boom' } })
    await expect(listPublishedQualityReports(client)).rejects.toThrow('boom')
  })
})

describe('getQualityReportById', () => {
  it('returns null when no row is found', async () => {
    const client = makeClient({ data: null, error: null })
    const result = await getQualityReportById(client, 'missing')
    expect(result).toBeNull()
  })

  it('returns detail with filePath when found', async () => {
    const client = makeClient({ data: makeRow(), error: null })
    const result = await getQualityReportById(client, 'q-1')
    expect(result).not.toBeNull()
    expect(result?.filePath).toBe('reports/sgs/cc_2025_014_aql.pdf')
    expect(result?.fileMime).toBe('application/pdf')
    expect(result?.publishedAt).toBe('2026-05-22T08:27:57.319234+00:00')
  })
})

describe('generateSignedFileUrl', () => {
  it('returns null when supabase storage returns an error', async () => {
    const storage = {
      from: vi.fn().mockReturnValue({
        createSignedUrl: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Bucket not found' },
        }),
      }),
    }
    const fakeClient = { storage } as unknown as SupabaseClient<Database>
    const url = await generateSignedFileUrl(
      fakeClient,
      'reports/sgs/missing.pdf',
    )
    expect(url).toBeNull()
    expect(storage.from).toHaveBeenCalledWith('quality-reports')
  })

  it('returns the signed URL when the storage call succeeds', async () => {
    const storage = {
      from: vi.fn().mockReturnValue({
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: 'https://signed.example/file.pdf' },
          error: null,
        }),
      }),
    }
    const fakeClient = { storage } as unknown as SupabaseClient<Database>
    const url = await generateSignedFileUrl(
      fakeClient,
      'reports/sgs/cc_2025_014_aql.pdf',
      120,
    )
    expect(url).toBe('https://signed.example/file.pdf')
  })
})
