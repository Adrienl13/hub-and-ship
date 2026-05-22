import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'

import { Toaster } from '@/components/ui/sonner'
import '@/styles/globals.css'

const ORGANIZATION_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Container Club',
  legalName: 'Pros Import',
  description:
    "Club d'achat groupé de mobilier outdoor professionnel par container. Importation officielle France, prix usine, contrôle qualité SGS.",
  url: 'https://container-club.fr',
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

export const Route = createRootRoute({
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
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
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
