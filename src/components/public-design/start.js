/* global localStorage, window, document, fetch, URLSearchParams */
import { PARTNER_ACTIVITY_PROFILE_LABEL } from '@/lib/partner-applications'
import { Page } from './accueil-v3/app.js'
import { Catalogue } from './catalogue/app.js'
import { adaptCatalogue, sanitizeCart } from './catalogue/data.js'
import { PricePage } from './prix/app.js'
import { PartnersPage } from './partenaires/app.js'
import { RegistryPage } from './livres/app.js'

export function startPage(kind, root, onSelection, onPartner) {
  const page =
    kind === 'home'
      ? new Page(root)
      : kind === 'catalogue'
        ? new Catalogue(root, [])
        : kind === 'prix'
          ? new PricePage(root)
          : kind === 'partenaires'
            ? new PartnersPage(root)
            : new RegistryPage(root)
  if (kind === 'partenaires' && onPartner) {
    const update = page.setState.bind(page)
    let nonce = 0
    page.setState = (change) => {
      update(change)
      const profile =
        Object.entries(PARTNER_ACTIVITY_PROFILE_LABEL).find(
          ([, label]) => label === page.state.formProfile,
        )?.[0] || ''
      onPartner({ profile, status: page.state.formStatus, nonce: ++nonce })
    }
  }
  if (kind === 'home') {
    const observer = new window.MutationObserver(() => {
      if (page.projectSelection) {
        onSelection(page.projectSelection)
        observer.disconnect()
      }
    })
    observer.observe(root, { childList: true, subtree: true })
    const destroy = page.destroy.bind(page)
    page.destroy = () => {
      observer.disconnect()
      destroy()
    }
  }
  if (['catalogue', 'prix', 'livres'].includes(kind)) {
    if (kind === 'catalogue') root.dataset.loading = 'true'
    fetch(kind === 'livres' ? '/api/public-registry' : '/api/public-catalogue')
      .then((r) => {
        if (!r.ok) throw new Error('Unavailable')
        return r.json()
      })
      .then((data) => {
        if (page.disposed) return
        if (kind === 'prix') page.loadCatalogue(data)
        else if (kind === 'livres') page.load(data)
        else {
          page.products = adaptCatalogue(data)
          try {
            page.state.cart = sanitizeCart(
              JSON.parse(localStorage.getItem('terrassea-projet') || '[]'),
              page.products,
              JSON.parse(
                localStorage.getItem('terrassea-projet-designs') || 'null',
              ),
            )
          } catch {
            page.state.cart = []
          }
          const collection = new URLSearchParams(window.location.search).get(
            'collection',
          )
          if (collection === 'cordage') page.state.fam = 'Cordage'
          if (collection === 'textilene') page.state.fam = 'Textilène'
          if (collection === 'bistrot') page.state.fam = 'Tressage'
          try {
            const ref = decodeURIComponent(
              window.location.hash.replace(/^#produit-/, ''),
            )
            const p = page.products.find((p) => p.ref === ref)
            if (p && window.location.hash.startsWith('#produit-')) {
              page.state.sheet = p.ref
              page.state.qty = page.minimum(p, 0)
            }
          } catch {
            /* Invalid hash is ignored. */
          }
          page.render()
          delete root.dataset.loading
          root.querySelector('#catalogue-status').textContent = page.products
            .length
            ? ''
            : 'Le catalogue ne contient actuellement aucun produit public.'
        }
      })
      .catch(() => {
        if (page.disposed) return
        if (kind === 'livres') {
          page.failed = true
          page.render()
        }
        if (kind === 'catalogue') {
          delete root.dataset.loading
          root.dataset.error = 'true'
          root.querySelector('#catalogue-status').textContent =
            'Le catalogue est momentanément indisponible.'
        }
      })
  }
  return () => {
    page.destroy()
    document.body.style.overflow = ''
    document.documentElement.classList.remove('motion-paused')
  }
}
