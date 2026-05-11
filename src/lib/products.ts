export type Product = {
  id: string;
  name: string;
  price: number; // EUR per unit
  cbm: number;   // cubic meters per unit
  color: string; // hex for 3D
  swatch: string; // tailwind-friendly hex for UI swatch
};

export const PRODUCTS: Product[] = [
  { id: "chaise",     name: "Chaise Riviera",          price: 50,  cbm: 0.018, color: "#F5F1E8", swatch: "#F5F1E8" },
  { id: "table",      name: "Table Bistrot 70cm",      price: 85,  cbm: 0.045, color: "#3A3A3F", swatch: "#3A3A3F" },
  { id: "parasol",    name: "Parasol Pro 3m",          price: 120, cbm: 0.060, color: "#D9C29A", swatch: "#D9C29A" },
  { id: "bain",       name: "Bain de soleil Cannes",   price: 140, cbm: 0.090, color: "#9C6B3F", swatch: "#9C6B3F" },
  { id: "tabouret",   name: "Tabouret Bar Aluminium",  price: 65,  cbm: 0.025, color: "#1F1F22", swatch: "#1F1F22" },
  { id: "banquette",  name: "Banquette 2 places",      price: 280, cbm: 0.180, color: "#C0653A", swatch: "#C0653A" },
];

export const CONTAINER_CBM = 33;
