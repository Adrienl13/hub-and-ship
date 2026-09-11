import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
const steps = [
  {
    title: 'Votre projet garde sa singularité.',
    text: 'Mobilier, matières, quantités : votre sélection reste la vôtre. Sa faisabilité est étudiée avant tout engagement.',
    label: 'Votre sélection',
  },
  {
    title: 'Le transport se pense ensemble.',
    text: 'Le principe du container partagé : regrouper plusieurs commandes pour mutualiser le transport, plutôt que réserver un container entier pour votre seul établissement.',
    label: 'Les volumes réunis',
  },
  {
    title: 'Un budget à comprendre, avant de décider.',
    text: 'Le regroupement et les achats directs font partie de notre modèle économique. Le prix final dépend des produits, des volumes, des options et de la livraison : il sera précisé dans votre devis.',
    label: 'Votre devis',
  },
]
export function ContainerStory() {
  const [step, setStep] = useState(0)
  const [scene, setScene] = useState(0)
  const visual = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setScene(1)
          observer.disconnect()
        }
      },
      { threshold: 0.5 },
    )
    if (visual.current) observer.observe(visual.current)
    return () => observer.disconnect()
  }, [])
  return (
    <section id="realisation" className="pi-container-story">
      <div className="pi-wrap">
        <div className="pi-container-heading">
          <p className="pi-eyebrow">03 / LE DESIGN, LES PIEDS SUR TERRE</p>
          <h2>
            Votre mobilier a du caractère.
            <br />
            <span>Son acheminement a une logique.</span>
          </h2>
          <p>
            La personnalisation pour votre lieu. Le container partagé pour
            penser les volumes et le transport autrement.
          </p>
        </div>
        <div className="pi-container-layout">
          <div ref={visual} className="pi-container-visual pi-container-cinema">
            <span className="pi-eyebrow">LE PRINCIPE DU CONTAINER PARTAGÉ</span>
            <svg
              key={scene}
              className={
                scene ? 'pi-container-scene is-playing' : 'pi-container-scene'
              }
              viewBox="0 0 640 350"
              role="img"
              aria-label="Schéma de plusieurs commandes réunies dans un container partagé"
            >
              <defs>
                <pattern
                  id="pi-ribs"
                  width="18"
                  height="18"
                  patternUnits="userSpaceOnUse"
                >
                  <path d="M3 0V18" stroke="#ffffff26" strokeWidth="3" />
                </pattern>
              </defs>
              <ellipse cx="328" cy="306" rx="273" ry="21" fill="#111b2530" />
              <path d="M60 104L162 46H590L490 104Z" fill="#718490" />
              <path d="M490 104L590 46V242L490 302Z" fill="#243e51" />
              <path d="M60 104H490V302H60Z" fill="#416478" />
              <path d="M60 104H490V302H60Z" fill="url(#pi-ribs)" />
              {[0, 1, 2].map((i) => (
                <g
                  key={i}
                  className="pi-cargo-group"
                  style={{ animationDelay: `${i * 0.5}s` }}
                >
                  <rect
                    x={86 + i * 128}
                    y="151"
                    width="106"
                    height="120"
                    rx="2"
                    fill={['#dfbb72', '#bbc8d9', '#d1d8bc'][i]}
                  />
                  <path
                    d={`M${97 + i * 128} 175h84m-84 72h84m-42-84v96`}
                    stroke="#20333d40"
                    strokeWidth="2"
                  />
                  <text
                    x={139 + i * 128}
                    y="219"
                    textAnchor="middle"
                    fill="#20333d"
                    fontSize="14"
                    fontFamily="sans-serif"
                  >
                    {i === 0 ? 'VOTRE' : 'AUTRE'}
                  </text>
                  <text
                    x={139 + i * 128}
                    y="238"
                    textAnchor="middle"
                    fill="#20333d"
                    fontSize="11"
                    fontFamily="sans-serif"
                  >
                    PROJET
                  </text>
                </g>
              ))}
              <path
                d="M498 123L578 76M498 280L578 231M544 98V251"
                stroke="#bac8cf"
                strokeWidth="3"
              />
              <text x="80" y="133" fill="#fff" fontSize="11" letterSpacing="3">
                TERRASSEA
              </text>
            </svg>
            <p>
              Illustration du principe · aucun chargement réel ni économie
              chiffrée représentés.
            </p>
            <div className="pi-scene-caption">
              <span>Plusieurs projets. Un transport partagé.</span>
              <button
                className="pi-text-link"
                onClick={() => setScene((n) => n + 1)}
              >
                Rejouer le regroupement ↻
              </button>
            </div>
          </div>
          <div className="pi-container-explainer">
            <div
              className="pi-container-tabs"
              role="group"
              aria-label="Comprendre le container partagé"
            >
              {steps.map((s, i) => (
                <button
                  key={s.label}
                  aria-pressed={step === i}
                  onClick={() => setStep(i)}
                >
                  <span>0{i + 1}</span>
                  {s.label}
                </button>
              ))}
            </div>
            <div className="pi-container-answer" aria-live="polite">
              <h3>{steps[step]!.title}</h3>
              <p>{steps[step]!.text}</p>
            </div>
            <a href="/prix" className="pi-text-link">
              Comprendre notre modèle de prix <ArrowUpRight size={18} />
            </a>
          </div>
        </div>
        <div className="pi-trust-links">
          <a href="/qualite">
            <span>01 / AVANT LE DÉPART</span>Les contrôles qualité{' '}
            <ArrowUpRight />
          </a>
          <a href="/livres">
            <span>02 / JUSQU’À VOTRE LIEU</span>Les livraisons documentées{' '}
            <ArrowUpRight />
          </a>
          <a href="/contact">
            <span>03 / VOTRE INTERLOCUTEUR</span>Parler de votre projet{' '}
            <ArrowUpRight />
          </a>
        </div>
      </div>
    </section>
  )
}
