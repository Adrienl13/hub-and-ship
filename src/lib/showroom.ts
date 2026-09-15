import { z } from 'zod'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'

const lat = z.number().finite().min(-90).max(90)
const lng = z.number().finite().min(-180).max(180)
export const locationSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().trim().min(1).max(160),
    address: z.string().trim().max(500),
    city: z.string().trim().min(1).max(160),
    postal_code: z.string().regex(/^\d{5}$/),
    city_lat: lat,
    city_lng: lng,
    latitude: lat.nullable(),
    longitude: lng.nullable(),
    visibility: z.enum(['internal', 'public', 'on_request']),
    publication_agreed: z.boolean(),
    consent_note: z.string().trim().max(2000),
    description: z.string().trim().max(2000),
    visit_info: z.string().trim().max(1000),
    internal_note: z.string().max(5000),
    product_skus: z.array(z.string().min(1).max(100)).max(100),
    photo_paths: z.array(z.string()).max(20),
  })
  .superRefine((v, ctx) => {
    if (
      v.visibility !== 'internal' &&
      (!v.publication_agreed || !v.consent_note)
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Enregistrez l’accord de publication et sa référence.',
      })
    if (
      v.visibility === 'public' &&
      (!v.address || v.latitude === null || v.longitude === null)
    )
      ctx.addIssue({
        code: 'custom',
        message:
          'Indiquez l’adresse et positionnez le lieu précisément sur la carte.',
      })
    if (
      v.photo_paths.some(
        (p) => !new RegExp(`^${v.id}/[a-f0-9-]+\\.(webp|jpg|png)$`).test(p),
      )
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Une photo ne correspond pas à ce lieu.',
      })
  })
export type LocationRecord = z.infer<typeof locationSchema>
export const publicLocationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  address: z.string().nullable(),
  city: z.string(),
  postal_code: z.string(),
  latitude: lat,
  longitude: lng,
  visibility: z.enum(['public', 'on_request']),
  description: z.string(),
  visit_info: z.string(),
  product_skus: z.array(z.string()),
  photo_paths: z.array(z.string()),
})
export type PublicLocation = z.infer<typeof publicLocationSchema> & {
  photos?: string[]
}
export type Commune = {
  nom: string
  code: string
  codesPostaux: string[]
  centre: { coordinates: [number, number] }
}
const communesSchema = z.array(
  z.object({
    nom: z.string(),
    code: z.string(),
    codesPostaux: z.array(z.string()),
    centre: z.object({ coordinates: z.tuple([lng, lat]) }),
  }),
)
export async function findCommunes(query: string): Promise<Commune[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const params = new URLSearchParams({
    fields: 'nom,code,codesPostaux,centre',
    limit: '10',
    boost: 'population',
  })
  params.set(/^\d{5}$/.test(q) ? 'codePostal' : 'nom', q)
  const response = await fetch(`https://geo.api.gouv.fr/communes?${params}`, {
    signal: AbortSignal.timeout(10000),
  })
  if (!response.ok)
    throw new Error('La recherche de communes est momentanément indisponible.')
  return communesSchema.parse(await response.json())
}
export function distanceKm(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const rad = Math.PI / 180
  const d =
    Math.sin(((b.latitude - a.latitude) * rad) / 2) ** 2 +
    Math.cos(a.latitude * rad) *
      Math.cos(b.latitude * rad) *
      Math.sin(((b.longitude - a.longitude) * rad) / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(d), Math.sqrt(Math.max(0, 1 - d)))
}
type Result<T> = { data: T | null; error: { message: string } | null }
interface LocationClient {
  from(table: 'showroom_locations'): {
    select(columns: '*'): {
      order(
        column: 'updated_at',
        options: { ascending: boolean },
      ): PromiseLike<Result<unknown[]>>
    }
    upsert(row: LocationRecord): PromiseLike<Result<unknown>>
  }
  rpc(name: 'list_public_showroom_locations'): PromiseLike<Result<unknown>>
}
export function showroomClient() {
  const config = getSupabasePublicConfig()
  if (!config.isConfigured) throw new Error('Connexion indisponible.')
  const client = createSupabaseBrowserClient(config)
  return { db: client as unknown as LocationClient, storage: client.storage }
}
export async function loadPublicLocations(): Promise<PublicLocation[]> {
  const { db, storage } = showroomClient()
  const { data, error } = await db.rpc('list_public_showroom_locations')
  if (error)
    throw new Error('La carte des lieux est momentanément indisponible.')
  const rows = z.array(publicLocationSchema).parse(data)
  // Short-lived URLs; photos are checked against publication status by storage RLS.
  return Promise.all(
    rows.map(async (row) => {
      if (!row.photo_paths.length) return { ...row, photos: [] }
      const result = await storage
        .from('showroom-photos')
        .createSignedUrls(row.photo_paths, 300)
      return {
        ...row,
        photos:
          result.data?.flatMap((p) => (p.signedUrl ? [p.signedUrl] : [])) ?? [],
      }
    }),
  )
}
