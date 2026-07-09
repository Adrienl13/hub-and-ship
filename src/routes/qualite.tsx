import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import {
  BadgeCheck,
  ClipboardCheck,
  FileSearch,
  LockKeyhole,
  PackageCheck,
  ShieldCheck,
} from 'lucide-react'
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
import { useCatalog } from '@/hooks/useCatalog'
import { useCart } from '@/stores/cart.store'
import {
  breadcrumbJsonLd,
  buildSeoHead,
  jsonLdScript,
} from '@/lib/seo'

export const Route = createFileRoute('/qualite')({
  component: QualitePage,
  head: () => ({
    ...buildSeoHead({
      title: 'Qualité & Tests',
      description:
        'Rapports indépendants SGS, Eurofins, TÜV. Chaque container est inspecté avant expédition : preuves publiques, rapports complets sur connexion.',
      path: '/qualite',
    }),
    scripts: [
      jsonLdScript(
        breadcrumbJsonLd([
          { name: 'Accueil', path: '/' },
          { name: 'Qualité & Tests', path: '/qualite' },
        ]),
      ),
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
  const { products, currentContainer } = useCatalog()
  const productsArray = useMemo(() => [...products], [products])
  const { items, totals } = useCart({
    products: productsArray,
    capacityCbm: currentContainer.capacityCbm,
  })
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
      setError(null)
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
            window.location.assign(
              `/auth/login?returnTo=${encodeURIComponent('/qualite')}`,
            )
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

      <main id="contenu">
        <section className="border-b border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]">
          <div className="mx-auto max-w-7xl px-6 py-12">
            <div className="label-eyebrow text-[color:var(--ember)]">
              Qualité & preuves
            </div>
            <h1 className="mt-2 font-display text-4xl tracking-tight md:text-5xl">
              La qualité doit se voir avant d'être promise.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[color:var(--ink-soft)]">
              Pros Import construit un dossier de preuve par produit et par
              container : contrôles fournisseur, inspection avant chargement,
              traçabilité documentaire et rapports complets accessibles aux pros
              connectés quand ils sont publiés.
            </p>

            <QualityCommitmentGrid />
          </div>
        </section>

        <QualityMethodSection />

        <section className="mx-auto max-w-7xl px-6 py-8">
          <div className="mb-6 max-w-2xl">
            <div className="label-eyebrow text-[color:var(--ember)]">
              Coffre documentaire
            </div>
            <h2 className="mt-2 font-display text-3xl tracking-tight">
              Rapports publiés et pièces à venir.
            </h2>
            <p className="mt-3 text-sm leading-6 text-[color:var(--ink-soft)]">
              Les premiers containers peuvent encore avoir un coffre-fort vide
              côté interface. Ce n'est pas un signal d'absence de méthode : les
              documents seront ajoutés ici dès qu'ils sont validés et rattachés
              au bon produit ou container.
            </p>
          </div>
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
            <ReportVaultNotice detail={error} />
          ) : visibleReports.length === 0 ? (
            <div className="rounded-md border border-dashed border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-6 py-12">
              <h2 className="font-display text-xl tracking-tight">
                {reports.length === 0
                  ? 'Coffre documentaire en cours de constitution.'
                  : 'Aucun rapport ne correspond à ces filtres.'}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                {reports.length === 0
                  ? 'Les rapports d’inspection, fiches techniques, photos de contrôle et documents de conformité seront publiés ici au fil des containers validés. En attendant, le protocole ci-dessus reste la référence opérationnelle.'
                  : 'Réinitialisez les filtres pour tout afficher.'}
              </p>
              <div className="mt-5 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                <MiniProof
                  label="À contrôler"
                  value="Structure, finition, colisage"
                />
                <MiniProof
                  label="À archiver"
                  value="Photos, rapports, factures"
                />
                <MiniProof label="À partager" value="PDF pro sur connexion" />
              </div>
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
            container={currentContainer}
          />
        )}
      </Suspense>
    </div>
  )
}

function QualityCommitmentGrid() {
  const items = [
    {
      Icon: ClipboardCheck,
      label: 'Protocole',
      value: '4 contrôles',
      desc: 'Produit, finition, colisage, chargement.',
    },
    {
      Icon: FileSearch,
      label: 'Traçabilité',
      value: 'Par lot',
      desc: 'Documents reliés au produit et au container.',
    },
    {
      Icon: LockKeyhole,
      label: 'Accès pro',
      value: 'PDF sécurisé',
      desc: 'Rapports complets réservés aux comptes connectés.',
    },
  ] as const

  return (
    <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
      {items.map(({ Icon, label, value, desc }) => (
        <div
          key={label}
          className="rounded-md border border-[color:var(--sand-deep)] bg-card p-4"
        >
          <Icon className="h-4 w-4 text-[color:var(--ember)]" />
          <div className="label-eyebrow mt-5 text-muted-foreground">
            {label}
          </div>
          <div className="mt-1 font-display text-3xl font-semibold">
            {value}
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{desc}</p>
        </div>
      ))}
    </div>
  )
}

function QualityMethodSection() {
  const steps = [
    {
      Icon: PackageCheck,
      title: '1. Sélection fournisseur',
      desc: 'Dimensions, matériaux, usage professionnel, contraintes de colisage et capacité container sont vérifiés avant de pousser un produit.',
    },
    {
      Icon: BadgeCheck,
      title: '2. Validation série',
      desc: 'MOQ par design, variantes, finitions et volumes sont cadrés pour éviter les fausses économies et les commandes impossibles à charger.',
    },
    {
      Icon: ShieldCheck,
      title: '3. Contrôle avant départ',
      desc: 'Photos, check-list et rapports externes quand disponibles sont associés au container avant expédition.',
    },
    {
      Icon: FileSearch,
      title: '4. Dossier consultable',
      desc: 'Les preuves publiables sont attachées au catalogue : fiche technique, garantie, conformité, inspection et historique container.',
    },
  ] as const

  return (
    <section className="border-b border-[color:var(--sand-deep)]">
      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className="mb-8 max-w-2xl">
          <div className="label-eyebrow text-[color:var(--ember)]">
            Carnet de preuves
          </div>
          <h2 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">
            Un process qualité simple, lisible et vérifiable.
          </h2>
          <p className="mt-3 text-sm leading-6 text-[color:var(--ink-soft)]">
            Le prix import n'a de valeur que si la conformité, le colisage et la
            finition suivent. Cette page doit devenir le carnet de preuves qui
            rassure les restaurants, hôtels et revendeurs.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {steps.map(({ Icon, title, desc }) => (
            <article
              key={title}
              className="rounded-md border border-[color:var(--sand-deep)] bg-card p-5"
            >
              <Icon className="h-5 w-5 text-[color:var(--ember)]" />
              <h3 className="mt-4 font-display text-lg font-semibold">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {desc}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function ReportVaultNotice({ detail }: { readonly detail: string }) {
  return (
    <div className="border-[color:var(--ochre)]/40 bg-[color:var(--ochre)]/10 rounded-md border p-6 text-sm text-foreground">
      <h2 className="font-display text-xl tracking-tight">
        Coffre documentaire momentanément indisponible.
      </h2>
      <p className="mt-2 max-w-2xl leading-6 text-muted-foreground">
        La méthode qualité reste visible ci-dessus. Le chargement des rapports a
        échoué côté interface : {detail}
      </p>
    </div>
  )
}

function MiniProof({
  label,
  value,
}: {
  readonly label: string
  readonly value: string
}) {
  return (
    <div className="rounded-sm border border-[color:var(--sand-deep)] bg-card p-3">
      <div className="label-eyebrow text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium text-foreground">{value}</div>
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
