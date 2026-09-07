// /studio — page d'entrée (lot 1 : fondation seulement).
//
// Aucune découverte d'assises, aucun moteur : cette page ne fait que
// prouver que l'accès (flag ou preview) fonctionne et que la fondation est
// en place. L'expérience elle-même arrive au lot 2.

import { createFileRoute } from '@tanstack/react-router'

import { STUDIO_PREVIEW_COOKIE } from '@/lib/studio/preview-cookie'

export const Route = createFileRoute('/studio/')({
  component: StudioIndex,
})

function StudioIndex() {
  const { studioAccess } = Route.useRouteContext()
  return (
    <section className="max-w-2xl">
      <p className="label-eyebrow text-[color:var(--ember)]">Studio Projet</p>
      <h1 className="mt-3 font-display text-h1 font-bold tracking-tight">
        Fondation en place
      </h1>
      <p className="mt-4 text-[color:var(--ink-soft)]">
        Le Studio Projet n&apos;est pas encore ouvert. Cette page confirme que
        l&apos;accès est correctement contrôlé
        {studioAccess === 'preview'
          ? ` (preview via le cookie ${STUDIO_PREVIEW_COOKIE}).`
          : ' (flag public activé).'}
      </p>
    </section>
  )
}
