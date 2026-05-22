import {
  Calendar,
  FileText,
  Lock,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  ORGANIZATION_BADGE_CLASS,
  PRODUCT_CATEGORY_LABEL,
  type QualityReportListItem,
} from '@/lib/quality-reports/types'

export interface QualityReportCardProps {
  readonly report: QualityReportListItem
  readonly isAuthenticated: boolean
  readonly opening: boolean
  readonly onOpenFile: () => void
}

function formatIssuedAt(iso: string): string {
  // Already a YYYY-MM-DD date; new Date() parses as UTC midnight which is
  // good enough for a display string.
  const date = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function QualityReportCard({
  report,
  isAuthenticated,
  opening,
  onOpenFile,
}: QualityReportCardProps) {
  const visibleHighlights = report.highlights.slice(0, 3)
  const extraHighlightsCount = Math.max(
    0,
    report.highlights.length - visibleHighlights.length,
  )

  return (
    <article className="group flex flex-col overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card transition-shadow hover:shadow-sm">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[color:var(--sand-soft)]">
        {report.previewImageUrl ? (
          <img
            src={report.previewImageUrl}
            alt={report.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <FileText className="h-10 w-10 opacity-30" />
          </div>
        )}
        <span
          className={`absolute left-3 top-3 inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${ORGANIZATION_BADGE_CLASS[report.organization]}`}
        >
          <ShieldCheck className="h-3 w-3" />
          {report.organizationLabel}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <div className="label-eyebrow text-muted-foreground">
            {report.reportTypeLabel}
          </div>
          <h3 className="mt-1 font-display text-lg leading-tight">
            {report.title}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {report.referenceNumber}
            </span>
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatIssuedAt(report.issuedAt)}
            </span>
            {report.containerReference && report.containerSlug && (
              <a
                href={`/livres/${report.containerSlug}`}
                className="inline-flex items-center gap-1 text-[color:var(--ember)] underline-offset-2 hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                {report.containerReference}
              </a>
            )}
            {report.containerReference && !report.containerSlug && (
              <span className="inline-flex items-center gap-1">
                {report.containerReference}
              </span>
            )}
          </div>
        </div>

        {report.summary && (
          <p className="text-xs leading-5 text-muted-foreground">
            {report.summary}
          </p>
        )}

        {report.productCategories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {report.productCategories.map((cat) => (
              <span
                key={cat}
                className="rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-2 py-0.5 text-[10px] font-medium"
              >
                {PRODUCT_CATEGORY_LABEL[cat]}
              </span>
            ))}
          </div>
        )}

        {visibleHighlights.length > 0 && (
          <dl className="grid grid-cols-3 gap-2 border-t border-[color:var(--sand-deep)] pt-3">
            {visibleHighlights.map((h) => (
              <div key={h.label} className="min-w-0">
                <dt className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
                  {h.label}
                </dt>
                <dd className="mt-0.5 truncate font-display text-sm font-semibold tabular-nums">
                  {h.value}
                </dd>
              </div>
            ))}
            {extraHighlightsCount > 0 && (
              <div className="col-span-3 text-[10px] text-muted-foreground">
                + {extraHighlightsCount} indicateur
                {extraHighlightsCount > 1 ? 's' : ''} dans le rapport complet.
              </div>
            )}
          </dl>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <Button
            type="button"
            size="sm"
            variant={isAuthenticated ? 'default' : 'outline'}
            className="h-9 w-full gap-1.5 rounded-sm"
            disabled={opening || !report.hasFile}
            onClick={onOpenFile}
          >
            {isAuthenticated ? (
              <FileText className="h-3.5 w-3.5" />
            ) : (
              <Lock className="h-3.5 w-3.5" />
            )}
            {!report.hasFile
              ? 'Bientôt disponible'
              : opening
                ? 'Ouverture…'
                : isAuthenticated
                  ? 'Voir le rapport complet'
                  : 'Se connecter pour télécharger'}
          </Button>
        </div>
      </div>
    </article>
  )
}
