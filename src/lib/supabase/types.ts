export type Json =
  | string
  | number
  | boolean
  | null
  | { readonly [key: string]: Json | undefined }
  | readonly Json[]

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string
          siret: string | null
          legal_name: string
          siret_verified: boolean
          created_at: string
        }
        Insert: {
          id?: string
          siret?: string | null
          legal_name: string
          siret_verified?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          siret?: string | null
          legal_name?: string
          siret_verified?: boolean
          created_at?: string
        }
      }
      users_profile: {
        Row: {
          id: string
          company_id: string | null
          email: string
          first_name: string | null
          last_name: string | null
          role: 'buyer' | 'admin' | 'super_admin'
          created_at: string
        }
        Insert: {
          id: string
          company_id?: string | null
          email: string
          first_name?: string | null
          last_name?: string | null
          role?: 'buyer' | 'admin' | 'super_admin'
          created_at?: string
        }
        Update: {
          company_id?: string | null
          email?: string
          first_name?: string | null
          last_name?: string | null
          role?: 'buyer' | 'admin' | 'super_admin'
          created_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      user_role: 'buyer' | 'admin' | 'super_admin'
    }
    CompositeTypes: Record<string, never>
  }
}
