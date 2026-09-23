// Gabarits HTML des emails. Chaînes assemblées à la main — pas de react-email
// ni de JSX dans le bundle serveur. Tables et CSS en ligne pour Gmail,
// Outlook et Apple Mail ; une seule feuille <style> pour le mobile.
//
// Deux registres, un seul kit :
//   - CLIENT : plaque laiton en en-tête, titre en serif, chiffre-clé,
//     prochaines étapes, bouton bleu. Le ton du site.
//   - INTERNE (admin) : bandeau sombre « Notification interne », fiche
//     contact cliquable (mailto/tel), bouton vers l'admin. Reconnaissable
//     d'un coup d'œil dans la boîte de réception.
//
// Toute valeur venue de l'extérieur passe par escape().

const CONTACT_EMAIL = 'contact@terrassea.com'
const SITE_URL = 'https://terrassea.com'
const SITE_LABEL = 'terrassea.com'
// PNG et non SVG : Gmail et Outlook n'affichent pas les SVG distants.
const LOGO_URL = `${SITE_URL}/brand/terrassea-logo-email.png`
const ADDRESS = '60 Rue François Ier, 75008 Paris'
const LEGAL = 'RCS Paris 988 269 981 · SIRET 98826998100011'
const HOURS = 'Lun – Ven · 9h – 18h'
const TEXT_SIGNATURE = `Terrassea — Pros Import EURL
${ADDRESS}
${SITE_LABEL} · ${CONTACT_EMAIL} · ${HOURS}`

// Charte du site (src/components/public-design, tokens --color-*).
const C = {
  bg: '#f3f2f2',
  card: '#ffffff',
  cream: '#faf8f2',
  ink: '#201e1d',
  body: '#3d3a38',
  muted: '#6f6b68',
  border: '#e6e5e4',
  rule: '#d2d1d0',
  blue: '#006d8f',
  blueDeep: '#005c78',
  blueSoft: '#e4f2f7',
  success: '#2d6a4f',
  successSoft: '#e3f1ea',
  warning: '#8a5a1a',
  warningSoft: '#f7ecd9',
  danger: '#8a3a2a',
  dangerSoft: '#f0d8cc',
  dark: '#201e1d',
} as const

const FONT_TEXT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
const FONT_TITLE = "Georgia,'Times New Roman',serif"

export interface ReservationEmailInput {
  readonly reference: string
  readonly contactName: string
  readonly contactCompany: string
  readonly contactEmail: string
  readonly contactPhone: string
  readonly siret: string
  readonly containerReference: string
  /** Somme des lignes AVANT remise volume. */
  readonly subtotalHt: number
  /** Montant HT de la remise volume déduite (0 si aucune). */
  readonly volumeDiscount: number
  /** Total HT réellement dû (net de remise) — cohérent avec totalTtc. */
  readonly totalHt: number
  readonly totalTtc: number
  readonly payNow: number
  readonly lines: ReadonlyArray<{
    readonly productName: string
    readonly variantName: string
    readonly quantity: number
    readonly subtotalHt: number
  }>
  readonly accountUrl: string
  /**
   * Tunnel « devis » (src/lib/reservations/mode.ts) : rien n'est encaissé sur
   * le site. Le client reçoit son devis, Terrassea le reçoit en même temps et
   * rappelle avec ses coordonnées bancaires. Change le ton des deux e-mails :
   * annoncer « à régler maintenant » serait faux.
   */
  readonly quoteMode?: boolean
  /** Mode de livraison choisi, déjà libellé en clair. */
  readonly deliveryLabel?: string
  /** Note libre du client : ville, accès, contraintes de déchargement. */
  readonly deliveryNote?: string
  /** Volume total, pour juger du remplissage container d'un coup d'œil. */
  readonly totalCbm?: number
  /** Code apporteur saisi au checkout, s'il y en a un. */
  readonly referralCode?: string
}

