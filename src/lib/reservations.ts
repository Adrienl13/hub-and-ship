// ============================================================
// Réservations — création + lecture des engagements d'un pro
// ============================================================

import { supabase } from "./supabase";
import type { CartItem, OrderTotals } from "./order";

// ----------------------------------------------------------------
// Query keys
// ----------------------------------------------------------------

export const reservationKeys = {
  myReservations: (proId: string | undefined) => ["reservations", "mine", proId] as const,
  detail: (reservationId: string) => ["reservations", "detail", reservationId] as const,
};

export interface CreateReservationInput {
  containerId: string;
  professionalId: string;
  items: CartItem[];
  totals: OrderTotals;
  deliveryZip?: string;
  notes?: string;
}

export async function createReservation(input: CreateReservationInput) {
  if (input.items.length === 0) {
    throw new Error("Le panier est vide.");
  }

  // 1. Crée la réservation parente
  const { data: reservation, error: rErr } = await supabase
    .from("container_reservations")
    .insert({
      container_id: input.containerId,
      professional_id: input.professionalId,
      status: "pending_payment",
      subtotal_ht: input.totals.subtotalHt,
      eco_contribution_total: input.totals.ecoContributionTotal,
      reservation_fee: input.totals.reservationFee,
      delivery_zip: input.deliveryZip ?? null,
      notes: input.notes ?? null,
    })
    .select("id")
    .single();

  if (rErr) throw rErr;

  // 2. Insère les lignes du panier (prix figés au moment de la résa)
  const rows = input.items.map((it) => ({
    reservation_id: reservation.id,
    product_id: it.product.id,
    variant_id: it.variant.id,
    quantity: it.quantity,
    unit_price_ht: it.product.basePriceHt,
    eco_contribution_unit: it.product.ecoContribution,
    cbm_per_unit: it.product.cbmPerUnit,
  }));

  const { error: iErr } = await supabase.from("container_reservation_items").insert(rows);

  if (iErr) {
    // Rollback best-effort : on annule la résa créée pour ne pas laisser
    // de réservation orpheline. Si la suppression échoue, on log.
    await supabase.from("container_reservations").delete().eq("id", reservation.id);
    throw iErr;
  }

  return reservation.id;
}

// ----------------------------------------------------------------
// Lecture
// ----------------------------------------------------------------

export interface ReservationWithItems {
  id: string;
  container_id: string;
  container_reference: string;
  container_status: string;
  container_port: string;
  status: "pending_payment" | "confirmed" | "cancelled";
  subtotal_ht: number;
  reservation_fee: number;
  eco_contribution_total: number;
  delivery_zip: string | null;
  notes: string | null;
  created_at: string;
  confirmed_at: string | null;
  items: Array<{
    id: string;
    product_id: string;
    product_name: string;
    variant_id: string;
    variant_name: string;
    variant_hex: string;
    quantity: number;
    unit_price_ht: number;
    cbm_per_unit: number;
  }>;
}

// Forme brute renvoyée par PostgREST avec les jointures (pas typée par
// nos manual types qui ne couvrent pas les Relationships chaînées).
interface RawReservationRow {
  id: string;
  container_id: string;
  status: "pending_payment" | "confirmed" | "cancelled";
  subtotal_ht: number | string;
  reservation_fee: number | string;
  eco_contribution_total: number | string;
  delivery_zip: string | null;
  notes: string | null;
  created_at: string;
  confirmed_at: string | null;
  containers:
    | { reference: string; status: string; port: string }
    | Array<{ reference: string; status: string; port: string }>;
  container_reservation_items: Array<{
    id: string;
    product_id: string;
    variant_id: string;
    quantity: number;
    unit_price_ht: number | string;
    cbm_per_unit: number | string;
    products: { name: string } | Array<{ name: string }>;
    product_variants: { name: string; hex: string } | Array<{ name: string; hex: string }>;
  }>;
}

function pickOne<T>(value: T | T[]): T | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Récupère toutes les réservations du pro courant (RLS appliquée). */
export async function fetchMyReservations(): Promise<ReservationWithItems[]> {
  const { data, error } = await supabase
    .from("container_reservations")
    .select(
      `id, status, subtotal_ht, reservation_fee, eco_contribution_total,
       delivery_zip, notes, created_at, confirmed_at, container_id,
       containers!inner ( reference, status, port ),
       container_reservation_items (
         id, product_id, variant_id, quantity, unit_price_ht, cbm_per_unit,
         products!inner ( name ),
         product_variants!inner ( name, hex )
       )`,
    )
    .order("created_at", { ascending: false });

  if (error) throw error;

  const rows = (data ?? []) as unknown as RawReservationRow[];

  return rows.map((row) => {
    const container = pickOne(row.containers);
    return {
      id: row.id,
      container_id: row.container_id,
      container_reference: container?.reference ?? "—",
      container_status: container?.status ?? "—",
      container_port: container?.port ?? "—",
      status: row.status,
      subtotal_ht: Number(row.subtotal_ht),
      reservation_fee: Number(row.reservation_fee),
      eco_contribution_total: Number(row.eco_contribution_total),
      delivery_zip: row.delivery_zip,
      notes: row.notes,
      created_at: row.created_at,
      confirmed_at: row.confirmed_at,
      items: (row.container_reservation_items ?? []).map((it) => {
        const product = pickOne(it.products);
        const variant = pickOne(it.product_variants);
        return {
          id: it.id,
          product_id: it.product_id,
          product_name: product?.name ?? "—",
          variant_id: it.variant_id,
          variant_name: variant?.name ?? "—",
          variant_hex: variant?.hex ?? "#000000",
          quantity: it.quantity,
          unit_price_ht: Number(it.unit_price_ht),
          cbm_per_unit: Number(it.cbm_per_unit),
        };
      }),
    };
  });
}
