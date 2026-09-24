import { describe, expect, it } from 'vitest'

import { buildAdminFollowUpEmail } from './templates'

// Gabarit de relance admin : registre client (logo, salutation, signature),
// corps libre échappé avec sauts de ligne, bouton facultatif, sujet repris tel
// quel. Aucune donnée client réelle.

describe('buildAdminFollowUpEmail', () => {
  it('greets without a name when the recipient has none', () => {
    const email = buildAdminFollowUpEmail({
      subject: 'Votre réservation Terrassea',
      body: 'Un mot pour faire le point sur votre réservation.',
    })
    expect(email.html).toContain('Bonjour,')
    expect(email.html).not.toContain('Bonjour Bonjour')
    expect(email.text.startsWith('Bonjour,\n')).toBe(true)
  })

  it('keeps the caller subject, greets the recipient and signs as Terrassea', () => {
    const email = buildAdminFollowUpEmail({
      subject: 'Votre devis Terrassea — TR-2026-0001',
      recipientName: 'Camille Test',
      body: 'Première ligne.\nDeuxième ligne.\n\nNouveau paragraphe.',
      reference: 'TR-2026-0001',
    })

    expect(email.subject).toBe('Votre devis Terrassea — TR-2026-0001')
    // Registre client : logo en en-tête, pas de bandeau interne.
    expect(email.html).toContain('terrassea-logo-email.png')
    expect(email.html).not.toContain('Notification interne')
    expect(email.html).toContain('Bonjour Camille Test,')
    expect(email.html).toContain('Référence TR-2026-0001')
    expect(email.html).toContain('<h1')
    expect(email.html).toContain('Votre devis Terrassea — TR-2026-0001</h1>')
    // Un saut simple devient <br>, une ligne vide sépare deux paragraphes.
    expect(email.html).toContain('Première ligne.<br>Deuxième ligne.')
    expect(email.html).toMatch(/<p[^>]*>Nouveau paragraphe\.<\/p>/)
    expect(email.html).toContain("L'équipe Terrassea")
    // Sans lien : aucun bouton.
    expect(email.html).not.toContain('display:inline-block;padding:14px 28px')

    expect(email.text).toContain('Bonjour Camille Test,')
    expect(email.text).toContain('Première ligne.\nDeuxième ligne.')
    expect(email.text).toContain('Terrassea — Pros Import EURL')
  })

  it('escapes the free text so an admin cannot inject markup', () => {
    const email = buildAdminFollowUpEmail({
      subject: 'Sujet <test> & "guillemets"',
      recipientName: 'Client <b>Gras</b>',
      body: 'Voir <script>alert(1)</script> & consorts',
    })

    expect(email.html).not.toContain('<script>')
    expect(email.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp;')
    expect(email.html).toContain('Bonjour Client &lt;b&gt;Gras&lt;/b&gt;,')
    expect(email.html).toContain(
      'Sujet &lt;test&gt; &amp; &quot;guillemets&quot;</title>',
    )
    // Le sujet rendu à Brevo reste brut : c'est un en-tête, pas du HTML.
    expect(email.subject).toBe('Sujet <test> & "guillemets"')
    // Le texte brut n'est pas échappé.
    expect(email.text).toContain('Voir <script>alert(1)</script> & consorts')
  })

  it('adds the optional button in HTML and the plain link in text', () => {
    const email = buildAdminFollowUpEmail({
      subject: 'Votre réservation Terrassea : règlement en attente',
      recipientName: 'Camille Test',
      body: 'Les frais de réservation restent à régler.',
      ctaLabel: 'Voir ma réservation',
      ctaUrl: 'https://terrassea.com/account/reservations/abc',
    })

    expect(email.html).toContain(
      'href="https://terrassea.com/account/reservations/abc"',
    )
    expect(email.html).toContain('>Voir ma réservation</a>')
    expect(email.text).toContain(
      'Voir ma réservation : https://terrassea.com/account/reservations/abc',
    )
    // Sans référence, le surtitre reste générique.
    expect(email.html).toContain('Votre suivi Terrassea')
  })

  it('uses the first non-empty line as preheader, shortened when long', () => {
    const longLine = 'a'.repeat(200)
    const email = buildAdminFollowUpEmail({
      subject: 'Sujet',
      recipientName: 'Camille',
      body: `\n\n${longLine}\nSuite.`,
    })
    // Le préchargement (div masqué en tête de <body>) est raccourci ; le
    // corps, lui, garde la ligne entière.
    const preheader = email.html.match(
      /<div style="display:none;[^>]*>([^<]*)</,
    )
    expect(preheader?.[1]).toContain(`${'a'.repeat(137)}…`)
    expect(preheader?.[1]).not.toContain(longLine)
    expect(email.html).toContain(`${longLine}<br>Suite.`)
  })
})
