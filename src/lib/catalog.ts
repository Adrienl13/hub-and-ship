// ============================================================
// Catalog — fetchers Supabase + mapping vers les types du front
// ============================================================

import { supabase } from "./supabase";
import type { ColorVariant, Product, ProductCategory } from "./products";

// ----------------------------------------------------------------
// Types exposés au front
// ----------------------------------------------------------------

export interface Container {
  id: string;
  reference: string;
  port: string;
  capacityCbm: number;
  thresholdPercent: number;
  minSeriesRequired: number;
  expectedCloseAt: string | null;
  status: "open" | "locked" | "shipping" | "delivered" | "cancelled";
  deliveredAt: string | null;
  plannedDays: number | null;
  actualDays: number | null;
  photoUrl: string | null;
  testimonial: {
    quote: string;
    author: string;
    location: string;
    rating: number;
  } | null;
  /** Seuil cible affiché (marketing) */
  totalSeries: number;
  /** Séries atteintes : variantes ayant atteint leur MOQ */
  seriesReached: number;
  /** Pros engagés (réel + override social proof) */
  professionalsEngaged: number;
  /** Total articles livrés (utilisé pour containers passés) */
  totalItems: number;
}

// ----------------------------------------------------------------
// Query keys
// ----------------------------------------------------------------

export const catalogKeys = {
  currentContainer: ["catalog", "current-container"] as const,
  pastContainers: ["catalog", "past-containers"] as const,
  products: (containerId: string | undefined) => ["catalog", "products", containerId] as const,
  containerByRef: (ref: string) => ["catalog", "container-by-ref", ref] as const,
  containerLineup: (containerId: string) => ["catalog", "container-lineup", containerId] as const,
};

export interface ContainerLineupItem {
  productId: string;
  productName: string;
  productCategory: ProductCategory;
  variantId: string;
  variantName: string;
  variantHex: string;
  unitsCommitted: number;
  cbmTotal: number;
}

// ----------------------------------------------------------------
// Fetchers
// ----------------------------------------------------------------

/** Container actuellement ouvert (statut = 'open'). */
export async function fetchCurrentContainer(): Promise<Container> {
  const { data, error } = await supabase
    .from("containers")
    .select("*")
    .eq("status", "open")
    .order("expected_close_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Aucun container ouvert pour le moment.");

  const stats = await fetchContainerStats(data.id);
  return mapContainer(data, stats);
}

/** Tous les containers livrés (ordre desc par date de livraison). */
export async function fetchPastContainers(): Promise<Container[]> {
  const { data, error } = await supabase
    .from("containers")
    .select("*")
    .eq("status", "delivered")
    .order("delivered_at", { ascending: false });

  if (error) throw error;

  const enriched = await Promise.all(
    (data ?? []).map(async (row) => {
      const stats = await fetchContainerStats(row.id);
      return mapContainer(row, stats);
    }),
  );
  return enriched;
}

/**
 * Produits + variantes pour le catalogue, avec compteur unitsCommitted
 * issu de la vue agrégée pour le container ciblé.
 */
export async function fetchProductsWithCommitments(containerId: string): Promise<Product[]> {
  const [{ data: products, error: pErr }, { data: variants, error: vErr }, commitments] =
    await Promise.all([
      supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      supabase.from("product_variants").select("*").order("sort_order", { ascending: true }),
      fetchVariantCommitmentsMap(containerId),
    ]);

  if (pErr) throw pErr;
  if (vErr) throw vErr;

  const variantsByProduct = new Map<string, ColorVariant[]>();
  for (const v of variants ?? []) {
    const enriched: ColorVariant = {
      id: v.id,
      name: v.name,
      hex: v.hex,
      imageUrl: v.image_url ?? undefined,
      unitsCommitted: commitments.get(v.id) ?? 0,
    };
    const list = variantsByProduct.get(v.product_id);
    if (list) list.push(enriched);
    else variantsByProduct.set(v.product_id, [enriched]);
  }

  return (products ?? []).map((p) => ({
    id: p.id,
    sku: p.sku,
    category: p.category as ProductCategory,
    name: p.name,
    description: p.description,
    dimensions: {
      l: p.dim_length_cm,
      w: p.dim_width_cm,
      h: p.dim_height_cm,
    },
    cbmPerUnit: Number(p.cbm_per_unit),
    weightKg: Number(p.weight_kg),
    moqUnits: p.moq_units,
    basePriceHt: Number(p.base_price_ht),
    retailPriceRef: Number(p.retail_price_ref),
    ecoContribution: Number(p.eco_contribution),
    mainImageUrl: p.main_image_url,
    galleryUrls: p.gallery_urls ?? [],
    features: p.features ?? [],
    fireRating: p.fire_rating ?? undefined,
    variants: variantsByProduct.get(p.id) ?? [],
  }));
}

