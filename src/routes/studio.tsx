// Layout des routes Studio Projet (lot 1 : accès ; lot 2 : coque).
//
// Accès : flag public VITE_STUDIO_ENABLED, sinon cookie de preview signé
// vérifié côté serveur ; à défaut notFound() (404 brandée de __root).
// noindex tant que le Studio n'est pas publiquement activé.

import { Outlet, createFileRoute, notFound } from '@tanstack/react-router'

import { ExperienceHeader } from '@/components/experience/ExperienceHeader'
import { Footer } from '@/components/Footer'
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
    <div className="pi-page flex min-h-screen flex-col">
      <ExperienceHeader inStudio />
      <main className="w-full flex-1 overflow-x-hidden">
        <div className="pi-wrap py-4" role="note">
          <p className="rounded-xl border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-4 py-3 text-sm leading-relaxed">
            <strong>Préparez votre projet.</strong> Vos choix sont des pistes à
            étudier ensemble. Nous confirmerons les personnalisations, les
            compatibilités, les prix et les délais avant toute commande.
          </p>
        </div>
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
