import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Pause, Play } from 'lucide-react'

// Editorial references from the repository catalogue. No price or capability inference.
const chairs = [
  {
    image: '/catalogue/bistro-seating-clean/BIS-057-01.webp',
    label: 'Chevrons bleus',
    tone: '#e3e7ec',
  },
  {
    image: '/catalogue/bistro-seating-clean/BIS-006-01.webp',
    label: 'Tressage rosé',
    tone: '#ece0d9',
  },
  {
    image: '/catalogue/rope-series/ROP-015-01.webp',
    label: 'Amalfi · lounge',
    tone: '#e7e6df',
  },
  {
    image: '/catalogue/bistro-seating-clean/BIS-036-01.webp',
    label: 'Siena · table en situation',
    tone: '#e3e5df',
  },
  {
    image: '/catalogue/bistro-seating-clean/BIS-009-01.webp',
    label: 'Montmartre · fauteuil',
    tone: '#e7e2db',
  },
  {
    image: '/catalogue/rope-series/ROP-007-01.webp',
    label: 'Deauville · fauteuil cordage',
    tone: '#ede0de',
  },
  {
    image: '/catalogue/rope-series/ROP-019-01.webp',
    label: 'Ravenna · lounge',
    tone: '#e5e6db',
  },
  {
    image: '/catalogue/rope-series/ROP-040-01.webp',
    label: 'Patmos · chaise cordage',
    tone: '#dfe7e5',
  },
  {
    image: '/catalogue/bistro-seating-clean/BIS-039-01.webp',
    label: 'Ravenna · bistrot',
    tone: '#e0e5ee',
  },
]
const families = [
  { label: 'Chaises', index: 0 },
  { label: 'Fauteuils', index: 4 },
  { label: 'Tables', index: 3 },
  { label: 'Lounge', index: 2 },
]

export function ChairShowcase() {
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [reduced, setReduced] = useState(true)
  const [visible, setVisible] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduced(media.matches)
    sync()
    media.addEventListener('change', sync)
    const observer = new IntersectionObserver(([entry]) =>
      setVisible(entry?.isIntersecting ?? false),
    )
    if (root.current) observer.observe(root.current)
    return () => {
      media.removeEventListener('change', sync)
      observer.disconnect()
    }
  }, [])
  useEffect(() => {
    if (paused || hovered || reduced || !visible) return
    const timer = window.setInterval(() => {
      if (!document.hidden) setActive((n) => (n + 1) % chairs.length)
    }, 3000)
    return () => window.clearInterval(timer)
  }, [paused, hovered, reduced, visible])
  const move = (step: number) => {
    setPaused(true)
    setActive((n) => (n + step + chairs.length) % chairs.length)
  }
  return (
    <div
      ref={root}
      className="pi-chair-showcase pi-showcase-depth"
      style={{ backgroundColor: chairs[active]!.tone }}
      role="region"
      aria-label="Explorer les modèles du catalogue"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={(e) => {
        if (!(e.target as HTMLElement).closest('[data-motion-toggle]'))
          setPaused(true)
      }}
    >
      <div className="pi-showcase-heading">
        <span>DES FORMES. DES COULEURS. VOTRE LIEU.</span>
        <span>0{active + 1} / 09</span>
      </div>
      <div
        className="pi-showcase-families"
        role="group"
        aria-label="Explorer les familles de mobilier"
      >
        {families.map((f) => (
          <button
            key={f.label}
            onClick={() => {
              setPaused(true)
              setActive(f.index)
            }}
            aria-pressed={active === f.index}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="pi-chair-orbit">
        {chairs.map((chair, i) => {
          const position = (i - active + chairs.length) % chairs.length
          return (
            <figure
              key={chair.image}
              className="pi-chair-card"
              data-position={position}
              aria-hidden={position !== 0}
              data-testid={position === 0 ? 'featured-model' : undefined}
            >
              <img
                src={chair.image}
                alt={
                  i === 0
                    ? 'Assise bistro, photographie catalogue originale'
                    : `${chair.label}, photographie catalogue originale`
                }
                width="800"
                height="800"
                fetchPriority={i === 0 ? 'high' : 'low'}
                decoding="async"
              />
            </figure>
          )
        })}
      </div>
      <div className="pi-showcase-bottom">
        <div>
          <span className="pi-eyebrow">UNE AUTRE FAÇON DE DONNER LE TON</span>
          <p>{chairs[active]!.label}</p>
        </div>
        <div className="pi-showcase-controls">
          <button
            className="pi-icon-button"
            aria-label="Modèle précédent"
            onClick={() => move(-1)}
          >
            <ArrowLeft size={18} />
          </button>
          {!reduced && (
            <button
              className="pi-icon-button"
              data-motion-toggle
              aria-label={
                paused ? 'Animer les modèles' : 'Mettre les modèles en pause'
              }
              onClick={() => setPaused(!paused)}
            >
              {paused ? <Play size={16} /> : <Pause size={16} />}
            </button>
          )}
          <button
            className="pi-icon-button"
            aria-label="Modèle suivant"
            onClick={() => move(1)}
          >
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
      <p className="pi-showcase-note">
        Photographies catalogue originales. Votre personnalisation sera étudiée
        séparément.
      </p>
    </div>
  )
}
