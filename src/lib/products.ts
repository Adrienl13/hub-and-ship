export type ColorOption = {
  id: string;
  name: string;
  hex: string;
};

export type OptionGroup = {
  /** What the option customizes */
  kind: "weave" | "textilene" | "frame" | "top";
  label: string;
  options: ColorOption[];
};

export type Product = {
  id: string;
  name: string;
  category: "Chaise" | "Tabouret" | "Table" | "Terrasse";
  price: number;          // EUR HT — Container Club price
  retailPrice: number;    // EUR HT — équivalent grossiste FR
  // Real packaging dimensions in meters [width, depth, height] for one shipping pack
  packDim: [number, number, number];
  packQty: number;        // how many real units fit in one pack
  baseColor: string;      // default 3D color (frame)
  swatch: string;
  blurb: string;
  /** Customer-facing customization (color de tressage / textilène / etc.) */
  customization?: OptionGroup;
};

// ——— Palettes usine ———
const WEAVE_COLORS: ColorOption[] = [
  { id: "noir",   name: "Noir profond",     hex: "#1a1a1c" },
  { id: "miel",   name: "Miel",             hex: "#b8853f" },
  { id: "taupe",  name: "Taupe",            hex: "#8a7a68" },
  { id: "ivoire", name: "Ivoire",           hex: "#e8dcc4" },
  { id: "anthr",  name: "Anthracite",       hex: "#3a3a3f" },
  { id: "vert",   name: "Vert Paris",       hex: "#3a5d4a" },
];

const TEXTILENE_COLORS: ColorOption[] = [
  { id: "ecru",   name: "Écru",             hex: "#dccfb6" },
  { id: "noir",   name: "Noir",             hex: "#1c1c1e" },
  { id: "marine", name: "Bleu Marine",      hex: "#1f3a5f" },
  { id: "terra",  name: "Terracotta",       hex: "#b85c3a" },
  { id: "olive",  name: "Olive",            hex: "#6b6a3a" },
  { id: "gris",   name: "Gris perle",       hex: "#9a9a9a" },
];

const FRAME_FINISHES: ColorOption[] = [
  { id: "noir",   name: "Noir mat",         hex: "#1c1c1e" },
  { id: "blanc",  name: "Blanc cassé",      hex: "#ece4d4" },
  { id: "bronze", name: "Bronze",           hex: "#6b4a2a" },
  { id: "vert",   name: "Vert sapin",       hex: "#2d4435" },
];

const TOP_FINISHES: ColorOption[] = [
  { id: "marbre",  name: "Marbre blanc",    hex: "#e8e4dc" },
  { id: "noir",    name: "Marbre noir",     hex: "#222226" },
  { id: "chene",   name: "Chêne clair",     hex: "#c9a878" },
  { id: "noyer",   name: "Noyer",           hex: "#5e3d22" },
  { id: "compact", name: "Compact gris",    hex: "#5a5a5e" },
];

export const PRODUCTS: Product[] = [
  {
    id: "bistrot-rotin",
    name: "Chaise Bistrot Rotin",
    category: "Chaise",
    price: 42,
    retailPrice: 89,
    // 10 chaises empilées ≈ 0,52 × 0,55 × 2,80 m  →  ≈ 0,080 CBM / chaise
    packDim: [0.52, 0.55, 2.8],
    packQty: 10,
    baseColor: "#b8853f",
    swatch: "#b8853f",
    blurb: "Rotin synthétique tressé · structure alu · empilable ×10",
    customization: { kind: "weave", label: "Couleur du tressage", options: WEAVE_COLORS },
  },
  {
    id: "bistrot-cannage",
    name: "Chaise Bistrot Cannage",
    category: "Chaise",
    price: 48,
    retailPrice: 109,
    packDim: [0.5, 0.55, 2.6],
    packQty: 10,
    baseColor: "#1a1a1c",
    swatch: "#1a1a1c",
    blurb: "Dossier rond cannage · cadre acier · empilable ×10",
    customization: { kind: "frame", label: "Finition cadre", options: FRAME_FINISHES },
  },
  {
    id: "tabouret-bistrot",
    name: "Tabouret Bistrot H75",
    category: "Tabouret",
    price: 58,
    retailPrice: 129,
    packDim: [0.45, 0.45, 1.95],
    packQty: 8,
    baseColor: "#b8853f",
    swatch: "#b8853f",
    blurb: "Repose-pied · tressé · empilable ×8",
    customization: { kind: "weave", label: "Couleur du tressage", options: WEAVE_COLORS },
  },
  {
    id: "table-bistrot-60",
    name: "Table Bistrot Ø60 — Pied fonte",
    category: "Table",
    price: 89,
    retailPrice: 199,
    // 2 plateaux + pied ≈ 0,68 × 0,68 × 0,42 m  →  ≈ 0,097 CBM / table
    packDim: [0.68, 0.68, 0.42],
    packQty: 2,
    baseColor: "#e8e4dc",
    swatch: "#e8e4dc",
    blurb: "Plateau marbre ou compact · pied fonte noir",
    customization: { kind: "top", label: "Plateau", options: TOP_FINISHES },
  },
  {
    id: "mange-debout",
    name: "Table Mange-Debout Ø70",
    category: "Table",
    price: 119,
    retailPrice: 259,
    packDim: [0.78, 0.78, 1.15],
    packQty: 1,
    baseColor: "#5e3d22",
    swatch: "#5e3d22",
    blurb: "Hauteur 110 cm · plateau noyer · pied alu",
    customization: { kind: "top", label: "Plateau", options: TOP_FINISHES },
  },
  {
    id: "bain-soleil",
    name: "Bain de Soleil Cannes",
    category: "Terrasse",
    price: 159,
    retailPrice: 339,
    packDim: [1.95, 0.65, 0.3],
    packQty: 2,
    baseColor: "#dccfb6",
    swatch: "#dccfb6",
    blurb: "Textilène pro · cadre alu · 5 positions",
    customization: { kind: "textilene", label: "Couleur de la toile", options: TEXTILENE_COLORS },
  },
  {
    id: "parasol",
    name: "Parasol Pro Ø3 m",
    category: "Terrasse",
    price: 139,
    retailPrice: 289,
    packDim: [0.18, 0.18, 3.0],
    packQty: 4,
    baseColor: "#dccfb6",
    swatch: "#dccfb6",
    blurb: "Mât central alu · toile dralon",
    customization: { kind: "textilene", label: "Couleur de la toile", options: TEXTILENE_COLORS },
  },
];

// 20ft High Cube — capacité utile ≈ 33 CBM
export const CONTAINER_CBM = 33;

export function unitCBM(p: Product) {
  const [w, d, h] = p.packDim;
  return (w * d * h) / p.packQty;
}

export function getProductColor(p: Product, optionId?: string): string {
  if (!optionId || !p.customization) return p.baseColor;
  const opt = p.customization.options.find((o) => o.id === optionId);
  return opt?.hex ?? p.baseColor;
}

export function defaultOptionId(p: Product): string | undefined {
  return p.customization?.options[0]?.id;
}
