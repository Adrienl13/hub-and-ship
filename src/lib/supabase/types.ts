export type Json =
  | string
  | number
  | boolean
  | null
  | { readonly [key: string]: Json | undefined }
  | readonly Json[]

export type UserRole = 'buyer' | 'admin' | 'super_admin'
export type CompanyRiskFlag = 'normal' | 'review' | 'blocked'
export type DeliveryMode =
  | 'pickup_at_port'
  | 'self_arranged'
  | 'partner_carrier_needed'
export type ReservationStatus =
  | 'draft'
  | 'pending_reservation_fee'
  | 'reserved'
  | 'deposit_called'
  | 'deposit_paid'
  | 'in_production'
  | 'in_transit'
  | 'delivered'
  | 'cancelled'
export type StockRequestStatus =
  | 'new'
  | 'contacted'
  | 'reserved'
  | 'converted'
  | 'closed'
export type PartnerApplicationStatus =
  | 'new'
  | 'reviewing'
  | 'qualified'
  | 'approved'
  | 'rejected'
  | 'archived'
export type PartnerKind =
  | 'introducer'
  | 'reseller'
  | 'agency'
  | 'installer'
  | 'network'
  | 'other'
export type PartnerDealStatus =
  | 'submitted'
  | 'protected'
  | 'quoted'
  | 'reserved'
  | 'won'
  | 'lost'
  | 'expired'
  | 'rejected'
// Fusion Claude x Codex — canal de vente (attribut de compte, admin-only),
// statut visé par une candidature (page /partenaires mockup), et ledger
// de commissions apporteur (8% CA encaissé / 12 mois).
export type SalesChannel =
  | 'direct'
  | 'revendeur'
  | 'distributeur'
  | 'grand_compte'
export type PartnerTargetStatus =
  | 'apporteur'
  | 'revendeur'
  | 'grand_compte'
  | 'distributeur'
  | 'nsp'
export type CommissionStatus = 'accrued' | 'payable' | 'paid'
export type CommissionPhase = 'accrual' | 'reversal'
export type ContainerStatus =
  | 'open'
  | 'locked'
  | 'shipping'
  | 'delivered'
  | 'cancelled'
export type ContainerType = '20_dv' | '20_hc' | '40_gp' | '40_hc'
export type StockCondition = 'new' | 'opened_box' | 'showroom'
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
export type ProductCategoryDb = 'chair' | 'armchair' | 'table' | 'bench'
export type FireRatingDb = 'M1' | 'M2'
export type CarrierSpecialtyDb =
  | 'national'
  | 'regional_sud_est'
  | 'regional_ouest'
  | 'international'
  | 'plateforme'
export type SecurityEventSeverity = 'info' | 'warning' | 'error' | 'critical'
export type SecurityEventType =
  | 'login_attempt'
  | 'magic_link_sent'
  | 'magic_link_rate_limited'
  | 'siret_lookup_success'
  | 'siret_lookup_failed'
  | 'siret_lookup_invalid'
  | 'siret_lookup_inactive'
  | 'siret_duplicate_attempt'
  | 'email_warning_shown'
  | 'rate_limit_hit'
  | 'suspicious_pattern'
  | 'admin_action'
  | 'data_export'
  | 'data_deletion'
  | 'failed_payment_attempt'
  | 'refund_initiated'

type CompanyRow = {
  id: string
  legal_name: string
  trading_name: string | null
  siret: string | null
  siren: string | null
  vat_number: string | null
  national_business_id: string | null
  country_code: string
  siret_verified: boolean
  siret_verified_at: string | null
  siret_verification_data: Json | null
  naf_code: string | null
  naf_label: string | null
  legal_form: string | null
  legal_form_code: string | null
  creation_date: string | null
  is_active_company: boolean
  inactive_since: string | null
  risk_flag: CompanyRiskFlag
  risk_notes: string | null
  billing_email: string | null
  billing_phone: string | null
  billing_address: Json | null
  default_delivery_address: Json | null
  default_delivery_postal_code: string | null
  default_delivery_country: string | null
  is_verified: boolean
  verified_at: string | null
  verification_notes: string | null
  loyalty_tier: number
  total_containers_completed: number
  total_lifetime_value: number
  preferred_locale: string
  channel: SalesChannel
  channel_set_by: string | null
  channel_set_at: string | null
  referred_by_partner_id: string | null
  referred_at: string | null
  created_at: string
  updated_at: string
}