// ----------------------------------------------------------------
// Helpers internes
// ----------------------------------------------------------------

async function fetchVariantCommitmentsMap(containerId: string): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from("container_variant_commitments")
    .select("variant_id, units_committed")
    .eq("container_id", containerId);

  if (error) throw error;

  const map = new Map<string, number>();
  for (const row of data ?? []) {
    map.set(row.variant_id, row.units_committed);
  }
  return map;
}

interface ContainerStats {
  seriesReached: number;
  realProsCount: number;
}

async function fetchContainerStats(containerId: string): Promise<ContainerStats> {
  const [commitments, reservations] = await Promise.all([
    supabase
      .from("container_variant_commitments")
      .select("variant_id, units_committed")
      .eq("container_id", containerId),
    supabase
      .from("container_reservations")
      .select("professional_id")
      .eq("container_id", containerId)
      .in("status", ["pending_payment", "confirmed"]),
  ]);

  if (commitments.error) throw commitments.error;
  // reservations.error peut être un 401/RLS si non-authentifié : on tolère.
  const reservationRows = reservations.data ?? [];

  // Récupère les MOQs en une requête (pour comparer aux units_committed)
  const variantIds = (commitments.data ?? []).map((r) => r.variant_id);
  let seriesReached = 0;
  if (variantIds.length > 0) {
    const { data: variantsWithMoq, error: vErr } = await supabase
      .from("product_variants")
      .select("id, products!inner(moq_units)")
      .in("id", variantIds);
    if (vErr) throw vErr;

    const moqByVariant = new Map<string, number>();
    for (const row of variantsWithMoq ?? []) {
      // Le typage strict suppose products singulier via !inner
      const moq = Array.isArray(row.products)
        ? row.products[0]?.moq_units
        : (row.products as { moq_units: number } | null)?.moq_units;
      if (moq !== undefined) moqByVariant.set(row.id, moq);
    }
    for (const c of commitments.data ?? []) {
      const moq = moqByVariant.get(c.variant_id);
      if (moq !== undefined && c.units_committed >= moq) seriesReached += 1;
    }
  }

  const realProsCount = new Set(reservationRows.map((r) => r.professional_id)).size;

  return { seriesReached, realProsCount };
}

type ContainerRow = {
  id: string;
  reference: string;
  port: string;
  capacity_cbm: number | string;
  threshold_percent: number;
  min_series_required: number;
  expected_close_at: string | null;
  status: string;
  delivered_at: string | null;
  planned_days: number | null;
  actual_days: number | null;
  photo_url: string | null;
  testimonial_quote: string | null;
  testimonial_author: string | null;
  testimonial_location: string | null;
  testimonial_rating: number | null;
  display_series_target?: number;
  display_pros_count?: number;
  display_items_count?: number;
};

function mapContainer(row: ContainerRow, stats: ContainerStats): Container {
  const testimonial =
    row.testimonial_quote &&
    row.testimonial_author &&
    row.testimonial_location &&
    row.testimonial_rating !== null
      ? {
          quote: row.testimonial_quote,
          author: row.testimonial_author,
          location: row.testimonial_location,
          rating: row.testimonial_rating,
        }
      : null;

  return {
    id: row.id,
    reference: row.reference,
    port: row.port,
    capacityCbm: Number(row.capacity_cbm),
    thresholdPercent: row.threshold_percent,
    minSeriesRequired: row.min_series_required,
    expectedCloseAt: row.expected_close_at,
    status: row.status as Container["status"],
    deliveredAt: row.delivered_at,
    plannedDays: row.planned_days,
    actualDays: row.actual_days,
    photoUrl: row.photo_url,
    testimonial,
    totalSeries: row.display_series_target ?? 5,
    seriesReached: stats.seriesReached,
    professionalsEngaged: Math.max(stats.realProsCount, row.display_pros_count ?? 0),
    totalItems: row.display_items_count ?? 0,
  };
}

