// ============================================================
// Container Club — catalogue, variantes, container courant
// ============================================================

export type ProductCategory = 'chair' | 'armchair' | 'table' | 'bench'

export interface DesignVariant {
  id: string
  name: string
  /** Hero photo of this design (thumbnail in selector, default in gallery). */
  imageUrl?: string
  /** Additional photos shown when this design is selected. */
  galleryUrls?: string[]
  /** Unités déjà engagées par d'autres pros (simulé) */
  unitsCommitted: number
}

export interface Product {
  id: string
  sku: string
  category: ProductCategory
  name: string
  description: string
  /** cm */
  dimensions: { l: number; w: number; h: number }
  /** m³ par unité (carton ou unité finie) */
  cbmPerUnit: number
  weightKg: number
  /** 50 assises · 20 tables */
  moqUnits: number
  /** Prix affiché à l'utilisateur : pour un revendeur connecté c'est son prix
   *  NET canal (via get_catalogue_prices). Pour anon/direct == prix public. */
  basePriceHt: number
  /** Prix PUBLIC direct (products.base_price_ht brut, jamais canalisé) — à
   *  utiliser partout où l'on fige/expose un prix destiné au client FINAL
   *  (sélections partenaires publiées, devis co-brandés) pour ne jamais fuiter
   *  le prix net d'un revendeur. Absent (undefined) = retomber sur basePriceHt. */
  publicBasePriceHt?: number
  retailPriceRef: number
  ecoContribution: number
  mainImageUrl: string
  galleryUrls: string[]
  variants: DesignVariant[]
  features: string[]
  fireRating?: 'M1' | 'M2'
}

export const CATEGORY_LABEL: Record<ProductCategory, string> = {
  chair: 'Chaise',
  armchair: 'Fauteuil',
  table: 'Table',
  bench: 'Banc',
}

export const PRODUCTS: Product[] = [
  {
    id: 'p1',
    sku: 'CHA-CAN-001',
    category: 'chair',
    name: 'Chaise Cannes Empilable',
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
      'https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=900&q=80',
    galleryUrls: [
      'https://images.unsplash.com/photo-1551298370-9d3d53740c72?auto=format&fit=crop&w=900&q=80',
      'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=900&q=80',
    ],
    features: [
      'Empilable x8',
      'Rotin synthétique S-PE',
      'Aluminium thermolaqué',
      'Résistant UV 5 ans',
      'Anti-corrosion marine',
    ],
    fireRating: 'M2',
    variants: [
      { id: 'v1a', name: 'Noir charbon', unitsCommitted: 38 },
      { id: 'v1b', name: 'Gris ardoise', unitsCommitted: 22 },
      { id: 'v1c', name: 'Beige sable', unitsCommitted: 52 },
      { id: 'v1d', name: 'Brun expresso', unitsCommitted: 12 },
      { id: 'v1e', name: 'Blanc craie', unitsCommitted: 0 },
      { id: 'v1f', name: 'Vert olive', unitsCommitted: 8 },
    ],
  },
  {
    id: 'p2',
    sku: 'FAU-MAL-002',
    category: 'armchair',
    name: 'Fauteuil Malibu Lounge',
    description:
      'Fauteuil large outdoor avec coussins déperlants inclus. Structure aluminium et tressage rotin synthétique haute densité.',
    dimensions: { l: 78, w: 82, h: 78 },
    cbmPerUnit: 0.35,
    weightKg: 11.5,
    moqUnits: 50,
    basePriceHt: 245.0,
    retailPriceRef: 429.0,
    ecoContribution: 1.0,
    mainImageUrl:
      'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=900&q=80',
    galleryUrls: [],
    features: [
      'Coussins inclus',
      'Tissu déperlant',
      'Rotin synthétique HD',
      'Structure renforcée',
      'Charge max 150 kg',
    ],
    fireRating: 'M1',
    variants: [
      {
        id: 'v2a',
        name: 'Noir / coussin écru',
        unitsCommitted: 28,
      },
      {
        id: 'v2b',
        name: 'Gris / coussin anthracite',
        unitsCommitted: 18,
      },
      {
        id: 'v2c',
        name: 'Naturel / coussin lin',
        unitsCommitted: 50,
      },
    ],
  },
  {
    id: 'p3',
    sku: 'TAB-LYO-003',
    category: 'table',
    name: 'Table Lyon Pied Central',
    description:
      'Table outdoor ronde 80 cm, plateau HPL résistant et pied central aluminium. Idéale brasseries et terrasses.',
    dimensions: { l: 80, w: 80, h: 73 },
    cbmPerUnit: 0.25,
    weightKg: 18.0,
    moqUnits: 20,
    basePriceHt: 189.0,
    retailPriceRef: 320.0,
    ecoContribution: 2.0,
    mainImageUrl:
      'https://images.unsplash.com/photo-1530018607912-eff2daa1bac4?auto=format&fit=crop&w=900&q=80',
    galleryUrls: [],
    features: [
      'Plateau HPL 12 mm',
      'Anti-UV',
      'Anti-rayures',
      'Pied alu thermolaqué',
      'Empilable démontée',
    ],
    fireRating: 'M1',
    variants: [
      { id: 'v3a', name: 'Plateau Teck', unitsCommitted: 14 },
      { id: 'v3b', name: 'Plateau Ardoise', unitsCommitted: 8 },
      {
        id: 'v3c',
        name: 'Plateau Marbre blanc',
        unitsCommitted: 22,
      },
      { id: 'v3d', name: 'Plateau Béton', unitsCommitted: 6 },
    ],
  },
  {
    id: 'p4',
    sku: 'CHA-MON-004',
    category: 'chair',
    name: 'Chaise Monaco Textilène',
    description:
      'Chaise outdoor textilène haute densité sur structure aluminium. Confort et légèreté pour le secteur hôtelier.',
    dimensions: { l: 52, w: 58, h: 88 },
    cbmPerUnit: 0.07,
    weightKg: 3.5,
    moqUnits: 50,
    basePriceHt: 72.0,
    retailPriceRef: 119.0,
    ecoContribution: 0.3,
    mainImageUrl:
      'https://images.unsplash.com/photo-1592078615290-033ee584e267?auto=format&fit=crop&w=900&q=80',
    galleryUrls: [],
    features: [
      'Textilène TS 8001',
      'Aluminium 6063',
      'Empilable x10',
      'Légère 3,5 kg',
      'Pieds anti-trace',
    ],
    fireRating: 'M2',
    variants: [
      { id: 'v4a', name: 'Textilène Noir', unitsCommitted: 55 },
      {
        id: 'v4b',
        name: 'Textilène Anthracite',
        unitsCommitted: 32,
      },
      {
        id: 'v4c',
        name: 'Textilène Taupe',
        unitsCommitted: 18,
      },
      { id: 'v4d', name: 'Textilène Écru', unitsCommitted: 8 },
    ],
  },
  {
    id: 'p5',
    sku: 'BAN-PRO-005',
    category: 'bench',
    name: 'Banc Provence 180 cm',
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
      'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=900&q=80',
    galleryUrls: [],
    features: [
      '3 places confort',
      'Rotin synthétique S-PE',
      'Structure renforcée',
      'Pieds anti-glisse',
    ],
    variants: [
      { id: 'v5a', name: 'Noir charbon', unitsCommitted: 22 },
      { id: 'v5b', name: 'Beige sable', unitsCommitted: 14 },
    ],
  },
  {
    id: 'p6',
    sku: 'TAB-MAR-006',
    category: 'table',
    name: 'Table Marseille Rectangulaire',
    description:
      'Table outdoor rectangulaire 160×80 cm pour 6 personnes. Plateau HPL et structure aluminium.',
    dimensions: { l: 160, w: 80, h: 73 },
    cbmPerUnit: 0.45,
    weightKg: 28.0,
    moqUnits: 20,
    basePriceHt: 349.0,
    retailPriceRef: 590.0,
    ecoContribution: 5.0,
    mainImageUrl:
      'https://images.unsplash.com/photo-1604578762246-41134e37f9cc?auto=format&fit=crop&w=900&q=80',
    galleryUrls: [],
    features: [
      '6 couverts',
      'Plateau HPL 12 mm',
      'Pieds renforcés',
      'Démontable transport',
    ],
    fireRating: 'M1',
    variants: [
      { id: 'v6a', name: 'Plateau Teck', unitsCommitted: 18 },
      {
        id: 'v6b',
        name: 'Plateau Ardoise',
        unitsCommitted: 12,
      },
      { id: 'v6c', name: 'Plateau Béton', unitsCommitted: 4 },
    ],
  },
]

