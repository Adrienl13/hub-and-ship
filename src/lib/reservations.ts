// ============================================================
// Réservations — création d'engagement d'un pro sur un container
// ============================================================

import { supabase } from "./supabase";
import type { CartItem, OrderTotals } from "./order";

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
