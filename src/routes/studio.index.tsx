import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { SafeImage } from '@/components/SafeImage'
import { ProjectSummary } from '@/components/studio/ProjectSummary'
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
  const photo = (src: string | undefined, alt: string) => (
    <SafeImage
      src={src}
      alt={alt}
      label="Visuel à venir"
      imgClassName="pi-entry-photo"
    />
  )
  return (
    <section className="pi-wrap pi-studio-intro">
      <p className="pi-eyebrow">LE STUDIO / DE VOTRE IDÉE À VOTRE MOBILIER</p>
      <div className="pi-studio-title">
        <h1>Créez votre projet</h1>
        <p>
          Partez d’une forme. Explorez les matières. Gardez vos envies : nous
          vérifierons ensemble ce qui peut être réalisé.
        </p>
      </div>
      {active && (
        <div className="pi-resume-banner">
          <div>
            <p className="pi-eyebrow">VOTRE PLAN DE TRAVAIL</p>
            <h2>Vos idées vous attendent.</h2>
            <p>
              {summary.items.length} sélection
              {summary.items.length > 1 ? 's' : ''} d’assises ·{' '}
              {summary.tables.length} composition
              {summary.tables.length > 1 ? 's' : ''} de tables · conservées sur
              cet appareil
            </p>
          </div>
          <Link
            to="/studio/personnalisation"
            className="pi-button pi-button-white"
          >
            Reprendre ma planche <ArrowRight size={18} />
          </Link>
        </div>
      )}
      <div className="pi-project-paths">
        <Link
          to="/studio/assises"
          search={{ entry: 'full_project' }}
          data-testid="entry-full-project"
          className="pi-path-primary"
        >
          <div className="pi-path-copy">
            <p className="pi-eyebrow">01 / ASSISES + TABLES</p>
            <h2>Projet complet</h2>
            <p>Le mobilier de votre établissement, pensé comme un ensemble.</p>
            <span className="pi-text-link">
              Commencer mon projet <ArrowRight size={16} />
            </span>
          </div>
          <div className="pi-path-photo">
            {photo(seat?.mainImageUrl, seat?.name ?? 'Assises')}
          </div>
        </Link>
        <div className="pi-path-secondary">
          <Link
            to="/studio/assises"
            search={{ entry: 'seats' }}
            data-testid="entry-seats"
          >
            <div>
              <p className="pi-eyebrow">02 / LES FORMES QUI VOUS PARLENT</p>
              <h2>Assises</h2>
              <p>Explorez, comparez, gardez vos pistes.</p>
              <span className="pi-text-link">
                Découvrir les assises <ArrowRight size={16} />
              </span>
            </div>
            {photo(seat?.mainImageUrl, seat?.name ?? 'Assises')}
          </Link>
          <Link
            to="/studio/tables"
            search={{ entry: 'tables' }}
            data-testid="entry-tables"
          >
            <div>
              <p className="pi-eyebrow">03 / VOTRE COMPOSITION</p>
              <h2>Tables</h2>
              <p>Un plateau, un piètement, une association à vérifier.</p>
              <span className="pi-text-link">
                Composer mes tables <ArrowRight size={16} />
              </span>
            </div>
            {photo(
              top?.mainImageUrl || base?.mainImageUrl,
              top?.name ?? base?.name ?? 'Tables',
            )}
          </Link>
        </div>
      </div>
      <div className="pi-studio-sequence">
        <span>
          <b>01</b>Choisir les formes
        </span>
        <span>
          <b>02</b>Explorer les matières
        </span>
        <span>
          <b>03</b>Partager le projet
        </span>
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
