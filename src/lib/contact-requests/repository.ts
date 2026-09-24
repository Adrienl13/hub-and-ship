// Enregistrement d'une demande de contact (table contact_requests, migration
// 56) depuis /api/contact, avec la clé anon : la politique RLS « Public
// creates contact requests » n'autorise que l'insertion d'un lead « new »
// sans note interne, et aucune lecture. On n'enchaîne donc pas de .select()
// après l'insert (il serait refusé) : l'appelant n'a besoin que de savoir si
// la ligne est passée.

import type { ContactMessageDraft } from '@/lib/contact'
import type { Database } from '@/lib/supabase/types'

export type ContactRequestInsertPayload =
  Database['public']['Tables']['contact_requests']['Insert']

interface RepositoryResult {
  readonly error: { readonly message: string } | null
}

export interface ContactRequestRepositoryClient {
  from: (table: 'contact_requests') => {
    insert: (
      payload: ContactRequestInsertPayload,
    ) => PromiseLike<RepositoryResult>
  }
}

/** Brouillon validé → colonnes de la table (statut « new » par défaut). */
export function toContactRequestInsertPayload(
  draft: ContactMessageDraft,
): ContactRequestInsertPayload {
  return {
    topic: draft.topic,
    source: draft.source,
    name: draft.name,
    email: draft.email,
    company: draft.company,
    phone: draft.phone,
    message: draft.message,
    product_sku: draft.product?.sku ?? null,
    product_name: draft.product?.name ?? null,
    product_design: draft.product?.design ?? null,
    quantity: draft.product?.quantity ?? null,
    price_label: draft.product?.priceLabel ?? null,
    studio_brief: draft.studioBrief,
    utm_source: draft.attribution?.utm_source ?? null,
    utm_medium: draft.attribution?.utm_medium ?? null,
    utm_campaign: draft.attribution?.utm_campaign ?? null,
    partner_ref: draft.attribution?.partner_ref ?? null,
  }
}

export async function insertContactRequest(
  client: ContactRequestRepositoryClient,
  draft: ContactMessageDraft,
): Promise<void> {
  const result = await client
    .from('contact_requests')
    .insert(toContactRequestInsertPayload(draft))

  if (result.error) {
    throw new Error(result.error.message)
  }
}