type CompanyInsert = {
  id?: string
  legal_name: string
  trading_name?: string | null
  siret?: string | null
  vat_number?: string | null
  national_business_id?: string | null
  country_code?: string
  siret_verified?: boolean
  siret_verified_at?: string | null
  siret_verification_data?: Json | null
  naf_code?: string | null
  naf_label?: string | null
  legal_form?: string | null
  legal_form_code?: string | null
  creation_date?: string | null
  is_active_company?: boolean
  inactive_since?: string | null
  risk_flag?: CompanyRiskFlag
  risk_notes?: string | null
  billing_email?: string | null
  billing_phone?: string | null
  billing_address?: Json | null
  default_delivery_address?: Json | null
  default_delivery_postal_code?: string | null
  default_delivery_country?: string | null
  is_verified?: boolean
  verified_at?: string | null
  verification_notes?: string | null
  loyalty_tier?: number
  total_containers_completed?: number
  total_lifetime_value?: number
  preferred_locale?: string
  channel?: SalesChannel
  channel_set_by?: string | null
  channel_set_at?: string | null
  referred_by_partner_id?: string | null
  referred_at?: string | null
  created_at?: string
  updated_at?: string
}

type CompanyUpdate = Partial<CompanyInsert>

type PartnerCodeRow = {
  id: string
  code: string
  company_id: string
  active: boolean
  created_at: string
}

type PartnerCodeInsert = {
  id?: string
  code: string
  company_id: string
  active?: boolean
  created_at?: string
}

type PartnerCodeUpdate = Partial<PartnerCodeInsert>

type CommissionLedgerRow = {
  id: string
  partner_code_id: string
  reservation_id: string
  base_amount_ht: number
  rate: number
  amount: number
  status: CommissionStatus
  phase: CommissionPhase
  accrued_at: string
  paid_at: string | null
}

type CommissionLedgerInsert = {
  id?: string
  partner_code_id: string
  reservation_id: string
  base_amount_ht: number
  rate?: number
  amount: number
  status?: CommissionStatus
  phase?: CommissionPhase
  accrued_at?: string
  paid_at?: string | null
}

type CommissionLedgerUpdate = Partial<CommissionLedgerInsert>

type ChannelCoefficientRow = {
  channel: SalesChannel
  coefficient: number
}
type ChannelCoefficientInsert = {
  channel: SalesChannel
  coefficient: number
}
type ChannelCoefficientUpdate = Partial<ChannelCoefficientInsert>

type ChannelPriceOverrideRow = {
  id: string
  product_id: string
  channel: SalesChannel
  unit_price_ht: number
}
type ChannelPriceOverrideInsert = {
  id?: string
  product_id: string
  channel: SalesChannel
  unit_price_ht: number
}
type ChannelPriceOverrideUpdate = Partial<ChannelPriceOverrideInsert>

type UserProfileRow = {
  id: string
  company_id: string | null
  first_name: string | null
  last_name: string | null
  email: string
  phone: string | null
  role: UserRole
  email_marketing_consent: boolean
  email_marketing_consent_at: string | null
  cgv_accepted_at: string | null
  cgv_version_accepted: string | null
  last_login_at: string | null
  preferred_locale: string
  created_at: string
  updated_at: string
}

type UserProfileInsert = {
  id: string
  company_id?: string | null
  first_name?: string | null
  last_name?: string | null
  email: string
  phone?: string | null
  role?: UserRole
  email_marketing_consent?: boolean
  email_marketing_consent_at?: string | null
  cgv_accepted_at?: string | null
  cgv_version_accepted?: string | null
  last_login_at?: string | null
  preferred_locale?: string
  created_at?: string
  updated_at?: string
}

