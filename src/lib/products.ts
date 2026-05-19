// ============================================================
// Container Club — Types catalogue
// Les données vivent en BDD Supabase. Voir lib/catalog.ts pour les fetchers.
// ============================================================

export type ProductCategory = "chair" | "armchair" | "table" | "bench";

export interface ColorVariant {
  id: string;
  name: string;
  hex: string;
  imageUrl?: string;
  /** Unités engagées sur le container courant (seed + vraies réservations) */
  unitsCommitted: number;
}

export interface Product {
  id: string;
  sku: string;
  category: ProductCategory;
  name: string;
  description: string;
  /** cm */
  dimensions: { l: number; w: number; h: number };
  /** m³ par unité (carton ou unité finie) */
  cbmPerUnit: number;
  weightKg: number;
  /** 50 assises · 20 tables */
  moqUnits: number;
  basePriceHt: number;
  retailPriceRef: number;
  ecoContribution: number;
  mainImageUrl: string;
  galleryUrls: string[];
  variants: ColorVariant[];
  features: string[];
  fireRating?: "M1" | "M2";
}

export const CATEGORY_LABEL: Record<ProductCategory, string> = {
  chair: "Chaise",
  armchair: "Fauteuil",
  table: "Table",
  bench: "Banc",
};

export function findVariant(p: Product, variantId: string): ColorVariant | undefined {
  return p.variants.find((v) => v.id === variantId);
}