function escape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatEur(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

// ---------------------------------------------------------------------------
// Kit de composants
// ---------------------------------------------------------------------------

type Tone = 'info' | 'success' | 'warning' | 'danger'

const TONE: Record<Tone, { readonly fg: string; readonly bg: string }> = {
  info: { fg: C.blueDeep, bg: C.blueSoft },
  success: { fg: C.success, bg: C.successSoft },
  warning: { fg: C.warning, bg: C.warningSoft },
  danger: { fg: C.danger, bg: C.dangerSoft },
}

/** Un paragraphe courant. `html` est déjà échappé par l'appelant. */
function p(html: string, opts: { muted?: boolean; small?: boolean } = {}) {
  const color = opts.muted ? C.muted : C.body
  const size = opts.small ? '13px' : '15px'
  return `<p style="margin:0 0 16px;font-size:${size};line-height:1.65;color:${color};">${html}</p>`
}

function greeting(name: string | null | undefined): string {
  const who = name?.trim()
  return p(
    `<span style="color:${C.ink};font-weight:600;">Bonjour${who ? ` ${escape(who)}` : ''},</span>`,
  )
}

/**
 * Chiffre-clé : le montant ou la référence que l'on cherche en ouvrant
 * l'email, en gros, dans un cadre crème. Jusqu'à trois cases côte à côte.
 */
function hero(
  cells: ReadonlyArray<{
    readonly label: string
    readonly value: string
    readonly tone?: 'blue' | 'ink' | 'danger'
  }>,
): string {
  const width = Math.floor(100 / cells.length)
  const tds = cells
    .map((cell, i) => {
      const color =
        cell.tone === 'blue'
          ? C.blue
          : cell.tone === 'danger'
            ? C.danger
            : C.ink
      const border = i > 0 ? `border-left:1px solid ${C.rule};` : ''
      // Une référence longue (TR-2026-014-0031) ne doit jamais se couper :
      // plus petite quand il y a trois cases, et jamais de césure.
      const size =
        cells.length > 2 ? '18px' : cell.value.length > 14 ? '19px' : '22px'
      return `<td class="hero-cell" width="${width}%" valign="top" style="padding:18px 20px;${border}">
<div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:${C.muted};font-family:${FONT_TEXT};white-space:nowrap;">${escape(cell.label)}</div>
<div style="margin-top:6px;font-size:${size};line-height:1.25;font-weight:700;color:${color};font-family:${FONT_TITLE};white-space:nowrap;">${escape(cell.value)}</div>
</td>`
    })
    .join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 24px;background:${C.cream};border:1px solid ${C.border};border-radius:8px;">
<tr>${tds}</tr>
</table>`
}

/** Tableau des lignes de commande : en-tête, quantités, montants alignés. */
function linesTable(lines: ReservationEmailInput['lines']): string {
  if (lines.length === 0) return ''
  const th = (label: string, align: 'left' | 'right') =>
    `<th align="${align}" style="padding:10px 12px;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;font-weight:600;color:${C.muted};border-bottom:2px solid ${C.ink};text-align:${align};">${label}</th>`
  const rows = lines
    .map(
      (line, i) => `<tr style="background:${i % 2 ? C.cream : C.card};">
<td style="padding:12px;border-bottom:1px solid ${C.border};font-size:14px;color:${C.ink};">
<div style="font-weight:600;">${escape(line.productName)}</div>
<div style="margin-top:2px;font-size:12px;color:${C.muted};">${escape(line.variantName)}</div>
</td>
<td align="right" style="padding:12px;border-bottom:1px solid ${C.border};font-size:14px;color:${C.body};white-space:nowrap;text-align:right;">${line.quantity}</td>
<td align="right" style="padding:12px;border-bottom:1px solid ${C.border};font-size:14px;color:${C.ink};font-weight:600;white-space:nowrap;text-align:right;">${formatEur(line.subtotalHt)}</td>
</tr>`,
    )
    .join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;border-collapse:collapse;">
<thead><tr>${th('Produit', 'left')}${th('Qté', 'right')}${th('Montant HT', 'right')}</tr></thead>
<tbody>${rows}</tbody>
</table>`
}

interface TotalRow {
  readonly label: string
  readonly value: string
  readonly strong?: boolean
  readonly tone?: 'success' | 'blue'
}

/** Bloc des totaux, la ligne forte soulignée d'un trait. */
function totals(rows: ReadonlyArray<TotalRow>): string {
  const trs = rows
    .map((row) => {
      const color =
        row.tone === 'success'
          ? C.success
          : row.tone === 'blue'
            ? C.blue
            : row.strong
              ? C.ink
              : C.body
      const weight = row.strong ? '700' : '400'
      const size = row.strong ? '16px' : '14px'
      const top = row.strong ? `border-top:1px solid ${C.rule};` : ''
      return `<tr>
<td style="padding:7px 12px;${top}font-size:${size};color:${color};font-weight:${weight};">${escape(row.label)}</td>
<td align="right" style="padding:7px 12px;${top}font-size:${size};color:${color};font-weight:${weight};white-space:nowrap;text-align:right;">${escape(row.value)}</td>
</tr>`
    })
    .join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
${trs}
</table>`
}

/** Fiche libellé / valeur (emails internes). `valueHtml` déjà échappé. */
function facts(
  rows: ReadonlyArray<{ readonly label: string; readonly valueHtml: string }>,
): string {
  const trs = rows
    .map(
      (row) => `<tr>
<td width="34%" valign="top" style="padding:9px 12px;border-bottom:1px solid ${C.border};font-size:12px;letter-spacing:0.04em;text-transform:uppercase;color:${C.muted};">${escape(row.label)}</td>
<td valign="top" style="padding:9px 12px;border-bottom:1px solid ${C.border};font-size:14px;color:${C.ink};">${row.valueHtml}</td>
</tr>`,
    )
    .join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;border:1px solid ${C.border};border-radius:8px;border-collapse:separate;overflow:hidden;">
${trs}
</table>`
}

const fact = (label: string, value: string) => ({
  label,
  valueHtml: escape(value),
})
const strongFact = (label: string, value: string) => ({
  label,
  valueHtml: `<strong>${escape(value)}</strong>`,
})
const monoFact = (label: string, value: string) => ({
  label,
  valueHtml: `<span style="font-family:Menlo,Consolas,monospace;font-size:13px;">${escape(value)}</span>`,
})
const mailFact = (label: string, email: string) => ({
  label,
  valueHtml: `<a href="mailto:${escape(email)}" style="color:${C.blue};text-decoration:none;">${escape(email)}</a>`,
})
const telFact = (label: string, phone: string) => ({
  label,
  valueHtml: `<a href="tel:${escape(phone.replace(/\s/g, ''))}" style="color:${C.blue};text-decoration:none;">${escape(phone)}</a>`,
})

/** Encart coloré : information, confirmation, avertissement, alerte. */
function callout(
  tone: Tone,
  html: string,
  opts: { title?: string } = {},
): string {
  const { fg, bg } = TONE[tone]
  const title = opts.title
    ? `<div style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;color:${fg};margin-bottom:6px;">${escape(opts.title)}</div>`
    : ''
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
<tr><td style="padding:14px 18px;background:${bg};border-left:4px solid ${fg};border-radius:0 8px 8px 0;font-size:14px;line-height:1.6;color:${C.ink};">${title}${html}</td></tr>
</table>`
}

/** Les prochaines étapes, numérotées. */
function steps(
  items: ReadonlyArray<{ readonly title: string; readonly detail?: string }>,
  heading = 'Et maintenant ?',
): string {
  const rows = items
    .map(
      (item, i) => `<tr>
<td width="36" valign="top" style="padding:0 0 14px;">
<div style="width:28px;height:28px;line-height:28px;border-radius:14px;background:${C.blue};color:#ffffff;font-size:13px;font-weight:700;text-align:center;">${i + 1}</div>
</td>
<td valign="top" style="padding:3px 0 14px 4px;">
<div style="font-size:14px;font-weight:600;color:${C.ink};">${escape(item.title)}</div>
${item.detail ? `<div style="margin-top:2px;font-size:13px;line-height:1.55;color:${C.muted};">${escape(item.detail)}</div>` : ''}
</td>
</tr>`,
    )
    .join('')
  return `<div style="margin:0 0 10px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;color:${C.muted};">${escape(heading)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;">
${rows}
</table>`
}

/** Bouton « pare-balles » : une table, pas un <a> stylé — Outlook oblige. */
function button(
  label: string,
  url: string,
  tone: 'primary' | 'dark' | 'danger' = 'primary',
): string {
  const bg = tone === 'dark' ? C.dark : tone === 'danger' ? C.danger : C.blue
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:8px auto 24px;">
<tr><td align="center" bgcolor="${bg}" style="border-radius:6px;">
<a href="${escape(url)}" style="display:inline-block;padding:14px 28px;font-family:${FONT_TEXT};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;">${escape(label)}</a>
</td></tr>
</table>`
}

/** Message libre cité (formulaire de contact, note client). */
function quote(text: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
<tr><td style="padding:16px 18px;background:${C.cream};border:1px solid ${C.border};border-radius:8px;font-size:14px;line-height:1.7;color:${C.body};white-space:pre-wrap;font-family:${FONT_TITLE};font-style:italic;">${escape(text)}</td></tr>
</table>`
}

function signature(): string {
  return `<p style="margin:8px 0 0;font-size:14px;line-height:1.6;color:${C.body};">À très vite,<br><strong style="color:${C.ink};">L'équipe Terrassea</strong></p>`
}

function replyNote(
  text = 'Une question ? Répondez simplement à cet email, nous sommes dans la boucle.',
) {
  return p(escape(text), { muted: true, small: true })
}

interface ShellInput {
  /** Petit libellé au-dessus du titre : « Votre devis », « Facture »… */
  readonly eyebrow: string
  readonly title: string
  readonly preheader: string
  readonly body: string
  /** `internal` = notification pour Terrassea, bandeau sombre. */
  readonly audience?: 'client' | 'internal'
}

function shell({
  eyebrow,
  title,
  preheader,
  body,
  audience = 'client',
}: ShellInput): string {
  const internal = audience === 'internal'
  const header = internal
    ? `<tr><td style="padding:14px 32px;background:${C.dark};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="font-size:11px;letter-spacing:0.14em;text-transform:uppercase;font-weight:700;color:#d9b54a;font-family:${FONT_TEXT};">Notification interne</td>
<td align="right" style="font-size:12px;color:#b8b4b0;font-family:${FONT_TEXT};text-align:right;">Terrassea · admin</td>
</tr></table>
</td></tr>`
    : `<tr><td align="center" style="padding:28px 32px 20px;background:${C.cream};border-bottom:1px solid ${C.border};">
<a href="${SITE_URL}" style="text-decoration:none;"><img src="${LOGO_URL}" width="150" height="70" alt="Terrassea" style="display:block;width:150px;height:auto;border:0;"></a>
</td></tr>`
  const eyebrowColor = internal ? '#d9b54a' : C.blue
  return `<!DOCTYPE html>
<html lang="fr" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escape(title)}</title>
<style>
  @media only screen and (max-width: 620px) {
    .wrap { width: 100% !important; }
    .pad { padding-left: 20px !important; padding-right: 20px !important; }
    .hero-cell { display: block !important; width: 100% !important; border-left: 0 !important; border-top: 1px solid ${C.rule}; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.bg};font-family:${FONT_TEXT};color:${C.ink};-webkit-font-smoothing:antialiased;">
<div style="display:none;font-size:1px;color:${C.bg};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escape(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg};">
<tr><td align="center" style="padding:32px 12px;">
<table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background:${C.card};border:1px solid ${C.border};border-radius:12px;overflow:hidden;">
${header}
<tr><td class="pad" style="padding:32px 40px 8px;">
<div style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;font-weight:700;color:${eyebrowColor};">${escape(eyebrow)}</div>
<h1 style="margin:8px 0 20px;font-family:${FONT_TITLE};font-size:28px;line-height:1.2;font-weight:700;color:${C.ink};">${escape(title)}</h1>
</td></tr>
<tr><td class="pad" style="padding:0 40px 28px;">
${body}
</td></tr>
<tr><td class="pad" style="padding:22px 40px 26px;background:${C.cream};border-top:1px solid ${C.border};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="font-size:12px;line-height:1.7;color:${C.muted};">
<strong style="color:${C.ink};">Terrassea</strong> — mobilier outdoor pour restaurants et hôtels, importé en direct.<br>
<a href="${SITE_URL}" style="color:${C.blue};text-decoration:none;font-weight:600;">${SITE_LABEL}</a> · <a href="mailto:${CONTACT_EMAIL}" style="color:${C.blue};text-decoration:none;">${CONTACT_EMAIL}</a> · ${HOURS}<br>
Une marque de Pros Import EURL · ${ADDRESS}<br>
<span style="color:#9c9895;">${LEGAL}</span>
</td>
</tr></table>
</td></tr>
</table>
<div style="margin:16px 0 0;font-size:11px;line-height:1.6;color:#9c9895;max-width:600px;">${internal ? 'Email automatique envoyé à l’administrateur Terrassea.' : 'Vous recevez cet email parce qu’une demande a été effectuée avec cette adresse sur terrassea.com.'}</div>
</td></tr>
</table>
</body>
</html>`
}

// ---------------------------------------------------------------------------
// Réservation / devis
// ---------------------------------------------------------------------------

function reservationTotals(
  input: ReservationEmailInput,
  payLabel: string | null,
): string {
  const rows: TotalRow[] = []
  if (input.volumeDiscount > 0) {
    rows.push({ label: 'Sous-total HT', value: formatEur(input.subtotalHt) })
    rows.push({
      label: 'Remise volume',
      value: `−${formatEur(input.volumeDiscount)}`,
      tone: 'success',
    })
  }
  rows.push({
    label: 'Total HT',
    value: formatEur(input.totalHt),
    strong: true,
  })
  rows.push({ label: 'Total TTC', value: formatEur(input.totalTtc) })
  if (payLabel) {
    rows.push({
      label: payLabel,
      value: formatEur(input.payNow),
      tone: 'blue',
      strong: true,
    })
  }
  return totals(rows)
}

function reservationTextLines(input: ReservationEmailInput): string {
  return input.lines
    .map(
      (l) =>
        `- ${l.productName} (${l.variantName}) · ${l.quantity} unités · ${formatEur(l.subtotalHt)}`,
    )
    .join('\n')
}

function reservationTextTotals(input: ReservationEmailInput): string {
  const discount =
    input.volumeDiscount > 0
      ? `Sous-total HT : ${formatEur(input.subtotalHt)}\nRemise volume : −${formatEur(input.volumeDiscount)}\n`
      : ''
  return `${discount}Total HT : ${formatEur(input.totalHt)}\nTotal TTC : ${formatEur(input.totalTtc)}`
}

export function buildReservationCreatedEmailToUser(
  input: ReservationEmailInput,
): { subject: string; html: string; text: string } {
  const quoteMode = input.quoteMode === true
  const subject = quoteMode
    ? `Votre devis Terrassea — ${input.reference}`
    : `Réservation enregistrée — ${input.reference}`
  const preheader = quoteMode
    ? `Votre devis pour le container ${input.containerReference}. Prix fermes, aucun paiement demandé — nous vous rappelons sous 24 h ouvrées.`
    : `Votre place sur le container ${input.containerReference} est sécurisée. Détails et prochaines étapes ci-dessous.`

  const intro = quoteMode
    ? p(
        `Voici votre devis pour le container <strong style="color:${C.ink};">${escape(input.containerReference)}</strong>. Les prix sont fermes, et nous partirons de ce document lors de notre appel.`,
      )
    : p(
        `Votre réservation pour le container <strong style="color:${C.ink};">${escape(input.containerReference)}</strong> est bien enregistrée. Il ne reste qu'une étape pour verrouiller votre place.`,
      )

  const notice = quoteMode
    ? callout(
        'info',
        `Aucun paiement n'est demandé à ce stade et rien n'a été prélevé. Le devis engage nos prix, pas votre commande.`,
        { title: 'Bon à savoir' },
      )
    : callout(
        'info',
        `Un membre Terrassea vous recontacte sous 24 h pour finaliser les frais de réservation (<strong>${formatEur(input.payNow)}</strong>, déduits du total). À réception, votre place est verrouillée.`,
        { title: 'Prochaine étape' },
      )

  const nextSteps = quoteMode
    ? steps([
        {
          title: 'Nous vous rappelons sous 24 h ouvrées',
          detail: 'Pour valider ensemble matières, quantités et délai.',
        },
        {
          title: 'Vous recevez nos coordonnées bancaires',
          detail: 'La commande est engagée à réception de l’acompte.',
        },
        {
          title: 'Production, contrôle qualité et transport',
          detail:
            'Chaque étape apparaît dans votre espace, jusqu’à la livraison.',
        },
      ])
    : steps([
        {
          title: 'Règlement des frais de réservation',
          detail: `${formatEur(input.payNow)}, déduits du total de la commande.`,
        },
        {
          title: 'Votre place est verrouillée',
          detail: 'Le container part dès qu’il est complet.',
        },
        {
          title: 'Production, contrôle qualité et transport',
          detail:
            'Chaque étape apparaît dans votre espace, jusqu’à la livraison.',
        },
      ])

  const body = `${greeting(input.contactName)}
${intro}
${hero([
  { label: quoteMode ? 'Devis' : 'Réservation', value: input.reference },
  { label: 'Total HT', value: formatEur(input.totalHt), tone: 'blue' },
])}
${linesTable(input.lines)}
${reservationTotals(input, quoteMode ? null : 'À régler maintenant')}
${notice}
${nextSteps}
${button(quoteMode ? 'Voir mon devis' : 'Voir ma réservation', input.accountUrl)}
${replyNote()}
${signature()}`

  const text = `Bonjour ${input.contactName},

${
  quoteMode
    ? `Voici votre devis ${input.reference} pour le container ${input.containerReference}. Les prix sont fermes.

Aucun paiement n'est demandé à ce stade et rien n'a été prélevé. Nous vous rappelons sous 24 h ouvrées pour valider matières, quantités et délai, puis vous transmettre nos coordonnées bancaires.`
    : `Votre réservation ${input.reference} pour le container ${input.containerReference} est bien enregistrée.

Un membre Terrassea vous recontacte sous 24 h pour finaliser les frais de réservation (${formatEur(input.payNow)}).`
}

Récapitulatif :
${reservationTextLines(input)}

${reservationTextTotals(input)}
${quoteMode ? '' : `À régler : ${formatEur(input.payNow)}\n`}
${quoteMode ? 'Voir votre devis' : 'Voir votre réservation'} : ${input.accountUrl}

Une question ? Répondez simplement à cet email.

${TEXT_SIGNATURE}`

  return {
    subject,
    html: shell({
      eyebrow: quoteMode ? 'Votre devis' : 'Votre réservation',
      title: quoteMode ? 'Votre devis est prêt' : 'Réservation enregistrée',
      preheader,
      body,
    }),
    text,
  }
}

export function buildReservationCreatedEmailToAdmin(
  input: ReservationEmailInput,
): { subject: string; html: string; text: string } {
  const quoteMode = input.quoteMode === true
  const subject = quoteMode
    ? `[Terrassea] Devis ${input.reference} — ${input.contactCompany} — ${formatEur(input.totalHt)} HT`
    : `[Terrassea] Nouvelle résa ${input.reference} — ${input.contactCompany}`
  const preheader = quoteMode
    ? `${input.contactCompany} (${input.siret}) demande un devis de ${formatEur(input.totalHt)} HT sur ${input.containerReference}. À rappeler.`
    : `${input.contactCompany} (${input.siret}) a réservé pour ${formatEur(input.totalHt)} HT sur ${input.containerReference}.`
  const payLabel = quoteMode ? 'Acompte à appeler (3 %)' : 'Frais à appeler'

  const contactRows = [
    strongFact('Société', input.contactCompany),
    monoFact('SIRET', input.siret),
    fact('Contact', input.contactName),
    mailFact('Email', input.contactEmail),
    telFact('Téléphone', input.contactPhone),
    monoFact('Container', input.containerReference),
  ]
  if (input.deliveryLabel)
    contactRows.push(fact('Livraison', input.deliveryLabel))
  if (typeof input.totalCbm === 'number' && input.totalCbm > 0) {
    contactRows.push(fact('Volume', `${input.totalCbm.toFixed(2)} m³`))
  }
  if (input.referralCode)
    contactRows.push(monoFact('Code apporteur', input.referralCode))

  const body = `${callout(
    quoteMode ? 'warning' : 'info',
    quoteMode
      ? 'Devis envoyé au client. À rappeler sous 24 h ouvrées, avec les coordonnées bancaires.'
      : 'Nouvelle réservation à traiter sous 24 h.',
    { title: 'À faire' },
  )}
${hero([
  { label: quoteMode ? 'Devis' : 'Réservation', value: input.reference },
  { label: 'Total HT', value: formatEur(input.totalHt), tone: 'blue' },
  { label: payLabel, value: formatEur(input.payNow) },
])}
${facts(contactRows)}
${input.deliveryNote ? `<div style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;color:${C.muted};">Note du client</div>${quote(input.deliveryNote)}` : ''}
${linesTable(input.lines)}
${reservationTotals(input, payLabel)}
${button("Ouvrir dans l'admin", input.accountUrl, 'dark')}`

  const text = `${quoteMode ? 'Devis envoyé au client. À rappeler sous 24 h ouvrées, avec les coordonnées bancaires.' : 'Nouvelle réservation à traiter sous 24h.'}

Référence : ${input.reference}
Container : ${input.containerReference}
Société : ${input.contactCompany}
SIRET : ${input.siret}
Contact : ${input.contactName} <${input.contactEmail}> · ${input.contactPhone}
${input.deliveryLabel ? `Livraison : ${input.deliveryLabel}\n` : ''}${input.deliveryNote ? `Note client : ${input.deliveryNote}\n` : ''}${typeof input.totalCbm === 'number' && input.totalCbm > 0 ? `Volume : ${input.totalCbm.toFixed(2)} m³\n` : ''}${input.referralCode ? `Code apporteur : ${input.referralCode}\n` : ''}
Lignes :
${reservationTextLines(input)}

${reservationTextTotals(input)}
${payLabel} : ${formatEur(input.payNow)}

Ouvrir : ${input.accountUrl}`

  return {
    subject,
    html: shell({
      eyebrow: quoteMode ? 'Devis' : 'Réservation',
      title: quoteMode ? 'Nouveau devis à rappeler' : 'Nouvelle réservation',
      preheader,
      body,
      audience: 'internal',
    }),
    text,
  }
}

// ---------------------------------------------------------------------------
// Paiement confirmé (webhook Stripe)
// ---------------------------------------------------------------------------

export interface PaymentConfirmedEmailInput {
  readonly reference: string
  readonly containerReference: string
  readonly customerEmail: string | null
  readonly amountPaid: number | null
  readonly accountUrl: string
  /** True when accountUrl is a one-time magic sign-in link. */
  readonly accountLinkIsMagic?: boolean
}

export function buildPaymentConfirmedEmailToUser(
  input: PaymentConfirmedEmailInput,
): { subject: string; html: string; text: string } {
  const subject = `Paiement confirmé — ${input.reference}`
  const preheader = `Votre place sur le container ${input.containerReference} est verrouillée.`
  const heroCells = [
    { label: 'Réservation', value: input.reference },
    ...(input.amountPaid
      ? [
          {
            label: 'Montant réglé',
            value: formatEur(input.amountPaid),
            tone: 'blue' as const,
          },
        ]
      : []),
  ]
  const body = `${greeting(null)}
${p(
  `Nous confirmons la réception de votre paiement pour le container <strong style="color:${C.ink};">${escape(input.containerReference)}</strong>. Votre place est désormais <strong style="color:${C.ink};">verrouillée</strong>.`,
)}
${hero(heroCells)}
${callout('success', 'Merci pour votre confiance. Votre réservation est ferme : plus rien à faire de votre côté pour l’instant.', { title: 'Place verrouillée' })}
${steps([
  {
    title: 'Production et contrôle qualité',
    detail:
      'Le container part dès qu’il est complet ; les essais SGS sont réalisés avant chargement.',
  },
  {
    title: 'Transport et dédouanement',
    detail: 'Nous gérons l’import et vous tenons informé des dates.',
  },
  {
    title: 'Livraison',
    detail:
      'Solde et livraison planifiés avec vous, à l’approche de l’arrivée.',
  },
])}
${button('Voir ma réservation', input.accountUrl)}
${
  input.accountLinkIsMagic
    ? p(
        'Ce bouton vous connecte automatiquement, sans mot de passe. Lien à usage unique — ensuite, connectez-vous avec votre email sur terrassea.com.',
        { muted: true, small: true },
      )
    : ''
}
${signature()}`
  const text = `Bonjour,

Nous confirmons la réception de votre paiement pour la réservation ${input.reference} (container ${input.containerReference}). Votre place est verrouillée.
${input.amountPaid ? `Montant réglé : ${formatEur(input.amountPaid)}\n` : ''}
Voir votre réservation (connexion automatique) : ${input.accountUrl}
${input.accountLinkIsMagic ? 'Lien à usage unique — ensuite, connectez-vous avec votre email sur terrassea.com.\n' : ''}
${TEXT_SIGNATURE}`
  return {
    subject,
    html: shell({
      eyebrow: 'Paiement',
      title: 'Paiement confirmé',
      preheader,
      body,
    }),
    text,
  }
}

export function buildPaymentConfirmedAdminEmail(
  input: PaymentConfirmedEmailInput,
): { subject: string; html: string; text: string } {
  const subject = `Paiement reçu — ${input.reference}`
  const preheader = `Container ${input.containerReference}`
  const rows = [
    monoFact('Référence', input.reference),
    monoFact('Container', input.containerReference),
  ]
  if (input.customerEmail) rows.push(mailFact('Client', input.customerEmail))
  const body = `${callout('success', 'Frais de réservation payés. La place est verrouillée côté client.', { title: 'Encaissé' })}
${input.amountPaid ? hero([{ label: 'Montant', value: formatEur(input.amountPaid), tone: 'blue' }]) : ''}
${facts(rows)}
${button("Ouvrir dans l'admin", input.accountUrl, 'dark')}`
  const text = `Frais de réservation payés.

Référence : ${input.reference}
Container : ${input.containerReference}
${input.customerEmail ? `Client : ${input.customerEmail}\n` : ''}${input.amountPaid ? `Montant : ${formatEur(input.amountPaid)}\n` : ''}`
  return {
    subject,
    html: shell({
      eyebrow: 'Paiement',
      title: 'Paiement reçu',
      preheader,
      body,
      audience: 'internal',
    }),
    text,
  }
}

// ---------------------------------------------------------------------------
// Facture
// ---------------------------------------------------------------------------

export interface InvoiceEmailInput {
  readonly number: string
  readonly reference: string
  readonly totalTtc: number
  readonly invoiceUrl: string
}

export function buildInvoiceEmailToUser(input: InvoiceEmailInput): {
  subject: string
  html: string
  text: string
} {
  const subject = `Votre facture ${input.number}`
  const preheader = `Facture ${input.number} pour la réservation ${input.reference}.`
  const body = `${greeting(null)}
${p(
  `Votre facture pour la réservation <strong style="color:${C.ink};">${escape(input.reference)}</strong> est disponible. Vous pouvez la consulter et la télécharger en PDF depuis votre espace.`,
)}
${hero([
  { label: 'Facture', value: input.number },
  { label: 'Montant TTC', value: formatEur(input.totalTtc), tone: 'blue' },
])}
${button('Voir / télécharger la facture', input.invoiceUrl)}
${p('Cette facture est émise par Pros Import EURL, société éditrice de Terrassea. Elle reste accessible à tout moment dans votre espace.', { muted: true, small: true })}
${replyNote('Une question sur cette facture ? Répondez simplement à cet email.')}
${signature()}`
  const text = `Bonjour,

Votre facture ${input.number} pour la réservation ${input.reference} est disponible.
Montant TTC : ${formatEur(input.totalTtc)}

Voir / télécharger : ${input.invoiceUrl}

Une question sur cette facture ? Répondez simplement à cet email.

${TEXT_SIGNATURE}`
  return {
    subject,
    html: shell({
      eyebrow: 'Facture',
      title: 'Votre facture est disponible',
      preheader,
      body,
    }),
    text,
  }
}

// ---------------------------------------------------------------------------
// Partenaires
// ---------------------------------------------------------------------------

export interface PartnerRequestEmailInput {
  readonly isDeal: boolean
  readonly companyName: string
  readonly contactName: string
  readonly contactEmail: string
  readonly contactPhone: string
  readonly partnerKindLabel: string
  readonly territory: string | null
  readonly expectedMonthlyVolume: string | null
  readonly message: string | null
  readonly clientCompanyName: string | null
  readonly projectType: string | null
  readonly adminUrl: string
}

export function buildPartnerRequestAdminEmail(
  input: PartnerRequestEmailInput,
): {
  subject: string
  html: string
  text: string
} {
  const kind = input.isDeal
    ? 'Opportunité partenaire'
    : 'Candidature partenaire'
  const subject = `${kind} — ${input.companyName}`
  const preheader = `${input.companyName} · ${input.contactEmail}`
  const rows = [
    strongFact('Société', input.companyName),
    fact('Type', input.partnerKindLabel),
    fact('Contact', input.contactName),
    mailFact('Email', input.contactEmail),
    telFact('Téléphone', input.contactPhone),
  ]
  if (input.territory) rows.push(fact('Territoire', input.territory))
  if (input.expectedMonthlyVolume)
    rows.push(fact('Volume estimé', input.expectedMonthlyVolume))
  if (input.clientCompanyName)
    rows.push(strongFact('Client protégé', input.clientCompanyName))
  if (input.projectType) rows.push(fact('Projet', input.projectType))
  const body = `${callout(
    input.isDeal ? 'warning' : 'info',
    input.isDeal
      ? 'Un partenaire déclare un client : à qualifier et attribuer avant que le client ne passe en direct.'
      : 'Nouvelle candidature à étudier sous 48 h ouvrées — le candidat a reçu un accusé de réception.',
    { title: 'À faire' },
  )}
${facts(rows)}
${input.message ? `<div style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;color:${C.muted};">Message</div>${quote(input.message)}` : ''}
${button("Ouvrir dans l'admin", input.adminUrl, 'dark')}`
  const text = `Nouvelle ${kind.toLowerCase()} reçue.

Société : ${input.companyName}
Type : ${input.partnerKindLabel}
Contact : ${input.contactName} · ${input.contactPhone}
Email : ${input.contactEmail}
${input.territory ? `Territoire : ${input.territory}\n` : ''}${input.expectedMonthlyVolume ? `Volume estimé : ${input.expectedMonthlyVolume}\n` : ''}${input.clientCompanyName ? `Client protégé : ${input.clientCompanyName}\n` : ''}${input.projectType ? `Projet : ${input.projectType}\n` : ''}${input.message ? `\n${input.message}\n` : ''}
Admin : ${input.adminUrl}`
  return {
    subject,
    html: shell({
      eyebrow: 'Partenaires',
      title: kind,
      preheader,
      body,
      audience: 'internal',
    }),
    text,
  }
}

export function buildPartnerRequestConfirmationEmail(
  input: PartnerRequestEmailInput,
): { subject: string; html: string; text: string } {
  const subject = 'Votre demande partenaire est bien reçue'
  const preheader = 'Terrassea revient vers vous sous 48 h ouvrées.'
  const body = `${greeting(input.contactName)}
${p(
  `Nous avons bien reçu votre demande pour <strong style="color:${C.ink};">${escape(input.companyName)}</strong>. Merci de votre intérêt pour le réseau Terrassea.`,
)}
${hero([
  { label: 'Société', value: input.companyName },
  { label: 'Profil', value: input.partnerKindLabel, tone: 'blue' },
])}
${steps([
  {
    title: 'Étude de votre dossier',
    detail: 'Notre équipe l’examine et revient vers vous sous 48 h ouvrées.',
  },
  {
    title: 'Échange téléphonique',
    detail: 'Pour comprendre votre activité, vos volumes et votre territoire.',
  },
  {
    title: 'Ouverture de votre espace partenaire',
    detail:
      'Prix nets privés, sélections, suivi de vos clients et de vos commissions.',
  },
])}
${callout('info', 'Terrassea protège ses partenaires : prix nets privés, marge libre, attribution de vos clients.', { title: 'Notre engagement' })}
${replyNote('Un élément à ajouter à votre dossier ? Répondez simplement à cet email.')}
${signature()}`
  const text = `Bonjour ${input.contactName},

Nous avons bien reçu votre demande pour ${input.companyName}. Notre équipe revient vers vous sous 48 h ouvrées.

${TEXT_SIGNATURE}`
  return {
    subject,
    html: shell({
      eyebrow: 'Partenaires',
      title: 'Demande bien reçue',
      preheader,
      body,
    }),
    text,
  }
}

// ---------------------------------------------------------------------------
// Stock 24h
// ---------------------------------------------------------------------------

export interface StockRequestEmailInput {
  readonly companyName: string
  readonly contactEmail: string
  readonly contactPhone: string
  readonly productName: string
  readonly requestedQuantity: number
  readonly estimatedTotalHt: number
  readonly customerNote: string | null
  readonly adminUrl: string
}

export function buildStockRequestAdminEmail(input: StockRequestEmailInput): {
  subject: string
  html: string
  text: string
} {
  const subject = `Lead stock 24h — ${input.productName} ×${input.requestedQuantity}`
  const preheader = `${input.companyName} · ${input.contactEmail}`
  const body = `${callout('warning', 'Demande de stock disponible : vérifier la quantité réelle et rappeler sous 24 h.', { title: 'À faire' })}
${hero([
  { label: 'Produit', value: input.productName },
  { label: 'Quantité', value: `${input.requestedQuantity} u.` },
  {
    label: 'Estimation HT',
    value: formatEur(input.estimatedTotalHt),
    tone: 'blue',
  },
])}
${facts([
  strongFact('Société', input.companyName),
  mailFact('Email', input.contactEmail),
  telFact('Téléphone', input.contactPhone),
])}
${input.customerNote ? `<div style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;color:${C.muted};">Note du client</div>${quote(input.customerNote)}` : ''}
${button("Ouvrir dans l'admin", input.adminUrl, 'dark')}`
  const text = `Nouvelle demande de stock 24h.

Produit : ${input.productName}
Quantité : ${input.requestedQuantity} unités
Estimation HT : ${formatEur(input.estimatedTotalHt)}
Société : ${input.companyName}
Contact : ${input.contactEmail} · ${input.contactPhone}
${input.customerNote ? `\n${input.customerNote}\n` : ''}
Admin : ${input.adminUrl}`
  return {
    subject,
    html: shell({
      eyebrow: 'Stock 24 h',
      title: 'Nouvelle demande de stock',
      preheader,
      body,
      audience: 'internal',
    }),
    text,
  }
}

export function buildStockRequestConfirmationEmail(
  input: StockRequestEmailInput,
): { subject: string; html: string; text: string } {
  const subject = 'Votre demande de stock est bien reçue'
  const preheader = 'Nous vérifions la disponibilité et revenons vers vous.'
  const body = `${greeting(null)}
${p(
  `Nous avons bien reçu votre demande de stock disponible pour <strong style="color:${C.ink};">${escape(input.productName)}</strong>.`,
)}
${hero([
  { label: 'Quantité', value: `${input.requestedQuantity} unités` },
  {
    label: 'Estimation HT',
    value: formatEur(input.estimatedTotalHt),
    tone: 'blue',
  },
])}
${steps([
  {
    title: 'Vérification de la disponibilité réelle',
    detail:
      'Le stock disponible part vite : nous contrôlons les quantités avant de vous répondre.',
  },
  {
    title: 'Confirmation sous 24 h',
    detail: 'Quantités, prix ferme et délai d’enlèvement ou de livraison.',
  },
])}
${replyNote()}
${signature()}`
  const text = `Bonjour,

Nous avons bien reçu votre demande pour ${input.productName} (${input.requestedQuantity} unités). Nous revenons vers vous sous 24 h.

${TEXT_SIGNATURE}`
  return {
    subject,
    html: shell({
      eyebrow: 'Stock 24 h',
      title: 'Demande bien reçue',
      preheader,
      body,
    }),
    text,
  }
}

// ---------------------------------------------------------------------------
// Annulation
// ---------------------------------------------------------------------------

export interface ReservationCancelledEmailInput {
  readonly reference: string
  readonly contactName: string
  readonly containerReference: string
  readonly cancellationReason: string | null
  readonly hasPaidReservationFee: boolean
}

export function buildReservationCancelledEmailToUser(
  input: ReservationCancelledEmailInput,
): { subject: string; html: string; text: string } {
  const subject = `Annulation de votre réservation — ${input.reference}`
  const preheader = `Votre réservation ${input.reference} sur le container ${input.containerReference} a été annulée.`
  const reasonBlock = input.cancellationReason
    ? callout('warning', escape(input.cancellationReason), { title: 'Motif' })
    : ''
  const refundBlock = input.hasPaidReservationFee
    ? callout(
        'success',
        'Les frais de réservation déjà encaissés vous sont remboursés sous 5 à 10 jours ouvrés, selon votre banque. Aucune démarche de votre côté.',
        { title: 'Remboursement' },
      )
    : callout(
        'info',
        'Aucun frais de réservation n’a été encaissé — rien à rembourser de votre côté.',
      )
  const body = `${greeting(input.contactName)}
${p(
  `Votre réservation sur le container <strong style="color:${C.ink};">${escape(input.containerReference)}</strong> a été annulée par notre équipe.`,
)}
${hero([{ label: 'Réservation annulée', value: input.reference, tone: 'danger' }])}
${reasonBlock}
${refundBlock}
${p('Si vous souhaitez rebondir sur un autre container ou clarifier cette annulation, répondez simplement à cet email : nous revenons vers vous rapidement.')}
${button('Voir les containers ouverts', `${SITE_URL}/catalogue`, 'dark')}
${signature()}`

  const reasonText = input.cancellationReason
    ? `\nMotif : ${input.cancellationReason}\n`
    : ''
  const refundText = input.hasPaidReservationFee
    ? `\nLes frais de réservation déjà encaissés sont remboursés sous 5 à 10 jours ouvrés.\n`
    : `\nAucun frais de réservation n'a été encaissé.\n`

  const text = `Bonjour ${input.contactName},

Votre réservation ${input.reference} sur le container ${input.containerReference} a été annulée par notre équipe.
${reasonText}${refundText}
Pour rebondir sur un autre container ou clarifier l'annulation, répondez simplement à cet email.

Merci pour votre confiance,
L'équipe Terrassea

${TEXT_SIGNATURE}`

  return {
    subject,
    html: shell({
      eyebrow: 'Votre réservation',
      title: 'Réservation annulée',
      preheader,
      body,
    }),
    text,
  }
}

// ---------------------------------------------------------------------------
// Formulaire de contact (/contact → /api/contact)
// ---------------------------------------------------------------------------

export interface ContactEmailInput {
  readonly name: string
  readonly email: string
  readonly company: string | null
  readonly phone: string | null
  readonly topicLabel: string
  readonly message: string
  /** Attribution first-touch (campagnes payantes / lien partenaire). */
  readonly attribution?: {
    readonly utm_source: string | null
    readonly utm_medium: string | null
    readonly utm_campaign: string | null
    readonly partner_ref: string | null
  } | null
}

function attributionLine(
  attribution: ContactEmailInput['attribution'],
): string {
  if (!attribution) return ''
  const parts = [
    attribution.utm_source && `source ${attribution.utm_source}`,
    attribution.utm_medium && `medium ${attribution.utm_medium}`,
    attribution.utm_campaign && `campagne ${attribution.utm_campaign}`,
    attribution.partner_ref && `partenaire ${attribution.partner_ref}`,
  ].filter(Boolean)
  return parts.join(' · ')
}

export function buildContactAdminEmail(input: ContactEmailInput): {
  subject: string
  html: string
  text: string
} {
  const subject = `[Contact] ${input.topicLabel} — ${input.company ?? input.name}`
  const preheader = `${input.name} (${input.email})`
  const rows = [strongFact('Sujet', input.topicLabel), fact('Nom', input.name)]
  if (input.company) rows.push(fact('Société', input.company))
  rows.push(mailFact('Email', input.email))
  if (input.phone) rows.push(telFact('Téléphone', input.phone))
  const source = attributionLine(input.attribution)
  if (source) rows.push(fact('Source', source))
  const body = `${callout('info', 'Nouveau message via le formulaire de contact. Répondre directement à cet email répond au client.', { title: 'À faire' })}
${facts(rows)}
<div style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;color:${C.muted};">Message</div>
${quote(input.message)}`
  const text = `Nouveau message via le formulaire de contact.

Sujet : ${input.topicLabel}
Nom : ${input.name}
${input.company ? `Société : ${input.company}\n` : ''}Email : ${input.email}
${input.phone ? `Téléphone : ${input.phone}\n` : ''}${source ? `Source : ${source}\n` : ''}
Message :
${input.message}`
  return {
    subject,
    html: shell({
      eyebrow: 'Contact',
      title: 'Nouveau message',
      preheader,
      body,
      audience: 'internal',
    }),
    text,
  }
}

export function buildContactConfirmationEmail(input: ContactEmailInput): {
  subject: string
  html: string
  text: string
} {
  const subject = 'Message bien reçu — réponse sous 24 h ouvrées'
  const preheader = 'Notre équipe vous répond sous 24 h ouvrées.'
  const body = `${greeting(input.name)}
${p(
  `Nous avons bien reçu votre message au sujet de <strong style="color:${C.ink};">${escape(input.topicLabel)}</strong>. Notre équipe vous répond sous <strong style="color:${C.ink};">24 h ouvrées</strong>, directement à cette adresse.`,
)}
<div style="margin:0 0 8px;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;color:${C.muted};">Votre message</div>
${quote(input.message)}
${p(
  `En attendant : le catalogue et les prix directs sont sur <a href="${SITE_URL}/catalogue" style="color:${C.blue};text-decoration:none;font-weight:600;">terrassea.com/catalogue</a>, et notre méthode de prix sur <a href="${SITE_URL}/prix" style="color:${C.blue};text-decoration:none;font-weight:600;">terrassea.com/prix</a>.`,
  { muted: true, small: true },
)}
${signature()}`
  const text = `Bonjour ${input.name},

Nous avons bien reçu votre message (${input.topicLabel}). Notre équipe vous répond sous 24 h ouvrées, directement à cette adresse.

Votre message :
${input.message}

${TEXT_SIGNATURE}`
  return {
    subject,
    html: shell({
      eyebrow: 'Contact',
      title: 'Message bien reçu',
      preheader,
      body,
    }),
    text,
  }
}

// ---------------------------------------------------------------------------
// Relance de paiement (réservation impayée — cron J+1 / J+3)
// ---------------------------------------------------------------------------

export interface PaymentReminderEmailInput {
  readonly reference: string
  readonly contactName: string | null
  readonly payNow: number
  /** 1 = première relance (J+1), 2 = dernière (J+3). */
  readonly stage: 1 | 2
  /** Lien (magic link si possible) vers la page de reprise de paiement. */
  readonly payUrl: string
}

export function buildPaymentReminderEmail(input: PaymentReminderEmailInput): {
  subject: string
  html: string
  text: string
} {
  const isLast = input.stage === 2
  const subject = isLast
    ? `Dernier rappel — votre place ${input.reference} expire bientôt`
    : `Votre réservation ${input.reference} attend son règlement`
  const preheader = isLast
    ? 'Sans règlement, votre place sur le container sera libérée.'
    : `Il reste ${formatEur(input.payNow)} à régler pour verrouiller votre place.`
  const urgency = isLast
    ? callout(
        'danger',
        `C'est le <strong>dernier rappel</strong> : sans règlement des frais de réservation, votre place sur le container sera <strong>libérée pour les professionnels en liste d'attente</strong>.`,
        { title: 'Dernier rappel' },
      )
    : callout(
        'warning',
        `Votre réservation est enregistrée mais votre place n'est <strong>pas encore verrouillée</strong> : les frais de réservation restent à régler. Ils sont déduits du total de la commande.`,
        { title: 'Place non verrouillée' },
      )
  const body = `${greeting(input.contactName)}
${urgency}
${hero([
  { label: 'Réservation', value: input.reference },
  {
    label: 'Reste à régler',
    value: formatEur(input.payNow),
    tone: isLast ? 'danger' : 'blue',
  },
])}
${button(`Régler ${formatEur(input.payNow)} et verrouiller ma place`, input.payUrl, isLast ? 'danger' : 'primary')}
${p('Le lien vous connecte automatiquement à votre réservation. Paiement sécurisé Stripe, 3D Secure.', { muted: true, small: true })}
${replyNote('Un imprévu, une question sur les quantités ou la livraison ? Répondez simplement à cet email.')}
${signature()}`
  const text = `${input.contactName ? `Bonjour ${input.contactName},` : 'Bonjour,'}

${
  isLast
    ? `Dernier rappel : sans règlement des frais de réservation, votre place ${input.reference} sur le container sera libérée.`
    : `Votre réservation ${input.reference} est enregistrée, mais votre place n'est pas encore verrouillée : il reste ${formatEur(input.payNow)} de frais de réservation à régler (déduits du total).`
}

Régler et verrouiller ma place : ${input.payUrl}

Un imprévu ? Répondez simplement à cet email.

${TEXT_SIGNATURE}`
  return {
    subject,
    html: shell({
      eyebrow: 'Votre réservation',
      title: isLast
        ? 'Dernier rappel avant libération'
        : 'Votre place vous attend',
      preheader,
      body,
    }),
    text,
  }
}

// ---------------------------------------------------------------------------
// Rapports de tests (accès sur autorisation admin)
// ---------------------------------------------------------------------------

export interface ReportAccessRequestEmailInput {
  readonly firstName: string
  readonly lastName: string
  readonly email: string
  readonly phone: string
  readonly siren: string
  readonly adminUrl: string
}

export function buildReportAccessAdminEmail(
  input: ReportAccessRequestEmailInput,
): { subject: string; html: string; text: string } {
  const fullName = `${input.firstName} ${input.lastName}`
  const subject = `Demande d'accès aux rapports de tests — ${fullName}`
  const preheader = `${input.email} · SIREN ${input.siren}`
  const body = `${callout('info', 'Un professionnel demande l’accès aux rapports de tests et certifications. Valider ou refuser depuis l’admin.', { title: 'À faire' })}
${facts([
  strongFact('Nom', fullName),
  mailFact('Email', input.email),
  telFact('Téléphone', input.phone),
  monoFact('SIREN', input.siren),
])}
${button("Valider ou refuser dans l'admin", input.adminUrl, 'dark')}`
  const text = `Demande d'accès aux rapports de tests.

Nom : ${fullName}
Email : ${input.email}
Téléphone : ${input.phone}
SIREN : ${input.siren}

Admin : ${input.adminUrl}`
  return {
    subject,
    html: shell({
      eyebrow: 'Qualité & tests',
      title: "Demande d'accès aux rapports",
      preheader,
      body,
      audience: 'internal',
    }),
    text,
  }
}

export interface ReportAccessDecisionEmailInput {
  readonly firstName: string
  readonly email: string
  /** Page où télécharger une fois connecté avec le même email. */
  readonly qualityUrl: string
}

export function buildReportAccessApprovedEmail(
  input: ReportAccessDecisionEmailInput,
): { subject: string; html: string; text: string } {
  const subject = 'Votre accès aux rapports de tests est validé'
  const preheader =
    'Connectez-vous avec cette adresse email pour consulter les rapports.'
  const body = `${greeting(input.firstName)}
${p(
  `Votre demande d'accès aux rapports de tests et certifications est <strong style="color:${C.ink};">validée</strong>. Vous pouvez consulter les essais SGS, les tests EN 581 / EN 1022 et les analyses matériaux de nos collections.`,
)}
${callout('success', `Accès ouvert pour <strong>${escape(input.email)}</strong>.`, { title: 'Accès validé' })}
${steps(
  [
    {
      title: 'Connectez-vous avec cette même adresse email',
      detail:
        'Ou créez votre compte si ce n’est pas encore fait — un lien de connexion vous est envoyé, sans mot de passe.',
    },
    {
      title: 'Ouvrez la page Qualité & Tests',
      detail: 'Les rapports y sont téléchargeables en PDF.',
    },
  ],
  'Pour consulter les rapports',
)}
${button('Consulter les rapports', input.qualityUrl)}
${replyNote('Une question sur un essai ou une norme ? Répondez simplement à cet email.')}
${signature()}`
  const text = `Bonjour ${input.firstName},

