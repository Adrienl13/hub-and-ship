export type Product = {
  id: string;
  name: string;
  price: number;          // EUR per unit
  // Real packaging dimensions in meters [width, depth, height] for one shipping pack
  packDim: [number, number, number];
  packQty: number;        // how many real units fit in one pack
  color: string;          // hex for 3D
  swatch: string;
  blurb: string;
};

export const PRODUCTS: Product[] = [
  {
    id: "chaise",
    name: "Chaise empilable Riviera",
    price: 49,
    // 10 chaises empilées ≈ 0,55 × 0,55 × 2,90 m  →  ≈ 0,088 CBM / chaise
    packDim: [0.55, 0.55, 2.9],
    packQty: 10,
    color: "#E8E0D0",
    swatch: "#E8E0D0",
    blurb: "Aluminium · empilable par 10",
  },
  {
    id: "table",
    name: "Plateau Bistrot Ø70",
    price: 79,
    // 2 plateaux ≈ 0,75 × 0,75 × 0,36 m  →  ≈ 0,10 CBM / plateau
    packDim: [0.75, 0.75, 0.36],
    packQty: 2,
    color: "#3A3A3F",
    swatch: "#3A3A3F",
    blurb: "Compact HPL · pied inclus",
  },
  {
    id: "parasol",
    name: "Parasol Pro Ø3 m",
    price: 139,
    // 4 parasols ≈ 0,18 × 0,18 × 3,00 m
    packDim: [0.18, 0.18, 3.0],
    packQty: 4,
    color: "#D9C29A",
    swatch: "#D9C29A",
    blurb: "Mât central alu · toile dralon",
  },
  {
    id: "bain",
    name: "Bain de soleil Cannes",
    price: 159,
    // 2 bains pliés ≈ 1,95 × 0,65 × 0,30 m
    packDim: [1.95, 0.65, 0.3],
    packQty: 2,
    color: "#9C6B3F",
    swatch: "#9C6B3F",
    blurb: "Textilène pro · cadre aluminium",
  },
  {
    id: "tabouret",
    name: "Tabouret de bar Aluminium",
    price: 69,
    // 8 tabourets empilés ≈ 0,45 × 0,45 × 1,60 m
    packDim: [0.45, 0.45, 1.6],
    packQty: 8,
    color: "#1F1F22",
    swatch: "#1F1F22",
    blurb: "Repose-pied · empilable par 8",
  },
  {
    id: "banquette",
    name: "Banquette d'angle 2 places",
    price: 329,
    // 1 banquette ≈ 1,50 × 0,75 × 0,85 m
    packDim: [1.5, 0.75, 0.85],
    packQty: 1,
    color: "#C0653A",
    swatch: "#C0653A",
    blurb: "Coussins déhoussables inclus",
  },
];

// 20ft High Cube — capacité utile ≈ 33 CBM
export const CONTAINER_CBM = 33;

export function unitCBM(p: Product) {
  const [w, d, h] = p.packDim;
  return (w * d * h) / p.packQty;
}
