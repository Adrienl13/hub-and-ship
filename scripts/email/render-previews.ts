// Rend chaque gabarit d'email avec des données d'exemple, en HTML et en
// texte, pour les ouvrir dans un navigateur ou les envoyer à un client mail.
//
//   bun scripts/email/render-previews.ts [dossier]    (défaut : .email-previews)
//
// Aucun envoi, aucune dépendance réseau : les données sont fictives.

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  buildAuthEmail,
  buildContactAdminEmail,
  buildContactConfirmationEmail,
  buildInvoiceEmailToUser,
  buildPartnerRequestAdminEmail,
  buildPartnerRequestConfirmationEmail,
  buildPaymentConfirmedAdminEmail,
  buildPaymentConfirmedEmailToUser,
  buildPaymentReminderEmail,
  buildReportAccessAdminEmail,
  buildReportAccessApprovedEmail,
  buildReservationCancelledEmailToUser,
  buildReservationCreatedEmailToAdmin,
  buildReservationCreatedEmailToUser,
  buildStockRequestAdminEmail,
  buildStockRequestConfirmationEmail,
  type ReservationEmailInput,
} from '../../src/lib/email/templates'

const SITE = 'https://terrassea.com'

const reservation: ReservationEmailInput = {
  reference: 'TR-2026-014-0031',
  contactName: 'Camille Roux',
  contactCompany: 'Hôtel des Pins',
  contactEmail: 'direction@hoteldespins.fr',
  contactPhone: '+33 6 12 34 56 78',
  siret: '55208131701750',
  containerReference: 'CONT-2026-014',
  subtotalHt: 12480,
  volumeDiscount: 1248,
  totalHt: 11232,
  totalTtc: 13478.4,
  payNow: 336.96,
  lines: [
    {
      productName: 'Chaise Cannes empilable',
      variantName: 'Cordage sable · structure graphite',
      quantity: 80,
      subtotalHt: 7120,
    },
    {
      productName: 'Fauteuil Biarritz',
      variantName: 'Textilène anthracite',
      quantity: 24,
      subtotalHt: 3120,
    },
    {
      productName: 'Table bistrot ronde Ø70',
      variantName: 'Plateau HPL chêne clair',
      quantity: 20,
      subtotalHt: 2240,
    },
  ],
  accountUrl: `${SITE}/account/reservations/8b1c`,
  deliveryLabel: "Livraison jusqu'à la terrasse",
  deliveryNote:
    'Accès camion par la rue du Port, livraison le matin de préférence.',
  totalCbm: 9.4,
  referralCode: 'APPORT-LR12',
}

const previews: Record<
  string,
  { subject: string; html: string; text: string }
