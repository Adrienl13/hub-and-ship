// ============================================================
// Container Club — générateur de devis PDF (print-to-PDF)
// ============================================================
// Ouvre une fenêtre imprimable, déclenche window.print() : l'utilisateur
// peut sauvegarder en PDF via le dialog d'impression natif.
// Aucune dépendance — rendu HTML/CSS pur, optimisé A4.
// ============================================================

import {
  CONTAINER_CBM,
  findOption,
  unitCBM,
  type Product,
} from "./products";

export type QuoteLine = {
  product: Product;
  qty: number;
  optionId?: string;
};

export type QuoteData = {
  lines: QuoteLine[];
  fillPct: number;
  usedCBM: number;
  subTotalHT: number;
  tierPct: number;
  tierDiscount: number;
  totalHT: number;
  retailEquivalent: number;
  savings: number;
  deposit: number;
  containerNumber: string;
  deliveryDate: string;
  buyer?: { name?: string; company?: string; email?: string };
};

const eur = (n: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHTML(q: QuoteData): string {
  const today = new Date().toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const ref = `CC-${q.containerNumber.replace(/\D/g, "")}-${Date.now()
    .toString(36)
    .slice(-5)
    .toUpperCase()}`;

  const linesHtml = q.lines
    .filter((l) => l.qty > 0)
    .map((l) => {
      const opt = findOption(l.product, l.optionId);
      const cbm = unitCBM(l.product) * l.qty;
      const lineTotal = l.product.price * l.qty;
      const swatch = opt?.hex ?? l.product.baseColor;
      return `
        <tr>
          <td>
            <div class="prod">
              <span class="sw" style="background:${swatch}"></span>
              <div>
                <div class="name">${escapeHtml(l.product.name)}</div>
                <div class="meta">
                  ${escapeHtml(l.product.category)}
                  ${opt ? ` · <span class="opt">${escapeHtml(opt.code ?? "")} ${escapeHtml(opt.name)}</span>` : ""}
                </div>
              </div>
            </div>
          </td>
          <td class="num">${l.qty}</td>
          <td class="num">${eur(l.product.price)}</td>
          <td class="num">${cbm.toFixed(2)} m³</td>
          <td class="num bold">${eur(lineTotal)}</td>
        </tr>`;
    })
    .join("");

  const buyer = q.buyer ?? {};

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>Devis ${ref} — Container Club</title>
<style>
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
    color: #1a1a1c;
    font-size: 11px;
    line-height: 1.45;
    background: #fff;
  }
  .doc { max-width: 186mm; margin: 0 auto; }
  header {
    display: flex; justify-content: space-between; align-items: flex-start;
    border-bottom: 2px solid #1a1a1c; padding-bottom: 14px; margin-bottom: 22px;
  }
  .brand { display: flex; align-items: center; gap: 10px; }
  .logo {
    width: 34px; height: 34px; border-radius: 8px; background: #1a1a1c;
    color: #fff; display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 16px;
  }
  .brand h1 { margin: 0; font-size: 16px; letter-spacing: -0.01em; }
  .brand .sub { font-size: 9px; color: #6a6a70; text-transform: uppercase; letter-spacing: 0.12em; }
  .ref { text-align: right; }
  .ref .label { font-size: 9px; color: #6a6a70; text-transform: uppercase; letter-spacing: 0.12em; }
  .ref .val { font-size: 18px; font-weight: 600; letter-spacing: -0.01em; }
  .ref .date { font-size: 10px; color: #6a6a70; margin-top: 2px; }

  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-bottom: 22px; }
  .card {
    border: 1px solid #e6e2d6; border-radius: 8px; padding: 12px 14px;
  }
  .card h3 {
    margin: 0 0 6px; font-size: 9px; text-transform: uppercase;
    letter-spacing: 0.12em; color: #6a6a70; font-weight: 600;
  }
  .card .body { font-size: 11px; }
  .card .body strong { display: block; font-size: 12px; margin-bottom: 1px; }

  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  thead th {
    text-align: left; font-size: 9px; text-transform: uppercase;
    letter-spacing: 0.1em; color: #6a6a70; font-weight: 600;
    padding: 8px 6px; border-bottom: 1.5px solid #1a1a1c;
  }
  tbody td { padding: 10px 6px; border-bottom: 1px solid #ece8dc; vertical-align: middle; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .bold { font-weight: 600; }
  .prod { display: flex; align-items: center; gap: 9px; }
  .sw {
    width: 22px; height: 22px; border-radius: 4px;
    border: 1px solid rgba(0,0,0,0.08); flex-shrink: 0;
  }
  .name { font-weight: 600; font-size: 11px; }
  .meta { font-size: 9px; color: #6a6a70; margin-top: 1px; }
  .opt { color: #3a3a3f; }

  .totals { display: grid; grid-template-columns: 1.4fr 1fr; gap: 18px; }
  .notes { font-size: 10px; color: #6a6a70; line-height: 1.55; }
  .notes h4 { margin: 0 0 6px; font-size: 9px; text-transform: uppercase; letter-spacing: 0.12em; color: #1a1a1c; }
  .notes ul { margin: 0; padding-left: 14px; }
  .notes li { margin-bottom: 3px; }

  .summary { border: 1px solid #e6e2d6; border-radius: 8px; padding: 14px 16px; }
  .row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 11px; }
  .row.muted { color: #6a6a70; }
  .row.strike .v { text-decoration: line-through; color: #6a6a70; }
  .row.discount .v { color: #b85c1f; font-weight: 600; }
  .row.total { border-top: 1.5px solid #1a1a1c; margin-top: 6px; padding-top: 9px; font-weight: 700; font-size: 13px; }
  .row.savings {
    background: #f4ede1; margin: 8px -16px -8px; padding: 8px 16px;
    border-radius: 0 0 8px 8px;
  }
  .row.savings .v { color: #b85c1f; font-weight: 700; }
  .deposit {
    margin-top: 12px; padding: 12px; background: #1a1a1c; color: #fff;
    border-radius: 6px; display: flex; justify-content: space-between; align-items: center;
  }
  .deposit .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; opacity: 0.7; }
  .deposit .label strong { display: block; font-size: 12px; letter-spacing: -0.005em; text-transform: none; opacity: 1; margin-top: 2px; }
  .deposit .amount { font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }

  footer {
    margin-top: 24px; padding-top: 12px; border-top: 1px solid #ece8dc;
    display: flex; justify-content: space-between; font-size: 9px; color: #6a6a70;
  }
  .actions {
    position: fixed; top: 12px; right: 12px;
    background: #1a1a1c; color: #fff; border: none;
    padding: 10px 16px; border-radius: 6px; cursor: pointer;
    font-size: 12px; font-weight: 600; box-shadow: 0 4px 12px rgba(0,0,0,0.18);
  }
  @media print { .actions { display: none; } }
</style>
</head>
<body>
  <button class="actions" onclick="window.print()">Imprimer / Sauvegarder en PDF</button>
  <div class="doc">
    <header>
      <div class="brand">
        <div class="logo">C</div>
        <div>
          <h1>Container Club</h1>
          <div class="sub">Pré-commande B2B · Direct usine</div>
        </div>
      </div>
      <div class="ref">
        <div class="label">Devis nº</div>
        <div class="val">${escapeHtml(ref)}</div>
        <div class="date">Émis le ${today}</div>
      </div>
    </header>

    <div class="grid2">
      <div class="card">
        <h3>Client</h3>
        <div class="body">
          <strong>${escapeHtml(buyer.company || "—")}</strong>
          ${buyer.name ? escapeHtml(buyer.name) + "<br/>" : ""}
          ${buyer.email ? escapeHtml(buyer.email) : ""}
        </div>
      </div>
      <div class="card">
        <h3>Container</h3>
        <div class="body">
          <strong>${escapeHtml(q.containerNumber)} — 20' High Cube</strong>
          Remplissage : ${q.fillPct.toFixed(0)} % (${q.usedCBM.toFixed(2)} / ${CONTAINER_CBM} m³)<br/>
          Livraison estimée : ${escapeHtml(q.deliveryDate)}
        </div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Produit</th>
          <th class="num">Qté</th>
          <th class="num">PU HT</th>
          <th class="num">Volume</th>
          <th class="num">Total HT</th>
        </tr>
      </thead>
      <tbody>${linesHtml || `<tr><td colspan="5" style="text-align:center;padding:24px;color:#6a6a70;">Aucun article</td></tr>`}</tbody>
    </table>

    <div class="totals">
      <div class="notes">
        <h4>Conditions</h4>
        <ul>
          <li>Acompte 30 % à la confirmation, remboursable jusqu'à clôture du container.</li>
          <li>Solde réglé avant expédition. Production lancée container plein.</li>
          <li>Livraison France métropolitaine incluse, dédouanement assuré.</li>
          <li>Certifications CE · REACH · contrôle qualité SGS inclus.</li>
          <li>Devis valable 14 jours. Prix HT, TVA 20 % en sus à la livraison.</li>
        </ul>
        <h4 style="margin-top:12px;">Personnalisation usine</h4>
        <p style="margin:0;">Tressage rotin synthétique (S-PE) ou textilène (TS) au choix.
        Plateaux table : 4 finitions. MOQ par référence : 50 unités assises, 20 unités tables.</p>
      </div>

      <div class="summary">
        <div class="row strike"><span>Équivalent retail FR</span><span class="v">${eur(q.retailEquivalent)}</span></div>
        <div class="row muted"><span>Sous-total club HT</span><span class="v">${eur(q.subTotalHT)}</span></div>
        ${q.tierPct > 0 ? `<div class="row discount"><span>Remise palier −${q.tierPct} %</span><span class="v">−${eur(q.tierDiscount)}</span></div>` : ""}
        <div class="row total"><span>Total HT</span><span class="v">${eur(q.totalHT)}</span></div>
        <div class="row savings"><span>Économie réalisée</span><span class="v">${eur(q.savings)}</span></div>
        <div class="deposit">
          <div class="label">Acompte<strong>30 % à la confirmation</strong></div>
          <div class="amount">${eur(q.deposit)}</div>
        </div>
      </div>
    </div>

    <footer>
      <div>Container Club — concept par Terrassea · hello@terrassea.fr</div>
      <div>Pros Import EURL · Paris · SIREN 123 456 789</div>
    </footer>
  </div>
</body>
</html>`;
}

export function openQuotePDF(q: QuoteData) {
  const html = buildHTML(q);
  const win = window.open("", "_blank", "noopener,noreferrer,width=900,height=1000");
  if (!win) {
    // Fallback : data URL
    const url = "data:text/html;charset=utf-8," + encodeURIComponent(html);
    window.open(url, "_blank");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}
