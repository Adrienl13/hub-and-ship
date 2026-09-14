/* global window, IntersectionObserver, queueMicrotask, */
import { PartnersModel } from './model.js'
import { config } from './config.js'
import { bind } from '../accueil-v3/bindings.js'
export class PartnersPage extends PartnersModel {
  constructor(root, settings = config) {
    super()
    this.root = root
    this.settings = settings
    this.feedback = { application: '', newsletter: '' }
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
  destroy() {
    this.disposed = true
    this.io.disconnect()
    window.removeEventListener('scroll', this.onScroll)
    this.reduce.removeEventListener('change', this.onMotion)
    this.root.removeEventListener('keydown', this.onKey)
    window.removeEventListener('pagehide', this.onHide)
  }
}
