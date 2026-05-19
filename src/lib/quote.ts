// ============================================================
// Container Club — devis PDF (print-to-PDF)
// ============================================================

import { CATEGORY_LABEL } from "./products";
import type { CartItem, OrderTotals } from "./order";

export type QuoteData = {
  items: CartItem[];
  totals: OrderTotals;
  fillPercent: number;
  usedCbm: number;
  capacity: number;
  containerRef: string;
  port: string;
  buyer?: { name?: string; company?: string; email?: string };
};

const eur = (n: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildQuoteRef(containerRef: string): string {
  return `DV-${containerRef.replace(/\D/g, "")}-${Date.now().toString(36).slice(-5).toUpperCase()}`;
}

export function buildQuoteHtml(q: QuoteData): string {
  const today = new Date().toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const ref = buildQuoteRef(q.containerRef);

  const linesHtml = q.items
    .map((item) => {
      const cbm = item.product.cbmPerUnit * item.quantity;
      const lineTotal = item.product.basePriceHt * item.quantity;
      return `
        <tr>
          <td>
            <div class="prod">
              <span class="sw" style="background:${item.variant.hex}"></span>
              <div>
                <div class="name">${escapeHtml(item.product.name)}</div>
                <div class="meta">
                  ${escapeHtml(CATEGORY_LABEL[item.product.category])} ·
                  <span class="opt">${escapeHtml(item.variant.name)}</span> ·
                  ${escapeHtml(item.product.sku)}
                </div>
              </div>
            </div>
          </td>
          <td class="num">${item.quantity}</td>
          <td class="num">${eur(item.product.basePriceHt)}</td>
          <td class="num">${cbm.toFixed(2)} m³</td>
          <td class="num bold">${eur(lineTotal)}</td>
        </tr>`;
    })
    .join("");

  const buyer = q.buyer ?? {};
  const t = q.totals;

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
    font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #1a1a1c;
    font-size: 11px;
    line-height: 1.5;
    background: #fff;
  }
  .doc { max-width: 186mm; margin: 0 auto; }
  header {
    display: flex; justify-content: space-between; align-items: flex-start;
    border-bottom: 1.5px solid #1a1a1c; padding-bottom: 14px; margin-bottom: 22px;
  }
  .brand { display: flex; align-items: center; gap: 10px; }
  .logo {
    width: 34px; height: 34px; border-radius: 4px; background: #1a1a1c;
    color: #f4ede1; display: flex; align-items: center; justify-content: center;
    font-weight: 600; font-size: 16px;
  }
  .brand h1 { margin: 0; font-size: 16px; letter-spacing: -0.02em; font-weight: 600; }
  .brand .sub { font-size: 9px; color: #5a544a; text-transform: uppercase; letter-spacing: 0.10em; }
  .ref { text-align: right; }
  .ref .label { font-size: 9px; color: #5a544a; text-transform: uppercase; letter-spacing: 0.10em; }
  .ref .val { font-size: 18px; font-weight: 600; letter-spacing: -0.02em; }
  .ref .date { font-size: 10px; color: #5a544a; margin-top: 2px; }

  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 22px; }
  .card {
    border: 1px solid #e8dfd0; border-radius: 4px; padding: 12px 14px;
  }
  .card h3 {
    margin: 0 0 6px; font-size: 9px; text-transform: uppercase;
    letter-spacing: 0.10em; color: #5a544a; font-weight: 500;
  }
  .card .body { font-size: 11px; }
  .card .body strong { display: block; font-size: 12px; margin-bottom: 1px; font-weight: 600; }

  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  thead th {
    text-align: left; font-size: 9px; text-transform: uppercase;
    letter-spacing: 0.08em; color: #5a544a; font-weight: 500;
    padding: 8px 6px; border-bottom: 1.5px solid #1a1a1c;
  }
  tbody td { padding: 10px 6px; border-bottom: 1px solid #e8dfd0; vertical-align: middle; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .bold { font-weight: 600; }
  .prod { display: flex; align-items: center; gap: 9px; }
  .sw {
    width: 22px; height: 22px; border-radius: 3px;
    border: 1px solid rgba(0,0,0,0.08); flex-shrink: 0;
  }
  .name { font-weight: 600; font-size: 11px; }
  .meta { font-size: 9px; color: #5a544a; margin-top: 1px; }
  .opt { color: #1a1a1c; }

  .totals { display: grid; grid-template-columns: 1.4fr 1fr; gap: 16px; }
  .notes { font-size: 10px; color: #5a544a; line-height: 1.6; }
  .notes h4 { margin: 0 0 6px; font-size: 9px; text-transform: uppercase; letter-spacing: 0.10em; color: #1a1a1c; font-weight: 600; }
  .notes ul { margin: 0; padding-left: 14px; }
  .notes li { margin-bottom: 3px; }

  .summary { border: 1px solid #e8dfd0; border-radius: 4px; padding: 14px 16px; }
  .row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 11px; }
  .row.muted { color: #5a544a; }
  .row.strike .v { text-decoration: line-through; color: #5a544a; }
  .row.discount .v { color: #b85c1f; font-weight: 600; }
  .row.total { border-top: 1.5px solid #1a1a1c; margin-top: 6px; padding-top: 9px; font-weight: 700; font-size: 13px; }
  .row.savings {
    background: #f4ede1; margin: 8px -16px -8px; padding: 8px 16px;
    border-radius: 0 0 4px 4px;
  }
  .row.savings .v { color: #b85c1f; font-weight: 700; }
  .deposit {
    margin-top: 12px; padding: 12px; background: #1a1a1c; color: #f4ede1;
    border-radius: 4px; display: flex; justify-content: space-between; align-items: center;
  }
  .deposit .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.10em; opacity: 0.65; }
  .deposit .label strong { display: block; font-size: 12px; letter-spacing: -0.005em; text-transform: none; opacity: 1; margin-top: 2px; }
  .deposit .amount { font-size: 22px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }

  .schedule { margin-top: 8px; font-size: 10px; color: #5a544a; }
  .schedule .item { display: flex; justify-content: space-between; padding: 3px 0; }

  footer {
    margin-top: 24px; padding-top: 12px; border-top: 1px solid #e8dfd0;
    display: flex; justify-content: space-between; font-size: 9px; color: #5a544a;
  }
  .actions {
    position: fixed; top: 12px; right: 12px;
    background: #1a1a1c; color: #f4ede1; border: none;
    padding: 10px 16px; border-radius: 4px; cursor: pointer;
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
          <div class="sub">Pré-commande B2B · Importateur officiel France</div>
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
          <strong>${escapeHtml(q.containerRef)} — 20' High Cube</strong>
          Destination : ${escapeHtml(q.port)}<br/>
          Remplissage : ${q.fillPercent.toFixed(0)} % (${q.usedCbm.toFixed(2)} / ${q.capacity} m³)
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
      <tbody>${linesHtml || `<tr><td colspan="5" style="text-align:center;padding:24px;color:#5a544a;">Aucun article</td></tr>`}</tbody>
    </table>

    <div class="totals">
      <div class="notes">
        <h4>Échéancier de paiement</h4>
        <ul>
          <li>Réservation : 3 % (min 150 €, max 500 €), non-remboursables sauf annulation Container Club.</li>
          <li>Acompte 27 % complémentaire à 80 % de remplissage.</li>
          <li>Solde 70 % avant expédition usine après contrôle qualité SGS.</li>
        </ul>
        <h4 style="margin-top:12px;">Inclus dans le prix</h4>
        <ul>
          <li>Importation officielle, dédouanement, TVA autoliquidée.</li>
          <li>Contrôle qualité SGS indépendant avant chargement.</li>
          <li>Garantie commerciale 2 ans, SAV France, éco-participation.</li>
          <li>Devis valable 14 jours. Prix HT, TVA 20 % en sus.</li>
        </ul>
      </div>

      <div class="summary">
        <div class="row strike"><span>Équivalent retail FR</span><span class="v">${eur(t.retailReference)}</span></div>
        <div class="row muted"><span>Sous-total club HT</span><span class="v">${eur(t.subtotalHt)}</span></div>
        <div class="row muted"><span>Éco-participation</span><span class="v">${eur(t.ecoContributionTotal)}</span></div>
        <div class="row total"><span>Total HT</span><span class="v">${eur(t.totalHt)}</span></div>
        <div class="row savings"><span>Économie réalisée</span><span class="v">−${eur(t.savings)} (${t.savingsPercent.toFixed(0)} %)</span></div>
        <div class="deposit">
          <div class="label">À payer aujourd'hui<strong>Frais de réservation 3 %</strong></div>
          <div class="amount">${eur(t.payNow)}</div>
        </div>
        <div class="schedule">
          <div class="item"><span>Acompte 27 % (à 80 % remplissage)</span><span class="num">${eur(t.payAt80Percent)}</span></div>
          <div class="item"><span>Solde 70 % (avant expédition)</span><span class="num">${eur(t.payBeforeShipping)}</span></div>
        </div>
      </div>
    </div>

    <footer>
      <div>Container Club — édité par [Raison sociale] · contact@container-club.fr</div>
      <div>RCS [ville] [n°] · EORI [n°] · TVA [n°]</div>
    </footer>
  </div>
</body>
</html>`;
}

export function openQuotePDF(q: QuoteData) {
  const html = buildQuoteHtml(q);
  const win = window.open("", "_blank", "noopener,noreferrer,width=900,height=1000");
  if (!win) {
    const url = "data:text/html;charset=utf-8," + encodeURIComponent(html);
    window.open(url, "_blank");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}
