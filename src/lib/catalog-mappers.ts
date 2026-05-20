// ============================================================
// Container Club — mappers Supabase row → API domaine
// ----------------------------------------------------------------
// Les rows Postgres sont en snake_case et n'embarquent pas les
// commitments. On normalise ici pour que les composants UI restent
// alignés sur les types `Product` / `ColorVariant` de
// `@/lib/products`.
// ============================================================

import type { Database } from "./db-types";
import type { ColorVariant, Product } from "./products";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type ProductVariantRow = Database["public"]["Tables"]["product_variants"]["Row"];
type ContainerRow = Database["public"]["Tables"]["containers"]["Row"];

export type CommitmentsByVariant = Record<string, number>;

export type CurrentContainer = {
  id: string;
  reference: string;
  port: string;
  capacityCbm: number;
  thresholdPercent: number;
  minSeriesRequired: number;
  expectedCloseAt: string;
  status: ContainerRow["status"];
  seriesReached: number;
  totalSeries: number;
  professionalsEngaged: number;
};

export function mapVariantRow(row: ProductVariantRow, unitsCommitted: number): ColorVariant {
  return {
    id: row.id,
    name: row.name,
    hex: row.hex,
    imageUrl: row.image_url ?? undefined,
    unitsCommitted,
  };
}

export function mapProductRow(
  row: ProductRow,
  variants: ProductVariantRow[],
  commitmentsByVariant: CommitmentsByVariant,
): Product {
  const sortedVariants = [...variants]
    .filter((v) => v.product_id === row.id)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((v) => mapVariantRow(v, commitmentsByVariant[v.id] ?? 0));

  return {
    id: row.id,
    sku: row.sku,
    category: row.category,
    name: row.name,
    description: row.description,
    dimensions: {
      l: row.dim_length_cm,
      w: row.dim_width_cm,
      h: row.dim_height_cm,
    },
    cbmPerUnit: Number(row.cbm_per_unit),
    weightKg: Number(row.weight_kg),
    moqUnits: row.moq_units,
    basePriceHt: Number(row.base_price_ht),
    retailPriceRef: Number(row.retail_price_ref),
    ecoContribution: Number(row.eco_contribution),
    mainImageUrl: row.main_image_url,
    galleryUrls: row.gallery_urls ?? [],
    variants: sortedVariants,
    features: row.features ?? [],
    fireRating: row.fire_rating ?? undefined,
  };
}

export function mapContainerRow(row: ContainerRow): CurrentContainer {
  // Phase actuelle : on n'a pas de colonne `series_reached` en DB.
  // On expose `min_series_required` comme proxy (afin que le hero
  // affiche au moins le seuil minimum). À ré-évaluer quand la DB
  // exposera un compteur fiable issu de `container_seed_commitments`.
  const totalSeries = row.display_series_target ?? 0;
  const seriesReached = Math.min(row.min_series_required, totalSeries);

  return {
    id: row.id,
    reference: row.reference,
    port: row.port,
    capacityCbm: Number(row.capacity_cbm),
    thresholdPercent: row.threshold_percent,
    minSeriesRequired: row.min_series_required,
    // Garde une string ISO pour rester compatible avec `formatDate`
    // côté Hero (qui appelle `new Date(iso)`).
    expectedCloseAt: row.expected_close_at ?? "",
    status: row.status,
    seriesReached,
    totalSeries,
    professionalsEngaged: row.display_pros_count ?? 0,
  };
}
