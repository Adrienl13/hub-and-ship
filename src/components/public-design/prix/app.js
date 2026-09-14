/* global document, window, IntersectionObserver, setInterval, clearInterval, queueMicrotask, */
import { PriceModel } from './model.js'
import { config } from './config.js'
import { bind } from '../accueil-v3/bindings.js'
import { adaptCatalogue } from '../catalogue/data.js'
export class PricePage extends PriceModel {
  constructor(root, settings = config) {
    super()
    this.root = root
    this.settings = settings
    this.price = null
    this.update = bind(root)
    this.reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    this.io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in')
            this.io.unobserve(e.target)
          }
        }),
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
    )
    this.videoVisible = new Set()
    this.videoObserver = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          const video = e.target
          if (e.isIntersecting) this.videoVisible.add(video)
          else this.videoVisible.delete(video)
          this.syncVideo(video)
        }),
      { threshold: 0.2 },
    )
    this.onMotion = () => {
      this.startAuto()
      this.render()
      this.root.querySelectorAll('video').forEach((v) => this.syncVideo(v))
    }
    this.reduce.addEventListener('change', this.onMotion)
    this.onVisibility = () =>
      this.root.querySelectorAll('video').forEach((v) => this.syncVideo(v))
    document.addEventListener('visibilitychange', this.onVisibility)
    this.onHide = (event) => {
      this.destroy()
      if (event.persisted)
        window.addEventListener('pageshow', () => window.location.reload(), {
          once: true,
        })
    }
    window.addEventListener('pagehide', this.onHide, { once: true })
    this.render()
    this.startAuto()
  }
  startAuto() {
    clearInterval(this.timer)
    if (this.reduce.matches || this.disposed) return
    this.timer = setInterval(() => {
      if (Date.now() < (this.pauseUntil || 0) || document.hidden) return
      this.setState((s) => ({
        step: s.step >= 6 ? 0 : s.step + 1,
        focus: null,
      }))
    }, 1600)
  }
  syncVideo(video) {
    video.muted = true
    if (
      this.videoVisible.has(video) &&
      !this.reduce.matches &&
      !document.hidden
    )
      video.play()?.catch(() => {})
    else video.pause()
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
    this.root
      .querySelectorAll('.rv:not(.in),.rv-l:not(.in),.rv-w:not(.in)')
      .forEach((el) => {
        if (this.reduce.matches) el.classList.add('in')
        else this.io.observe(el)
      })
    this.root.querySelectorAll('video:not([data-observed])').forEach((v) => {
      v.dataset.observed = 'true'
      v.muted = true
      this.videoObserver.observe(v)
    })
    this.root
      .querySelectorAll('[data-onclick="q.toggle"]')
      .forEach((button) =>
        button.nextElementSibling.setAttribute(
          'aria-hidden',
          String(button.getAttribute('aria-expanded') !== 'true'),
        ),
      )
  }
  loadCatalogue(data) {
    const product = adaptCatalogue(data).find(
      (p) => p.id === this.settings.quiberonId,
    )
    this.product = product || null
    this.price = product?.price ?? null
    this.render()
  }
  destroy() {
    this.disposed = true
    clearInterval(this.timer)
    this.io.disconnect()
    this.videoObserver.disconnect()
    this.root.querySelectorAll('video').forEach((v) => v.pause())
    this.reduce.removeEventListener('change', this.onMotion)
    document.removeEventListener('visibilitychange', this.onVisibility)
    window.removeEventListener('pagehide', this.onHide)
  }
}
