// ============================================================
// Container Club — catalogue, palettes usine, MOQ
// ============================================================

export type SwatchPattern = "solid" | "chevron" | "diamond" | "stripe" | "weave" | "check";

export type ColorOption = {
  id: string;
  name: string;
  /** Code usine (ex. S-PE003, TS-052) */
  code?: string;
  /** Couleur dominante (sert au rendu 3D et au swatch) */
  hex: string;
  /** Couleur secondaire (motif tissé) */
  hex2?: string;
  pattern?: SwatchPattern;
};

export type OptionGroup = {
  /** Ce que customise ce groupe */
  kind: "weave" | "textilene" | "frame" | "top";
  label: string;
  options: ColorOption[];
};

export type Product = {
  id: string;
  name: string;
  category: "Chaise" | "Fauteuil" | "Tabouret" | "Table" | "Terrasse";
  price: number;          // EUR HT — Container Club price
  retailPrice: number;    // EUR HT — équivalent grossiste FR
  /** Dimensions emballage (m) [largeur, profondeur, hauteur] pour 1 carton */
  packDim: [number, number, number];
  /** Unités par carton */
  packQty: number;
  /** MOQ — quantité minimum de commande (en unités) */
  moq: number;
  /** Couleur 3D par défaut (cadre) */
  baseColor: string;
  swatch: string;
  blurb: string;
  /** Une chaise peut proposer plusieurs familles : tressage OU textilène */
  customizations?: OptionGroup[];
};

// ────────────────────────────────────────────────────────────
// Palettes usine — inspirées des planches S-PE / TS du catalog
// ────────────────────────────────────────────────────────────

// Tressage rotin synthétique — codes S-PE
const WEAVE_COLORS: ColorOption[] = [
  { id: "pe001", code: "S-PE001", name: "Indigo / Gris",   hex: "#2b3a72", hex2: "#c5c8cf", pattern: "chevron" },
  { id: "pe002", code: "S-PE002", name: "Kaki Mêlé",       hex: "#5a5135", hex2: "#9a8f6a", pattern: "chevron" },
  { id: "pe003", code: "S-PE003", name: "Orange Vif",      hex: "#d24a1b", hex2: "#ece4d4", pattern: "chevron" },
  { id: "pe004", code: "S-PE004", name: "Vert Sapin",      hex: "#2f5d4a", hex2: "#ece4d4", pattern: "chevron" },
  { id: "pe005", code: "S-PE005", name: "Jaune Soleil",    hex: "#e8b91b", hex2: "#ece4d4", pattern: "chevron" },
  { id: "pe006", code: "S-PE006", name: "Rouge / Marine",  hex: "#a93030", hex2: "#1f3a5f", pattern: "weave" },
  { id: "pe007", code: "S-PE007", name: "Bleu Marseille",  hex: "#1f4a8a", hex2: "#ece4d4", pattern: "weave" },
  { id: "pe008", code: "S-PE008", name: "Mandarine",       hex: "#d96a1f", hex2: "#3a3528", pattern: "weave" },
  { id: "pe009", code: "S-PE009", name: "Beige Naturel",   hex: "#dccfa8", hex2: "#b85c3a", pattern: "weave" },
  { id: "pe010", code: "S-PE010", name: "Anthracite",      hex: "#3a3a3f", hex2: "#b8b2a4", pattern: "diamond" },
  { id: "pe011", code: "S-PE011", name: "Bleu Roi",        hex: "#1a4faa", hex2: "#ece4d4", pattern: "diamond" },
  { id: "pe012", code: "S-PE012", name: "Vert Paris",      hex: "#2d5a3d", hex2: "#ece4d4", pattern: "diamond" },
  { id: "pe013", code: "S-PE013", name: "Miel",            hex: "#b8853f", hex2: "#3a2a1a", pattern: "diamond" },
  { id: "pe017", code: "S-PE017", name: "Bordeaux Ivoire", hex: "#7a2230", hex2: "#ece4d4", pattern: "diamond" },
  { id: "pe018", code: "S-PE018", name: "Noir / Blanc",    hex: "#1a1a1c", hex2: "#ece4d4", pattern: "diamond" },
  { id: "pe025", code: "S-PE025", name: "Vert Forêt",      hex: "#2a4a35", hex2: "#1a1a1c", pattern: "diamond" },
];

