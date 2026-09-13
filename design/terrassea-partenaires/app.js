/* global document, window, fetch, IntersectionObserver, queueMicrotask, URL, FormData */
import { PartnersModel } from './model.js'
import { config } from './config.js'
import { bind } from '../terrassea-accueil-v3/bindings.js'
export class PartnersPage extends PartnersModel {
  constructor(root, settings = config) {
    super()
    this.root = root
    this.settings = settings
    this.feedback = {
      application: 'Démonstration : aucune candidature réelle.',
      newsletter: 'Démonstration : aucune inscription réelle.',
    }
    this.pending = new Set()
    this.update = bind(root)
    this.reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    this.io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in')
            this.io.unobserve(e.target)
          }
        }),
      { threshold: 0.1, rootMargin: '0px 0px -6% 0px' },
    )
    this.onMotion = () => this.render()
    this.reduce.addEventListener('change', this.onMotion)
    this.onScroll = () => {
      const fab = window.scrollY > 700
      if (fab !== this.state.fab) this.setState({ fab })
    }
    window.addEventListener('scroll', this.onScroll, { passive: true })
    this.onKey = (e) => {
      const tabs = [...this.root.querySelectorAll('[role=tab]')]
      const idx = tabs.indexOf(e.target)
      if (idx < 0) return
      const moves = {
        ArrowDown: (idx + 1) % 4,
        ArrowRight: (idx + 1) % 4,
        ArrowUp: (idx + 3) % 4,
        ArrowLeft: (idx + 3) % 4,
        Home: 0,
        End: 3,
      }
      if (!(e.key in moves)) return
      e.preventDefault()
      const next = moves[e.key]
      this.setState({ tab: next, formStatus: this.defs[next].id })
      tabs[next].focus()
    }
    root.addEventListener('keydown', this.onKey)
    this.onHide = (e) => {
      this.destroy()
      if (e.persisted)
        window.addEventListener('pageshow', () => window.location.reload(), {
          once: true,
        })
    }
    window.addEventListener('pagehide', this.onHide, { once: true })
    this.render()
    this.onScroll()
  }
  setState(change) {
    if (this.disposed) return
    Object.assign(
      this.state,
      typeof change === 'function' ? change(this.state) : change,
    )
    if (this.queued) return
    this.queued = true
    queueMicrotask(() => {
      this.queued = false
      if (!this.disposed) this.render()
    })
  }
  render() {
    this.update(this.renderVals())
    const reco = this.root.querySelector('#recommendation')
    reco.inert = this.state.profile === null
    reco.setAttribute('aria-hidden', String(this.state.profile === null))
    this.root
      .querySelectorAll('.rv:not(.in),.rv-l:not(.in),.rv-w:not(.in)')
      .forEach((el) => {
        if (this.reduce.matches) el.classList.add('in')
        else this.io.observe(el)
      })
    const fab = this.root.querySelector('.fab')
    fab.inert = !this.state.fab
    fab.setAttribute('aria-hidden', String(!this.state.fab))
    this.root
      .querySelectorAll('[data-onclick="q.toggle"]')
      .forEach((b) =>
        b.nextElementSibling.setAttribute(
          'aria-hidden',
          String(b.getAttribute('aria-expanded') !== 'true'),
        ),
      )
  }
  async send(event, type) {
    event.preventDefault()
    const form = event.currentTarget
    if (!form.reportValidity() || this.pending.has(type)) return
    if (this.settings.demo) {
      this.feedback[type] =
        type === 'application'
          ? 'Simulation uniquement : aucune candidature envoyée.'
          : 'Simulation uniquement : aucune inscription envoyée.'
      this.render()
      return
    }
    const endpoint = this.settings[type + 'Endpoint']
    if (
      !endpoint ||
      new URL(endpoint, window.location.href).origin !== window.location.origin
    ) {
      this.feedback[type] = 'Envoi indisponible. Votre saisie est conservée.'
      this.render()
      return
    }
    const payload = Object.fromEntries(new FormData(form))
    if (type === 'application' && !/^\d{14}$/.test(payload.siret)) {
      this.feedback[type] = 'Le SIRET doit contenir exactement 14 chiffres.'
      this.render()
      return
    }
    this.pending.add(type)
    const button = form.querySelector('button[type=submit]')
    button.disabled = true
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) throw new Error('Submission failed')
      this.state[type === 'application' ? 'sent' : 'sub'] = true
      this.feedback[type] =
        type === 'application'
          ? 'Candidature envoyée — réponse sous 48 h ✓'
          : 'Merci, vous serez prévenu ✓'
    } catch {
      this.feedback[type] =
        'L’envoi a échoué. Votre saisie est conservée pour réessayer.'
    } finally {
      this.pending.delete(type)
      button.disabled = false
      if (!this.disposed) this.render()
    }
  }
  destroy() {
    this.disposed = true
    this.io.disconnect()
    window.removeEventListener('scroll', this.onScroll)
    this.reduce.removeEventListener('change', this.onMotion)
    this.root.removeEventListener('keydown', this.onKey)
    window.removeEventListener('pagehide', this.onHide)
  }
}
const root =
  typeof document !== 'undefined'
    ? document.getElementById('partners-page')
    : null
if (root) new PartnersPage(root)
