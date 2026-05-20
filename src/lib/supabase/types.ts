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
  created_at?: string
  updated_at?: string
}

type CompanyUpdate = Partial<CompanyInsert>

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
  created_at: string
  updated_at: string
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
  created_at?: string
  updated_at?: string
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
  created_at?: string
  updated_at?: string
}

type StockRequestUpdate = Partial<StockRequestInsert>

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
    }
    Enums: {
      user_role: UserRole
      delivery_mode: DeliveryMode
      reservation_status: ReservationStatus
      stock_request_status: StockRequestStatus
      security_event_type: SecurityEventType
    }
    CompositeTypes: Record<string, never>
  }
}
