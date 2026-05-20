import { getSupabaseClient, isSupabaseConfigured } from "./supabase";
import type { CartItem, OrderTotals } from "./order";

export type ReservationContact = {
  name: string;
  company: string;
  email: string;
  phone: string;
  zip?: string;
  siret?: string;
};

export type CreateReservationInput = {
  containerReference: string;
  contact: ReservationContact;
  items: CartItem[];
  totals: OrderTotals;
  usedCbm: number;
};

export type CreateReservationResult =
  | { ok: true; reservationId: string }
  | { ok: false; error: string };

const toCents = (eur: number) => Math.round(eur * 100);

/**
 * Persists a reservation + its line items to Supabase. Returns the
 * reservation id so the caller can hand it to Stripe as metadata
 * before launching the payment intent.
 *
 * Falls back to a no-op when Supabase env vars are missing so the
 * front end keeps working in dev without a backend wired up.
 */
export async function createReservation(
  input: CreateReservationInput,
): Promise<CreateReservationResult> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      error: "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.",
    };
  }

  const supabase = getSupabaseClient();
  const totalUnits = input.items.reduce((s, i) => s + i.quantity, 0);

  const { data: reservation, error: insertError } = await supabase
    .from("reservations")
    .insert({
      container_reference: input.containerReference,
      status: "pending",
      name: input.contact.name.trim(),
      company: input.contact.company.trim(),
      email: input.contact.email.trim().toLowerCase(),
      phone: input.contact.phone.trim(),
      zip: input.contact.zip?.trim() || null,
      siret: input.contact.siret?.trim() || null,
      subtotal_ht_cents: toCents(input.totals.subtotalHt),
      reservation_fee_cents: toCents(input.totals.reservationFee),
      total_units: totalUnits,
      used_cbm: Number(input.usedCbm.toFixed(3)),
    })
    .select("id")
    .single();

  if (insertError || !reservation) {
    return { ok: false, error: insertError?.message ?? "Insert failed" };
  }

  const itemsPayload = input.items.map((item) => ({
    reservation_id: reservation.id,
    product_sku: item.product.sku,
    product_name: item.product.name,
    variant_id: item.variant.id,
    variant_name: item.variant.name,
    variant_hex: item.variant.hex,
    quantity: item.quantity,
    unit_price_ht_cents: toCents(item.product.basePriceHt),
    cbm_per_unit: Number(item.product.cbmPerUnit.toFixed(4)),
    eco_contribution_cents: toCents(item.product.ecoContribution),
  }));

  const { error: itemsError } = await supabase.from("reservation_items").insert(itemsPayload);

  if (itemsError) {
    // Best-effort rollback. RLS allows anon delete on rows the
    // anon role just inserted only if a policy exists — none does
    // here, so we surface the inconsistency and let the server
    // clean it up.
    return {
      ok: false,
      error: `Reservation created (id=${reservation.id}) but items insert failed: ${itemsError.message}`,
    };
  }

  return { ok: true, reservationId: reservation.id };
}
