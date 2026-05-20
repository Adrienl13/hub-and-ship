// ============================================================
// Container Club — catalogue & container "courant" en mock
// ----------------------------------------------------------------
// Ces données reproduisent ce qui se trouve en base. Elles
// servent de fallback dès que Supabase n'est pas configuré
// (dev sans .env, build statique, etc.) afin que la home reste
// utilisable sans backend.
// ============================================================

import type { Product } from "./products";

export const PRODUCTS_MOCK: Product[] = [
  {
    id: "p1",
    sku: "CHA-CAN-001",
    category: "chair",
    name: "Chaise Cannes Empilable",
    description:
      "Chaise outdoor en rotin synthétique S-PE tressé sur structure aluminium thermolaqué. Empilable jusqu'à 8 unités.",
    dimensions: { l: 55, w: 58, h: 85 },
    cbmPerUnit: 0.08,
    weightKg: 4.2,
    moqUnits: 50,
    basePriceHt: 89.0,
    retailPriceRef: 149.0,
    ecoContribution: 0.3,
    mainImageUrl:
      "https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=900&q=80",
    galleryUrls: [
      "https://images.unsplash.com/photo-1551298370-9d3d53740c72?auto=format&fit=crop&w=900&q=80",
      "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=900&q=80",
    ],
    features: [
      "Empilable x8",
      "Rotin synthétique S-PE",
      "Aluminium thermolaqué",
      "Résistant UV 5 ans",
      "Anti-corrosion marine",
    ],
    fireRating: "M2",
    variants: [
      { id: "v1a", name: "Noir charbon", hex: "#1f1f1f", unitsCommitted: 38 },
      { id: "v1b", name: "Gris ardoise", hex: "#5e5e5e", unitsCommitted: 22 },
      { id: "v1c", name: "Beige sable", hex: "#c9b88a", unitsCommitted: 52 },
      { id: "v1d", name: "Brun expresso", hex: "#3d2817", unitsCommitted: 12 },
      { id: "v1e", name: "Blanc craie", hex: "#e8e0d0", unitsCommitted: 0 },
      { id: "v1f", name: "Vert olive", hex: "#5a6b3a", unitsCommitted: 8 },
    ],
  },
  {
    id: "p2",
    sku: "FAU-MAL-002",
    category: "armchair",
    name: "Fauteuil Malibu Lounge",
    description:
      "Fauteuil large outdoor avec coussins déperlants inclus. Structure aluminium et tressage rotin synthétique haute densité.",
    dimensions: { l: 78, w: 82, h: 78 },
    cbmPerUnit: 0.35,
    weightKg: 11.5,
    moqUnits: 50,
    basePriceHt: 245.0,
    retailPriceRef: 429.0,
    ecoContribution: 1.0,
    mainImageUrl:
      "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=900&q=80",
    galleryUrls: [],
    features: [
      "Coussins inclus",
      "Tissu déperlant",
      "Rotin synthétique HD",
      "Structure renforcée",
      "Charge max 150 kg",
    ],
    fireRating: "M1",
    variants: [
      { id: "v2a", name: "Noir / coussin écru", hex: "#1f1f1f", unitsCommitted: 28 },
      { id: "v2b", name: "Gris / coussin anthracite", hex: "#5e5e5e", unitsCommitted: 18 },
      { id: "v2c", name: "Naturel / coussin lin", hex: "#c9b88a", unitsCommitted: 50 },
    ],
  },
  {
    id: "p3",
    sku: "TAB-LYO-003",
    category: "table",
    name: "Table Lyon Pied Central",
    description:
      "Table outdoor ronde 80 cm, plateau HPL résistant et pied central aluminium. Idéale brasseries et terrasses.",
    dimensions: { l: 80, w: 80, h: 73 },
    cbmPerUnit: 0.25,
    weightKg: 18.0,
    moqUnits: 20,
    basePriceHt: 189.0,
    retailPriceRef: 320.0,
    ecoContribution: 2.0,
    mainImageUrl:
      "https://images.unsplash.com/photo-1530018607912-eff2daa1bac4?auto=format&fit=crop&w=900&q=80",
    galleryUrls: [],
    features: [
      "Plateau HPL 12 mm",
      "Anti-UV",
      "Anti-rayures",
      "Pied alu thermolaqué",
      "Empilable démontée",
    ],
    fireRating: "M1",
    variants: [
      { id: "v3a", name: "Plateau Teck", hex: "#a87344", unitsCommitted: 14 },
      { id: "v3b", name: "Plateau Ardoise", hex: "#3a3a3e", unitsCommitted: 8 },
      { id: "v3c", name: "Plateau Marbre blanc", hex: "#e8e4dc", unitsCommitted: 22 },
      { id: "v3d", name: "Plateau Béton", hex: "#8a8580", unitsCommitted: 6 },
    ],
  },
  {
    id: "p4",
    sku: "CHA-MON-004",
    category: "chair",
    name: "Chaise Monaco Textilène",
    description:
      "Chaise outdoor textilène haute densité sur structure aluminium. Confort et légèreté pour le secteur hôtelier.",
    dimensions: { l: 52, w: 58, h: 88 },
    cbmPerUnit: 0.07,
    weightKg: 3.5,
    moqUnits: 50,
    basePriceHt: 72.0,
    retailPriceRef: 119.0,
    ecoContribution: 0.3,
    mainImageUrl:
      "https://images.unsplash.com/photo-1592078615290-033ee584e267?auto=format&fit=crop&w=900&q=80",
    galleryUrls: [],
    features: [
      "Textilène TS 8001",
      "Aluminium 6063",
      "Empilable x10",
      "Légère 3,5 kg",
      "Pieds anti-trace",
    ],
    fireRating: "M2",
    variants: [
      { id: "v4a", name: "Textilène Noir", hex: "#1f1f1f", unitsCommitted: 55 },
      { id: "v4b", name: "Textilène Anthracite", hex: "#3a3a3e", unitsCommitted: 32 },
      { id: "v4c", name: "Textilène Taupe", hex: "#9a8a7a", unitsCommitted: 18 },
      { id: "v4d", name: "Textilène Écru", hex: "#d8cdb8", unitsCommitted: 8 },
    ],
  },
  {
    id: "p5",
    sku: "BAN-PRO-005",
    category: "bench",
    name: "Banc Provence 180 cm",
    description:
      "Banc outdoor 3 places en rotin synthétique sur structure aluminium. Parfait pour entrées d'hôtels et halls.",
    dimensions: { l: 180, w: 55, h: 82 },
    cbmPerUnit: 0.45,
    weightKg: 14.0,
    moqUnits: 50,
    basePriceHt: 219.0,
    retailPriceRef: 379.0,
    ecoContribution: 1.5,
    mainImageUrl:
      "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=900&q=80",
    galleryUrls: [],
    features: [
      "3 places confort",
      "Rotin synthétique S-PE",
      "Structure renforcée",
      "Pieds anti-glisse",
    ],
    variants: [
      { id: "v5a", name: "Noir charbon", hex: "#1f1f1f", unitsCommitted: 22 },
      { id: "v5b", name: "Beige sable", hex: "#c9b88a", unitsCommitted: 14 },
    ],
  },
  {
    id: "p6",
    sku: "TAB-MAR-006",
    category: "table",
    name: "Table Marseille Rectangulaire",
    description:
      "Table outdoor rectangulaire 160×80 cm pour 6 personnes. Plateau HPL et structure aluminium.",
    dimensions: { l: 160, w: 80, h: 73 },
    cbmPerUnit: 0.45,
    weightKg: 28.0,
    moqUnits: 20,
    basePriceHt: 349.0,
    retailPriceRef: 590.0,
    ecoContribution: 5.0,
    mainImageUrl:
      "https://images.unsplash.com/photo-1604578762246-41134e37f9cc?auto=format&fit=crop&w=900&q=80",
    galleryUrls: [],
    features: ["6 couverts", "Plateau HPL 12 mm", "Pieds renforcés", "Démontable transport"],
    fireRating: "M1",
    variants: [
      { id: "v6a", name: "Plateau Teck", hex: "#a87344", unitsCommitted: 18 },
      { id: "v6b", name: "Plateau Ardoise", hex: "#3a3a3e", unitsCommitted: 12 },
      { id: "v6c", name: "Plateau Béton", hex: "#8a8580", unitsCommitted: 4 },
    ],
  },
];

export type CurrentContainerMock = {
  id: string;
  reference: string;
  port: string;
  capacityCbm: number;
  thresholdPercent: number;
  minSeriesRequired: number;
  expectedCloseAt: string;
  status: "open" | "locked" | "shipping" | "delivered" | "cancelled";
  seriesReached: number;
  totalSeries: number;
  professionalsEngaged: number;
};

export const CURRENT_CONTAINER_MOCK: CurrentContainerMock = {
  id: "00000000-0000-0000-0000-000000000001",
  reference: "CC-2026-001",
  port: "Marseille-Fos",
  capacityCbm: 28,
  thresholdPercent: 80,
  minSeriesRequired: 3,
  expectedCloseAt: "2026-03-14",
  status: "open",
  seriesReached: 3,
  totalSeries: 5,
  professionalsEngaged: 12,
};
