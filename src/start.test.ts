import { describe, expect, it } from 'vitest'
import { getCanonicalRedirectLocation, getLegacyPathRedirect } from './start'

describe('getCanonicalRedirectLocation', () => {
  it('keeps apex host requests unchanged', () => {
    expect(
      getCanonicalRedirectLocation('https://terrassea.com/catalogue?audit=1'),
    ).toBeNull()
  })

  it('redirects www host requests to the canonical apex host', () => {
    expect(
      getCanonicalRedirectLocation(
        'https://www.terrassea.com/catalogue?audit=1',
      ),
    ).toBe('https://terrassea.com/catalogue?audit=1')
  })
})

// Adresses de l'ancien site (Vercel) vues dans Search Console le 23/09/2026 :
// 21 « page avec redirection », 12 « explorée, non indexée », 1 soft 404,
// 1 noindex — toutes des URL qui n'existent plus.
describe('getLegacyPathRedirect', () => {
  it('laisse passer les adresses du site actuel', () => {
    for (const path of [
      '/',
      '/catalogue',
      '/catalogue/p/chaise-x',
      '/studio',
      '/prix',
    ]) {
      expect(getLegacyPathRedirect(`https://terrassea.com${path}`)).toBeNull()
    }
  })

  it('envoie les anciennes fiches produit au catalogue', () => {
    expect(
      getLegacyPathRedirect(
        'https://terrassea.com/produits/r7ci1opm9g388qziwk9xxkly',
      ),
    ).toBe('/catalogue')
    expect(getLegacyPathRedirect('https://terrassea.com/produits')).toBe(
      '/catalogue',
    )
    expect(getLegacyPathRedirect('https://terrassea.com/produits/')).toBe(
      '/catalogue',
    )
  })

  it('traduit les anciennes catégories en collections', () => {
    expect(
      getLegacyPathRedirect(
        'https://terrassea.com/produits?categorie=Chaise%20%2F%20Fauteuil%20Cordage',
      ),
    ).toBe('/catalogue?collection=cordage')
    expect(
      getLegacyPathRedirect(
        'https://terrassea.com/produits?categorie=Chaise / Fauteuil Aluminium',
      ),
    ).toBe('/catalogue')
  })

  it('envoie l’ancien « nouveau projet » au Studio et index.html à l’accueil', () => {
    expect(getLegacyPathRedirect('https://terrassea.com/projects/new')).toBe(
      '/studio',
    )
    expect(getLegacyPathRedirect('https://terrassea.com/index.html')).toBe('/')
  })
})
