import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import { useEffect } from 'react'

import { captureFirstTouchAttribution } from '@/lib/analytics/attribution'
import { Toaster } from '@/components/ui/sonner'
import '@/styles/globals.css'

const ORGANIZATION_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Container Club',
  legalName: 'Pros Import',
  description:
    "Club d'achat groupé de mobilier outdoor professionnel par container. Importation officielle France, prix usine, contrôle qualité SGS.",
  url: 'https://prosimport.com',
  email: 'adrienlaniez1@gmail.com',
  founder: {
    '@type': 'Person',
    name: 'Adrien Laniez',
  },
  address: {
    '@type': 'PostalAddress',
    streetAddress: '60 Rue François Ier',
    postalCode: '75008',
    addressLocality: 'Paris',
    addressCountry: 'FR',
  },
  taxID: 'FR08988269981',
  vatID: 'FR08988269981',
  identifier: [
    { '@type': 'PropertyValue', propertyID: 'SIRET', value: '98826998100011' },
    { '@type': 'PropertyValue', propertyID: 'SIREN', value: '988269981' },
    {
      '@type': 'PropertyValue',
      propertyID: 'EORI',
      value: 'FR98826998100011',
    },
  ],
  areaServed: 'FR',
  sameAs: [],
}

const PLAUSIBLE_DOMAIN = import.meta.env.VITE_PLAUSIBLE_DOMAIN ?? ''
const PLAUSIBLE_API_HOST =
  import.meta.env.VITE_PLAUSIBLE_API_HOST ?? 'https://plausible.io'

/**
 * Plausible analytics scripts, only emitted when a domain is configured.
 * `script.manual.js` lets us fire pageviews/custom events ourselves; the inline
 * snippet defines the `plausible()` queue so events triggered before the script
 * loads are buffered. RGPD-friendly (no cookies), so no consent banner needed.
 */
function plausibleScripts(): Array<Record<string, string | boolean>> {
  if (!PLAUSIBLE_DOMAIN) return []
  return [
    {
      defer: true,
      'data-domain': PLAUSIBLE_DOMAIN,
      src: `${PLAUSIBLE_API_HOST}/js/script.js`,
    },
    {
      children:
        'window.plausible=window.plausible||function(){(window.plausible.q=window.plausible.q||[]).push(arguments)}',
    },
  ]
}

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
          'Container Club Terrassea — Mobilier outdoor pro mutualisé par container',
      },
      {
        name: 'description',
        content:
          "Réservez votre place sur le prochain container : mobilier outdoor pour pros (restaurants, hôtels, campings) à prix usine grâce à l'achat groupé. Importation officielle Terrassea.",
      },
      { name: 'author', content: 'Pros Import — Container Club Terrassea' },
      {
        property: 'og:title',
        content:
          'Container Club Terrassea — Mobilier outdoor pro mutualisé par container',
      },
      {
        property: 'og:description',
        content:
          "Réservez votre place sur le prochain container : mobilier outdoor pour pros (restaurants, hôtels, campings) à prix usine grâce à l'achat groupé. Importation officielle Terrassea.",
      },
      { property: 'og:type', content: 'website' },
      { property: 'og:locale', content: 'fr_FR' },
      { name: 'twitter:card', content: 'summary_large_image' },
      {
        name: 'twitter:title',
        content:
          'Container Club Terrassea — Mobilier outdoor pro mutualisé par container',
      },
      {
        name: 'twitter:description',
        content:
          "Réservez votre place sur le prochain container : mobilier outdoor pour pros à prix usine grâce à l'achat groupé.",
      },
    ],
    links: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap',
      },
    ],
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify(ORGANIZATION_JSON_LD),
      },
      ...plausibleScripts(),
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
        <Outlet />
        <Toaster />
        <Scripts />
      </body>
    </html>
  )
}