export interface ContainerSummary {
  readonly id?: string
  readonly reference: string
  readonly port: string
  readonly capacityCbm: number
  readonly thresholdPercent: number
  readonly minSeriesRequired: number
  readonly expectedCloseAt: string | null
  readonly status: 'open'
  readonly seriesReached: number
  readonly totalSeries: number
  readonly professionalsEngaged: number
  /** ISO container format (drives the 3D shell + sidebar label).
   *  Falls back to '20_hc' when omitted by older callers. */
  readonly containerType?: '20_dv' | '20_hc' | '40_gp' | '40_hc'
}

export const CURRENT_CONTAINER: ContainerSummary = {
  reference: 'CC-2026-001',
  port: 'Marseille-Fos',
  capacityCbm: 28,
  thresholdPercent: 80,
  minSeriesRequired: 3,
  // No hardcoded close date: the live one comes from Supabase (containers).
  // A stale date here would show a false "clôture imminente" urgency badge.
  expectedCloseAt: null,
  status: 'open',
  seriesReached: 3,
  totalSeries: 5,
  professionalsEngaged: 12,
}

export interface PastContainerTestimonial {
  readonly quote: string
  readonly author: string
  readonly location: string
  readonly rating: number
}

export interface PastContainer {
  readonly reference: string
  readonly port: string
  readonly deliveredAt: string
  readonly professionalsServed: number
  readonly totalItems: number
  readonly plannedDays: number
  readonly actualDays: number
  readonly testimonial: PastContainerTestimonial
  readonly photoUrl: string
}

// Aucune preuve inventée : tant qu'aucun container n'a réellement été livré, ce
// fallback reste VIDE. Les vrais containers livrés viennent de la table
// `delivered_containers` (repository DB-first) ; les composants publics
// (PastContainers, /livres) masquent proprement la section quand la liste est
// vide — cohérent avec /avis qui n'affiche encore aucun avis client.
export const PAST_CONTAINERS: ReadonlyArray<PastContainer> = []

export function findVariant(
  p: Product,
  variantId: string,
): DesignVariant | undefined {
  return p.variants.find((v) => v.id === variantId)
}