Votre demande d'accès aux rapports de tests & certifications est validée.

Connectez-vous (ou créez votre compte) avec cette même adresse email, puis ouvrez la page Qualité & Tests : ${input.qualityUrl}

Une question ? Répondez simplement à cet email.

${TEXT_SIGNATURE}`
  return {
    subject,
    html: shell({
      eyebrow: 'Qualité & tests',
      title: 'Votre accès est validé',
      preheader,
      body,
    }),
    text,
  }
}

// ---------------------------------------------------------------------------
// Connexion (hook Supabase « Send Email » → /api/auth/send-email)
// ---------------------------------------------------------------------------
//
// Le lien magique est le seul mode de connexion du site : ces emails sont
// souvent le PREMIER contact écrit avec un client. Ils portent la marque,
// disent en une phrase ce que le clic va faire, et rassurent : valable une
// heure, un seul usage, ouvrable sur n'importe quel appareil.

export type AuthEmailKind =
  /** Première visite (signup, invite) : le clic crée l'espace. */
  | 'welcome'
  /** Adresse connue (magiclink, email) : le clic ouvre l'espace. */
  | 'login'
  /** Récupération d'accès : sans mot de passe, le lien ouvre la session. */
  | 'recovery'
  /** Changement d'adresse, message envoyé à l'adresse ACTUELLE. */
  | 'email_change_current'
  /** Changement d'adresse, message envoyé à la NOUVELLE adresse. */
  | 'email_change_new'
  /** Code à 6 chiffres, sans lien. */
  | 'reauthentication'
  /** Information sans lien (mot de passe modifié, adresse modifiée…). */
  | 'notice'

export interface AuthEmailInput {
  readonly kind: AuthEmailKind
  /** Lien vers /auth/callback, obligatoire sauf reauthentication et notice. */
  readonly link?: string
  /** Code à 6 chiffres (reauthentication). */
  readonly code?: string
  readonly firstName?: string
  /** Titre de l'information (notice) : « Votre mot de passe a été modifié ». */
  readonly noticeLabel?: string
}

const AUTH_LINK_VALIDITY =
  'Ce lien est valable une heure et ne sert qu’une fois. Vous pouvez l’ouvrir sur l’ordinateur ou le téléphone de votre choix.'
const AUTH_NOTHING_ASKED =
  'Vous n’avez rien demandé ? Ignorez simplement cet email : sans clic, rien ne se passe.'
const AUTH_NOTICE_FALLBACK_LABEL = 'Information sur votre compte'

/** Le lien en clair, sous le bouton, pour les clients mail qui bloquent les boutons. */
function plainLink(link: string): string {
  return p(
    `Si le bouton ne répond pas, copiez ce lien dans votre navigateur :<br><span style="word-break:break-all;"><a href="${escape(link)}" style="color:${C.blue};text-decoration:none;">${escape(link)}</a></span>`,
    { muted: true, small: true },
  )
}

function authTextGreeting(firstName: string | undefined): string {
  const who = firstName?.trim()
  return who ? `Bonjour ${who},` : 'Bonjour,'
}

function authLinkText(
  firstName: string | undefined,
  intro: string,
  action: string,
  link: string,
): string {
  return `${authTextGreeting(firstName)}

