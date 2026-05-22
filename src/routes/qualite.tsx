import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { QualityReportCard } from '@/components/QualityReportCard'
import { useAuth } from '@/hooks/useAuth'
import { getReportFileUrl } from '@/lib/quality-reports/access'
import { listPublishedQualityReports } from '@/lib/quality-reports/repository'
import {
  ORGANIZATION_LABEL,
  PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_LABEL,
  REPORT_TYPE_LABEL,
  type ProductCategory,
  type QualityReportListItem,
  type QualityReportOrganization,
  type QualityReportType,
} from '@/lib/quality-reports/types'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'
import { useCart } from '@/stores/cart.store'

export const Route = createFileRoute('/qualite')({
  component: QualitePage,
  head: () => ({
    meta: [
      { title: 'Qualité & Tests — Container Club Terrassea' },
      {
        name: 'description',
        content:
          'Rapports indépendants SGS, Eurofins, TÜV. Chaque container est inspecté avant expédition : preuves publiques, rapports complets sur connexion.',
      },
    ],
  }),
})

const LazyReservationDialog = lazy(() =>
  import('@/components/ReservationDialog').then((module) => ({
    default: module.ReservationDialog,
  })),
)

type OrgFilter = QualityReportOrganization | 'all'
type TypeFilter = QualityReportType | 'all'
type CategoryFilter = ProductCategory | 'all'