> = {
  '01-devis-client': buildReservationCreatedEmailToUser({
    ...reservation,
    quoteMode: true,
  }),
  '02-devis-admin': buildReservationCreatedEmailToAdmin({
    ...reservation,
    quoteMode: true,
  }),
  '03-reservation-client': buildReservationCreatedEmailToUser(reservation),
  '04-reservation-admin': buildReservationCreatedEmailToAdmin(reservation),
  '05-paiement-client': buildPaymentConfirmedEmailToUser({
    reference: reservation.reference,
    containerReference: reservation.containerReference,
    customerEmail: reservation.contactEmail,
    amountPaid: reservation.payNow,
    accountUrl: reservation.accountUrl,
    accountLinkIsMagic: true,
  }),
  '06-paiement-admin': buildPaymentConfirmedAdminEmail({
    reference: reservation.reference,
    containerReference: reservation.containerReference,
    customerEmail: reservation.contactEmail,
    amountPaid: reservation.payNow,
    accountUrl: `${SITE}/admin?tab=reservations`,
  }),
  '07-facture': buildInvoiceEmailToUser({
    number: 'FAC-2026-000042',
    reference: reservation.reference,
    totalTtc: reservation.totalTtc,
    invoiceUrl: `${SITE}/account/reservations/8b1c/facture/f42`,
  }),
  '08-partenaire-admin': buildPartnerRequestAdminEmail({
    isDeal: false,
    companyName: 'CHR Conseil Atlantique',
    contactName: 'Claire Martin',
    contactEmail: 'claire@chr-conseil.fr',
    contactPhone: '+33 6 00 00 00 00',
    partnerKindLabel: 'Revendeur',
    territory: 'Nouvelle-Aquitaine',
    expectedMonthlyVolume: '1 container / trimestre',
    message:
      'Nous équipons une trentaine de terrasses par an sur le bassin d’Arcachon et cherchons un importateur direct.',
    clientCompanyName: null,
    projectType: null,
    adminUrl: `${SITE}/admin?tab=partners`,
  }),
  '09-partenaire-confirmation': buildPartnerRequestConfirmationEmail({
    isDeal: false,
    companyName: 'CHR Conseil Atlantique',
    contactName: 'Claire Martin',
    contactEmail: 'claire@chr-conseil.fr',
    contactPhone: '+33 6 00 00 00 00',
    partnerKindLabel: 'Revendeur',
    territory: null,
    expectedMonthlyVolume: null,
    message: null,
    clientCompanyName: null,
    projectType: null,
    adminUrl: `${SITE}/admin?tab=partners`,
  }),
  '10-stock-admin': buildStockRequestAdminEmail({
    companyName: 'Brasserie du Marché',
    contactEmail: 'achats@brasseriedumarche.fr',
    contactPhone: '+33 4 91 00 00 00',
    productName: 'Chaise Cannes empilable',
    requestedQuantity: 24,
    estimatedTotalHt: 2136,
    customerNote:
      'Ouverture de la terrasse dans dix jours, enlèvement possible.',
    adminUrl: `${SITE}/admin?tab=stock-requests`,
  }),
  '11-stock-confirmation': buildStockRequestConfirmationEmail({
    companyName: 'Brasserie du Marché',
    contactEmail: 'achats@brasseriedumarche.fr',
    contactPhone: '+33 4 91 00 00 00',
    productName: 'Chaise Cannes empilable',
    requestedQuantity: 24,
    estimatedTotalHt: 2136,
    customerNote: null,
    adminUrl: `${SITE}/admin?tab=stock-requests`,
  }),
  '12-annulation': buildReservationCancelledEmailToUser({
    reference: reservation.reference,
    contactName: reservation.contactName,
    containerReference: reservation.containerReference,
    cancellationReason:
      'Le container CONT-2026-014 n’a pas atteint le remplissage minimum dans le délai prévu.',
    hasPaidReservationFee: true,
  }),
  '13-contact-admin': buildContactAdminEmail({
    name: 'Julien Berthier',
    email: 'julien@lecabanon.fr',
    company: 'Le Cabanon',
    phone: '+33 6 55 44 33 22',
    topicLabel: 'Devis pour une terrasse',
    message:
      'Bonjour,\n\nNous ouvrons 60 couverts en terrasse en avril. Pouvez-vous nous proposer chaises et tables assorties, avec une livraison avant le 15 mars ?\n\nMerci.',
    attribution: {
      utm_source: 'google',
      utm_medium: 'cpc',
      utm_campaign: 'terrasse-2026',
      partner_ref: null,
    },
  }),
  '14-contact-confirmation': buildContactConfirmationEmail({
    name: 'Julien Berthier',
    email: 'julien@lecabanon.fr',
    company: 'Le Cabanon',
    phone: null,
    topicLabel: 'Devis pour une terrasse',
    message:
      'Bonjour,\n\nNous ouvrons 60 couverts en terrasse en avril. Pouvez-vous nous proposer chaises et tables assorties, avec une livraison avant le 15 mars ?\n\nMerci.',
  }),
  '15-relance-1': buildPaymentReminderEmail({
    reference: reservation.reference,
    contactName: reservation.contactName,
    payNow: reservation.payNow,
    stage: 1,
    payUrl: `${SITE}/account/reservations/8b1c?canceled=true`,
  }),
  '16-relance-2': buildPaymentReminderEmail({
    reference: reservation.reference,
    contactName: reservation.contactName,
    payNow: reservation.payNow,
    stage: 2,
    payUrl: `${SITE}/account/reservations/8b1c?canceled=true`,
  }),
  '17-rapports-admin': buildReportAccessAdminEmail({
    firstName: 'Sophie',
    lastName: 'Lambert',
    email: 'sophie.lambert@groupe-horizon.fr',
    phone: '+33 1 40 00 00 00',
    siren: '552081317',
    adminUrl: `${SITE}/admin?tab=quality`,
  }),
  '18-rapports-valide': buildReportAccessApprovedEmail({
    firstName: 'Sophie',
    email: 'sophie.lambert@groupe-horizon.fr',
    qualityUrl: `${SITE}/qualite`,
  }),
  // Connexion (hook Supabase « Send Email ») : jeton fictif, lien inerte.
  '19-auth-bienvenue': buildAuthEmail({
    kind: 'welcome',
    firstName: 'Camille',
    link: `${SITE}/auth/callback?returnTo=%2Faccount&token_hash=apercu_jeton_fictif&type=signup`,
  }),
  '20-auth-connexion': buildAuthEmail({
    kind: 'login',
    link: `${SITE}/auth/callback?returnTo=%2Faccount%2Ffavoris&token_hash=apercu_jeton_fictif&type=magiclink`,
  }),
  '21-auth-code': buildAuthEmail({
    kind: 'reauthentication',
    firstName: 'Camille',
    code: '482913',
  }),
  '22-auth-notice': buildAuthEmail({
    kind: 'notice',
    firstName: 'Camille',
    noticeLabel: 'Votre mot de passe a été modifié',
  }),
}

const outDir = process.argv[2] ?? '.email-previews'
mkdirSync(outDir, { recursive: true })
const index: string[] = []
for (const [name, email] of Object.entries(previews)) {
  writeFileSync(join(outDir, `${name}.html`), email.html)
  writeFileSync(
    join(outDir, `${name}.txt`),
    `Objet : ${email.subject}\n\n${email.text}`,
  )
  index.push(`<li><a href="${name}.html">${name}</a> — ${email.subject}</li>`)
}
writeFileSync(
  join(outDir, 'index.html'),
  `<!DOCTYPE html><meta charset="utf-8"><title>Aperçus emails Terrassea</title><ul style="font:15px/1.8 sans-serif">${index.join('')}</ul>`,
)
console.log(`${Object.keys(previews).length} aperçus écrits dans ${outDir}/`)
