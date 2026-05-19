// ============================================================
// Admin — CRUD catalogue + containers, vue admin sur réservations
// Tous les writes passent par RLS via la function is_admin()
// (cf. supabase/migrations/0006_admin_role_and_past_items.sql).
// ============================================================

import { useMemo } from "react";
import { supabase } from "./supabase";
import { useProfessional } from "./auth";
import type { Database } from "./database.types";

export type ProductRow = Database["public"]["Tables"]["products"]["Row"];
export type ProductVariantRow = Database["public"]["Tables"]["product_variants"]["Row"];
export type ContainerRow = Database["public"]["Tables"]["containers"]["Row"];

// ----------------------------------------------------------------
// Hook : suis-je admin ?
// ----------------------------------------------------------------

export function useIsAdmin(): {
  isAdmin: boolean;
  isLoading: boolean;
} {
  const proQuery = useProfessional();
  return useMemo(
    () => ({
      isAdmin: !!proQuery.data?.is_admin,
      isLoading: proQuery.isLoading,
    }),
    [proQuery.data, proQuery.isLoading],
  );
}

// ----------------------------------------------------------------
// Query keys
// ----------------------------------------------------------------

export const adminKeys = {
  allProducts: ["admin", "products"] as const,
  allContainers: ["admin", "containers"] as const,
  allReservations: ["admin", "reservations"] as const,
  dashboardStats: ["admin", "dashboard-stats"] as const,
};

// ----------------------------------------------------------------
// Products
// ----------------------------------------------------------------

export interface ProductWithVariants extends ProductRow {
  variants: ProductVariantRow[];
}

export async function fetchAllProductsAdmin(): Promise<ProductWithVariants[]> {
  const [productsRes, variantsRes] = await Promise.all([
    supabase.from("products").select("*").order("sort_order", { ascending: true }),
    supabase.from("product_variants").select("*").order("sort_order", { ascending: true }),
  ]);

  if (productsRes.error) throw productsRes.error;
  if (variantsRes.error) throw variantsRes.error;

  const byProduct = new Map<string, ProductVariantRow[]>();
  for (const v of variantsRes.data ?? []) {
    const list = byProduct.get(v.product_id) ?? [];
    list.push(v);
    byProduct.set(v.product_id, list);
  }

  return (productsRes.data ?? []).map((p) => ({
    ...p,
    variants: byProduct.get(p.id) ?? [],
  }));
}

export interface ProductUpdateInput {
  name?: string;
  description?: string;
  base_price_ht?: number;
  retail_price_ref?: number;
  eco_contribution?: number;
  moq_units?: number;
  is_active?: boolean;
  sort_order?: number;
  main_image_url?: string;
}

export async function updateProductAdmin(productId: string, patch: ProductUpdateInput) {
  const { error } = await supabase.from("products").update(patch).eq("id", productId);
  if (error) throw error;
}

// ----------------------------------------------------------------
// Containers
// ----------------------------------------------------------------

export async function fetchAllContainersAdmin(): Promise<ContainerRow[]> {
  const { data, error } = await supabase
    .from("containers")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export interface ContainerUpdateInput {
  reference?: string;
  port?: string;
  capacity_cbm?: number;
  threshold_percent?: number;
  min_series_required?: number;
  expected_close_at?: string | null;
  status?: ContainerRow["status"];
  delivered_at?: string | null;
  planned_days?: number | null;
  actual_days?: number | null;
  photo_url?: string | null;
  testimonial_quote?: string | null;
  testimonial_author?: string | null;
  testimonial_location?: string | null;
  testimonial_rating?: number | null;
  display_series_target?: number;
  display_pros_count?: number;
  display_items_count?: number;
}

export async function updateContainerAdmin(containerId: string, patch: ContainerUpdateInput) {
  const { error } = await supabase.from("containers").update(patch).eq("id", containerId);
  if (error) throw error;
}

// ----------------------------------------------------------------
// Stats globales pour le dashboard admin
// ----------------------------------------------------------------

export interface AdminDashboardStats {
  productsCount: number;
  variantsCount: number;
  containersOpen: number;
  containersDelivered: number;
  totalReservations: number;
  pendingReservations: number;
  totalProfessionals: number;
}

export async function fetchAdminDashboardStats(): Promise<AdminDashboardStats> {
  const [products, variants, open, delivered, total, pending, pros] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }),
    supabase.from("product_variants").select("id", { count: "exact", head: true }),
    supabase.from("containers").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase
      .from("containers")
      .select("id", { count: "exact", head: true })
      .eq("status", "delivered"),
    supabase.from("container_reservations").select("id", { count: "exact", head: true }),
    supabase
      .from("container_reservations")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending_payment"),
    supabase.from("professionals").select("id", { count: "exact", head: true }),
  ]);

  return {
    productsCount: products.count ?? 0,
    variantsCount: variants.count ?? 0,
    containersOpen: open.count ?? 0,
    containersDelivered: delivered.count ?? 0,
    totalReservations: total.count ?? 0,
    pendingReservations: pending.count ?? 0,
    totalProfessionals: pros.count ?? 0,
  };
}