type UserProfileUpdate = Partial<Omit<UserProfileInsert, 'id'>> & {
  id?: string
}

type SecurityEventRow = {
  id: string
  event_type: SecurityEventType
  user_id: string | null
  company_id: string | null
  ip_address: string | null
  user_agent: string | null
  request_id: string | null
  metadata: Json | null
  severity: SecurityEventSeverity
  reviewed_by: string | null
  reviewed_at: string | null
  resolution: string | null
  created_at: string
}

type SecurityEventInsert = {
  id?: string
  event_type: SecurityEventType
  user_id?: string | null
  company_id?: string | null
  ip_address?: string | null
  user_agent?: string | null
  request_id?: string | null
  metadata?: Json | null
  severity?: SecurityEventSeverity
  reviewed_by?: string | null
  reviewed_at?: string | null
  resolution?: string | null
  created_at?: string
}

type SecurityEventUpdate = Partial<SecurityEventInsert>

type SiretCacheRow = {
  siret: string
  insee_response: Json
  is_valid: boolean
  is_active: boolean
  fetched_at: string
  expires_at: string
}

type SiretCacheInsert = {
  siret: string
  insee_response: Json
  is_valid: boolean
  is_active: boolean
  fetched_at?: string
  expires_at?: string
}

type SiretCacheUpdate = Partial<SiretCacheInsert>

type ReservationRow = {
  id: string
  reference: string
  container_reference: string
  container_id: string | null
  user_id: string | null
  company_id: string | null
  siret: string
  contact_snapshot: Json
  delivery_mode: DeliveryMode
  delivery_note: string | null
  delivery_fee: number
  subtotal_ht: number
  eco_contribution_total: number
  referral_code: string | null
  referral_discount: number
  total_ht: number
  vat_rate: number
  vat_amount: number
  total_ttc: number
  total_cbm: number
  reservation_fee: number
  pay_now: number
  deposit_amount: number
  pay_at_80_percent: number
  balance_amount: number
  status: ReservationStatus
  cgv_version_accepted: string
  cgv_accepted_at: string
  reserved_at: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
  admin_notes: string | null
  stripe_payment_intent_id: string | null
  stripe_customer_id: string | null
  stripe_checkout_session_id: string | null
  paid_reservation_fee_at: string | null
  partner_deal_id: string | null
  partner_application_id: string | null
  partner_attribution_reason: string | null
  partner_attribution_snapshot: Json
  payment_reminder_count: number
  payment_reminder_last_at: string | null
  created_at: string
  updated_at: string
  requested_container_type: ContainerType | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  partner_ref: string | null
}

type ReservationInsert = {
  id?: string
  reference: string
  container_reference: string
  container_id?: string | null
  user_id?: string | null
  company_id?: string | null
  siret: string
  contact_snapshot: Json
  delivery_mode?: DeliveryMode
  delivery_note?: string | null
  delivery_fee?: number
  subtotal_ht: number
  eco_contribution_total?: number
  referral_code?: string | null
  referral_discount?: number
  total_ht: number
  vat_rate?: number
  vat_amount: number
  total_ttc: number
  total_cbm: number
  reservation_fee: number
  pay_now: number
  deposit_amount: number
  pay_at_80_percent: number
  balance_amount: number
  status?: ReservationStatus
  cgv_version_accepted: string
  cgv_accepted_at: string
  reserved_at?: string | null
  cancelled_at?: string | null
  cancellation_reason?: string | null
  admin_notes?: string | null
  stripe_payment_intent_id?: string | null
  stripe_customer_id?: string | null
  stripe_checkout_session_id?: string | null
  paid_reservation_fee_at?: string | null
  partner_deal_id?: string | null
  partner_application_id?: string | null
  partner_attribution_reason?: string | null
  partner_attribution_snapshot?: Json
  payment_reminder_count?: number
  payment_reminder_last_at?: string | null
  created_at?: string
  updated_at?: string
  requested_container_type?: ContainerType | null
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  partner_ref?: string | null
}

type ReservationUpdate = Partial<ReservationInsert>

