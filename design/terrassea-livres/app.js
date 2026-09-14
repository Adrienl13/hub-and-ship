/* global document,window,fetch,IntersectionObserver */
import { bind } from '../terrassea-accueil-v3/bindings.js'
import { computeStats, subscribeContainerNotification } from './shared.js'
export class RegistryPage {
  constructor(root) {
    this.root = root
    this.containers = []
    this.sgsIds = []
    this.filter = 'all'
    this.open = null
    this.loaded = false
    this.failed = false
    this.feedback = 'Démonstration : aucune inscription réelle.'
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
      { threshold: 0.1 },
    )
    this.onMotion = () => this.render()
    this.reduce.addEventListener('change', this.onMotion)
    this.onClick = (e) => {
      const button = e.target.closest('.registry-toggle')
      if (!button) return
      const id = button.closest('[data-container-id]').dataset.containerId
      this.open = this.open === id ? null : id
      this.render()
    }
    root.addEventListener('click', this.onClick)
    this.onResize = () => this.render()
    window.addEventListener('resize', this.onResize)
    this.onHide = () => this.destroy()
    window.addEventListener('pagehide', this.onHide, { once: true })
    this.render()
  }
  load(data) {
    this.containers = data.containers
    this.sgsIds = data.sgsIds
    this.loaded = true
    this.failed = false
    const mount = this.root.querySelector('#registry-cards')
    mount.innerHTML = ''
    for (const card of data.cards)
      mount.insertAdjacentHTML('beforeend', card.html)
    mount
      .querySelectorAll('img')
      .forEach((img) =>
        img.addEventListener('error', () => img.remove(), { once: true }),
      )
    this.open = this.containers[0]?.id || null
    this.render()
  }
  visible() {
    return this.containers.filter(
      (c) =>
        this.filter === 'all' ||
        (this.filter === 'done'
          ? c.status === 'delivered'
          : c.status !== 'delivered'),
    )
  }
  render() {
    const done = this.containers.filter((c) => c.status === 'delivered'),
      transit = this.containers.length - done.length,
      s = computeStats(done),
      n = done.length,
      known = !n || done.some((c) => c.savingsPercent != null),
      ready = this.loaded && !this.failed
    const totals = ready
      ? [
          {
            num: String(n),
            label: transit
              ? `containers livrés · ${transit} en transit`
              : 'containers livrés',
            color: '#8f6f33',
          },
          {
            num: String(s.totalPros),
            label: 'pros servis',
            color: 'var(--color-text)',
          },
          {
            num: s.totalArticles.toLocaleString('fr-FR'),
            label: 'articles livrés',
            color: 'var(--color-text)',
          },
          ...(known
            ? [
                {
                  num: `${s.avgSavingsPercent ? '−' : ''}${s.avgSavingsPercent} %`,
                  label: 'économie moyenne vs retail FR',
                  color: 'var(--color-accent-700)',
                },
              ]
            : []),
        ]
      : []
    const checked = done.filter((c) => this.sgsIds.includes(c.id)).length
    const stats = ready
      ? [
          {
            num: String(n),
            label: 'containers partis et livrés',
            color: '#e2c27a',
          },
          ...(n && checked
            ? [
                {
                  num: `${Math.round((checked / n) * 100)} %`,
                  label: 'contrôlés SGS avant départ',
                  color: 'var(--color-bg)',
                },
              ]
            : []),
          {
            num: String(s.totalPros),
            label: 'établissements équipés',
            color: 'var(--color-bg)',
          },
          ...(known
            ? [
                {
                  num: `${s.avgSavingsPercent ? '−' : ''}${s.avgSavingsPercent} %`,
                  label: 'économie moyenne constatée',
                  color: '#e2c27a',
                },
              ]
            : []),
        ].map((x, i) => ({ ...x, delay: i * 0.1 + 's' }))
      : []
    this.update({
      totals,
      stats,
      filters: [
        ['all', 'Tous', this.containers.length],
        ['transit', 'En transit', transit],
        ['done', 'Livrés', n],
      ].map(([key, label, count]) => ({
        label: `${label} (${count})`,
        selected: key === this.filter,
        border: 'var(--color-neutral-300)',
        bg: key === this.filter ? 'var(--color-text)' : 'transparent',
        color: key === this.filter ? 'var(--color-bg)' : 'var(--color-text)',
        pick: () => {
          this.filter = key
          this.open = this.visible()[0]?.id || null
          this.render()
        },
      })),
      feedback: this.feedback,
      submitLabel: 'M’avertir',
      submit: (e) => this.subscribe(e),
    })
    const ids = new Set(this.visible().map((c) => c.id))
    this.root.querySelectorAll('.registry-card').forEach((card) => {
      card.hidden = !ids.has(card.dataset.containerId)
      const open = card.dataset.containerId === this.open
      const button = card.querySelector('.registry-toggle'),
        detail = card.querySelector('.registry-details')
      button.setAttribute('aria-expanded', String(open))
      detail.setAttribute('aria-hidden', String(!open))
      detail.inert = !open
      detail.style.maxHeight = open ? detail.scrollHeight + 'px' : '0px'
    })
    this.root.querySelector('#registry-status').textContent = this.failed
      ? 'Le registre est momentanément indisponible. Aucun container de démonstration ne le remplace.'
      : !this.loaded
        ? 'Chargement du registre…'
        : ids.size
          ? ''
          : 'Aucun container publié dans cette catégorie.'
    this.root.querySelectorAll('.rv:not(.in),.rv-w:not(.in)').forEach((el) => {
      if (this.reduce.matches) el.classList.add('in')
      else this.io.observe(el)
    })
  }
  async subscribe(e) {
    e.preventDefault()
    const form = e.currentTarget
    if (!form.reportValidity()) return
    // Reuse the existing subscription contract through a deliberately disabled local client.
    // Wiring an approved real client later preserves the existing RPC and repository.
    const localClient = {
      rpc: async () => ({
        error: {
          message: 'Simulation uniquement : aucune inscription envoyée.',
        },
      }),
    }
    try {
      await subscribeContainerNotification(
        localClient,
        form.elements.email.value.trim(),
        'livres',
      )
    } catch (error) {
      this.feedback = error.message
      this.render()
    }
  }
  destroy() {
    this.disposed = true
    this.io.disconnect()
    this.reduce.removeEventListener('change', this.onMotion)
    this.root.removeEventListener('click', this.onClick)
    window.removeEventListener('resize', this.onResize)
    window.removeEventListener('pagehide', this.onHide)
  }
}
const root =
  typeof document !== 'undefined'
    ? document.getElementById('livres-page')
    : null
if (root) {
  const page = new RegistryPage(root)
  fetch('./api')
    .then((r) => {
      if (!r.ok) throw new Error('Unavailable')
      return r.json()
    })
    .then((data) => {
      if (!page.disposed) page.load(data)
    })
    .catch(() => {
      if (!page.disposed) {
        page.failed = true
        page.render()
      }
    })
}