function QualitePage() {
  const auth = useAuth()
  const { items, totals } = useCart()
  const [reports, setReports] = useState<ReadonlyArray<QualityReportListItem>>(
    [],
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reserveOpen, setReserveOpen] = useState(false)
  const [orgFilter, setOrgFilter] = useState<OrgFilter>('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [openingReportId, setOpeningReportId] = useState<string | null>(null)

  const fetchReportFileUrl = useServerFn(getReportFileUrl)

  useEffect(() => {
    let cancelled = false
    const config = getSupabasePublicConfig()
    if (!config.isConfigured) {
      setReports([])
      setError('Supabase non configuré : impossible de charger les rapports.')
      setLoading(false)
      return
    }

    const client = createSupabaseBrowserClient(config)
    void listPublishedQualityReports(client)
      .then((data) => {
        if (cancelled) return
        setReports(data)
        setError(null)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Erreur inconnue')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const stats = useMemo(() => computeStats(reports), [reports])

  const visibleReports = useMemo(() => {
    return reports.filter((r) => {
      if (orgFilter !== 'all' && r.organization !== orgFilter) return false
      if (typeFilter !== 'all' && r.reportType !== typeFilter) return false
      if (
        categoryFilter !== 'all' &&
        !r.productCategories.includes(categoryFilter)
      ) {
        return false
      }
      return true
    })
  }, [reports, orgFilter, typeFilter, categoryFilter])

  const isAuthenticated = auth.status === 'authenticated'

  async function handleOpenFile(report: QualityReportListItem): Promise<void> {
    if (!isAuthenticated) {
      toast.message('Connectez-vous pour télécharger', {
        description:
          'Les rapports complets sont réservés aux pros connectés (lecture vérifiée).',
        action: {
          label: 'Se connecter',
          onClick: () => {
            window.location.assign('/auth/login?returnTo=/qualite')
          },
        },
      })
      return
    }

    setOpeningReportId(report.id)
    try {
      const result = await fetchReportFileUrl({
        data: { reportId: report.id },
      })

      if (result.ok) {
        window.open(result.url, '_blank', 'noopener,noreferrer')
        return
      }

      switch (result.reason) {
        case 'auth_required':
          toast.error('Session expirée', {
            description: 'Reconnectez-vous pour accéder au rapport.',
          })
          break
        case 'no_file':
          toast.message('Rapport bientôt disponible', {
            description: 'Le PDF est en cours de numérisation.',
          })
          break
        case 'not_found':
          toast.error('Rapport introuvable', {
            description: 'Ce rapport a peut-être été dépublié.',
          })
          break
        case 'storage_unavailable':
        default:
          toast.message('Rapport en cours de numérisation', {
            description:
              'Le coffre-fort des rapports est en cours d’installation. Contactez-nous pour recevoir le PDF par email.',
          })
          break
      }
    } catch (err) {
      console.error('getReportFileUrl failed', err)
      toast.error('Téléchargement indisponible', {
        description:
          'Réessayez dans un instant ou contactez-nous si le problème persiste.',
      })
    } finally {
      setOpeningReportId(null)
    }
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <Header onReserve={() => setReserveOpen(true)} />

      <main>
        <section className="border-b border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]">
          <div className="mx-auto max-w-7xl px-6 py-12">
            <div className="label-eyebrow text-[color:var(--ember)]">
              Qualité & Tests
            </div>
            <h1 className="mt-2 font-display text-4xl tracking-tight md:text-5xl">
              Inspecté avant d'être expédié.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[color:var(--ink-soft)]">
              Chaque container est inspecté par un organisme indépendant (SGS,
              Eurofins, TÜV…) avant chargement. Les rapports complets sont
              accessibles aux pros connectés.
            </p>

            <StatsGrid stats={stats} loading={loading} />
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-8">
          <FilterBar
            reports={reports}
            orgFilter={orgFilter}
            typeFilter={typeFilter}
            categoryFilter={categoryFilter}
            onOrgChange={setOrgFilter}
            onTypeChange={setTypeFilter}
            onCategoryChange={setCategoryFilter}
          />
        </section>

        <section className="mx-auto max-w-7xl px-6 pb-16">
          {loading ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-primary/10 h-96 animate-pulse rounded-md"
                />
              ))}
            </div>
          ) : error ? (
            <div className="border-[color:var(--ochre)]/40 bg-[color:var(--ochre)]/10 rounded-md border p-6 text-sm text-foreground">
              {error}
            </div>
          ) : visibleReports.length === 0 ? (
            <div className="rounded-md border border-dashed border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-6 py-16 text-center">
              <h2 className="font-display text-xl">
                {reports.length === 0
                  ? 'Aucun rapport publié pour l’instant.'
                  : 'Aucun rapport ne correspond à ces filtres.'}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {reports.length === 0
                  ? 'Les premiers rapports d’inspection seront publiés ici dès le prochain container.'
                  : 'Réinitialisez les filtres pour tout afficher.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {visibleReports.map((report) => (
                <QualityReportCard
                  key={report.id}
                  report={report}
                  isAuthenticated={isAuthenticated}
                  opening={openingReportId === report.id}
                  onOpenFile={() => void handleOpenFile(report)}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer />

      <Suspense fallback={null}>
        {reserveOpen && (
          <LazyReservationDialog
            open={reserveOpen}
            onOpenChange={setReserveOpen}
            items={items}
            totals={totals}
          />
        )}
      </Suspense>
    </div>
  )
}

interface QualityStats {
  readonly totalReports: number
  readonly organizationsCount: number
  readonly containersCovered: number
}

function computeStats(
  reports: ReadonlyArray<QualityReportListItem>,
): QualityStats {
  const orgs = new Set<QualityReportOrganization>()
  const containers = new Set<string>()
  for (const r of reports) {
    orgs.add(r.organization)
    if (r.containerReference) containers.add(r.containerReference)
  }
  return {
    totalReports: reports.length,
    organizationsCount: orgs.size,
    containersCovered: containers.size,
  }
}

function StatsGrid({
  stats,
  loading,
}: {
  readonly stats: QualityStats
  readonly loading: boolean
}) {
  const items = loading
    ? []
    : [
        { label: 'Rapports publiés', value: stats.totalReports.toString() },
        {
          label: 'Organismes indépendants',
          value: stats.organizationsCount.toString(),
        },
        {
          label: 'Containers couverts',
          value: stats.containersCovered.toString(),
        },
      ]

  return (
    <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
      {(loading ? Array.from({ length: 3 }) : items).map((it, i) => (
        <div
          key={i}
          className="rounded-md border border-[color:var(--sand-deep)] bg-card p-4"
        >
          {loading ? (
            <div className="bg-primary/10 h-10 animate-pulse rounded" />
          ) : (
            <>
              <div className="label-eyebrow text-muted-foreground">
                {(it as { label: string; value: string }).label}
              </div>
              <div className="mt-1 font-display text-3xl font-semibold tabular-nums">
                {(it as { label: string; value: string }).value}
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  )
}

function FilterBar({
  reports,
  orgFilter,
  typeFilter,
  categoryFilter,
  onOrgChange,
  onTypeChange,
  onCategoryChange,
}: {
  readonly reports: ReadonlyArray<QualityReportListItem>
  readonly orgFilter: OrgFilter
  readonly typeFilter: TypeFilter
  readonly categoryFilter: CategoryFilter
  readonly onOrgChange: (next: OrgFilter) => void
  readonly onTypeChange: (next: TypeFilter) => void
  readonly onCategoryChange: (next: CategoryFilter) => void
}) {
  const availableOrgs = useMemo(() => {
    const set = new Set<QualityReportOrganization>()
    reports.forEach((r) => set.add(r.organization))
    return Array.from(set)
  }, [reports])

  const availableTypes = useMemo(() => {
    const set = new Set<QualityReportType>()
    reports.forEach((r) => set.add(r.reportType))
    return Array.from(set)
  }, [reports])

  if (reports.length === 0) return null

  return (
    <div className="space-y-3">
      <FilterRow label="Organisme">
        <Chip
          active={orgFilter === 'all'}
          onClick={() => onOrgChange('all')}
          label="Tous"
        />
        {availableOrgs.map((org) => (
          <Chip
            key={org}
            active={orgFilter === org}
            onClick={() => onOrgChange(org)}
            label={ORGANIZATION_LABEL[org]}
          />
        ))}
      </FilterRow>
      <FilterRow label="Type de rapport">
        <Chip
          active={typeFilter === 'all'}
          onClick={() => onTypeChange('all')}
          label="Tous"
        />
        {availableTypes.map((type) => (
          <Chip
            key={type}
            active={typeFilter === type}
            onClick={() => onTypeChange(type)}
            label={REPORT_TYPE_LABEL[type]}
          />
        ))}
      </FilterRow>
      <FilterRow label="Catégorie produit">
        <Chip
          active={categoryFilter === 'all'}
          onClick={() => onCategoryChange('all')}
          label="Toutes"
        />
        {PRODUCT_CATEGORIES.map((cat) => (
          <Chip
            key={cat}
            active={categoryFilter === cat}
            onClick={() => onCategoryChange(cat)}
            label={PRODUCT_CATEGORY_LABEL[cat]}
          />
        ))}
      </FilterRow>
    </div>
  )
}

function FilterRow({
  label,
  children,
}: {
  readonly label: string
  readonly children: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="label-eyebrow shrink-0 text-muted-foreground">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

function Chip({
  active,
  onClick,
  label,
}: {
  readonly active: boolean
  readonly onClick: () => void
  readonly label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-8 rounded-sm border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? 'border-[color:var(--foreground)] bg-[color:var(--foreground)] text-[color:var(--background)]'
          : 'hover:border-[color:var(--foreground)]/40 border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] text-foreground'
      }`}
    >
      {label}
    </button>
  )
}
