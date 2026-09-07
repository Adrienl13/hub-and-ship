// Layout des routes Studio Projet (lot 1 : fondation invisible).
//
// Accès : flag public VITE_STUDIO_ENABLED, sinon cookie de preview signé
// vérifié côté serveur ; à défaut notFound() (404 brandée de __root).
// noindex tant que le Studio n'est pas publiquement activé.

import { Outlet, createFileRoute, notFound } from '@tanstack/react-router'

import { Footer } from '@/components/Footer'
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
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
