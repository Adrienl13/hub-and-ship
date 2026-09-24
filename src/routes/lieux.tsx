import { createFileRoute } from '@tanstack/react-router'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { ExperienceHeader } from '@/components/experience/ExperienceHeader'
import { Footer } from '@/components/Footer'
import { ContactForm } from '@/components/ContactForm'
import { CommuneSearch } from '@/components/showroom/CommuneSearch'
import {
  distanceKm,
  loadPublicLocations,
  type PublicLocation,
  type Commune,
} from '@/lib/showroom'
import { productShortName } from '@/lib/products'
import { buildSeoHead } from '@/lib/seo'
import '@/styles/experience.css'
import '@/styles/showroom.css'
const LocationMap = lazy(() => import('@/components/showroom/LocationMap'))
export const Route = createFileRoute('/lieux')({
  head: () =>
    buildSeoHead({
      title: 'Voir notre mobilier près de chez vous — Terrassea',
      description:
        'Découvrez les établissements équipés de mobilier Terrassea : photos sur place, modèles et possibilités de visite.',
      path: '/lieux',
    }),
  component: ShowroomPage,
})
function ShowroomPage() {
  const [showSteps, setShowSteps] = useState(false)
  const [places, setPlaces] = useState<PublicLocation[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [selected, setSelected] = useState<string | null>(null)
  const [city, setCity] = useState<Commune | null>(null)
  const [radius, setRadius] = useState(50)
  const [withPhotos, setWithPhotos] = useState(false)
  const [visit, setVisit] = useState<PublicLocation | null>(null)
  const [products, setProducts] = useState<{ sku: string; name: string }[]>([])
  useEffect(() => {
    let stop = false
    void loadPublicLocations()
      .then((rows) => {
        if (!stop) {
          setPlaces(rows)
          setStatus('ready')
        }
      })
      .catch(() => {
        if (!stop) setStatus('error')
      })
    void fetch('/api/public-catalogue')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { products?: { sku: string; name: string }[] } | null) => {
        if (!stop) setProducts(data?.products ?? [])
      })
      .catch(() => {})
    return () => {
      stop = true
    }
  }, [])
  const center = useMemo(
    () =>
      city
        ? {
            latitude: city.centre.coordinates[1],
            longitude: city.centre.coordinates[0],
          }
        : null,
    [city],
  )
  const filtered = useMemo(
    () =>
      places
        .map((p) => ({ ...p, distance: center ? distanceKm(center, p) : null }))
        .filter(
          (p) =>
            (!withPhotos || p.photos?.length) &&
            (p.distance === null || p.distance <= radius),
        )
        .sort(
          (a, b) =>
            (a.distance ?? 0) - (b.distance ?? 0) ||
            a.city.localeCompare(b.city),
        ),
    [places, center, radius, withPhotos],
  )
  const active = filtered.find((p) => p.id === selected)
  const points = useMemo(
    () =>
      filtered.map((p) => ({
        ...p,
        approximate: p.visibility === 'on_request',
      })),
    [filtered],
  )
  return (
    <div className="pi-page">
      <ExperienceHeader />
      <main className="showroom-page">
        <header className="showroom-intro">
          <div className="showroom-heading">
            <p className="showroom-eyebrow">Le showroom à ciel ouvert</p>
            <h1>
              Voyez notre mobilier
              <br />
              <em>près de chez vous.</em>
            </h1>
          </div>
          <div className="showroom-intro-copy">
            <p>
              Pas un showroom traditionnel : des cafés, restaurants et hôtels
              qui utilisent notre mobilier au quotidien. Repérez un lieu près de
              chez vous, découvrez ses modèles et préparez votre visite.
            </p>
            <span>Des lieux réels. Des adresses partagées avec accord.</span>
          </div>
          <button
            className="showroom-steps-toggle"
            aria-expanded={showSteps}
            aria-controls="showroom-steps"
            onClick={() => setShowSteps(!showSteps)}
          >
            Comment découvrir un lieu ?{' '}
            <span aria-hidden>{showSteps ? '−' : '+'}</span>
          </button>
          <ol
            id="showroom-steps"
            className={`showroom-how${showSteps ? 'is-open' : ''}`}
          >
            <li>
              <strong>Repérez un lieu</strong>
              <span>
                Indiquez votre ville ou votre code postal pour explorer les
                adresses autour de vous.
              </span>
            </li>
            <li>
              <strong>Découvrez le mobilier</strong>
              <span>
                Consultez les modèles installés et les photos disponibles pour
                vous projeter.
              </span>
            </li>
            <li>
              <strong>Préparez votre visite</strong>
              <span>
                Suivez les modalités du lieu ou demandez-nous une mise en
                relation. Chaque adresse est publiée avec accord.
              </span>
            </li>
          </ol>
        </header>
        <section
          className="showroom-explorer"
          aria-label="Trouver un lieu équipé"
        >
          <div className="showroom-toolbar">
            <CommuneSearch
              onChoose={(c) => {
                setCity(c)
                setSelected(null)
              }}
            />
            <label>
              Autour de vous
              <select
                value={radius}
                onChange={(e) => {
                  setRadius(Number(e.target.value))
                  setSelected(null)
                }}
              >
                <option value={25}>25 km</option>
                <option value={50}>50 km</option>
                <option value={100}>100 km</option>
                <option value={250}>250 km</option>
              </select>
            </label>
            <label className="showroom-check">
              <input
                type="checkbox"
                checked={withPhotos}
                onChange={(e) => {
                  setWithPhotos(e.target.checked)
                  setSelected(null)
                }}
              />
              Avec photos
            </label>
            {city && (
              <button
                onClick={() => {
                  setCity(null)
                  setSelected(null)
                }}
              >
                Toute la France
              </button>
            )}
          </div>
          <div className="showroom-explorer-grid">
            <div>
              <Suspense
                fallback={
                  <div className="showroom-map">Chargement de la carte…</div>
                }
              >
                <LocationMap
                  points={points}
                  selected={active?.id}
                  onSelect={setSelected}
                  center={center}
                />
              </Suspense>
              <p className="showroom-legend">
                <span>● Adresse publique</span>
                <span>◌ Sur demande : position au centre de la commune</span>
              </p>
            </div>
            <div className="showroom-results" aria-live="polite">
              {status === 'loading' ? (
                <p>Recherche des lieux équipés…</p>
              ) : status === 'error' ? (
                <div>
                  <h2>La carte se prépare.</h2>
                  <p>
                    Contactez-nous pour connaître les possibilités de découverte
                    près de chez vous.
                  </p>
                  <a href="/contact">Parlons de votre projet →</a>
                </div>
              ) : filtered.length === 0 ? (
                <div>
                  <h2>
                    {places.length
                      ? 'Aucun lieu dans cette sélection.'
                      : 'Les premiers lieux arrivent bientôt.'}
                  </h2>
                  <p>
                    {places.length
                      ? 'Essayez une autre ville, un rayon plus large ou retirez le filtre photos.'
                      : 'Nous réunissons les adresses et les photos des établissements participants.'}
                  </p>
                  <a href="/contact">Trouver du mobilier pour mon lieu →</a>
                </div>
              ) : (
                <>
                  <p>
                    {filtered.length} lieu{filtered.length > 1 ? 'x' : ''} à
                    découvrir{city ? ` autour de ${city.nom}` : ''}
                  </p>
                  {filtered.map((p) => (
                    <button
                      className={`showroom-result ${active?.id === p.id ? 'selected' : ''}`}
                      key={p.id}
                      onClick={() => setSelected(p.id)}
                    >
                      {p.photos?.[0] && (
                        <img
                          src={p.photos[0]}
                          alt={`Mobilier installé à ${p.city}`}
                          loading="lazy"
                        />
                      )}
                      <span>
                        <strong>{p.name}</strong>
                        <span>
                          {p.city} ·{' '}
                          {p.visibility === 'public'
                            ? 'Adresse publique'
                            : 'Visite sur demande'}
                        </span>
                        {p.distance !== null && (
                          <small>
                            À environ {Math.round(p.distance)} km
                            {p.visibility === 'on_request'
                              ? ' du centre de la commune'
                              : ''}
                          </small>
                        )}
                      </span>
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        </section>
        {active && (
          <section className="showroom-detail" aria-label="Détails du lieu">
            <div>
              <p className="showroom-eyebrow">
                {active.visibility === 'public'
                  ? 'Une adresse à découvrir'
                  : 'Une découverte à organiser'}
              </p>
              <h2>{active.name}</h2>
              <p>
                {active.visibility === 'public'
                  ? `${active.address}, ${active.postal_code} ${active.city}`
                  : active.city}
              </p>
              {active.description && <p>{active.description}</p>}
              {active.visit_info && <p>{active.visit_info}</p>}
              {active.visibility === 'public' ? (
                <a
                  className="showroom-primary"
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${active.latitude},${active.longitude}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Itinéraire ↗
                </a>
              ) : (
                <button
                  className="showroom-primary"
                  onClick={() => setVisit(active)}
                >
                  Organiser une visite
                </button>
              )}
              {active.product_skus.length > 0 && (
                <>
                  <h3>Le mobilier installé</h3>
                  <ul>
                    {active.product_skus.map((sku) => {
                      const product = products.find((p) => p.sku === sku)
                      return (
                        <li key={sku}>
                          {product ? (
                            <a
                              href={`/catalogue/#produit-${encodeURIComponent(sku)}`}
                            >
                              {productShortName(product.name)} →
                            </a>
                          ) : (
                            <span>
                              Référence {sku} · contactez-nous pour les détails
                            </span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </>
              )}
            </div>
            <div className="showroom-gallery">
              {active.photos?.length ? (
                active.photos.map((photo, i) => (
                  <a
                    key={photo}
                    href={photo}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <img
                      src={photo}
                      alt={`Mobilier sur place à ${active.city} — photo ${i + 1}`}
                      loading="lazy"
                    />
                  </a>
                ))
              ) : (
                <p>Les photos de ce lieu seront ajoutées prochainement.</p>
              )}
            </div>
          </section>
        )}
        {visit && active?.id === visit.id && (
          <section
            className="showroom-contact"
            aria-label="Organiser une visite"
          >
            <button onClick={() => setVisit(null)}>Fermer la demande</button>
            <h2>Découvrir le mobilier à {visit.city}</h2>
            <ContactForm
              key={visit.id}
              source="lieux"
              initialTopic="produit"
              initialMessage={`Bonjour, je souhaite organiser une visite du lieu équipé à ${visit.city} (référence ${visit.id}). Merci de me préciser les possibilités.`}
            />
          </section>
        )}
        <p className="showroom-respect">
          Ces établissements utilisent notre mobilier au quotidien. Ils ne sont
          pas des magasins Terrassea. Merci de respecter leur activité et les
          modalités de visite indiquées.
        </p>
      </main>
      <Footer />
    </div>
  )
}
