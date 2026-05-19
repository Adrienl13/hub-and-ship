/**
 * Manual database types mirroring supabase/migrations/*.sql.
 *
 * Replace this file with `supabase gen types typescript --project-id
 * mkfztwibolswqcggukeq --schema public > src/lib/db-types.ts` once the
 * Supabase CLI is authenticated, or by calling the MCP tool
 * generate_typescript_types after the project-scoped MCP server is
 * authorized (cf. CLAUDE.md § Supabase).
 */

export type Database = {
  public: {
    Tables: {
      reservations: {
        Row: {
          id: string;
          container_reference: string;
          status: "pending" | "paid" | "cancelled" | "refunded" | "expired";
          name: string;
          company: string;
          email: string;
          phone: string;
          zip: string | null;
          siret: string | null;
          subtotal_ht_cents: number;
          reservation_fee_cents: number;
          total_units: number;
          used_cbm: number;
          stripe_payment_intent_id: string | null;
          stripe_customer_id: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          container_reference: string;
          status?: "pending" | "paid" | "cancelled" | "refunded" | "expired";
          name: string;
          company: string;
          email: string;
          phone: string;
          zip?: string | null;
          siret?: string | null;
          subtotal_ht_cents: number;
          reservation_fee_cents: number;
          total_units?: number;
          used_cbm?: number;
          stripe_payment_intent_id?: string | null;
          stripe_customer_id?: string | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reservations"]["Insert"]>;
        Relationships: [];
      };
      reservation_items: {
        Row: {
          id: string;
          reservation_id: string;
          product_sku: string;
          product_name: string;
          variant_id: string;
          variant_name: string;
          variant_hex: string;
          quantity: number;
          unit_price_ht_cents: number;
          cbm_per_unit: number;
          eco_contribution_cents: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          reservation_id: string;
          product_sku: string;
          product_name: string;
          variant_id: string;
          variant_name: string;
          variant_hex: string;
          quantity: number;
          unit_price_ht_cents: number;
          cbm_per_unit: number;
          eco_contribution_cents?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reservation_items"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "reservation_items_reservation_id_fkey";
            columns: ["reservation_id"];
            isOneToOne: false;
            referencedRelation: "reservations";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
