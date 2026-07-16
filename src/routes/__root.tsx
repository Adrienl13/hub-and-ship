import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import { useEffect } from 'react'

import { PartnerLinkTracker } from '@/components/PartnerLinkTracker'
import { Toaster } from '@/components/ui/sonner'
import { captureFirstTouchAttribution } from '@/lib/analytics/attribution'
import { organizationJsonLd } from '@/lib/seo'
import '@/styles/globals.css'

// Single source of truth for the Organization entity (stable @id) — child
// routes must NOT inject a second copy; /avis merges into it via the @id.
const ORGANIZATION_JSON_LD = organizationJsonLd()

// Privacy-friendly analytics, only loaded when a Plausible domain is configured.
const PLAUSIBLE_DOMAIN = import.meta.env.VITE_PLAUSIBLE_DOMAIN as
  | string
  | undefined
const PLAUSIBLE_SRC =
  (import.meta.env.VITE_PLAUSIBLE_SRC as string | undefined) ??
  'https://plausible.io/js/script.tagged-events.js'

const ANALYTICS_SCRIPTS = PLAUSIBLE_DOMAIN
  ? [
      // Queue stub so custom events fire even before the script finishes loading.
      {
        children:
          'window.plausible=window.plausible||function(){(window.plausible.q=window.plausible.q||[]).push(arguments)}',
      },
      {
        src: PLAUSIBLE_SRC,
        defer: true,
        'data-domain': PLAUSIBLE_DOMAIN,
      },
    ]
  : []

function NotFoundComponent() {
  return (
    <html lang="fr">
      <head>
        <HeadContent />
        <title>Page introuvable — Container Club</title>
      </head>
      <body className="bg-background text-foreground">
        <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
          <div className="label-eyebrow text-[color:var(--ember)]">404</div>
          <h1 className="mt-2 font-display text-4xl tracking-tight">
            Page introuvable.
          </h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
            Le lien que vous avez suivi est cassé ou la page a été déplacée.
            Vous pouvez retourner à l&apos;accueil ou consulter le catalogue.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/"
              className="hover:bg-foreground/90 inline-flex h-11 items-center rounded-sm bg-foreground px-4 text-sm font-medium text-background"
            >
              Retour à l&apos;accueil
            </Link>
            <Link
              to="/catalogue"
              className="hover:border-foreground/40 inline-flex h-11 items-center rounded-sm border border-[color:var(--sand-deep)] px-4 text-sm font-medium"
            >
              Voir le catalogue
            </Link>
          </div>
        </main>
        <Scripts />
      </body>
    </html>
  )
}

export const Route = createRootRoute({
  notFoundComponent: NotFoundComponent,
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      {
        title:
          'Container Club — Mobilier outdoor pro mutualisé par container',
      },
      {
        name: 'description',
        content:
          "Réservez votre place sur le prochain container : mobilier outdoor pour pros (restaurants, hôtels, campings) à prix usine grâce à l'achat groupé. Importation officielle France.",
      },
      { name: 'author', content: 'Pros Import — Container Club' },
      {
        property: 'og:title',
        content:
          'Container Club — Mobilier outdoor pro mutualisé par container',
      },
      {
        property: 'og:description',
        content:
          "Réservez votre place sur le prochain container : mobilier outdoor pour pros (restaurants, hôtels, campings) à prix usine grâce à l'achat groupé. Importation officielle France.",
      },
      { property: 'og:type', content: 'website' },
      { property: 'og:locale', content: 'fr_FR' },
      { name: 'twitter:card', content: 'summary_large_image' },
      {
        name: 'twitter:title',
        content:
          'Container Club — Mobilier outdoor pro mutualisé par container',
      },
      {
        name: 'twitter:description',
        content:
          "Réservez votre place sur le prochain container : mobilier outdoor pour pros à prix usine grâce à l'achat groupé.",
      },
    ],
    links: [
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap',
      },
    ],
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify(ORGANIZATION_JSON_LD),
      },
      ...ANALYTICS_SCRIPTS,
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  // First-touch attribution: persist utm_* / ref from the landing URL once.
  useEffect(() => {
    captureFirstTouchAttribution(window.location.search, Date.now())
  }, [])

  return (
    <html lang="fr">
      <head>
        <HeadContent />
      </head>
      <body>
        <HydrationMarker />
        <PartnerLinkTracker />
        <Outlet />
        <Toaster />
        <Scripts />
      </body>
    </html>
  )
}

function HydrationMarker() {
  useEffect(() => {
    document.documentElement.dataset.hydrated = 'true'
  }, [])

  return null
}
