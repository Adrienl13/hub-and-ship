// HTML email templates. Kept as plain string builders to avoid pulling
// react-email or JSX renderers into the server bundle. Tables + inline CSS
// for broad client compatibility (Gmail, Outlook, Apple Mail).

export interface ReservationEmailInput {
  readonly reference: string
  readonly contactName: string
  readonly contactCompany: string
  readonly contactEmail: string
  readonly contactPhone: string
  readonly siret: string
  readonly containerReference: string
  readonly subtotalHt: number
  readonly totalTtc: number
  readonly payNow: number
  readonly lines: ReadonlyArray<{
    readonly productName: string
    readonly variantName: string
    readonly quantity: number
    readonly subtotalHt: number
  }>
  readonly accountUrl: string
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

function shell({
  title,
  preheader,
  body,
}: {
  title: string
  preheader: string
  body: string
}): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>${escape(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f4eee3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;">
<div style="display:none;font-size:1px;color:#f4eee3;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escape(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4eee3;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border:1px solid #e3d8c4;border-radius:6px;overflow:hidden;">
<tr><td style="padding:24px 32px;border-bottom:1px solid #e3d8c4;">
<div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#c25e2a;font-weight:600;">Container Club</div>
<div style="font-size:22px;font-weight:600;margin-top:4px;font-family:Georgia,serif;">${escape(title)}</div>
</td></tr>
<tr><td style="padding:24px 32px;">
${body}
</td></tr>
<tr><td style="padding:16px 32px;border-top:1px solid #e3d8c4;font-size:11px;color:#666;line-height:1.5;">
Container Club — édité par Pros Import EURL · 60 Rue François Ier, 75008 Paris · adrienlaniez1@gmail.com<br>
RCS Paris 988 269 981 · SIRET 98826998100011 · TVA FR08988269981
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

function renderLines(
  lines: ReservationEmailInput['lines'],
): string {
  if (lines.length === 0) return ''
  const rows = lines
    .map(
      (line) => `<tr>
<td style="padding:8px 0;border-bottom:1px solid #efe7d7;font-size:13px;">
<div style="font-weight:600;">${escape(line.productName)}</div>
<div style="color:#666;font-size:11px;">${escape(line.variantName)} · ${line.quantity} unités</div>
</td>
<td style="padding:8px 0;border-bottom:1px solid #efe7d7;font-size:13px;text-align:right;white-space:nowrap;">${formatEur(line.subtotalHt)}</td>
</tr>`,
    )
    .join('')
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;">
${rows}
</table>`
}

export function buildReservationCreatedEmailToUser(
  input: ReservationEmailInput,
): { subject: string; html: string; text: string } {
  const subject = `Réservation enregistrée — ${input.reference}`
  const preheader = `Votre place sur le container ${input.containerReference} est sécurisée. Détails et prochaines étapes ci-dessous.`
  const body = `<p style="font-size:14px;line-height:1.6;margin:0 0 16px;">Bonjour ${escape(input.contactName)},</p>
<p style="font-size:14px;line-height:1.6;margin:0 0 16px;">Votre réservation <strong>${escape(input.reference)}</strong> pour le container <strong>${escape(input.containerReference)}</strong> est bien enregistrée.</p>
<p style="font-size:14px;line-height:1.6;margin:0 0 16px;color:#666;">Un membre Container Club vous recontacte sous 24 h pour finaliser les frais de réservation (${formatEur(input.payNow)}). À réception, votre place est verrouillée.</p>
${renderLines(input.lines)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;border-top:2px solid #1a1a1a;padding-top:8px;">
<tr><td style="font-size:13px;">Total commande HT</td><td style="font-size:13px;text-align:right;font-weight:600;">${formatEur(input.subtotalHt)}</td></tr>
<tr><td style="font-size:13px;">Total TTC</td><td style="font-size:13px;text-align:right;">${formatEur(input.totalTtc)}</td></tr>
<tr><td style="font-size:13px;font-weight:600;">À régler maintenant</td><td style="font-size:13px;text-align:right;font-weight:600;color:#c25e2a;">${formatEur(input.payNow)}</td></tr>
</table>
<p style="margin:24px 0 0;text-align:center;">
<a href="${escape(input.accountUrl)}" style="display:inline-block;background:#1a1a1a;color:#f4eee3;padding:12px 24px;text-decoration:none;border-radius:4px;font-size:13px;font-weight:500;">Voir ma réservation</a>
</p>
<p style="font-size:12px;line-height:1.6;color:#666;margin:24px 0 0;">Questions ? Répondez simplement à cet email, on est dans la boucle.</p>`

  const text = `Bonjour ${input.contactName},

Votre réservation ${input.reference} pour le container ${input.containerReference} est bien enregistrée.

Un membre Container Club vous recontacte sous 24 h pour finaliser les frais de réservation (${formatEur(input.payNow)}).

Récapitulatif :
${input.lines.map((l) => `- ${l.productName} (${l.variantName}) · ${l.quantity} unités · ${formatEur(l.subtotalHt)}`).join('\n')}

Total HT : ${formatEur(input.subtotalHt)}
Total TTC : ${formatEur(input.totalTtc)}
À régler : ${formatEur(input.payNow)}

Voir votre réservation : ${input.accountUrl}

Container Club — Pros Import EURL
60 Rue François Ier, 75008 Paris
adrienlaniez1@gmail.com`

  return { subject, html: shell({ title: 'Réservation enregistrée', preheader, body }), text }
}

export function buildReservationCreatedEmailToAdmin(
  input: ReservationEmailInput,
): { subject: string; html: string; text: string } {
  const subject = `[Container Club] Nouvelle résa ${input.reference} — ${input.contactCompany}`
  const preheader = `${input.contactCompany} (${input.siret}) a réservé pour ${formatEur(input.subtotalHt)} HT sur ${input.containerReference}.`
  const body = `<p style="font-size:14px;line-height:1.6;margin:0 0 16px;">Nouvelle réservation à traiter sous 24h.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
<tr><td style="font-size:12px;color:#666;padding:4px 0;">Référence</td><td style="font-size:13px;text-align:right;font-family:monospace;">${escape(input.reference)}</td></tr>
<tr><td style="font-size:12px;color:#666;padding:4px 0;">Container</td><td style="font-size:13px;text-align:right;">${escape(input.containerReference)}</td></tr>
<tr><td style="font-size:12px;color:#666;padding:4px 0;">Société</td><td style="font-size:13px;text-align:right;font-weight:600;">${escape(input.contactCompany)}</td></tr>
<tr><td style="font-size:12px;color:#666;padding:4px 0;">SIRET</td><td style="font-size:13px;text-align:right;font-family:monospace;">${escape(input.siret)}</td></tr>
<tr><td style="font-size:12px;color:#666;padding:4px 0;">Contact</td><td style="font-size:13px;text-align:right;">${escape(input.contactName)}</td></tr>
<tr><td style="font-size:12px;color:#666;padding:4px 0;">Email</td><td style="font-size:13px;text-align:right;"><a href="mailto:${escape(input.contactEmail)}" style="color:#1a1a1a;">${escape(input.contactEmail)}</a></td></tr>
<tr><td style="font-size:12px;color:#666;padding:4px 0;">Téléphone</td><td style="font-size:13px;text-align:right;">${escape(input.contactPhone)}</td></tr>
</table>
${renderLines(input.lines)}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;border-top:2px solid #1a1a1a;padding-top:8px;">
<tr><td style="font-size:13px;">Total HT</td><td style="font-size:13px;text-align:right;font-weight:600;">${formatEur(input.subtotalHt)}</td></tr>
<tr><td style="font-size:13px;">Total TTC</td><td style="font-size:13px;text-align:right;">${formatEur(input.totalTtc)}</td></tr>
<tr><td style="font-size:13px;">Frais à appeler</td><td style="font-size:13px;text-align:right;">${formatEur(input.payNow)}</td></tr>
</table>`
  const text = `Nouvelle réservation à traiter sous 24h.

Référence : ${input.reference}
Container : ${input.containerReference}
Société : ${input.contactCompany}
SIRET : ${input.siret}
Contact : ${input.contactName} <${input.contactEmail}> · ${input.contactPhone}

Lignes :
${input.lines.map((l) => `- ${l.productName} (${l.variantName}) · ${l.quantity} unités · ${formatEur(l.subtotalHt)}`).join('\n')}

Total HT : ${formatEur(input.subtotalHt)}
Total TTC : ${formatEur(input.totalTtc)}
Frais à appeler : ${formatEur(input.payNow)}`

  return { subject, html: shell({ title: 'Nouvelle réservation', preheader, body }), text }
}
