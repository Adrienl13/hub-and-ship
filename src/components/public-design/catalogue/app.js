/* global document, window, localStorage, fetch, IntersectionObserver, setInterval, clearInterval, queueMicrotask */
import { CatalogueModel } from './model.js'
import { bind } from '../accueil-v3/bindings.js'
import { sanitizeCart, minimum } from './data.js'
import { getAttributionFields } from '@/lib/analytics/attribution'
export class Catalogue extends CatalogueModel {
  constructor(root, products) {
    super()
    this.root = root
    this.products = products
    this.disposed = false
    this.update = bind(root)
    this.returnFocus = null
    this.lastDialog = null
    try {
      const identities = JSON.parse(
        localStorage.getItem('terrassea-projet-designs') || 'null',
      )
      this.state.cart = sanitizeCart(
        JSON.parse(localStorage.getItem('terrassea-projet') || '[]'),
        products,
        identities,
      )
      this.state.delivery =
        localStorage.getItem('terrassea-reception') === 'depot'
          ? 'depot'
          : 'terrasse'
    } catch {
      this.state.cart = []
    }
    this.io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in')
            this.io.unobserve(e.target)
          }
        }),
      { threshold: 0.1 },
    )
    this.reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    this.onMotion = () => {
      clearInterval(this.timer)
      if (!this.reduce.matches)
        this.timer = setInterval(
          () => this.setState((s) => ({ tick: s.tick + 1 })),
          2600,
        )
    }
    this.reduce.addEventListener('change', this.onMotion)
    this.onMotion()
    this.onKey = (e) => {
      const dialog = this.dialog()
      if (!dialog) return
      if (e.key === 'Escape') {
        e.preventDefault()
        this.setState({ sheet: null, cartOpen: false })
      }
      if (e.key === 'Tab') {
        const all = [
          ...dialog.querySelectorAll('button,a,input,select,[tabindex="0"]'),
        ].filter(
          (el) => !el.disabled && !el.inert && el.getClientRects().length,
        )
        if (!all.length) {
          e.preventDefault()
          dialog.focus()
          return
        }
        if (
          e.shiftKey &&
          (document.activeElement === all[0] ||
            document.activeElement === dialog)
        ) {
          e.preventDefault()
          all.at(-1).focus()
        } else if (!e.shiftKey && document.activeElement === all.at(-1)) {
          e.preventDefault()
          all[0].focus()
        }
      }
    }
    window.addEventListener('keydown', this.onKey)
    this.onStorage = (e) => {
      if (e.key === 'terrassea-projet') {
        try {
          this.state.cart = sanitizeCart(
            JSON.parse(e.newValue || '[]'),
            this.products,
            JSON.parse(
              localStorage.getItem('terrassea-projet-designs') || 'null',
            ),
          )
          this.forceUpdate()
        } catch {
          /* ignore corrupt external data */
        }
      }
    }
    window.addEventListener('storage', this.onStorage)
    this.onHide = () => this.destroy()
    window.addEventListener('pagehide', this.onHide, { once: true })
    this.render()
  }
  minimum(p, i) {
    return minimum(p, i)
  }
  isStocked(p, i) {
    return p.stockVariantIds?.includes(p.variantIds[i]) === true
  }
  totalLabel(rows, n) {
    return rows.every((r) => Number.isFinite(r.p.price))
      ? this.eur(n)
      : 'À confirmer'
  }
  sheetQuantity(p, i, n) {
    const min = this.minimum(p, i)
    return min
      ? Math.min(
          100000,
          min + Math.max(0, Math.ceil(((Number(n) || min) - min) / 10)) * 10,
        )
      : 0
  }
  setState(change) {
    if (this.disposed) return
    const delta = typeof change === 'function' ? change(this.state) : change
    if ((delta.sheet || delta.cartOpen) && !this.dialog())
      this.returnFocus = document.activeElement
    Object.assign(this.state, delta)
    if (delta.delivery)
      try {
        localStorage.setItem('terrassea-reception', delta.delivery)
      } catch {
        /* storage unavailable */
      }
    this.forceUpdate()
  }
  forceUpdate() {
    if (this.queued || this.disposed) return
    this.queued = true
    queueMicrotask(() => {
      this.queued = false
      if (!this.disposed) this.render()
    })
  }
  saveCart(input) {
    const cart = sanitizeCart(input, this.products)
    this.setState({ cart })
    try {
      const ids = Object.fromEntries(
        cart.map((r) => [
          r.key,
          this.products.find((p) => p.ref === r.ref).variantIds[r.varIdx],
        ]),
      )
      localStorage.setItem('terrassea-projet-designs', JSON.stringify(ids))
      localStorage.setItem('terrassea-projet', JSON.stringify(cart))
      // An edited cart must not leave an older handoff in the home form.
      localStorage.removeItem('terrassea-projet-transfert')
    } catch {
      document.getElementById('catalogue-status').textContent =
        'Stockage indisponible : votre sélection reste disponible dans cette page.'
    }
  }
  addToCart(p, varIdx, qty) {
    const min = this.minimum(p, varIdx)
    if (!min || !Number.isFinite(qty)) return
    const key = p.ref + ':' + varIdx,
      cart = this.state.cart.map((r) => ({ ...r })),
      row = cart.find((r) => r.key === key)
    if (row) row.qty = Math.min(100000, row.qty + qty)
    else cart.push({ key, ref: p.ref, varIdx, qty: Math.max(min, qty) })
    this.saveCart(cart)
  }
  /**
   * Demande de devis pour un modèle → /api/contact, même canal que le
   * formulaire de contact (même-origine, limite par IP, validation zod).
   * Le modèle (model.js) fournit source « catalogue_quick_quote » et le
   * produit structuré ; l'attribution first-touch part avec, comme depuis
   * /contact. Côté serveur la demande est enregistrée dans contact_requests
   * avant l'email.
   */
  async deliverQuote(payload) {
    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        attribution: getAttributionFields(Date.now()),
      }),
    })
    if (response.ok) return
    let message = 'Envoi impossible pour le moment. Réessayez dans un instant.'
    try {
      const body = await response.json()
      if (body && typeof body.error === 'string') message = body.error
    } catch {
      /* corps non JSON : message générique */
    }
    throw new Error(message)
  }
  prepareHandoff() {
    this.saveCart(this.state.cart)
    try {
      localStorage.setItem('terrassea-reception', this.state.delivery)
      localStorage.setItem(
        'terrassea-projet-transfert',
        JSON.stringify({
          lines: this.state.cart.map((r) => ({
            ref: r.ref,
            designId: this.products.find((p) => p.ref === r.ref).variantIds[
              r.varIdx
            ],
            design: this.products.find((p) => p.ref === r.ref).variants[
              r.varIdx
            ][0],
            qty: r.qty,
          })),
          delivery: this.state.delivery,
        }),
      )
    } catch {
      /* form still remains reachable */
    }
  }
  dialog() {
    return this.state.cartOpen
      ? this.root.querySelector('.drawer')
      : this.state.sheet
        ? this.root.querySelector('.sheet')
        : null
  }
  render() {
    this.update(this.renderVals())
    this.root.querySelectorAll('[data-disabled]').forEach((el) => {
      el.disabled = el.dataset.disabled === 'true'
    })
    this.io.disconnect()
    this.root.querySelectorAll('.rv:not(.in)').forEach((e) => {
      if (this.reduce.matches) e.classList.add('in')
      else this.io.observe(e)
    })
    const drawer = this.root.querySelector('.drawer')
    drawer.inert = !this.state.cartOpen
    drawer.setAttribute('aria-hidden', String(!this.state.cartOpen))
    const dialog = this.dialog()
    for (const child of this.root.children)
      if (child.tagName !== 'TEMPLATE')
        child.inert =
          !!dialog &&
          !child.contains(dialog) &&
          child !== dialog &&
          !child.matches('[data-onclick=closeCart]')
    drawer.inert = !this.state.cartOpen
    document.body.style.overflow = dialog ? 'hidden' : ''
    if (dialog !== this.lastDialog) {
      if (dialog) dialog.focus()
      else if (this.returnFocus?.isConnected) this.returnFocus.focus()
      this.lastDialog = dialog
    }
    const clear = this.root.querySelector('#grille [data-onclick=clearFilters]')
    clear.hidden = !this.state.cat && !this.state.stockOnly
  }
  destroy() {
    this.disposed = true
    clearInterval(this.timer)
    this.io.disconnect()
    this.reduce.removeEventListener('change', this.onMotion)
    window.removeEventListener('keydown', this.onKey)
    window.removeEventListener('storage', this.onStorage)
    window.removeEventListener('pagehide', this.onHide)
    document.body.style.overflow = ''
  }
}
