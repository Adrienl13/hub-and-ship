// HTML email templates. Kept as plain string builders to avoid pulling
// react-email or JSX renderers into the server bundle. Tables + inline CSS
// for broad client compatibility (Gmail, Outlook, Apple Mail).

// Branded contact surface (the sending domain is authenticated in Brevo and
// receives via Cloudflare Email Routing). Single source of truth for footers
// and text signatures so we never leak a personal address.
const CONTACT_EMAIL = 'contact@prosimport.com'
const SITE_URL = 'https://prosimport.com'
const SITE_LABEL = 'prosimport.com'
const TEXT_SIGNATURE = `Container Club — Pros Import EURL
${SITE_LABEL} · ${CONTACT_EMAIL}`

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
Container Club — édité par Pros Import EURL · 60 Rue François Ier, 75008 Paris<br>
<a href="${SITE_URL}" style="color:#c25e2a;text-decoration:none;">${SITE_LABEL}</a> · <a href="mailto:${CONTACT_EMAIL}" style="color:#666;text-decoration:none;">${CONTACT_EMAIL}</a><br>
RCS Paris 988 269 981 · SIRET 98826998100011 · TVA FR08988269981
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

function renderLines(lines: ReservationEmailInput['lines']): string {
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

${TEXT_SIGNATURE}
60 Rue François Ier, 75008 Paris`

  return {
    subject,
    html: shell({ title: 'Réservation enregistrée', preheader, body }),
    text,
  }
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

  return {
    subject,
    html: shell({ title: 'Nouvelle réservation', preheader, body }),
    text,
  }
}

// ---------------------------------------------------------------------------
// Payment confirmed (Stripe webhook)
// ---------------------------------------------------------------------------

export interface PaymentConfirmedEmailInput {
  readonly reference: string
  readonly containerReference: string
  readonly customerEmail: string | null
  readonly amountPaid: number | null
  readonly accountUrl: string
}

export function buildPaymentConfirmedEmailToUser(
  input: PaymentConfirmedEmailInput,
): { subject: string; html: string; text: string } {
  const subject = `Paiement confirmé — ${input.reference}`
  const preheader = `Votre place sur le container ${input.containerReference} est verrouillée.`
  const amountLine = input.amountPaid
    ? `<p style="font-size:14px;line-height:1.6;margin:0 0 16px;">Montant réglé : <strong>${formatEur(input.amountPaid)}</strong>.</p>`
    : ''
  const body = `<p style="font-size:14px;line-height:1.6;margin:0 0 16px;">Bonjour,</p>
<p style="font-size:14px;line-height:1.6;margin:0 0 16px;">Nous confirmons la réception de votre paiement pour la réservation <strong>${escape(input.reference)}</strong> (container ${escape(input.containerReference)}). Votre place est désormais <strong>verrouillée</strong>.</p>
${amountLine}
<p style="font-size:13px;line-height:1.6;margin:0 0 16px;color:#666;">Les prochaines étapes (acompte, production, transport) apparaissent dans votre espace au fur et à mesure.</p>
<p style="margin:24px 0 0;text-align:center;">
<a href="${escape(input.accountUrl)}" style="display:inline-block;background:#1a1a1a;color:#f4eee3;padding:12px 24px;text-decoration:none;border-radius:4px;font-size:13px;font-weight:500;">Voir ma réservation</a>
</p>`
  const text = `Bonjour,

Nous confirmons la réception de votre paiement pour la réservation ${input.reference} (container ${input.containerReference}). Votre place est verrouillée.
${input.amountPaid ? `Montant réglé : ${formatEur(input.amountPaid)}\n` : ''}
Voir votre réservation : ${input.accountUrl}

${TEXT_SIGNATURE}`
  return {
    subject,
    html: shell({ title: 'Paiement confirmé', preheader, body }),
    text,
  }
}

export function buildPaymentConfirmedAdminEmail(
  input: PaymentConfirmedEmailInput,
): { subject: string; html: string; text: string } {
  const subject = `Paiement reçu — ${input.reference}`
  const preheader = `Container ${input.containerReference}`
  const body = `<p style="font-size:14px;line-height:1.6;margin:0 0 16px;">Frais de réservation payés.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${detailRow('Référence', input.reference)}
${detailRow('Container', input.containerReference)}
${input.customerEmail ? detailRow('Client', input.customerEmail) : ''}
${input.amountPaid ? detailRow('Montant', formatEur(input.amountPaid)) : ''}
</table>`
  const text = `Frais de réservation payés.

Référence : ${input.reference}
Container : ${input.containerReference}
${input.customerEmail ? `Client : ${input.customerEmail}\n` : ''}${input.amountPaid ? `Montant : ${formatEur(input.amountPaid)}\n` : ''}`
  return {
    subject,
    html: shell({ title: 'Paiement reçu', preheader, body }),
    text,
  }
}

// ---------------------------------------------------------------------------
// Invoice issued
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
  const body = `<p style="font-size:14px;line-height:1.6;margin:0 0 16px;">Bonjour,</p>
<p style="font-size:14px;line-height:1.6;margin:0 0 16px;">Votre facture <strong>${escape(input.number)}</strong> pour la réservation ${escape(input.reference)} est disponible. Montant TTC : <strong>${formatEur(input.totalTtc)}</strong>.</p>
<p style="margin:24px 0 0;text-align:center;">
<a href="${escape(input.invoiceUrl)}" style="display:inline-block;background:#1a1a1a;color:#f4eee3;padding:12px 24px;text-decoration:none;border-radius:4px;font-size:13px;font-weight:500;">Voir / télécharger la facture</a>
</p>
<p style="font-size:12px;line-height:1.6;color:#666;margin:24px 0 0;">Une question sur cette facture ? Répondez simplement à cet email.</p>`
  const text = `Bonjour,

Votre facture ${input.number} pour la réservation ${input.reference} est disponible.
Montant TTC : ${formatEur(input.totalTtc)}

Voir / télécharger : ${input.invoiceUrl}

Une question sur cette facture ? Répondez simplement à cet email.

${TEXT_SIGNATURE}`
  return {
    subject,
    html: shell({ title: 'Facture disponible', preheader, body }),
    text,
  }
}

// ---------------------------------------------------------------------------
// Partner channel notifications
// ---------------------------------------------------------------------------

function detailRow(label: string, value: string): string {
  return `<tr><td style="padding:4px 0;font-size:13px;color:#666;">${escape(label)}</td><td style="padding:4px 0;font-size:13px;text-align:right;font-weight:600;">${escape(value)}</td></tr>`
}

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

export function buildPartnerRequestAdminEmail(input: PartnerRequestEmailInput): {
  subject: string
  html: string
  text: string
} {
  const kind = input.isDeal ? 'Opportunité partenaire' : 'Candidature partenaire'
  const subject = `${kind} — ${input.companyName}`
  const preheader = `${input.companyName} · ${input.contactEmail}`
  const body = `<p style="font-size:14px;line-height:1.6;margin:0 0 16px;">Nouvelle ${escape(kind.toLowerCase())} reçue.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${detailRow('Société', input.companyName)}
${detailRow('Type', input.partnerKindLabel)}
${detailRow('Contact', `${input.contactName} · ${input.contactPhone}`)}
${detailRow('Email', input.contactEmail)}
${input.territory ? detailRow('Territoire', input.territory) : ''}
${input.expectedMonthlyVolume ? detailRow('Volume estimé', input.expectedMonthlyVolume) : ''}
${input.clientCompanyName ? detailRow('Client protégé', input.clientCompanyName) : ''}
${input.projectType ? detailRow('Projet', input.projectType) : ''}
</table>
${input.message ? `<p style="font-size:13px;line-height:1.6;margin:16px 0 0;color:#444;">${escape(input.message)}</p>` : ''}
<p style="margin:24px 0 0;text-align:center;">
<a href="${escape(input.adminUrl)}" style="display:inline-block;background:#1a1a1a;color:#f4eee3;padding:12px 24px;text-decoration:none;border-radius:4px;font-size:13px;font-weight:500;">Ouvrir dans l'admin</a>
</p>`
  const text = `Nouvelle ${kind.toLowerCase()} reçue.

Société : ${input.companyName}
Type : ${input.partnerKindLabel}
Contact : ${input.contactName} · ${input.contactPhone}
Email : ${input.contactEmail}
${input.territory ? `Territoire : ${input.territory}\n` : ''}${input.expectedMonthlyVolume ? `Volume estimé : ${input.expectedMonthlyVolume}\n` : ''}${input.clientCompanyName ? `Client protégé : ${input.clientCompanyName}\n` : ''}${input.projectType ? `Projet : ${input.projectType}\n` : ''}${input.message ? `\n${input.message}\n` : ''}
Admin : ${input.adminUrl}`
  return { subject, html: shell({ title: kind, preheader, body }), text }
}

export function buildPartnerRequestConfirmationEmail(
  input: PartnerRequestEmailInput,
): { subject: string; html: string; text: string } {
  const subject = 'Votre demande partenaire est bien reçue'
  const preheader = 'Pros Import revient vers vous rapidement.'
  const body = `<p style="font-size:14px;line-height:1.6;margin:0 0 16px;">Bonjour ${escape(input.contactName)},</p>
<p style="font-size:14px;line-height:1.6;margin:0 0 16px;">Nous avons bien reçu votre demande pour <strong>${escape(input.companyName)}</strong>. Notre équipe l'étudie et revient vers vous sous 48 h ouvrées.</p>
<p style="font-size:13px;line-height:1.6;margin:0;color:#666;">Pros Import protège les revendeurs : prix nets privés, marge libre, attribution de vos clients. Vous pourrez bientôt accéder à votre espace partenaire.</p>`
  const text = `Bonjour ${input.contactName},

Nous avons bien reçu votre demande pour ${input.companyName}. Notre équipe revient vers vous sous 48 h ouvrées.

${TEXT_SIGNATURE}`
  return {
    subject,
    html: shell({ title: 'Demande reçue', preheader, body }),
    text,
  }
}

// ---------------------------------------------------------------------------
// Stock 24h notifications
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
  const body = `<p style="font-size:14px;line-height:1.6;margin:0 0 16px;">Nouvelle demande de stock disponible reçue.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${detailRow('Produit', input.productName)}
${detailRow('Quantité', `${input.requestedQuantity} unités`)}
${detailRow('Estimation HT', formatEur(input.estimatedTotalHt))}
${detailRow('Société', input.companyName)}
${detailRow('Contact', `${input.contactEmail} · ${input.contactPhone}`)}
</table>
${input.customerNote ? `<p style="font-size:13px;line-height:1.6;margin:16px 0 0;color:#444;">${escape(input.customerNote)}</p>` : ''}
<p style="margin:24px 0 0;text-align:center;">
<a href="${escape(input.adminUrl)}" style="display:inline-block;background:#1a1a1a;color:#f4eee3;padding:12px 24px;text-decoration:none;border-radius:4px;font-size:13px;font-weight:500;">Ouvrir dans l'admin</a>
</p>`
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
    html: shell({ title: 'Lead stock 24h', preheader, body }),
    text,
  }
}

export function buildStockRequestConfirmationEmail(
  input: StockRequestEmailInput,
): { subject: string; html: string; text: string } {
  const subject = 'Votre demande de stock est bien reçue'
  const preheader = 'Nous vérifions la disponibilité et revenons vers vous.'
  const body = `<p style="font-size:14px;line-height:1.6;margin:0 0 16px;">Bonjour,</p>
<p style="font-size:14px;line-height:1.6;margin:0 0 16px;">Nous avons bien reçu votre demande pour <strong>${escape(input.productName)}</strong> (${input.requestedQuantity} unités). Nous vérifions la disponibilité réelle et revenons vers vous rapidement, en général sous 24 h.</p>
<p style="font-size:13px;line-height:1.6;margin:0;color:#666;">Le stock disponible part vite : nous vous confirmons les quantités et le délai d'enlèvement.</p>`
  const text = `Bonjour,

Nous avons bien reçu votre demande pour ${input.productName} (${input.requestedQuantity} unités). Nous revenons vers vous sous 24 h.

${TEXT_SIGNATURE}`
  return {
    subject,
    html: shell({ title: 'Demande reçue', preheader, body }),
    text,
  }
}

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
    ? `<p style="font-size:14px;line-height:1.6;margin:0 0 16px;background:#f4e3d1;border-left:3px solid #c25e2a;padding:12px 16px;border-radius:0 4px 4px 0;"><strong style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#c25e2a;">Motif</strong><br><span style="font-size:13px;">${escape(input.cancellationReason)}</span></p>`
    : ''
  const refundBlock = input.hasPaidReservationFee
    ? `<p style="font-size:14px;line-height:1.6;margin:0 0 16px;">Les frais de réservation déjà encaissés sont remboursés sous 5 à 10 jours ouvrés selon votre banque.</p>`
    : `<p style="font-size:14px;line-height:1.6;margin:0 0 16px;color:#666;">Aucun frais de réservation n'a été encaissé — rien à rembourser de votre côté.</p>`
  const body = `<p style="font-size:14px;line-height:1.6;margin:0 0 16px;">Bonjour ${escape(input.contactName)},</p>
<p style="font-size:14px;line-height:1.6;margin:0 0 16px;">Votre réservation <strong>${escape(input.reference)}</strong> sur le container <strong>${escape(input.containerReference)}</strong> a été annulée par notre équipe.</p>
${reasonBlock}
${refundBlock}
<p style="font-size:14px;line-height:1.6;margin:0 0 16px;">Si vous souhaitez rebondir sur un autre container ou clarifier l'annulation, répondez simplement à cet email — on revient vers vous rapidement.</p>
<p style="font-size:12px;line-height:1.6;color:#666;margin:24px 0 0;">Merci pour votre confiance,<br>L'équipe Container Club</p>`

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
L'équipe Container Club

Container Club — Pros Import EURL
60 Rue François Ier, 75008 Paris
adrienlaniez1@gmail.com`

  return {
    subject,
    html: shell({ title: 'Réservation annulée', preheader, body }),
    text,
  }
}
