import { Star } from 'lucide-react'

import type {
  DeliveredContainer,
  DeliveredContainersListItem,
} from '@/lib/delivered-containers/repository'

function formatDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function DeliveredContainerCard({
  container,
  registry,
}: {
  readonly container: DeliveredContainersListItem | DeliveredContainer
  readonly registry?: {
    hasSgs: boolean
    latestDelivered: boolean
    sequence: number
  }
}) {
  if (registry && 'status' in container)
    return <RegistryContainerCard container={container} {...registry} />
  const planned = container.plannedDays
  const actual = container.actualDays
  const onTime = planned != null && actual != null ? actual <= planned : true
  const rating = container.testimonial.rating ?? 0
  // Aucune preuve empruntée : sans photo du container, la vignette reste vide
  // plutôt que d'afficher une image de banque légendée « Container … ».
  const photo = container.photoUrl

  return (
    <a
      href={`/livres/${container.slug}`}
      className="hover:border-foreground/30 hover:shadow-paper group block h-full overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card transition-all hover:-translate-y-1"
    >
      <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-[color:var(--sand)]">
        {photo ? (
          <img
            src={photo}
            alt={`Container ${container.reference}`}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
          />
        ) : (
          <span className="text-[11px] text-muted-foreground">
            Photo à venir
          </span>
        )}
      </div>
      <div className="space-y-3 p-5">
        <div>
          <div className="font-display text-base font-semibold tracking-tight">
            {container.reference} · {container.port}
          </div>
          {container.deliveredAt && (
            <div className="text-xs text-muted-foreground">
              Livré le {formatDate(container.deliveredAt)}
            </div>
          )}
        </div>

        <div className="text-foreground/75 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {container.professionalsServed != null && (
            <span>
              <strong className="font-semibold tabular-nums text-foreground">
                {container.professionalsServed}
              </strong>{' '}
              pros servis
            </span>
          )}
          {container.totalItems != null && (
            <span>
              <strong className="font-semibold tabular-nums text-foreground">
                {container.totalItems}
              </strong>{' '}
              articles
            </span>
          )}
          {planned != null && actual != null && (
            <span
              className={
                onTime
                  ? 'text-[color:var(--forest)]'
                  : 'text-[color:var(--ochre)]'
              }
            >
              Annoncé {planned}j / Réel {actual}j
            </span>
          )}
        </div>

        {container.testimonial.quote && (
          <blockquote className="border-[color:var(--ember)]/40 border-l-2 pl-3 text-xs italic text-[color:var(--ink-soft)]">
            &quot;{container.testimonial.quote}&quot;
          </blockquote>
        )}
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-foreground/80">
            {container.testimonial.author && (
              <>
                — {container.testimonial.author}
                {container.testimonial.location
                  ? `, ${container.testimonial.location}`
                  : ''}
              </>
            )}
          </span>
          {rating > 0 && (
            <span className="flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`h-3 w-3 ${
                    i < rating
                      ? 'fill-[color:var(--ember)] text-[color:var(--ember)]'
                      : 'text-[color:var(--sand-deep)]'
                  }`}
                />
              ))}
            </span>
          )}
        </div>
      </div>
    </a>
  )
}

/** Native markup also rendered by the standalone design preview (no client React runtime). */
function RegistryContainerCard({
  container: c,
  hasSgs,
  latestDelivered,
  sequence,
}: {
  container: DeliveredContainer
  hasSgs: boolean
  latestDelivered: boolean
  sequence: number
}) {
  const transit = c.status !== 'delivered'
  // The current schema has no distinct "loaded" or "French customs" status.
  const step = c.status === 'shipping' ? 2 : c.status === 'delivered' ? 4 : 0
  const status = transit ? 'En transit' : 'Livré'
  const photos = [
    ...c.gallery.map((p) => p.url),
    ...(c.photoUrl ? [c.photoUrl] : []),
  ]
    .filter((url, i, a) => /^https?:\/\//.test(url) && a.indexOf(url) === i)
    .slice(0, 4)
  const fmt = (n: number) => n.toLocaleString('fr-FR')
  const saving = c.savingsPercent != null ? `−${c.savingsPercent} %` : null
  const details = [
    [
      'Pros servis',
      c.professionalsServed != null ? fmt(c.professionalsServed) : null,
    ],
    ['Articles livrés', c.totalItems != null ? fmt(c.totalItems) : null],
    ['Économie moyenne', saving],
    [
      transit ? 'Arrivée estimée' : 'Livraison',
      formatDate(c.deliveredAt) || null,
    ],
    [
      'Contenu',
      c.productBreakdown
        .map((x) => x.modelLabel)
        .filter(Boolean)
        .join(' · ') || null,
    ],
  ]
  return (
    <article
      className={`registry-card ${transit ? 'is-transit' : latestDelivered ? 'is-latest' : ''}`}
      data-container-id={c.id}
      data-transit={String(transit)}
    >
      <button
        type="button"
        className="registry-toggle"
        aria-expanded="false"
        aria-controls={`detail-${c.id}`}
      >
        <span className="registry-number">
          {String(sequence).padStart(2, '0')}
        </span>
        <span className="registry-heading">
          <span className="registry-code">
            {c.reference}
            {!transit && c.deliveredAt ? ` · ${formatDate(c.deliveredAt)}` : ''}
          </span>{' '}
          <span className="registry-badge">{status}</span>
          <strong>{c.port}</strong>
        </span>
        <span className="registry-metrics">
          {c.professionalsServed != null && (
            <span className="hide-m">
              <strong>{fmt(c.professionalsServed)}</strong>
              <small>pros servis</small>
            </span>
          )}
          {c.totalItems != null && (
            <span className="hide-m">
              <strong>{fmt(c.totalItems)}</strong>
              <small>articles</small>
            </span>
          )}
          {saving && (
            <span>
              <strong className="registry-saving">{saving}</strong>
              <small>{transit ? 'vs retail (réservé)' : 'vs retail'}</small>
            </span>
          )}
          <span className="registry-chevron" aria-hidden="true">
            ↓
          </span>
        </span>
      </button>
      <div
        className="registry-details"
        id={`detail-${c.id}`}
        aria-hidden="true"
      >
        <div className="g g-ledger">
          <div className="registry-facts">
            <p className="registry-label">Fiche du container</p>
            <dl>
              {details
                .filter(([, v]) => v)
                .map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd
                      className={
                        label === 'Économie moyenne' ? 'registry-saving' : ''
                      }
                    >
                      {value}
                    </dd>
                  </div>
                ))}
            </dl>
            <div className="registry-badges">
              {hasSgs && <span>Contrôle SGS validé</span>}
              <span className="registry-badge">{status}</span>
            </div>
            {transit && (
              <div className="registry-transit">
                <p className="registry-label">Suivi du transit</p>
                <div className="registry-track">
                  <span style={{ width: `${(step / 4) * 100}%` }} />
                </div>
                <ol>
                  {['Usine', 'Chargé', 'En mer', 'Douane FR', 'Dépôt'].map(
                    (name, i) => (
                      <li
                        key={name}
                        data-done={i <= step}
                        aria-current={i === step ? 'step' : undefined}
                      >
                        <i />
                        {name}
                      </li>
                    ),
                  )}
                </ol>
              </div>
            )}
          </div>
          <div className="registry-media">
            <p className="registry-label">
              {transit ? 'Photos du trajet' : 'Photos du déchargement'}
            </p>
            <div className="g g-photos">
              {Array.from({ length: 4 }, (_, i) => (
                <div className="registry-photo" key={i}>
                  <span>Photo à venir</span>
                  {photos[i] && (
                    <img
                      src={photos[i]}
                      alt={`Container ${c.reference} — photo ${i + 1}`}
                      loading="lazy"
                      width="320"
                      height="400"
                    />
                  )}
                </div>
              ))}
            </div>
            {c.testimonial.quote && (
              <blockquote>
                {c.testimonial.quote}
                {c.testimonial.author && <cite>{c.testimonial.author}</cite>}
              </blockquote>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}
