import { ArrowDown, ArrowRight, ArrowUpRight } from 'lucide-react'
import { useState } from 'react'
import { ChairShowcase } from './ChairShowcase'
import { ContainerStory } from './ContainerStory'
import { ExperienceHeader, ExperienceFooter } from './ExperienceHeader'
import { isStudioEnabled } from '@/lib/studio/flags'
const directions = [
  {
    id: 'weave',
    name: 'Le rythme du tressage',
    detail: 'Un motif donne le ton. Les couleurs ouvrent la discussion.',
    ref: 'PI-TR-007',
    image: '/studio/materials/pi-tr-007-detail.webp',
    word: 'Rythme',
    color: '#e4e9f6',
  },
  {
    id: 'rope',
    name: 'Le relief du cordage',
    detail: 'Une texture, une densité, une présence à explorer.',
    ref: 'PI-RP-060',
    image: '/studio/materials/pi-rp-060-detail.webp',
    word: 'Relief',
    color: '#e6e9df',
  },
  {
    id: 'textilene',
    name: 'La finesse du textilène',
    detail: 'Regarder la trame. Rapprocher les nuances.',
    ref: 'PI-TX-033',
    image: '/studio/materials/pi-tx-033-detail.webp',
    word: 'Trame',
    color: '#ebe4dd',
  },
]
export function ProjectHome() {
  const [direction, setDirection] = useState(0)
  const d = directions[direction]!
  const start = isStudioEnabled() ? '/studio' : '/contact'
  return (
    <div className="pi-page">
      <ExperienceHeader />
      <main id="top">
        <section className="pi-home-hero pi-wrap">
          <div className="pi-hero-copy">
            <p className="pi-eyebrow">
              <span className="pi-status-dot" /> MOBILIER PROFESSIONNEL ·
              PERSONNALISATION
            </p>
            <h1>
              Votre lieu a<br />
              du caractère.
              <span>
                Votre mobilier
                <br />
                aussi.
              </span>
            </h1>
            <p className="pi-hero-intro">
              Chaises, fauteuils, tables, lounge. Trouvez un modèle qui vous
              plaît, ou créez votre direction avec nos matières et vos couleurs.
            </p>
            <div className="pi-hero-actions">
              <a href={start} className="pi-button pi-button-blue">
                {isStudioEnabled()
                  ? 'Créer mon projet dans le Studio'
                  : 'Construire mon projet'}
                <ArrowUpRight size={18} />
              </a>
              <a href="/catalogue" className="pi-text-link">
                Explorer le mobilier <ArrowRight size={16} />
              </a>
            </div>
            <p className="pi-micro">
              Restaurants · Hôtels · Architectes · Réseaux
            </p>
          </div>
          <ChairShowcase />
        </section>
        <div className="pi-opening-line pi-wrap">
          <span>DU MOBILIER À VOTRE IMAGE, UN PROJET À LA FOIS.</span>
          <a href="#matieres">
            Entrer dans la matière <ArrowDown size={16} />
          </a>
        </div>
        <section
          className="pi-atmosphere pi-wrap"
          aria-labelledby="pi-atmosphere-title"
        >
          <div className="pi-atmosphere-heading">
            <p className="pi-eyebrow">
              LE MOBILIER CHANGE LA PERCEPTION D’UN LIEU
            </p>
            <h2 id="pi-atmosphere-title">
              On vient pour une adresse.
              <br />
              <span>On revient pour une atmosphère.</span>
            </h2>
          </div>
          <div className="pi-atmosphere-pair">
            <figure className="pi-atmosphere-wide">
              <img
                src="/images/home/hero-salon-vue-mer.webp"
                alt="Inspiration : salon outdoor ouvert sur la mer"
                width="1920"
                height="960"
                loading="lazy"
              />
              <figcaption>
                <span>01 / PRENDRE LE TEMPS</span>Des lignes qui invitent à
                rester.
              </figcaption>
            </figure>
            <figure className="pi-atmosphere-detail">
              <img
                src="/images/home/fauteuils-tresses-dessus.webp"
                alt="Inspiration : fauteuils aux cordages roses et bleus vus du dessus"
                width="1920"
                height="960"
                loading="lazy"
              />
              <figcaption>
                <span>02 / AFFIRMER UNE IDENTITÉ</span>Une couleur que l’on
                retient.
              </figcaption>
            </figure>
          </div>
          <div className="pi-atmosphere-foot">
            <p>
              Images d’inspiration. Les modèles, finitions et associations de
              votre projet seront vérifiés ensemble.
            </p>
            <a href={start} className="pi-text-link">
              Trouver ma direction <ArrowRight size={18} />
            </a>
          </div>
        </section>
        <section id="matieres" className="pi-material-story pi-wrap">
          <div className="pi-section-heading">
            <p className="pi-eyebrow">01 / TROUVER VOTRE LANGAGE</p>
            <h2>
              Tout commence
              <br />
              par une sensation.
            </h2>
            <p>
              La ligne d’une assise. Le relief d’un cordage. Le rythme d’un
              motif. Dans le Studio, rapprochez vos idées avant de figer vos
              choix.
            </p>
          </div>
          <div className="pi-material-editorial">
            <div className="pi-material-visual" style={{ background: d.color }}>
              <span aria-hidden className="pi-material-word">
                {d.word}
              </span>
              <img
                key={d.id}
                src={d.image}
                loading="lazy"
                alt={`Échantillon réel ${d.ref}`}
              />
              <span className="pi-index-label">{d.ref} / ÉCHANTILLON RÉEL</span>
            </div>
            <div className="pi-material-direction">
              <div role="group" aria-label="Explorer les matières">
                {directions.map((item, i) => (
                  <button
                    key={item.id}
                    onClick={() => setDirection(i)}
                    aria-pressed={i === direction}
                  >
                    <span>0{i + 1}</span>
                    <span>{item.name}</span>
                    <ArrowUpRight size={20} />
                  </button>
                ))}
              </div>
              <p aria-live="polite">{d.detail}</p>
              <p className="pi-micro">
                Le motif et les couleurs sont deux choix distincts. Les
                possibilités seront vérifiées pour votre mobilier.
              </p>
              <a className="pi-text-link" href={start}>
                Construire ma planche projet <ArrowRight size={18} />
              </a>
            </div>
          </div>
        </section>
        <section className="pi-project-invitation">
          <div className="pi-wrap pi-invitation-grid">
            <div>
              <p className="pi-eyebrow">02 / LE STUDIO PROS IMPORT</p>
              <h2>
                Pas besoin d’être designer.
                <br />
                <span>Juste d’avoir un projet.</span>
              </h2>
              <p>
                Commencez par les formes qui vous parlent. Gardez vos pistes.
                Précisez les matières, les couleurs et les quantités à votre
                rythme.
              </p>
              <a href={start} className="pi-button pi-button-white">
                {isStudioEnabled()
                  ? 'Entrer dans le Studio'
                  : 'Parler de mon projet'}
                <ArrowUpRight size={20} />
              </a>
            </div>
            <ol className="pi-step-list">
              <li>
                <span>01</span>
                <div>
                  <img
                    className="pi-step-photo"
                    src="/catalogue/bistro-seating-clean/BIS-012-01.webp"
                    alt="Une forme : assise du catalogue"
                    loading="lazy"
                    width="220"
                    height="220"
                  />
                  <h3>Le mobilier</h3>
                  <p>Des assises et des tables pour votre lieu.</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <div
                    className="pi-step-samples"
                    aria-label="Exemples de matières distinctes"
                  >
                    {directions.map((item) => (
                      <img
                        key={item.id}
                        src={item.image}
                        alt={item.name}
                        loading="lazy"
                        width="90"
                        height="90"
                      />
                    ))}
                  </div>
                  <h3>Votre direction</h3>
                  <p>
                    Motifs, matières, couleurs : une planche qui vous ressemble.
                  </p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <div className="pi-project-paper" aria-hidden="true">
                    <span>TERRASSEA / VOTRE PROJET</span>
                    <i />
                    <i />
                    <i />
                    <b>À étudier ensemble ↗</b>
                  </div>
                  <h3>Le projet à vérifier</h3>
                  <p>Vos choix réunis pour une étude avec notre équipe.</p>
                </div>
              </li>
            </ol>
          </div>
        </section>
        <ContainerStory />
      </main>
      <ExperienceFooter />
    </div>
  )
}