type ReservationItemRow = {
  id: string
  reservation_id: string
  product_id: string
  sku: string
  product_name: string
  category: string
  variant_id: string
  variant_name: string
  quantity: number
  unit_price_ht: number
  unit_eco_contribution: number
  subtotal_ht: number
  eco_contribution_total: number
  cbm_total: number
  product_snapshot: Json
  created_at: string
}

type ReservationItemInsert = {
  id?: string
  reservation_id: string
  product_id: string
  sku: string
  product_name: string
  category: string
  variant_id: string
  variant_name: string
  quantity: number
  unit_price_ht: number
  unit_eco_contribution?: number
  subtotal_ht: number
  eco_contribution_total?: number
  cbm_total: number
  product_snapshot: Json
  created_at?: string
}

type ReservationItemUpdate = Partial<ReservationItemInsert>

type StockLineRow = {
  id: string
  product_id: string
  variant_id: string
  available_units: number
  reserved_units: number
  stock_price_ht: number
  location: string
  ready_label: string
  condition: StockCondition
  priority: number
  note: string
  is_active: boolean
  created_at: string
  updated_at: string
  image_url: string | null
  image_urls: string[]
}

type StockLineInsert = {
  id: string
  product_id: string
  variant_id: string
  available_units?: number
  reserved_units?: number
  stock_price_ht: number
  location: string
  ready_label?: string
  condition?: StockCondition
  priority?: number
  note?: string
  is_active?: boolean
  created_at?: string
  updated_at?: string
  image_url?: string | null
  image_urls?: string[]
}

type StockLineUpdate = Partial<StockLineInsert>

type StockRequestRow = {
  id: string
  status: StockRequestStatus
  stock_line_id: string
  product_id: string
  sku: string
  product_name: string
  variant_id: string
  variant_name: string
  requested_quantity: number
  available_units_snapshot: number
  unit_price_ht: number
  estimated_total_ht: number
  company_name: string
  contact_email: string
  contact_phone: string
  location: string
  customer_note: string | null
  internal_note: string | null
  product_snapshot: Json
  source: string
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  partner_ref: string | null
  created_at: string
  updated_at: string
}

type StockRequestInsert = {
  id?: string
  status?: StockRequestStatus
  stock_line_id: string
  product_id: string
  sku: string
  product_name: string
  variant_id: string
  variant_name: string
  requested_quantity: number
  available_units_snapshot: number
  unit_price_ht: number
  estimated_total_ht: number
  company_name: string
  contact_email: string
  contact_phone: string
  location: string
  customer_note?: string | null
  internal_note?: string | null
  product_snapshot: Json
  source?: string
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  partner_ref?: string | null
  created_at?: string
  updated_at?: string
}

type StockRequestUpdate = Partial<StockRequestInsert>

type PartnerApplicationRow = {
  id: string
  status: PartnerApplicationStatus
  partner_kind: PartnerKind
  company_name: string
  contact_name: string
  contact_email: string
  contact_phone: string
  siret: string | null
  website: string | null
  partner_referral_slug: string | null
  territory: string | null
  network_description: string | null
  expected_monthly_volume: string | null
  message: string | null
  source: string
  internal_note: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
  // Extension fusion (migration partner_applications_extend) — champs de la
  // page /partenaires mockup + attribution first-touch.
  activity_profile: string | null
  target_status: PartnerTargetStatus | null
  siret_verified: boolean
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  partner_ref: string | null
}

type PartnerApplicationInsert = {
  id?: string
  status?: PartnerApplicationStatus
  partner_kind?: PartnerKind
  company_name: string
  contact_name: string
  contact_email: string
  contact_phone: string
  siret?: string | null
  website?: string | null
  partner_referral_slug?: string | null
  territory?: string | null
  network_description?: string | null
  expected_monthly_volume?: string | null
  message?: string | null
  source?: string
  internal_note?: string | null
  reviewed_by?: string | null
  reviewed_at?: string | null
  created_at?: string
  updated_at?: string
  activity_profile?: string | null
  target_status?: PartnerTargetStatus | null
  siret_verified?: boolean
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  partner_ref?: string | null
}

