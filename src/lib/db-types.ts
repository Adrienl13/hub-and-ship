export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      container_reservation_items: {
        Row: {
          cbm_per_unit: number;
          created_at: string;
          eco_contribution_unit: number;
          id: string;
          product_id: string;
          quantity: number;
          reservation_id: string;
          unit_price_ht: number;
          variant_id: string;
        };
        Insert: {
          cbm_per_unit: number;
          created_at?: string;
          eco_contribution_unit?: number;
          id?: string;
          product_id: string;
          quantity: number;
          reservation_id: string;
          unit_price_ht: number;
          variant_id: string;
        };
        Update: {
          cbm_per_unit?: number;
          created_at?: string;
          eco_contribution_unit?: number;
          id?: string;
          product_id?: string;
          quantity?: number;
          reservation_id?: string;
          unit_price_ht?: number;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "container_reservation_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "container_reservation_items_reservation_id_fkey";
            columns: ["reservation_id"];
            isOneToOne: false;
            referencedRelation: "container_reservations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "container_reservation_items_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      container_reservations: {
        Row: {
          cancelled_at: string | null;
          confirmed_at: string | null;
          container_id: string;
          created_at: string;
          delivery_zip: string | null;
          eco_contribution_total: number;
          id: string;
          notes: string | null;
          paid_balance_at: string | null;
          paid_deposit_at: string | null;
          paid_reservation_at: string | null;
          professional_id: string;
          reservation_fee: number;
          status: Database["public"]["Enums"]["reservation_status"];
          subtotal_ht: number;
        };
        Insert: {
          cancelled_at?: string | null;
          confirmed_at?: string | null;
          container_id: string;
          created_at?: string;
          delivery_zip?: string | null;
          eco_contribution_total?: number;
          id?: string;
          notes?: string | null;
          paid_balance_at?: string | null;
          paid_deposit_at?: string | null;
          paid_reservation_at?: string | null;
          professional_id: string;
          reservation_fee: number;
          status?: Database["public"]["Enums"]["reservation_status"];
          subtotal_ht: number;
        };
        Update: {
          cancelled_at?: string | null;
          confirmed_at?: string | null;
          container_id?: string;
          created_at?: string;
          delivery_zip?: string | null;
          eco_contribution_total?: number;
          id?: string;
          notes?: string | null;
          paid_balance_at?: string | null;
          paid_deposit_at?: string | null;
          paid_reservation_at?: string | null;
          professional_id?: string;
          reservation_fee?: number;
          status?: Database["public"]["Enums"]["reservation_status"];
          subtotal_ht?: number;
        };
        Relationships: [
          {
            foreignKeyName: "container_reservations_container_id_fkey";
            columns: ["container_id"];
            isOneToOne: false;
            referencedRelation: "containers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "container_reservations_professional_id_fkey";
            columns: ["professional_id"];
            isOneToOne: false;
            referencedRelation: "professionals";
            referencedColumns: ["id"];
          },
        ];
      };
      container_seed_commitments: {
        Row: {
          container_id: string;
          units_committed: number;
          variant_id: string;
        };
        Insert: {
          container_id: string;
          units_committed: number;
          variant_id: string;
        };
        Update: {
          container_id?: string;
          units_committed?: number;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "container_seed_commitments_container_id_fkey";
            columns: ["container_id"];
            isOneToOne: false;
            referencedRelation: "containers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "container_seed_commitments_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      containers: {
        Row: {
          actual_days: number | null;
          capacity_cbm: number;
          created_at: string;
          delivered_at: string | null;
          display_items_count: number;
          display_pros_count: number;
          display_series_target: number;
          expected_close_at: string | null;
          id: string;
          min_series_required: number;
          photo_url: string | null;
          planned_days: number | null;
          port: string;
          reference: string;
          status: Database["public"]["Enums"]["container_status"];
          testimonial_author: string | null;
          testimonial_location: string | null;
          testimonial_quote: string | null;
          testimonial_rating: number | null;
          threshold_percent: number;
          updated_at: string;
        };
        Insert: {
          actual_days?: number | null;
          capacity_cbm: number;
          created_at?: string;
          delivered_at?: string | null;
          display_items_count?: number;
          display_pros_count?: number;
          display_series_target?: number;
          expected_close_at?: string | null;
          id?: string;
          min_series_required?: number;
          photo_url?: string | null;
          planned_days?: number | null;
          port: string;
          reference: string;
          status?: Database["public"]["Enums"]["container_status"];
          testimonial_author?: string | null;
          testimonial_location?: string | null;
          testimonial_quote?: string | null;
          testimonial_rating?: number | null;
          threshold_percent?: number;
          updated_at?: string;
        };
        Update: {
          actual_days?: number | null;
          capacity_cbm?: number;
          created_at?: string;
          delivered_at?: string | null;
          display_items_count?: number;
          display_pros_count?: number;
          display_series_target?: number;
          expected_close_at?: string | null;
          id?: string;
          min_series_required?: number;
          photo_url?: string | null;
          planned_days?: number | null;
          port?: string;
          reference?: string;
          status?: Database["public"]["Enums"]["container_status"];
          testimonial_author?: string | null;
          testimonial_location?: string | null;
          testimonial_quote?: string | null;
          testimonial_rating?: number | null;
          threshold_percent?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      product_variants: {
        Row: {
          created_at: string;
          hex: string;
          id: string;
          image_url: string | null;
          name: string;
          product_id: string;
          sort_order: number;
        };
        Insert: {
          created_at?: string;
          hex: string;
          id: string;
          image_url?: string | null;
          name: string;
          product_id: string;
          sort_order?: number;
        };
        Update: {
          created_at?: string;
          hex?: string;
          id?: string;
          image_url?: string | null;
          name?: string;
          product_id?: string;
          sort_order?: number;
        };
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
      products: {
        Row: {
          base_price_ht: number;
          category: Database["public"]["Enums"]["product_category"];
          cbm_per_unit: number;
          created_at: string;
          description: string;
          dim_height_cm: number;
          dim_length_cm: number;
          dim_width_cm: number;
          eco_contribution: number;
          features: string[];
          fire_rating: Database["public"]["Enums"]["fire_rating"] | null;
          gallery_urls: string[];
          id: string;
          is_active: boolean;
          main_image_url: string;
          moq_units: number;
          name: string;
          retail_price_ref: number;
          sku: string;
          sort_order: number;
          updated_at: string;
          weight_kg: number;
        };
        Insert: {
          base_price_ht: number;
          category: Database["public"]["Enums"]["product_category"];
          cbm_per_unit: number;
          created_at?: string;
          description: string;
          dim_height_cm: number;
          dim_length_cm: number;
          dim_width_cm: number;
          eco_contribution?: number;
          features?: string[];
          fire_rating?: Database["public"]["Enums"]["fire_rating"] | null;
          gallery_urls?: string[];
          id: string;
          is_active?: boolean;
          main_image_url: string;
          moq_units: number;
          name: string;
          retail_price_ref: number;
          sku: string;
          sort_order?: number;
          updated_at?: string;
          weight_kg: number;
        };
        Update: {
          base_price_ht?: number;
          category?: Database["public"]["Enums"]["product_category"];
          cbm_per_unit?: number;
          created_at?: string;
          description?: string;
          dim_height_cm?: number;
          dim_length_cm?: number;
          dim_width_cm?: number;
          eco_contribution?: number;
          features?: string[];
          fire_rating?: Database["public"]["Enums"]["fire_rating"] | null;
          gallery_urls?: string[];
          id?: string;
          is_active?: boolean;
          main_image_url?: string;
          moq_units?: number;
          name?: string;
          retail_price_ref?: number;
          sku?: string;
          sort_order?: number;
          updated_at?: string;
          weight_kg?: number;
        };
        Relationships: [];
      };
      professionals: {
        Row: {
          company_name: string;
          contact_name: string;
          created_at: string;
          delivery_zip: string | null;
          email: string;
          id: string;
          is_admin: boolean;
          phone: string;
          siret: string;
          updated_at: string;
        };
        Insert: {
          company_name: string;
          contact_name: string;
          created_at?: string;
          delivery_zip?: string | null;
          email: string;
          id: string;
          is_admin?: boolean;
          phone: string;
          siret: string;
          updated_at?: string;
        };
        Update: {
          company_name?: string;
          contact_name?: string;
          created_at?: string;
          delivery_zip?: string | null;
          email?: string;
          id?: string;
          is_admin?: boolean;
          phone?: string;
          siret?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      reservation_items: {
        Row: {
          cbm_per_unit: number;
          created_at: string;
          eco_contribution_cents: number;
          id: string;
          product_name: string;
          product_sku: string;
          quantity: number;
          reservation_id: string;
          unit_price_ht_cents: number;
          variant_hex: string;
          variant_id: string;
          variant_name: string;
        };
        Insert: {
          cbm_per_unit: number;
          created_at?: string;
          eco_contribution_cents?: number;
          id?: string;
          product_name: string;
          product_sku: string;
          quantity: number;
          reservation_id: string;
          unit_price_ht_cents: number;
          variant_hex: string;
          variant_id: string;
          variant_name: string;
        };
        Update: {
          cbm_per_unit?: number;
          created_at?: string;
          eco_contribution_cents?: number;
          id?: string;
          product_name?: string;
          product_sku?: string;
          quantity?: number;
          reservation_id?: string;
          unit_price_ht_cents?: number;
          variant_hex?: string;
          variant_id?: string;
          variant_name?: string;
        };
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
      reservations: {
        Row: {
          company: string;
          container_reference: string;
          created_at: string;
          email: string;
          id: string;
          metadata: Json;
          name: string;
          phone: string;
          reservation_fee_cents: number;
          siret: string | null;
          status: string;
          stripe_customer_id: string | null;
          stripe_payment_intent_id: string | null;
          subtotal_ht_cents: number;
          total_units: number;
          updated_at: string;
          used_cbm: number;
          zip: string | null;
        };
        Insert: {
          company: string;
          container_reference: string;
          created_at?: string;
          email: string;
          id?: string;
          metadata?: Json;
          name: string;
          phone: string;
          reservation_fee_cents: number;
          siret?: string | null;
          status?: string;
          stripe_customer_id?: string | null;
          stripe_payment_intent_id?: string | null;
          subtotal_ht_cents: number;
          total_units?: number;
          updated_at?: string;
          used_cbm?: number;
          zip?: string | null;
        };
        Update: {
          company?: string;
          container_reference?: string;
          created_at?: string;
          email?: string;
          id?: string;
          metadata?: Json;
          name?: string;
          phone?: string;
          reservation_fee_cents?: number;
          siret?: string | null;
          status?: string;
          stripe_customer_id?: string | null;
          stripe_payment_intent_id?: string | null;
          subtotal_ht_cents?: number;
          total_units?: number;
          updated_at?: string;
          used_cbm?: number;
          zip?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      container_variant_commitments: {
        Row: {
          cbm_committed: number | null;
          container_id: string | null;
          units_committed: number | null;
          variant_id: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      is_admin: { Args: never; Returns: boolean };
    };
    Enums: {
      container_status: "open" | "locked" | "shipping" | "delivered" | "cancelled";
      fire_rating: "M1" | "M2";
      product_category: "chair" | "armchair" | "table" | "bench";
      reservation_status: "pending_payment" | "confirmed" | "cancelled";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      container_status: ["open", "locked", "shipping", "delivered", "cancelled"],
      fire_rating: ["M1", "M2"],
      product_category: ["chair", "armchair", "table", "bench"],
      reservation_status: ["pending_payment", "confirmed", "cancelled"],
    },
  },
} as const;
