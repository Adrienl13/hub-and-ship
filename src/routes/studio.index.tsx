import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { SafeImage } from '@/components/SafeImage'
import { ProjectSummary } from '@/components/studio/ProjectSummary'
import { StudioSectionHeader } from '@/components/studio/StudioChoices'
import { useStudioCatalog } from '@/hooks/useStudioCatalog'
import { useStudioProjectSummary } from '@/hooks/useStudioProjectSummary'
export const Route = createFileRoute('/studio/')({ component: StudioIndex })
function StudioIndex() {
  const catalog = useStudioCatalog()
  const summary = useStudioProjectSummary(catalog.catalog)
  const products = catalog.catalog?.products ?? []
  const seat = products.find(
    (p) => p.isActive && p.studio.studioRole === 'seat' && p.mainImageUrl,
  )
  const top = products.find(
    (p) => p.isActive && p.studio.studioRole === 'tabletop' && p.mainImageUrl,
  )
  const base = products.find(
    (p) => p.isActive && p.studio.studioRole === 'base' && p.mainImageUrl,
  )
  const active = summary.items.length > 0 || summary.tables.length > 0
  const card =
    'group flex min-h-[44px] min-w-0 flex-col overflow-hidden rounded-lg border border-[color:var(--sand-deep)] bg-[color:var(--paper)] transition-colors hover:border-[color:var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ink)] focus-visible:ring-offset-4 motion-reduce:transition-none'
  const photo = (src: string | undefined, alt: string) => (
    <SafeImage
      src={src}
      alt={alt}
      label="Visuels à venir"
      imgClassName="h-56 w-full object-contain p-6 lg:h-72"
      className="h-56 w-full lg:h-72"
    />
  )
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-16">
      <StudioSectionHeader eyebrow="Studio Projet" title="Créez votre projet">
        Choisissez vos assises, composez vos tables et précisez vos quantités.
        Votre projet se construit à votre rythme.
      </StudioSectionHeader>
      <div className="grid gap-5 md:grid-cols-3">
        <Link
          to="/studio/assises"
          search={{ entry: 'full_project' }}
          data-testid="entry-full-project"
          className={card}
        >
          <div className="grid grid-cols-2">
            {photo(seat?.mainImageUrl, seat?.name ?? 'Assises')}
            {photo(top?.mainImageUrl, top?.name ?? 'Tables')}
          </div>
          <div className="flex flex-1 flex-col p-6">
            <p className="label-eyebrow text-[color:var(--ember)]">
              Assises + tables
            </p>
            <h2 className="mt-2 text-2xl font-bold">Projet complet</h2>
            <p className="mt-2 text-sm text-[color:var(--ink-soft)]">
              Construisez le mobilier de votre établissement, en commençant par
              les assises.
            </p>
            <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold">
              Commencer mon projet{' '}
              <ArrowRight aria-hidden className="h-4 w-4" />
            </span>
          </div>
        </Link>
        <Link
          to="/studio/assises"
          search={{ entry: 'seats' }}
          data-testid="entry-seats"
          className={card}
        >
          {photo(seat?.mainImageUrl, seat?.name ?? 'Assises')}
          <div className="p-6">
            <p className="label-eyebrow text-[color:var(--ink-soft)]">
              Vos préférences
            </p>
            <h2 className="mt-2 text-2xl font-bold">Assises</h2>
            <p className="mt-2 text-sm text-[color:var(--ink-soft)]">
              Explorez les formes, gardez vos pistes et choisissez votre assise.
            </p>
            <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold">
              Découvrir les assises{' '}
              <ArrowRight aria-hidden className="h-4 w-4" />
            </span>
          </div>
        </Link>
        <Link
          to="/studio/tables"
          search={{ entry: 'tables' }}
          data-testid="entry-tables"
          className={card}
        >
          {photo(
            top?.mainImageUrl || base?.mainImageUrl,
            top?.name ?? base?.name ?? 'Tables',
          )}
          <div className="p-6">
            <p className="label-eyebrow text-[color:var(--ink-soft)]">
              Votre composition
            </p>
            <h2 className="mt-2 text-2xl font-bold">Tables</h2>
            <p className="mt-2 text-sm text-[color:var(--ink-soft)]">
              Une forme, une finition, puis le piètement compatible avec votre
              plateau.
            </p>
            <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold">
              Composer mes tables <ArrowRight aria-hidden className="h-4 w-4" />
            </span>
          </div>
        </Link>
      </div>
      {catalog.status === 'error' && (
        <p role="status" className="mt-4 text-sm">
          Les visuels ne sont pas disponibles. Vous pouvez ouvrir votre espace
          pour réessayer.
        </p>
      )}
      {active && (
        <section
          aria-label="Reprendre mon projet"
          className="mt-12 grid gap-8 border-t border-[color:var(--sand-deep)] pt-8 lg:grid-cols-[1fr_2fr]"
        >
          <div>
            <h2 className="text-2xl font-bold">Reprendre mon projet</h2>
            <p className="mt-3 text-sm text-[color:var(--ink-soft)]">
              Votre sélection est conservée sur cet appareil.
            </p>
            {summary.items.length > 0 && (
              <Link
                to="/studio/assises"
                className="mt-5 inline-flex min-h-[44px] items-center underline underline-offset-4"
              >
                Reprendre les assises
              </Link>
            )}
          </div>
          <ProjectSummary {...summary} />
        </section>
      )}
    </section>
  )
}