${intro}

${action} : ${link}

${AUTH_LINK_VALIDITY}
${AUTH_NOTHING_ASKED}

${TEXT_SIGNATURE}`
}

interface AuthLinkEmailSpec {
  readonly subject: string
  readonly eyebrow: string
  readonly title: string
  readonly preheader: string
  /** Phrase d'explication, déjà en HTML sûr (aucune donnée externe). */
  readonly introHtml: string
  /** La même phrase, en texte brut. */
  readonly introText: string
  readonly buttonLabel: string
  /** Prochaines étapes, pour la première visite uniquement. */
  readonly stepsHtml?: string
}

function authLinkEmail(
  input: AuthEmailInput,
  link: string,
  spec: AuthLinkEmailSpec,
): { subject: string; html: string; text: string } {
  const body = `${greeting(input.firstName)}
${p(spec.introHtml)}
${button(spec.buttonLabel, link)}
${spec.stepsHtml ?? ''}
${callout('info', AUTH_LINK_VALIDITY, { title: 'Bon à savoir' })}
${plainLink(link)}
${p(AUTH_NOTHING_ASKED, { muted: true, small: true })}
${signature()}`
  return {
    subject: spec.subject,
    html: shell({
      eyebrow: spec.eyebrow,
      title: spec.title,
      preheader: spec.preheader,
      body,
    }),
    text: authLinkText(input.firstName, spec.introText, spec.buttonLabel, link),
  }
}

export function buildAuthEmail(input: AuthEmailInput): {
  subject: string
  html: string
  text: string
} {
  const link = input.link?.trim() ?? ''

  switch (input.kind) {
    case 'welcome': {
      const intro =
        'Vous avez demandé à ouvrir votre espace professionnel sur terrassea.com. Un clic sur le bouton et il est prêt : vous complétez votre fiche en trente secondes (nom, établissement), puis vous retrouvez vos devis, réservations et factures au même endroit.'
      return authLinkEmail(input, link, {
        subject: 'Bienvenue chez Terrassea — créez votre espace',
        eyebrow: 'Votre espace pro',
        title: 'Bienvenue chez Terrassea',
        preheader:
          'Un clic pour ouvrir votre espace : devis, réservations et factures au même endroit.',
        introHtml: intro,
        introText: intro,
        buttonLabel: 'Créer mon espace',
        stepsHtml: steps([
          { title: 'Cliquez sur le bouton' },
          {
            title: 'Complétez votre fiche',
            detail:
              'Prénom, nom, établissement : trente secondes, une seule fois.',
          },
          {
            title: 'Retrouvez tout votre suivi',
            detail:
              'Devis, réservations, factures et favoris, sur tous vos appareils.',
          },
        ]),
      })
    }

    case 'login': {
      const intro =
        'Cliquez sur le bouton pour ouvrir votre espace. Aucun mot de passe : ce lien suffit.'
      return authLinkEmail(input, link, {
        subject: 'Votre lien de connexion Terrassea',
        eyebrow: 'Connexion',
        title: 'Votre lien de connexion',
        preheader: 'Votre lien de connexion Terrassea, valable une heure.',
        introHtml: intro,
        introText: intro,
        buttonLabel: 'Me connecter',
      })
    }

    case 'recovery': {
      const intro =
        'Vous avez demandé à retrouver l’accès à votre espace. Le site n’utilise pas de mot de passe : ce lien ouvre directement votre session, et vous retrouvez tout votre suivi.'
      return authLinkEmail(input, link, {
        subject: 'Réinitialiser votre accès Terrassea',
        eyebrow: 'Connexion',
        title: 'Réinitialiser votre accès',
        preheader: 'Un clic ouvre votre espace : aucun mot de passe à retenir.',
        introHtml: intro,
        introText: intro,
        buttonLabel: 'Me connecter',
      })
    }

    case 'email_change_current': {
      const intro =
        'Un changement d’adresse email a été demandé sur votre espace Terrassea. Pour le confirmer depuis votre adresse actuelle, cliquez sur le bouton. Votre nouvelle adresse reçoit un email du même type : les deux confirmations sont nécessaires.'
      return authLinkEmail(input, link, {
        subject: 'Confirmez votre adresse email — Terrassea',
        eyebrow: 'Votre espace',
        title: 'Confirmez le changement d’adresse',
        preheader:
          'Un changement d’adresse a été demandé sur votre espace : confirmez-le en un clic.',
        introHtml: intro,
        introText: intro,
        buttonLabel: 'Confirmer',
      })
    }

    case 'email_change_new': {
      const intro =
        'Cette adresse a été indiquée comme nouvelle adresse de votre espace Terrassea. Cliquez sur le bouton pour la confirmer : vos devis, réservations et factures vous suivent.'
      return authLinkEmail(input, link, {
        subject: 'Confirmez votre adresse email — Terrassea',
        eyebrow: 'Votre espace',
        title: 'Confirmez votre nouvelle adresse',
        preheader: 'Confirmez votre nouvelle adresse email en un clic.',
        introHtml: intro,
        introText: intro,
        buttonLabel: 'Confirmer',
      })
    }

    case 'reauthentication': {
      const code = input.code?.trim() ?? ''
      const body = `${greeting(input.firstName)}