type PartnerApplicationUpdate = Partial<PartnerApplicationInsert>

type PartnerDealRow = {
  id: string
  application_id: string | null
  status: PartnerDealStatus
  partner_company_name: string
  partner_contact_email: string
  partner_referral_slug: string | null
  client_company_name: string
  client_siret: string | null
  client_email: string | null
  project_city: string | null
  project_type: string
  expected_budget_ht: number | null
  expected_purchase_window: string | null
  product_interest: string | null
  protection_days: number
  protected_until: string | null
  message: string | null
  source: string
  internal_note: string | null
  created_at: string
  updated_at: string
}

type PartnerDealInsert = {
  id?: string
  application_id?: string | null
  status?: PartnerDealStatus
  partner_company_name: string
  partner_contact_email: string
  partner_referral_slug?: string | null
  client_company_name: string
  client_siret?: string | null
  client_email?: string | null
  project_city?: string | null
  project_type: string
  expected_budget_ht?: number | null
  expected_purchase_window?: string | null
  product_interest?: string | null
  protection_days?: number
  protected_until?: string | null
  message?: string | null
  source?: string
  internal_note?: string | null
  created_at?: string
  updated_at?: string
}

type PartnerDealUpdate = Partial<PartnerDealInsert>

type ContainerRow = {
  id: string
  reference: string
  port: string
  capacity_cbm: number
  threshold_percent: number
  min_series_required: number
  expected_close_at: string | null
  status: ContainerStatus
  delivered_at: string | null
  planned_days: number | null
  actual_days: number | null
  photo_url: string | null
  testimonial_quote: string | null
  testimonial_author: string | null
  testimonial_location: string | null
  testimonial_rating: number | null
  created_at: string
  updated_at: string
  display_series_target: number
  display_pros_count: number
  display_items_count: number
  slug: string | null
  origin_port: string | null
  total_items: number | null
  professionals_served: number | null
  savings_total_eur: number | null
  savings_percent: number | null
  story: string | null
  certifications: Json
  timeline: Json
  product_breakdown: Json
  gallery: Json
  testimonial_long_quote: string | null
  testimonial_role: string | null
  published_at: string | null
  container_type: ContainerType
}

type ContainerInsert = {
  id?: string
  reference: string
  port: string
  capacity_cbm: number
  threshold_percent?: number
  min_series_required?: number
  expected_close_at?: string | null
  status?: ContainerStatus
  delivered_at?: string | null
  planned_days?: number | null
  actual_days?: number | null
  photo_url?: string | null
  testimonial_quote?: string | null
  testimonial_author?: string | null
  testimonial_location?: string | null
  testimonial_rating?: number | null
  created_at?: string
  updated_at?: string
  display_series_target?: number
  display_pros_count?: number
  display_items_count?: number
  slug?: string | null
  origin_port?: string | null
  total_items?: number | null
  professionals_served?: number | null
  savings_total_eur?: number | null
  savings_percent?: number | null
  story?: string | null
  certifications?: Json
  timeline?: Json
  product_breakdown?: Json
  gallery?: Json
  testimonial_long_quote?: string | null
  testimonial_role?: string | null
  published_at?: string | null
  container_type?: ContainerType
}

type ContainerUpdate = Partial<ContainerInsert>

type QualityReportRow = {
  id: string
  container_id: string | null
  organization: QualityReportOrganization
  report_type: QualityReportType
  reference_number: string
  issued_at: string
  product_categories: string[]
  title: string
  summary: string | null
  highlights: Json
  file_path: string | null
  file_size_bytes: number | null
  file_mime: string | null
  preview_image_url: string | null
  is_active: boolean
  published_at: string | null
  created_at: string
  updated_at: string
}

type QualityReportInsert = {
  id?: string
  container_id?: string | null
  organization: QualityReportOrganization
  report_type: QualityReportType
  reference_number: string
  issued_at: string
  product_categories?: string[]
  title: string
  summary?: string | null
  highlights?: Json
  file_path?: string | null
  file_size_bytes?: number | null
  file_mime?: string | null
  preview_image_url?: string | null
  is_active?: boolean
  published_at?: string | null
  created_at?: string
  updated_at?: string
}