// Textilène / toile — codes TS
const TEXTILENE_COLORS: ColorOption[] = [
  { id: "ts007", code: "TS-007", name: "Lin Naturel",    hex: "#d8d2c4", pattern: "weave" },
  { id: "ts066", code: "TS-066", name: "Blanc Cassé",    hex: "#e8e4dc", pattern: "weave" },
  { id: "ts003", code: "TS-003", name: "Noir Profond",   hex: "#1c1c1e", pattern: "weave" },
  { id: "ts048", code: "TS-048", name: "Olive Mêlée",    hex: "#6b6a3a", hex2: "#3a3528", pattern: "weave" },
  { id: "ts018", code: "TS-018", name: "Pied-de-Poule",  hex: "#1a1a1c", hex2: "#ece4d4", pattern: "check" },
  { id: "ts011", code: "TS-011", name: "Terracotta",     hex: "#b85c3a", hex2: "#ece4d4", pattern: "weave" },
  { id: "ts009", code: "TS-009", name: "Rouge Damier",   hex: "#a83030", hex2: "#ece4d4", pattern: "check" },
  { id: "ts010", code: "TS-010", name: "Bleu Tissé",     hex: "#3a5a8a", hex2: "#ece4d4", pattern: "weave" },
  { id: "ts031", code: "TS-031", name: "Chevron Noir",   hex: "#1c1c1e", hex2: "#ece4d4", pattern: "chevron" },
  { id: "ts052", code: "TS-052", name: "Chevron Vert",   hex: "#2a6a4a", hex2: "#ece4d4", pattern: "chevron" },
  { id: "ts020", code: "TS-020", name: "Chevron Soleil", hex: "#e8b91b", hex2: "#3a3528", pattern: "chevron" },
  { id: "ts057", code: "TS-057", name: "Chevron Marine", hex: "#1a3a6a", hex2: "#ece4d4", pattern: "chevron" },
  { id: "ts058", code: "TS-058", name: "Chevron Sapin",  hex: "#1f5a3a", hex2: "#ece4d4", pattern: "chevron" },
  { id: "ts036", code: "TS-036", name: "Chevron Rouge",  hex: "#c43030", hex2: "#ece4d4", pattern: "chevron" },
  { id: "ts080", code: "TS-080", name: "Diamant Gris",   hex: "#5a5a5e", hex2: "#ece4d4", pattern: "diamond" },
  { id: "ts082", code: "TS-082", name: "Diamant Rouge",  hex: "#b83030", hex2: "#ece4d4", pattern: "diamond" },
  { id: "ts016", code: "TS-016", name: "Diamant Sarcelle", hex: "#2a7a8a", hex2: "#ece4d4", pattern: "diamond" },
  { id: "ts056", code: "TS-056", name: "Vichy Noir",     hex: "#1c1c1e", hex2: "#ece4d4", pattern: "check" },
];

const FRAME_FINISHES: ColorOption[] = [
  { id: "noir",   name: "Noir mat",    hex: "#1c1c1e" },
  { id: "blanc",  name: "Blanc cassé", hex: "#ece4d4" },
  { id: "bronze", name: "Bronze",      hex: "#6b4a2a" },
  { id: "vert",   name: "Vert sapin",  hex: "#2d4435" },
];

// Plateaux table — 4 finitions au choix
const TOP_FINISHES: ColorOption[] = [
  { id: "marbre-blanc", name: "Marbre Blanc", hex: "#e8e4dc" },
  { id: "marbre-noir",  name: "Marbre Noir",  hex: "#222226" },
  { id: "chene-clair",  name: "Chêne Clair",  hex: "#c9a878" },
  { id: "compact-noir", name: "Compact Noir", hex: "#2a2a2e" },
];

// ────────────────────────────────────────────────────────────
// Catalogue produits
// ────────────────────────────────────────────────────────────

const CHAIR_PACK: [number, number, number] = [0.52, 0.55, 2.8];
const FAUTEUIL_PACK: [number, number, number] = [0.62, 0.65, 2.6];

