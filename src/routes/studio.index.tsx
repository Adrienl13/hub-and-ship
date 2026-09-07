// /studio — entrée du Studio (lot 2) : Projet complet / Assises / Tables.
//
// Projet complet et Assises démarrent par la découverte des assises. Tables
// renvoie vers le catalogue (piètements + plateaux) jusqu'au lot 4, avec une
// explication simple. Aucun moteur ici.

import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, Armchair, LayoutGrid, Table2 } from 'lucide-react'

import { useStudioStore } from '@/stores/studio.store'

export const Route = createFileRoute('/studio/')({
  component: StudioIndex,
})

function StudioIndex() {
  const setEntry = useStudioStore((state) => state.setEntry)
  const itemCount = useStudioStore((state) => state.project.items.length)

  // De vrais liens (`?entry=`) : l'entrée choisie est portée par l'URL et
  // posée par la page Assises, donc fiable même avant l'hydratation.
  const cardClass =
    'group flex min-h-[44px] flex-col gap-4 rounded-lg border border-[color:var(--sand-deep)] bg-[color:var(--paper)] p-6 text-left transition-colors hover:border-[color:var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ink)] focus-visible:ring-offset-2'

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:py-16">
      <p className="label-eyebrow text-[color:var(--ember)]">Studio Projet</p>
      <h1 className="mt-3 max-w-3xl font-display text-h1 font-bold tracking-tight">
        Composez votre terrasse, assise par assise.
      </h1>
      <p className="mt-4 max-w-2xl text-[color:var(--ink-soft)]">
        Un espace de travail, pas un catalogue : vous regardez des assises variées, vous gardez
        vos favoris, vous comparez vos finalistes puis vous choisissez. Quantité libre, sans
        arrondi. Votre projet reste sur cet appareil.
      </p>

      <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Link to="/studio/assises" search={{ entry: 'full_project' }} className={cardClass} data-testid="entry-full-project">
          <LayoutGrid className="h-6 w-6 text-[color:var(--ember)]" aria-hidden />
          <span>
            <span className="block font-display text-xl font-bold">Projet complet</span>
            <span className="mt-1 block text-sm text-[color:var(--ink-soft)]">
              Assises d&apos;abord, puis tables. Vous avancez à votre rythme.
            </span>
          </span>
          <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold">
            Commencer par les assises
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </span>
        </Link>

        <Link to="/studio/assises" search={{ entry: 'seats' }} className={cardClass} data-testid="entry-seats">
          <Armchair className="h-6 w-6 text-[color:var(--ember)]" aria-hidden />
          <span>
            <span className="block font-display text-xl font-bold">Assises</span>
            <span className="mt-1 block text-sm text-[color:var(--ink-soft)]">
              Chaises et fauteuils de terrasse : découverte carte par carte.
            </span>
          </span>
          <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold">
            Découvrir les assises
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </span>
        </Link>

        <Link
          to="/catalogue"
          search={{ collection: 'pietements' }}
          onClick={() => setEntry('tables')}
          className={cardClass}
          data-testid="entry-tables"
        >
          <Table2 className="h-6 w-6 text-[color:var(--ember)]" aria-hidden />
          <span>
            <span className="block font-display text-xl font-bold">Tables</span>
            <span className="mt-1 block text-sm text-[color:var(--ink-soft)]">
              Plateaux et piètements se composent aujourd&apos;hui dans le catalogue. L&apos;expérience
              Studio Tables arrive dans une prochaine étape.
            </span>
          </span>
          <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold">
            Ouvrir le catalogue tables
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </span>
        </Link>
      </div>

      {itemCount > 0 && (
        <p className="mt-8 text-sm text-[color:var(--ink-soft)]">
          Un projet est en cours sur cet appareil ({itemCount} ligne{itemCount > 1 ? 's' : ''}).{' '}
          <Link to="/studio/assises" className="inline-flex min-h-[44px] min-w-[44px] items-center font-semibold text-[color:var(--ember)] underline-offset-2 hover:underline">
            Reprendre
          </Link>
        </p>
      )}
    </section>
  )
}