type QualityReportUpdate = Partial<QualityReportInsert>

type ProductRow = {
  id: string
  sku: string
  category: ProductCategoryDb
  name: string
  description: string
  dim_length_cm: number
  dim_width_cm: number
  dim_height_cm: number
  cbm_per_unit: number
  weight_kg: number
  moq_units: number
  base_price_ht: number
  retail_price_ref: number
  eco_contribution: number
  main_image_url: string
  gallery_urls: string[]
  features: string[]
  fire_rating: FireRatingDb | null
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

type ProductInsert = {
  id: string
  sku: string
  category: ProductCategoryDb
  name: string
  description: string
  dim_length_cm: number
  dim_width_cm: number
  dim_height_cm: number
  cbm_per_unit: number
  weight_kg: number
  moq_units: number
  base_price_ht: number
  retail_price_ref: number
  eco_contribution?: number
  main_image_url: string
  gallery_urls?: string[]
  features?: string[]
  fire_rating?: FireRatingDb | null
  is_active?: boolean
  sort_order?: number
  created_at?: string
  updated_at?: string
}

type ProductUpdate = Partial<ProductInsert>

type ProductVariantRow = {
  id: string
  product_id: string
  name: string
  image_url: string | null
  gallery_urls: string[]
  sort_order: number
  created_at: string
}

type ProductVariantInsert = {
  id: string
  product_id: string
  name: string
  image_url?: string | null
  gallery_urls?: string[]
  sort_order?: number
  created_at?: string
}

type ProductVariantUpdate = Partial<ProductVariantInsert>

type ContainerSeedCommitmentRow = {
  container_id: string
  variant_id: string
  units_committed: number
}

type ContainerSeedCommitmentInsert = {
  container_id: string
  variant_id: string
  units_committed: number
}

type ContainerSeedCommitmentUpdate = Partial<ContainerSeedCommitmentInsert>

type CarrierPartnerRow = {
  id: string
  slug: string
  name: string
  specialty: CarrierSpecialtyDb
  specialty_label: string
  summary: string
  strengths: Json
  coverage: string
  indicative_pricing: string | null
  contact_phone: string | null
  contact_email: string | null
  contact_website: string | null
  source: 'partenaire-direct' | 'plateforme-publique'
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

type CarrierPartnerInsert = {
  id?: string
  slug: string
  name: string
  specialty: CarrierSpecialtyDb
  specialty_label: string
  summary: string
  strengths?: Json
  coverage: string
  indicative_pricing?: string | null
  contact_phone?: string | null
  contact_email?: string | null
  contact_website?: string | null
  source?: 'partenaire-direct' | 'plateforme-publique'
  sort_order?: number
  is_active?: boolean
  created_at?: string
  updated_at?: string
}

type CarrierPartnerUpdate = Partial<CarrierPartnerInsert>

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: CompanyRow
        Insert: CompanyInsert
        Update: CompanyUpdate
      }
      users_profile: {
        Row: UserProfileRow
        Insert: UserProfileInsert
        Update: UserProfileUpdate
      }
      security_events: {
        Row: SecurityEventRow
        Insert: SecurityEventInsert
        Update: SecurityEventUpdate
      }
      siret_cache: {
        Row: SiretCacheRow
        Insert: SiretCacheInsert
        Update: SiretCacheUpdate
      }
      reservations: {
        Row: ReservationRow
        Insert: ReservationInsert
        Update: ReservationUpdate
      }
      partner_codes: {
        Row: PartnerCodeRow
        Insert: PartnerCodeInsert
        Update: PartnerCodeUpdate
      }
      commission_ledger: {
        Row: CommissionLedgerRow
        Insert: CommissionLedgerInsert
        Update: CommissionLedgerUpdate
      }
      reservation_items: {
        Row: ReservationItemRow
        Insert: ReservationItemInsert
        Update: ReservationItemUpdate
      }
      stock_requests: {
        Row: StockRequestRow
        Insert: StockRequestInsert
        Update: StockRequestUpdate
      }
      stock_lines: {
        Row: StockLineRow
        Insert: StockLineInsert
        Update: StockLineUpdate
      }
      partner_applications: {
        Row: PartnerApplicationRow
        Insert: PartnerApplicationInsert
        Update: PartnerApplicationUpdate
      }
      partner_deals: {
        Row: PartnerDealRow
        Insert: PartnerDealInsert
        Update: PartnerDealUpdate
      }
      containers: {
        Row: ContainerRow
        Insert: ContainerInsert
        Update: ContainerUpdate
      }
      quality_reports: {
        Row: QualityReportRow
        Insert: QualityReportInsert
        Update: QualityReportUpdate
      }
      products: {
        Row: ProductRow
        Insert: ProductInsert
        Update: ProductUpdate
      }
      product_variants: {
        Row: ProductVariantRow
        Insert: ProductVariantInsert
        Update: ProductVariantUpdate
      }
      container_seed_commitments: {
        Row: ContainerSeedCommitmentRow
        Insert: ContainerSeedCommitmentInsert
        Update: ContainerSeedCommitmentUpdate
      }
      carrier_partners: {
        Row: CarrierPartnerRow
        Insert: CarrierPartnerInsert
        Update: CarrierPartnerUpdate
      }
      channel_coefficients: {
        Row: ChannelCoefficientRow
        Insert: ChannelCoefficientInsert
        Update: ChannelCoefficientUpdate
      }
      channel_price_overrides: {
        Row: ChannelPriceOverrideRow
        Insert: ChannelPriceOverrideInsert
        Update: ChannelPriceOverrideUpdate
      }
    }
    Views: Record<string, never>
    Functions: {
      current_company_id: {
        Args: Record<string, never>
        Returns: string | null
      }
      current_user_role: {
        Args: Record<string, never>
        Returns: UserRole | null
      }
      is_admin: {
        Args: Record<string, never>
        Returns: boolean
      }
      is_partner: {
        Args: Record<string, never>
        Returns: boolean
      }
      current_partner_application_ids: {
        Args: Record<string, never>
        Returns: string[]
      }
      claim_partner_access: {
        Args: Record<string, never>
        Returns: string[]
      }
      admin_save_product_full: {
        Args: { payload: Json }
        Returns: void
      }
      create_reservation_with_items: {
        Args: { payload: Json }
        Returns: Json
      }
      get_catalogue_prices: {
        Args: Record<string, never>
        Returns: ReadonlyArray<{
          product_id: string
          unit_price_ht: number
        }>
      }
      current_channel: {
        Args: Record<string, never>
        Returns: SalesChannel | null
      }
      find_partner_protected_deal: {
        Args: {
          p_client_siret: string | null
          p_client_email: string | null
          p_now?: string
        }
        Returns: ReadonlyArray<{
          deal_id: string
          partner_company_name: string
          partner_contact_email: string
          reason: string
          matched_value: string
          protected_until: string
        }>
      }
      find_partner_link_attribution: {
        Args: {
          p_partner_slug: string | null
          p_now?: string
        }
        Returns: ReadonlyArray<{
          partner_application_id: string | null
          deal_id: string | null
          partner_company_name: string
          partner_contact_email: string
          reason: string
          matched_value: string
          protected_until: string | null
        }>
      }
    }
    Enums: {
      user_role: UserRole
      delivery_mode: DeliveryMode
      reservation_status: ReservationStatus
      stock_request_status: StockRequestStatus
      partner_application_status: PartnerApplicationStatus
      partner_kind: PartnerKind
      partner_deal_status: PartnerDealStatus
      security_event_type: SecurityEventType
      container_status: ContainerStatus
      quality_report_organization: QualityReportOrganization
      quality_report_type: QualityReportType
      product_category: ProductCategoryDb
      fire_rating: FireRatingDb
      carrier_specialty: CarrierSpecialtyDb
    }
    CompositeTypes: Record<string, never>
  }
}
