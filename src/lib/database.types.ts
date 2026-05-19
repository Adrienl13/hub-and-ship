// ============================================================
// Types BDD générés manuellement à partir de supabase/migrations.
// À régénérer avec : npx supabase gen types typescript --linked
// quand on a accès au projet via CLI.
// ============================================================

export type ProductCategoryDb = "chair" | "armchair" | "table" | "bench";
export type FireRatingDb = "M1" | "M2";
export type ContainerStatusDb = "open" | "locked" | "shipping" | "delivered" | "cancelled";
export type ReservationStatusDb = "pending_payment" | "confirmed" | "cancelled";

export interface Database {
  public: {
    Tables: {
      professionals: {
        Row: {
          id: string;
          company_name: string;
          contact_name: string;
          email: string;
          phone: string;
          siret: string;
          delivery_zip: string | null;
          is_admin: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          company_name: string;
          contact_name: string;
          email: string;
          phone: string;
          siret: string;
          delivery_zip?: string | null;
          is_admin?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["professionals"]["Insert"]>;
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          sku: string;
          category: ProductCategoryDb;
          name: string;
          description: string;
          dim_length_cm: number;
          dim_width_cm: number;
          dim_height_cm: number;
          cbm_per_unit: number;
          weight_kg: number;
          moq_units: number;
          base_price_ht: number;
          retail_price_ref: number;
          eco_contribution: number;
          main_image_url: string;
          gallery_urls: string[];
          features: string[];
          fire_rating: FireRatingDb | null;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["products"]["Row"]> & {
          id: string;
          sku: string;
          category: ProductCategoryDb;
          name: string;
          description: string;
          dim_length_cm: number;
          dim_width_cm: number;
          dim_height_cm: number;
          cbm_per_unit: number;
          weight_kg: number;
          moq_units: number;
          base_price_ht: number;
          retail_price_ref: number;
          main_image_url: string;
        };
        Update: Partial<Database["public"]["Tables"]["products"]["Row"]>;
        Relationships: [];
      };
      product_variants: {
        Row: {
          id: string;
          product_id: string;
          name: string;
          hex: string;
          image_url: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      containers: {
        Row: {
          id: string;
          reference: string;
          port: string;
          capacity_cbm: number;
          threshold_percent: number;
          min_series_required: number;
          expected_close_at: string | null;
          status: ContainerStatusDb;
          delivered_at: string | null;
          planned_days: number | null;
          actual_days: number | null;
          photo_url: string | null;
          testimonial_quote: string | null;
          testimonial_author: string | null;
          testimonial_location: string | null;
          testimonial_rating: number | null;
          display_series_target: number;
          display_pros_count: number;
          display_items_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["containers"]["Row"]> & {
          reference: string;
          port: string;
          capacity_cbm: number;
        };
        Update: Partial<Database["public"]["Tables"]["containers"]["Row"]>;
        Relationships: [];
      };
      container_reservations: {
        Row: {
          id: string;
          container_id: string;
          professional_id: string;
          status: ReservationStatusDb;
          subtotal_ht: number;
          eco_contribution_total: number;
          reservation_fee: number;
          delivery_zip: string | null;
          notes: string | null;
          created_at: string;
          confirmed_at: string | null;
          cancelled_at: string | null;
          paid_reservation_at: string | null;
          paid_deposit_at: string | null;
          paid_balance_at: string | null;
        };
        Insert: {
          container_id: string;
          professional_id: string;
          status?: ReservationStatusDb;
          subtotal_ht: number;
          eco_contribution_total?: number;
          reservation_fee: number;
          delivery_zip?: string | null;
          notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["container_reservations"]["Insert"]>;
        Relationships: [];
      };
      container_reservation_items: {
        Row: {
          id: string;
          reservation_id: string;
          product_id: string;
          variant_id: string;
          quantity: number;
          unit_price_ht: number;
          eco_contribution_unit: number;
          cbm_per_unit: number;
          created_at: string;
        };
        Insert: {
          reservation_id: string;
          product_id: string;
          variant_id: string;
          quantity: number;
          unit_price_ht: number;
          eco_contribution_unit?: number;
          cbm_per_unit: number;
        };
        Update: Partial<Database["public"]["Tables"]["container_reservation_items"]["Insert"]>;
        Relationships: [];
      };
      container_seed_commitments: {
        Row: {
          container_id: string;
          variant_id: string;
          units_committed: number;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: {
      container_variant_commitments: {
        Row: {
          container_id: string;
          variant_id: string;
          units_committed: number;
          cbm_committed: number;
        };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: {
      product_category: ProductCategoryDb;
      fire_rating: FireRatingDb;
      container_status: ContainerStatusDb;
      reservation_status: ReservationStatusDb;
    };
    CompositeTypes: Record<string, never>;
  };
}
