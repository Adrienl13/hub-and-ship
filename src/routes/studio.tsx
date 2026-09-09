// Layout des routes Studio Projet (lot 1 : accès ; lot 2 : coque).
//
// Accès : flag public VITE_STUDIO_ENABLED, sinon cookie de preview signé
// vérifié côté serveur ; à défaut notFound() (404 brandée de __root).
// noindex tant que le Studio n'est pas publiquement activé.

import { Outlet, createFileRoute, notFound } from '@tanstack/react-router'

import { Header } from '@/components/Header'
import { resolveStudioAccess } from '@/lib/studio/access'
import { isStudioEnabled } from '@/lib/studio/flags'
import { buildSeoHead } from '@/lib/seo'

export const Route = createFileRoute('/studio')({
  beforeLoad: async () => {
    const access = await resolveStudioAccess()
    if (!access.allowed) throw notFound()
    return { studioAccess: access.source }
  },
  head: () =>
    buildSeoHead({
      title: 'Studio Projet',
      description:
        'Construisez votre projet de terrasse : assises, plateaux et piètements, à votre rythme.',
      path: '/studio',
      noindex: !isStudioEnabled(),
    }),
  component: StudioLayout,
})

function StudioLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--sand-soft)] text-foreground">
      <Header />
      <main className="w-full flex-1 overflow-x-hidden">
        <Outlet />
      </main>
      <footer className="mx-auto w-full max-w-7xl border-t border-[color:var(--sand-deep)] px-6 py-8 pb-28 text-sm text-[color:var(--ink-soft)] lg:pb-8">
        <p>
          Du mobilier professionnel pour votre projet, en direct des fabricants.
        </p>
        <p className="mt-1">
          La personnalisation sera définie à partir de votre sélection.
        </p>
        <nav
          aria-label="Informations Studio"
          className="mt-4 flex flex-wrap gap-x-6"
        >
          <a
            href="/contact"
            className="inline-flex min-h-[44px] items-center underline underline-offset-4"
          >
            Parlons de votre projet
          </a>
          <a
            href="/legal/confidentialite"
            className="inline-flex min-h-[44px] items-center"
          >
            Confidentialité
          </a>
          <a
            href="/legal/mentions-legales"
            className="inline-flex min-h-[44px] items-center"
          >
            Mentions légales
          </a>
        </nav>
      </footer>
    </div>
  )
}
