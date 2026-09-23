import { describe, expect, it } from 'vitest'

import { buildAuthEmail, type AuthEmailKind } from './templates'

const LINK =
  'https://terrassea.com/auth/callback?returnTo=%2Faccount&token_hash=pkce_abc123&type=signup'
const LINK_HTML = LINK.replace(/&/g, '&amp;')

describe('emails de connexion (hook Send Email)', () => {
  it('welcome : sujet, bouton « Créer mon espace », étapes et lien en clair', () => {
    const email = buildAuthEmail({
      kind: 'welcome',
      link: LINK,
      firstName: 'Camille',
    })
    expect(email.subject).toBe('Bienvenue chez Terrassea — créez votre espace')
    expect(email.html).toContain('Bienvenue chez Terrassea')
    expect(email.html).toContain('Bonjour Camille,')
    expect(email.html).toContain('Créer mon espace')
    expect(email.html).toContain(`href="${LINK_HTML}"`)
    expect(email.html).toContain('Complétez votre fiche')
    expect(email.html).toContain('Bon à savoir')
    expect(email.html).toContain('word-break:break-all')
    expect(email.html).toContain('Vous n’avez rien demandé ?')
    expect(email.text).toContain(LINK)
    expect(email.text).toContain('Bonjour Camille,')
    expect(email.text).toContain('Créer mon espace : ')
    expect(email.text).toContain('terrassea.com · contact@terrassea.com')
  })

  it('login : sujet, « Me connecter », sans prénom ni étapes', () => {
    const email = buildAuthEmail({ kind: 'login', link: LINK })
    expect(email.subject).toBe('Votre lien de connexion Terrassea')
    expect(email.html).toContain('Votre lien de connexion')
    expect(email.html).toContain('Bonjour,')
    expect(email.html).toContain('Me connecter')
    expect(email.html).toContain('Aucun mot de passe')
    expect(email.html).not.toContain('Et maintenant ?')
    expect(email.html).toContain(`href="${LINK_HTML}"`)
    expect(email.text).toContain(LINK)
  })

  it('recovery et changement d’adresse : sujets et boutons attendus', () => {
    const recovery = buildAuthEmail({ kind: 'recovery', link: LINK })
    expect(recovery.subject).toBe('Réinitialiser votre accès Terrassea')
    expect(recovery.html).toContain('Réinitialiser votre accès')
    expect(recovery.html).toContain('Me connecter')
    expect(recovery.text).toContain(LINK)

    const current = buildAuthEmail({ kind: 'email_change_current', link: LINK })
    expect(current.subject).toBe('Confirmez votre adresse email — Terrassea')
    expect(current.html).toContain('Confirmez le changement d’adresse')
    expect(current.html).toContain('>Confirmer<')

    const next = buildAuthEmail({ kind: 'email_change_new', link: LINK })
    expect(next.subject).toBe('Confirmez votre adresse email — Terrassea')
    expect(next.html).toContain('Confirmez votre nouvelle adresse')
    expect(next.html).toContain('>Confirmer<')
    expect(next.text).toContain(LINK)
  })

  it('reauthentication : le code en évidence, aucun lien', () => {
    const email = buildAuthEmail({ kind: 'reauthentication', code: '482913' })
    expect(email.subject).toBe('Votre code de vérification Terrassea')
    expect(email.html).toContain('Votre code de vérification')
    expect(email.html).toContain('>482913<')
    expect(email.html).toContain('>Code<')
    expect(email.html).toContain('expire dans quelques minutes')
    expect(email.html).not.toContain('/auth/callback')
    expect(email.text).toContain('Code : 482913')
  })

  it('notice : le libellé fait le titre et le sujet, avec l’alerte contact', () => {
    const email = buildAuthEmail({
      kind: 'notice',
      noticeLabel: 'Votre mot de passe a été modifié',
    })
    expect(email.subject).toBe('Votre mot de passe a été modifié — Terrassea')
    expect(email.html).toContain('<h1')
    expect(email.html).toContain('Votre mot de passe a été modifié')
    expect(email.html).toContain('Ce n’est pas vous ?')
    expect(email.html).toContain('contact@terrassea.com')
    expect(email.text).toContain('Ce n’est pas vous ?')
    expect(email.html).not.toContain('/auth/callback')

    const fallback = buildAuthEmail({ kind: 'notice' })
    expect(fallback.subject).toBe('Information sur votre compte — Terrassea')
  })

  it('échappe un prénom hostile dans chaque gabarit', () => {
    const hostile = '<img src=x onerror=alert(1)>'
    const kinds: AuthEmailKind[] = [
      'welcome',
      'login',
      'recovery',
      'email_change_current',
      'email_change_new',
      'reauthentication',
      'notice',
    ]
    for (const kind of kinds) {
      const email = buildAuthEmail({
        kind,
        link: LINK,
        code: '123456',
        firstName: hostile,
        noticeLabel: hostile,
      })
      expect(email.html, kind).not.toContain(hostile)
      expect(email.html, kind).toContain('&lt;img src=x onerror=alert(1)&gt;')
    }
  })

  it('échappe un lien hostile dans le href et dans le lien en clair', () => {
    const email = buildAuthEmail({
      kind: 'login',
      link: 'https://terrassea.com/auth/callback?a="><script>alert(1)</script>',
    })
    expect(email.html).not.toContain('<script>')
    expect(email.html).toContain('&quot;&gt;&lt;script&gt;')
  })
})
