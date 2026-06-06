import type { Database } from '@/lib/supabase/types'

export const PARTNER_APPLICATION_STATUS_LABEL = {
  new: 'Nouvelle',
  reviewing: 'En analyse',
  qualified: 'Qualifiée',
  approved: 'Approuvée',
  rejected: 'Refusée',
  archived: 'Archivée',
} as const satisfies Record<PartnerApplicationStatus, string>

export const PARTNER_KIND_LABEL = {
  introducer: 'Apporteur',
  reseller: 'Revendeur',
  agency: 'Agenceur',
  installer: 'Installateur',
  network: 'Réseau',
  other: 'Autre',
} as const satisfies Record<PartnerKind, string>

export const PARTNER_DEAL_STATUS_LABEL = {
  submitted: 'Soumise',
  protected: 'Protégée',
  quoted: 'Devis envoyé',
  reserved: 'Réservée',
  won: 'Gagnée',
  lost: 'Perdue',
  expired: 'Expirée',
  rejected: 'Refusée',
} as const satisfies Record<PartnerDealStatus, string>

export type PartnerApplicationStatus =
  Database['public']['Enums']['partner_application_status']

export type PartnerKind = Database['public']['Enums']['partner_kind']

export type PartnerDealStatus =
  Database['public']['Enums']['partner_deal_status']

export type PartnerApplicationInsertPayload =
  Database['public']['Tables']['partner_applications']['Insert']

export type PartnerDealInsertPayload =
  Database['public']['Tables']['partner_deals']['Insert']

export type PartnerApplicationRow =
  Database['public']['Tables']['partner_applications']['Row']

export type PartnerDealRow =
  Database['public']['Tables']['partner_deals']['Row']