// ----------------------------------------------------------------
// Container par référence (page détail publique /containers/[ref])
// ----------------------------------------------------------------

export async function fetchContainerByReference(reference: string): Promise<Container> {
  const { data, error } = await supabase
    .from("containers")
    .select("*")
    .eq("reference", reference)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Container introuvable : ${reference}`);
  const stats = await fetchContainerStats(data.id);
  return mapContainer(data, stats);
}

/**
 * Liste des variantes engagées sur un container, enrichies avec leur produit.
 * Sert à afficher "qu'est-ce qui était / sera à bord" sur la page détail.
 */
export async function fetchContainerLineup(containerId: string): Promise<ContainerLineupItem[]> {
  const { data: commitments, error: cErr } = await supabase
    .from("container_variant_commitments")
    .select("variant_id, units_committed, cbm_committed")
    .eq("container_id", containerId);
  if (cErr) throw cErr;

  const variantIds = (commitments ?? []).map((c) => c.variant_id);
  if (variantIds.length === 0) return [];

  const { data: variants, error: vErr } = await supabase
    .from("product_variants")
    .select(
      `id, name, hex, product_id,
       products!inner ( id, name, category )`,
    )
    .in("id", variantIds);
  if (vErr) throw vErr;

  type VariantWithProduct = {
    id: string;
    name: string;
    hex: string;
    product_id: string;
    products:
      | { id: string; name: string; category: string }
      | Array<{ id: string; name: string; category: string }>;
  };

  const byId = new Map<string, VariantWithProduct>();
  for (const v of (variants ?? []) as unknown as VariantWithProduct[]) {
    byId.set(v.id, v);
  }

  const lineup: ContainerLineupItem[] = [];
  for (const c of commitments ?? []) {
    const v = byId.get(c.variant_id);
    if (!v) continue;
    const product = Array.isArray(v.products) ? v.products[0] : v.products;
    if (!product) continue;
    lineup.push({
      productId: product.id,
      productName: product.name,
      productCategory: product.category as ProductCategory,
      variantId: v.id,
      variantName: v.name,
      variantHex: v.hex,
      unitsCommitted: c.units_committed,
      cbmTotal: Number(c.cbm_committed),
    });
  }

  // Tri : par catégorie puis par produit
  lineup.sort((a, b) => {
    if (a.productCategory !== b.productCategory) {
      return a.productCategory.localeCompare(b.productCategory);
    }
    if (a.productName !== b.productName) {
      return a.productName.localeCompare(b.productName);
    }
    return a.variantName.localeCompare(b.variantName);
  });

  return lineup;
}

// ----------------------------------------------------------------
// Stats agrégées : total containers livrés, pros, articles, on-time rate
// (déjà calculé côté front à partir de fetchPastContainers, mais on
// expose une fonction pure pour testabilité)
// ----------------------------------------------------------------

export interface PastContainersStats {
  totalContainers: number;
  totalProsServed: number;
  totalItems: number;
  onTimeRate: number; // 0..1
}

export function computePastContainersStats(containers: Container[]): PastContainersStats {
  if (containers.length === 0) {
    return { totalContainers: 0, totalProsServed: 0, totalItems: 0, onTimeRate: 0 };
  }
  let totalProsServed = 0;
  let totalItems = 0;
  let onTimeCount = 0;
  let measurableCount = 0;
  for (const c of containers) {
    totalProsServed += c.professionalsEngaged;
    totalItems += c.totalItems;
    if (c.plannedDays !== null && c.actualDays !== null) {
      measurableCount += 1;
      if (c.actualDays <= c.plannedDays) onTimeCount += 1;
    }
  }
  return {
    totalContainers: containers.length,
    totalProsServed,
    totalItems,
    onTimeRate: measurableCount > 0 ? onTimeCount / measurableCount : 0,
  };
}
