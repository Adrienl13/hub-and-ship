/* global document, window, IntersectionObserver, setInterval, clearInterval, setTimeout, clearTimeout, queueMicrotask, fetch, */
import { Accueil } from './model.js'
import { config } from './config.js'
import { bind } from './bindings.js'
import { validateProject } from './project.js'

export class Page extends Accueil {
  constructor(root, settings = config) {
    super()
    this.root = root
    this.config = settings
    this.disposed = false
    this.replayTimers = []
    this.pending = new Set()
    this.reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    this.paused = this.reduce.matches
    this.bandDefs = settings.band.map((b) => ({ ...b, img: b.url }))
    this.compareDefs = this.compareDefs.map((c) => ({
      ...c,
      ...settings.compares.find((item) => item.name === c.name),
    }))
    this.texDefs = this.texDefs.map((t) => {
      const url = settings.textures[t.ref]
      return {
        ...t,
        pattern: url
          ? `url("${url}") center / cover no-repeat`
          : 'repeating-linear-gradient(135deg,#d2d1d0 0 12px,#e6e5e4 12px 24px)',
        size: 'cover',
        caption: `${t.ref} / ${url ? 'échantillon réel' : 'échantillon à confirmer'}`,
      }
    })
    document.documentElement.style.setProperty(
      '--color-process-yellow',
      settings.processYellow,
    )
    this.update = bind(root)
    this.reveal = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in')
            this.reveal.unobserve(e.target)
          }
        }),
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
    )
    this.visibleVideos = new Set()
    this.video = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          const video = e.target
          if (e.isIntersecting) {
            this.visibleVideos.add(video)
            if (!video.getAttribute('src')) {
              video.src = video.dataset.videoSrc
              video.load()
            }
            if (!this.paused) video.play().catch(() => {})
          } else {
            this.visibleVideos.delete(video)
            video.pause()
          }
        }),
      { rootMargin: '150px' },
    )
    this.mediaSeen = new WeakSet()
    this.state.tiles = this.initTiles()
    this.render()
    this.configureMedia()
    void this.attachCatalogueProject()
    this.appear = setTimeout(() => this.setState({ shown: 16 }), 80)
    this.onScroll = () => {
      const fab = window.scrollY > 600
      if (fab !== this.state.fab) this.setState({ fab })
    }
    window.addEventListener('scroll', this.onScroll, { passive: true })
    this.onScroll()
    this.onMotion = () => {
      this.paused = this.reduce.matches
      this.startTimers()
    }
    this.reduce.addEventListener('change', this.onMotion)
    this.onPageHide = (event) => {
      this.destroy()
      if (event.persisted)
        window.addEventListener('pageshow', () => window.location.reload(), {
          once: true,
        })
    }
    window.addEventListener('pagehide', this.onPageHide, { once: true })
    this.startTimers()
  }
  url(path) {
    return this.config.productPhotos[path] || super.url(path)
  }
  setState(change) {
    if (this.disposed) return
    Object.assign(
      this.state,
      typeof change === 'function' ? change(this.state) : change,
    )
    this.forceUpdate()
  }
  forceUpdate() {
    if (this.frame || this.disposed) return
    this.frame = true
    queueMicrotask(() => {
      this.frame = false
      if (!this.disposed) this.render()
    })
  }
  render() {
    this.update(this.renderVals())
    this.root
      .querySelectorAll(
        '.rv:not(.in),.rv-l:not(.in),.rv-s:not(.in),.rv-w:not(.in)',
      )
      .forEach((el) => {
        if (this.paused) el.classList.add('in')
        else this.reveal.observe(el)
      })
    this.root.querySelectorAll('video[data-video-src]').forEach((video) => {
      if (!this.mediaSeen.has(video)) {
        this.mediaSeen.add(video)
        video.muted = true
        this.video.observe(video)
      }
    })
    const fab = this.root.querySelector('.fab')
    fab.setAttribute('aria-hidden', String(!this.state.fab))
    fab.inert = !this.state.fab
  }
  configureMedia() {
    const slots = [...this.config.univers, ...this.config.parcours]
    this.root.querySelectorAll('[data-media-slot]').forEach((el) => {
      const slot = slots[Number(el.dataset.mediaSlot)]
      if (!slot?.url) return
      const img = document.createElement('img')
      img.src = slot.url
      img.alt = slot.name
      img.width = 1200
      img.height = 800
      img.loading = 'lazy'
      img.decoding = 'async'
      img.className = 'media-photo'
      el.replaceChildren(img)
      el.dataset.configured = ''
      const parentLink = el.closest('a')
      if (slot.href && parentLink) parentLink.href = slot.href
      else if (slot.href) {
        const a = document.createElement('a')
        a.href = slot.href
        a.append(img)
        el.append(a)
      }
    })
    this.root.querySelectorAll('a[href="/catalogue"]').forEach((a) => {
      a.href = this.config.catalogueHref
    })
  }
  async attachCatalogueProject() {
    try {
      const raw = window.localStorage.getItem('terrassea-projet-transfert')
      if (!raw || raw.length > 200000) return
      const response = await fetch('/api/public-catalogue')
      if (!response.ok) return
      const selection = validateProject(JSON.parse(raw), await response.json())
      if (!selection || this.disposed) return
      this.projectSelection = selection
      const form = this.root.querySelector('[data-form=project]')
      const summary = document.createElement('p')
      summary.className = 'catalogue-selection'
      summary.textContent =
        selection.lines
          .map((r) => `${r.ref} · ${r.design} · ${r.qty} pièces`)
          .join(' / ') +
        ' — ' +
        (selection.delivery === 'depot'
          ? 'Enlèvement au dépôt'
          : 'Livraison jusqu’à votre terrasse')
      form.prepend(summary)
    } catch {
      /* An unavailable catalogue must never block the lead form. */
    }
  }
  clearReplay() {
    this.replayTimers.forEach(clearTimeout)
    this.replayTimers = []
  }
  startShipTimer() {
    clearInterval(this.shipTimer)
    if (!this.paused && !this.disposed)
      this.shipTimer = setInterval(
        () => this.setState((s) => ({ ship: (s.ship + 1) % 3 })),
        4500,
      )
  }
  startTimers() {
    clearInterval(this.tileTimer)
    clearInterval(this.textureTimer)
    clearInterval(this.shipTimer)
    this.clearReplay()
    document.documentElement.classList.toggle('motion-paused', this.paused)
    this.root.querySelectorAll('video').forEach((v) => v.pause())
    if (this.paused || this.disposed) return
    this.visibleVideos.forEach((video) => video.play().catch(() => {}))
    this.tileTimer = setInterval(
      () =>
        this.swapTile(
          Math.floor(Math.random() * 4),
          Math.floor(Math.random() * 4),
        ),
      1500,
    )
    this.textureTimer = setInterval(
      () => this.setState((s) => ({ tex: (s.tex + 1) % 3, swap: s.swap + 1 })),
      3200,
    )
    this.startShipTimer()
  }
  selectShip(ship) {
    this.clearReplay()
    this.setState({ ship })
    this.startShipTimer()
  }
  replayContainer() {
    this.clearReplay()
    clearInterval(this.shipTimer)
    this.setState({ ship: 0 })
    if (this.paused) return
    this.replayTimers = [
      setTimeout(() => this.setState({ ship: 1 }), 1600),
      setTimeout(() => {
        this.setState({ ship: 2 })
        this.startShipTimer()
      }, 3600),
    ]
  }
  destroy() {
    this.disposed = true
    clearInterval(this.tileTimer)
    clearInterval(this.textureTimer)
    clearInterval(this.shipTimer)
    clearTimeout(this.appear)
    this.clearReplay()
    this.reveal.disconnect()
    this.video.disconnect()
    this.visibleVideos.clear()
    this.root.querySelectorAll('video').forEach((v) => v.pause())
    window.removeEventListener('scroll', this.onScroll)
    window.removeEventListener('pagehide', this.onPageHide)
    this.reduce.removeEventListener('change', this.onMotion)
  }
}
