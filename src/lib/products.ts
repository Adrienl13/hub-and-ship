// ============================================================
// Container Club — catalogue, variantes, container courant
// ============================================================

export type ProductCategory = "chair" | "armchair" | "table" | "bench";

export interface ColorVariant {
  id: string;
  name: string;
  hex: string;
  imageUrl?: string;
  /** Unités déjà engagées par d'autres pros (simulé) */
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

// NB: les exports `PRODUCTS` et `CURRENT_CONTAINER` ont été déplacés
// vers `products-mock.ts` (fallback) et la source de vérité passe
// désormais par Supabase via `@/hooks/useCatalog`.

export type TimelineStatus = "done" | "delay";

export interface PastContainerTimelineStep {
  date: string;
  label: string;
  description: string;
  status: TimelineStatus;
}

export interface PastContainerGalleryItem {
  url: string;
  caption: string;
}

export interface PastContainerBreakdown {
  category: ProductCategory;
  units: number;
  modelLabel: string;
}

export interface PastContainer {
  reference: string;
  slug: string;
  port: string;
  originPort: string;
  deliveredAt: string;
  professionalsServed: number;
  totalItems: number;
  plannedDays: number;
  actualDays: number;
  savingsTotalEur: number;
  savingsPercent: number;
  story: string;
  certifications: string[];
  timeline: PastContainerTimelineStep[];
  productBreakdown: PastContainerBreakdown[];
  testimonial: {
    quote: string;
    longQuote?: string;
    author: string;
    role: string;
    location: string;
    rating: number;
  };
  photoUrl: string;
  gallery: PastContainerGalleryItem[];
}

export const PAST_CONTAINERS: PastContainer[] = [
  {
    reference: "CC-2025-014",
    slug: "cc-2025-014",
    port: "Marseille-Fos",
    originPort: "Ningbo (Chine)",
    deliveredAt: "2025-12-12",
    professionalsServed: 8,
    totalItems: 287,
    plannedDays: 75,
    actualDays: 78,
    savingsTotalEur: 14820,
    savingsPercent: 36,
    story:
      "Container saisonnier pré-printemps mobilisé par 8 hôteliers du Var et des Bouches-du-Rhône. Mix chaises empilables et tables HPL pour réouverture de terrasses. Léger retard de 3 jours absorbé sans impact (livraison anticipée dans le planning travaux).",
    certifications: [
      "Contrôle SGS · AQL 2.5 conforme",
      "Conformité CE / REACH",
      "Classement feu M1 / M2",
      "Importation officielle Terrassea SAS",
    ],
    timeline: [
      {
        date: "2025-09-22",
        label: "Clôture commande",
        description: "Container atteint 92% de remplissage, 5 séries déclenchées.",
        status: "done",
      },
      {
        date: "2025-10-05",
        label: "Production usine",
        description: "Lancement production simultanée des 4 fournisseurs partenaires.",
        status: "done",
      },
      {
        date: "2025-11-10",
        label: "Contrôle qualité SGS",
        description: "Inspection physique avant chargement. 287/287 articles conformes.",
        status: "done",
      },
      {
        date: "2025-11-15",
        label: "Chargement port Ningbo",
        description: "Container scellé, embarqué sur le CMA CGM Bougainville.",
        status: "done",
      },
      {
        date: "2025-12-08",
        label: "Arrivée Marseille-Fos",
        description: "Dédouanement immédiat, TVA autoliquidée.",
        status: "done",
      },
      {
        date: "2025-12-12",
        label: "Livraisons finales",
        description: "Tournée régionale Var / Bouches-du-Rhône. +3j vs annoncé.",
        status: "delay",
      },
    ],
    productBreakdown: [
      { category: "chair", units: 180, modelLabel: "Chaises Cannes & Monaco" },
      { category: "table", units: 42, modelLabel: "Tables Lyon pied central" },
      { category: "armchair", units: 38, modelLabel: "Fauteuils Malibu Lounge" },
      { category: "bench", units: 27, modelLabel: "Bancs Provence 180cm" },
    ],
    testimonial: {
      quote: "Qualité au rendez-vous, délais tenus, on recommence sur le prochain.",
      longQuote:
        "On a comparé avec nos fournisseurs habituels : −36% sur facture, qualité strictement équivalente. Le rapport SGS reçu avant chargement a vraiment fait la différence pour rassurer notre direction. On a déjà bloqué notre place sur le container suivant.",
      author: "Hôtel Le Lavandou",
      role: "Direction achats",
      location: "Var",
      rating: 5,
    },
    photoUrl:
      "https://images.unsplash.com/photo-1494412519320-aa613dfb7738?auto=format&fit=crop&w=1400&q=80",
    gallery: [
      {
        url: "https://images.unsplash.com/photo-1551298370-9d3d53740c72?auto=format&fit=crop&w=1200&q=80",
        caption: "Inspection SGS en usine — échantillonnage AQL 2.5",
      },
      {
        url: "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1200&q=80",
        caption: "Chargement container 20' HC — port de Ningbo",
      },
      {
        url: "https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=1200&q=80",
        caption: "Mise en place terrasse — Hôtel Le Lavandou",
      },
    ],
  },
  {
    reference: "CC-2025-013",
    slug: "cc-2025-013",
    port: "Le Havre",
    originPort: "Shanghai (Chine)",
    deliveredAt: "2025-11-28",
    professionalsServed: 6,
    totalItems: 198,
    plannedDays: 75,
    actualDays: 71,
    savingsTotalEur: 9640,
    savingsPercent: 38,
    story:
      "Première rotation port du Havre — 6 campings et hôtels de plein air du grand ouest. Container livré 4 jours avant l'annonce grâce à un transit Asie-Europe plus rapide que prévu.",
    certifications: [
      "Contrôle SGS · AQL 2.5 conforme",
      "Conformité CE / REACH",
      "Classement feu M2",
      "Importation officielle Terrassea SAS",
    ],
    timeline: [
      {
        date: "2025-09-08",
        label: "Clôture commande",
        description: "Container atteint 84% de remplissage en 6 semaines.",
        status: "done",
      },
      {
        date: "2025-09-22",
        label: "Production usine",
        description: "Lancement production 3 fournisseurs.",
        status: "done",
      },
      {
        date: "2025-10-28",
        label: "Contrôle qualité SGS",
        description: "Inspection conforme, 198/198 articles.",
        status: "done",
      },
      {
        date: "2025-11-02",
        label: "Chargement Shanghai",
        description: "Embarquement plus rapide que prévu (transit 18j au lieu de 22j).",
        status: "done",
      },
      {
        date: "2025-11-24",
        label: "Arrivée Le Havre",
        description: "Dédouanement express, 4 jours d'avance.",
        status: "done",
      },
      {
        date: "2025-11-28",
        label: "Livraisons finales",
        description: "Tournée Bretagne, Pays-de-Loire, Nouvelle-Aquitaine. −4j vs annoncé.",
        status: "done",
      },
    ],
    productBreakdown: [
      { category: "chair", units: 140, modelLabel: "Chaises Monaco Textilène" },
      { category: "table", units: 24, modelLabel: "Tables Marseille rectangulaires" },
      { category: "armchair", units: 22, modelLabel: "Fauteuils Malibu Lounge" },
      { category: "bench", units: 12, modelLabel: "Bancs Provence" },
    ],
    testimonial: {
      quote: "Économies réelles vs nos fournisseurs habituels. Process clair et rassurant.",
      longQuote:
        "On gère 4 campings, on renouvelle 200 chaises par an. La pré-commande groupée nous a fait économiser 9 600€ HT sur un seul container, avec une qualité au moins équivalente à notre ancien fournisseur. Le contact humain et la transparence des étapes sont rares dans ce métier.",
      author: "Camping Les Pins Bleus",
      role: "Direction technique",
      location: "Landes",
      rating: 5,
    },
    photoUrl:
      "https://images.unsplash.com/photo-1605283176568-9b41fde3a09c?auto=format&fit=crop&w=1400&q=80",
    gallery: [
      {
        url: "https://images.unsplash.com/photo-1530018607912-eff2daa1bac4?auto=format&fit=crop&w=1200&q=80",
        caption: "Tables HPL installées — Camping Les Pins Bleus",
      },
      {
        url: "https://images.unsplash.com/photo-1592078615290-033ee584e267?auto=format&fit=crop&w=1200&q=80",
        caption: "Mise en place terrasse de restaurant client",
      },
      {
        url: "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=1200&q=80",
        caption: "Fauteuils lounge — espace lobby hôtel",
      },
    ],
  },
  {
    reference: "CC-2025-012",
    slug: "cc-2025-012",
    port: "Marseille-Fos",
    originPort: "Yantian (Chine)",
    deliveredAt: "2025-10-15",
    professionalsServed: 11,
    totalItems: 412,
    plannedDays: 75,
    actualDays: 82,
    savingsTotalEur: 21560,
    savingsPercent: 34,
    story:
      "Plus gros container du semestre — 11 professionnels mutualisés, 412 articles. Petit incident de transit (escale technique imprévue 5 jours à Singapour) a entraîné 7 jours de retard sur livraison, communiqué et compensé par un geste commercial 2% sur tous les clients impactés.",
    certifications: [
      "Contrôle SGS · AQL 2.5 conforme",
      "Conformité CE / REACH",
      "Classement feu M1",
      "Eco-participation Eco-mobilier",
      "Importation officielle Terrassea SAS",
    ],
    timeline: [
      {
        date: "2025-07-12",
        label: "Clôture commande",
        description: "Container saturé à 98%, 5 séries complètes.",
        status: "done",
      },
      {
        date: "2025-07-28",
        label: "Production usine",
        description: "Production simultanée 4 fournisseurs partenaires.",
        status: "done",
      },
      {
        date: "2025-09-10",
        label: "Contrôle qualité SGS",
        description: "Inspection conforme, 412/412 articles.",
        status: "done",
      },
      {
        date: "2025-09-15",
        label: "Chargement Yantian",
        description: "Container scellé, embarqué CMA CGM.",
        status: "done",
      },
      {
        date: "2025-09-22",
        label: "Escale technique Singapour",
        description: "Imprévu : retard 5 jours sur réacheminement. Communiqué aux clients J+1.",
        status: "delay",
      },
      {
        date: "2025-10-10",
        label: "Arrivée Marseille-Fos",
        description: "Dédouanement, TVA autoliquidée.",
        status: "done",
      },
      {
        date: "2025-10-15",
        label: "Livraisons finales",
        description: "Tournée régionale. +7j vs annoncé. Geste commercial 2% appliqué.",
        status: "delay",
      },
    ],
    productBreakdown: [
      { category: "chair", units: 260, modelLabel: "Chaises Cannes, Monaco" },
      { category: "table", units: 68, modelLabel: "Tables Lyon & Marseille" },
      { category: "armchair", units: 54, modelLabel: "Fauteuils Malibu Lounge" },
      { category: "bench", units: 30, modelLabel: "Bancs Provence" },
    ],
    testimonial: {
      quote:
        "Petit retard de 7 jours communiqué en transparence. Mobilier au top, prix imbattable.",
      longQuote:
        "Sept jours de retard, ça peut faire mal quand on prévoit une ouverture. Mais l'équipe a prévenu en amont, proposé un geste commercial, et la qualité du mobilier est largement à la hauteur. C'est ce qu'on attend d'un partenaire pro : la transparence quand ça coince.",
      author: "Restaurant La Marina",
      role: "Gérance",
      location: "Cap d'Agde",
      rating: 4,
    },
    photoUrl:
      "https://images.unsplash.com/photo-1516571748831-5d81767b788d?auto=format&fit=crop&w=1400&q=80",
    gallery: [
      {
        url: "https://images.unsplash.com/photo-1604578762246-41134e37f9cc?auto=format&fit=crop&w=1200&q=80",
        caption: "Terrasse complète équipée — Restaurant La Marina",
      },
      {
        url: "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=1200&q=80",
        caption: "Chaises Cannes empilables — vue de quai",
      },
      {
        url: "https://images.unsplash.com/photo-1551298370-9d3d53740c72?auto=format&fit=crop&w=1200&q=80",
        caption: "Container 20' HC sur quai Marseille-Fos",
      },
    ],
  },
];

export function findPastContainer(slug: string): PastContainer | undefined {
  return PAST_CONTAINERS.find((c) => c.slug === slug);
}

export function getPastContainersStats() {
  const totalContainers = PAST_CONTAINERS.length;
  const totalPros = PAST_CONTAINERS.reduce((s, c) => s + c.professionalsServed, 0);
  const totalArticles = PAST_CONTAINERS.reduce((s, c) => s + c.totalItems, 0);
  const totalSavings = PAST_CONTAINERS.reduce((s, c) => s + c.savingsTotalEur, 0);
  const onTime = PAST_CONTAINERS.filter((c) => c.actualDays <= c.plannedDays).length;
  const onTimeRate = totalContainers > 0 ? (onTime / totalContainers) * 100 : 0;
  const avgSavingsPercent =
    totalContainers > 0
      ? PAST_CONTAINERS.reduce((s, c) => s + c.savingsPercent, 0) / totalContainers
      : 0;
  return {
    totalContainers,
    totalPros,
    totalArticles,
    totalSavings,
    onTimeRate,
    avgSavingsPercent,
  };
}

export function findVariant(p: Product, variantId: string): ColorVariant | undefined {
  return p.variants.find((v) => v.id === variantId);
}