export const PRODUCTS: Product[] = [
  // — Chaises —
  {
    id: "bistrot-rotin",
    name: "Chaise Bistrot Rotin",
    category: "Chaise",
    price: 42, retailPrice: 89,
    packDim: CHAIR_PACK, packQty: 10, moq: 50,
    baseColor: "#b8853f", swatch: "#b8853f",
    blurb: "Tressé synthétique · alu · empilable ×10",
    customizations: [
      { kind: "weave",     label: "Tressage rotin",   options: WEAVE_COLORS },
      { kind: "textilene", label: "Toile textilène",  options: TEXTILENE_COLORS },
    ],
  },
  {
    id: "bistrot-cannage",
    name: "Chaise Bistrot Cannage",
    category: "Chaise",
    price: 48, retailPrice: 109,
    packDim: [0.5, 0.55, 2.6], packQty: 10, moq: 50,
    baseColor: "#1a1a1c", swatch: "#1a1a1c",
    blurb: "Dossier rond cannage · cadre acier · empilable ×10",
    customizations: [
      { kind: "frame", label: "Finition cadre", options: FRAME_FINISHES },
    ],
  },
  {
    id: "chaise-riviera",
    name: "Chaise Riviera",
    category: "Chaise",
    price: 46, retailPrice: 99,
    packDim: CHAIR_PACK, packQty: 10, moq: 50,
    baseColor: "#1f4a8a", swatch: "#1f4a8a",
    blurb: "Assise tressée bicolore · style Côte d'Azur",
    customizations: [
      { kind: "weave",     label: "Tressage rotin",  options: WEAVE_COLORS },
      { kind: "textilene", label: "Toile textilène", options: TEXTILENE_COLORS },
    ],
  },
  // — Fauteuils —
  {
    id: "fauteuil-marais",
    name: "Fauteuil Marais",
    category: "Fauteuil",
    price: 78, retailPrice: 169,
    packDim: FAUTEUIL_PACK, packQty: 6, moq: 50,
    baseColor: "#2d5a3d", swatch: "#2d5a3d",
    blurb: "Accoudoirs bois · dossier tressé · empilable ×6",
    customizations: [
      { kind: "weave",     label: "Tressage rotin",  options: WEAVE_COLORS },
      { kind: "textilene", label: "Toile textilène", options: TEXTILENE_COLORS },
    ],
  },
  {
    id: "fauteuil-lounge",
    name: "Fauteuil Lounge Pro",
    category: "Fauteuil",
    price: 95, retailPrice: 209,
    packDim: [0.7, 0.7, 2.4], packQty: 4, moq: 50,
    baseColor: "#3a3a3f", swatch: "#3a3a3f",
    blurb: "Coque enveloppante · cadre alu · empilable ×4",
    customizations: [
      { kind: "weave",     label: "Tressage rotin",  options: WEAVE_COLORS },
      { kind: "textilene", label: "Toile textilène", options: TEXTILENE_COLORS },
    ],
  },
  // — Tabouret —
  {
    id: "tabouret-bistrot",
    name: "Tabouret Bistrot H75",
    category: "Tabouret",
    price: 58, retailPrice: 129,
    packDim: [0.45, 0.45, 1.95], packQty: 8, moq: 50,
    baseColor: "#b8853f", swatch: "#b8853f",
    blurb: "Repose-pied · tressé · empilable ×8",
    customizations: [
      { kind: "weave",     label: "Tressage rotin",  options: WEAVE_COLORS },
      { kind: "textilene", label: "Toile textilène", options: TEXTILENE_COLORS },
    ],
  },
  // — Tables —
  {
    id: "table-bistrot-60",
    name: "Table Bistrot Ø60 — Pied fonte",
    category: "Table",
    price: 89, retailPrice: 199,
    packDim: [0.68, 0.68, 0.42], packQty: 2, moq: 20,
    baseColor: "#e8e4dc", swatch: "#e8e4dc",
    blurb: "Plateau 4 finitions · pied fonte noir",
    customizations: [
      { kind: "top", label: "Plateau (4 finitions)", options: TOP_FINISHES },
    ],
  },
  {
    id: "mange-debout",
    name: "Table Mange-Debout Ø70",
    category: "Table",
    price: 119, retailPrice: 259,
    packDim: [0.78, 0.78, 1.15], packQty: 1, moq: 20,
    baseColor: "#c9a878", swatch: "#c9a878",
    blurb: "Hauteur 110 cm · plateau au choix · pied alu",
    customizations: [
      { kind: "top", label: "Plateau (4 finitions)", options: TOP_FINISHES },
    ],
  },
];

// 20ft High Cube — capacité utile ≈ 33 CBM
export const CONTAINER_CBM = 33;

// Indication catalogue : nb de formes total (pour suggérer la profondeur)
export const TOTAL_CHAIR_SHAPES = 28;

export function unitCBM(p: Product) {
  const [w, d, h] = p.packDim;
  return (w * d * h) / p.packQty;
}

/** Trouve l'option courante (toutes familles confondues) */
export function findOption(p: Product, optionId?: string): ColorOption | undefined {
  if (!optionId || !p.customizations) return undefined;
  for (const g of p.customizations) {
    const o = g.options.find((x) => x.id === optionId);
    if (o) return o;
  }
  return undefined;
}

export function findOptionGroup(p: Product, optionId?: string): OptionGroup | undefined {
  if (!optionId || !p.customizations) return undefined;
  return p.customizations.find((g) => g.options.some((o) => o.id === optionId));
}

export function getProductColor(p: Product, optionId?: string): string {
  return findOption(p, optionId)?.hex ?? p.baseColor;
}

export function defaultOptionId(p: Product): string | undefined {
  return p.customizations?.[0]?.options[0]?.id;
}