${p('Voici le code demandé pour confirmer une opération sensible sur votre espace. Saisissez-le dans la page qui l’attend.')}
${hero([{ label: 'Code', value: code, tone: 'blue' }])}
${callout('info', 'Il expire dans quelques minutes et ne sert qu’une fois. Ne le communiquez à personne : Terrassea ne vous le demandera jamais.', { title: 'Bon à savoir' })}
${p(AUTH_NOTHING_ASKED, { muted: true, small: true })}
${signature()}`
      const text = `${authTextGreeting(input.firstName)}

Voici le code demandé pour confirmer une opération sensible sur votre espace :

Code : ${code}

Il expire dans quelques minutes et ne sert qu'une fois. Ne le communiquez à personne.
${AUTH_NOTHING_ASKED}

${TEXT_SIGNATURE}`
      return {
        subject: 'Votre code de vérification Terrassea',
        html: shell({
          eyebrow: 'Vérification',
          title: 'Votre code de vérification',
          preheader:
            'Votre code de vérification Terrassea, valable quelques minutes.',
          body,
        }),
        text,
      }
    }

    case 'notice': {
      const label = input.noticeLabel?.trim() || AUTH_NOTICE_FALLBACK_LABEL
      const warning =
        'Ce n’est pas vous ? Écrivez-nous immédiatement à contact@terrassea.com.'
      const body = `${greeting(input.firstName)}
${p(
  `Un changement vient d’être effectué sur votre espace terrassea.com. <strong style="color:${C.ink};">${escape(label)}.</strong> Si c’est bien vous, vous n’avez rien à faire.`,
)}
${callout('warning', escape(warning), { title: 'Sécurité' })}
${signature()}`
      const text = `${authTextGreeting(input.firstName)}

Un changement vient d'être effectué sur votre espace terrassea.com.
${label}. Si c'est bien vous, vous n'avez rien à faire.

${warning}

${TEXT_SIGNATURE}`
      return {
        subject: `${label} — Terrassea`,
        html: shell({
          eyebrow: 'Votre espace',
          title: label,
          preheader: `${label}. Ce n’est pas vous ? Écrivez-nous.`,
          body,
        }),
        text,
      }
    }
  }
}
