import { Star } from 'lucide-react'

import type { DeliveredContainersListItem } from '@/lib/delivered-containers/repository'

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
}: {
  readonly container: DeliveredContainersListItem
}) {
  const planned = container.plannedDays
  const actual = container.actualDays
  const onTime = planned != null && actual != null ? actual <= planned : true
  const rating = container.testimonial.rating ?? 0
  const photo =
    container.photoUrl ??
    'https://images.unsplash.com/photo-1494412519320-aa613dfb7738?auto=format&fit=crop&w=900&q=80'

  return (
    <a
      href={`/livres/${container.slug}`}
      className="hover:border-foreground/30 hover:shadow-paper group block h-full overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card transition-all hover:-translate-y-1"
    >
      <div className="aspect-[4/3] overflow-hidden bg-[color:var(--sand)]">
        <img
          src={photo}
          alt={`Container ${container.reference}`}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
        />
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
