// Carrier partners repository. Public callers go through
// `listPublishedCarriers` (RLS-gated to is_active=true). Admin callers
// use the *AllCarriers / upsert / deactivate helpers which target the
// `Admins full access carriers` RLS policy.

import type { SupabaseBrowserClient } from '@/lib/supabase/client'
import type { Carrier, CarrierSpecialty } from '@/lib/carriers'
import type { CarrierSpecialtyDb, Database, Json } from '@/lib/supabase/types'

export type CarrierPartnersClient = SupabaseBrowserClient

type CarrierRow = Database['public']['Tables']['carrier_partners']['Row']
type CarrierInsert = Database['public']['Tables']['carrier_partners']['Insert']

export interface AdminCarrier extends Carrier {
  readonly id: string
  readonly isActive: boolean
  readonly sortOrder: number
}

function asStringArray(value: Json | null | undefined): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const item of value) {
    if (typeof item === 'string') out.push(item)
  }
  return out
}

function toCarrier(row: CarrierRow): Carrier {
  return {
    slug: row.slug,
    name: row.name,
    specialty: row.specialty as CarrierSpecialty,
    specialtyLabel: row.specialty_label,
    summary: row.summary,
    strengths: asStringArray(row.strengths),
    coverage: row.coverage,
    indicativePricing: row.indicative_pricing ?? '',
    contact: {
      phone: row.contact_phone ?? undefined,
      email: row.contact_email ?? undefined,
      website: row.contact_website ?? undefined,
    },
    source: row.source,
  }
}

function toAdminCarrier(row: CarrierRow): AdminCarrier {
  return {
    ...toCarrier(row),
    id: row.id,
    isActive: row.is_active,
    sortOrder: row.sort_order,
  }
}

export async function listPublishedCarriers(
  client: CarrierPartnersClient,
): Promise<ReadonlyArray<Carrier>> {
  const { data, error } = await client
    .from('carrier_partners')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) throw new Error(error.message)
  return ((data ?? []) as ReadonlyArray<CarrierRow>).map(toCarrier)
}

export async function listAllCarriers(
  client: CarrierPartnersClient,
): Promise<ReadonlyArray<AdminCarrier>> {
  const { data, error } = await client
    .from('carrier_partners')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) throw new Error(error.message)
  return ((data ?? []) as ReadonlyArray<CarrierRow>).map(toAdminCarrier)
}

export interface CarrierUpsertPayload {
  readonly id?: string
  readonly slug: string
  readonly name: string
  readonly specialty: CarrierSpecialtyDb
  readonly specialtyLabel: string
  readonly summary: string
  readonly strengths: ReadonlyArray<string>
  readonly coverage: string
  readonly indicativePricing: string | null
  readonly contactPhone: string | null
  readonly contactEmail: string | null
  readonly contactWebsite: string | null
  readonly source: 'partenaire-direct' | 'plateforme-publique'
  readonly sortOrder: number
  readonly isActive: boolean
}

function toInsert(payload: CarrierUpsertPayload): CarrierInsert {
  return {
    id: payload.id,
    slug: payload.slug,
    name: payload.name,
    specialty: payload.specialty,
    specialty_label: payload.specialtyLabel,
    summary: payload.summary,
    strengths: payload.strengths.filter((s) => s.trim()) as Json,
    coverage: payload.coverage,
    indicative_pricing: payload.indicativePricing,
    contact_phone: payload.contactPhone,
    contact_email: payload.contactEmail,
    contact_website: payload.contactWebsite,
    source: payload.source,
    sort_order: payload.sortOrder,
    is_active: payload.isActive,
  }
}

export async function upsertCarrier(
  client: CarrierPartnersClient,
  payload: CarrierUpsertPayload,
): Promise<void> {
  const insertPayload = toInsert(payload)
  const { error } = await client
    .from('carrier_partners')
    .upsert(insertPayload as never, { onConflict: 'slug' })

  if (error) throw new Error(error.message)
}

export async function deactivateCarrier(
  client: CarrierPartnersClient,
  id: string,
): Promise<void> {
  const { error } = await client
    .from('carrier_partners')
    .update({ is_active: false } as never)
    .eq('id', id)

  if (error) throw new Error(error.message)
}

export async function reactivateCarrier(
  client: CarrierPartnersClient,
  id: string,
): Promise<void> {
  const { error } = await client
    .from('carrier_partners')
    .update({ is_active: true } as never)
    .eq('id', id)

  if (error) throw new Error(error.message)
}

export async function deleteCarrier(
  client: CarrierPartnersClient,
  id: string,
): Promise<void> {
  const { error } = await client.from('carrier_partners').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
