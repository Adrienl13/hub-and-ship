import { createFileRoute } from '@tanstack/react-router'

import { SeoLandingPage } from '@/components/SeoLandingPage'
import { PRODUCTS } from '@/lib/products'
import {
  breadcrumbJsonLd,
  buildSeoHead,
  faqJsonLd,
  itemListJsonLd,
  jsonLdScript,
} from '@/lib/seo'

const BENCH_PRODUCTS = PRODUCTS.filter(
  (product) => product.category === 'bench',
)

const FAQ = [
  {
    q: 'Quels produits trouve-t-on dans la famille bancs terrasse ?',
    a: 'La famille regroupe les bancs, salons compacts et bains de soleil outdoor utilisés pour les zones lounge, piscines, campings, rooftops et terrasses CHR.',
  },
  {
    q: 'Les bains de soleil sont-ils traités comme des bancs dans le catalogue ?',
    a: 'Oui, ils sont regroupés dans cette famille pour simplifier la recherche admin et catalogue tant qu’une catégorie dédiée n’est pas nécessaire.',
  },
  {
    q: 'Peut-on commander moins de 50 unités ?',
    a: 'Le premier seuil reste celui indiqué sur la fiche produit. Une fois le minimum atteint, les ajouts peuvent être plus souples selon le modèle.',
  },
] as const

export const Route = createFileRoute('/catalogue_/bancs-terrasse')({
  head: () => ({
    ...buildSeoHead({
      title: 'Bancs et bains de soleil terrasse pro',
      description:
        'Bancs, salons et bains de soleil outdoor pour hôtels, campings, rooftops et terrasses CHR : achat groupé, MOQ pro et chargement container.',
      path: '/catalogue/bancs-terrasse',
      image: BENCH_PRODUCTS[0]?.mainImageUrl,
    }),
    scripts: [
      jsonLdScript(
        breadcrumbJsonLd([
          { name: 'Accueil', path: '/' },
          { name: 'Catalogue', path: '/catalogue' },
          { name: 'Bancs terrasse', path: '/catalogue/bancs-terrasse' },
        ]),
      ),
      jsonLdScript(
        itemListJsonLd({
          name: 'Bancs et bains de soleil terrasse professionnelle',
          path: '/catalogue/bancs-terrasse',
          products: BENCH_PRODUCTS,
        }),
      ),
      jsonLdScript(faqJsonLd(FAQ)),
    ],
  }),
  component: BancsTerrassePage,
})

function BancsTerrassePage() {
  return (
    <SeoLandingPage
      eyebrow="Bancs et lounge outdoor"
      title="Bancs, salons et bains de soleil pour projets terrasse."
      description="Une page dédiée aux produits outdoor plus larges : bancs, ensembles lounge et bains de soleil pour hôtels, campings, restaurants et zones détente."
      proofPoints={[
        'Famille séparée pour éviter les confusions avec les tables',
        'Produits adaptés aux espaces lounge et zones piscine',
        'Photos, dimensions et volume CBM visibles avant réservation',
      ]}
      products={BENCH_PRODUCTS}
      primaryHref="/catalogue?categorie=bench"
      primaryLabel="Voir les bancs"
      sections={[
        {
          title: 'Espaces détente',
          body: 'Ces références répondent aux besoins des zones lounge, bords de piscine et terrasses où l’assise classique ne suffit pas.',
        },
        {
          title: 'Lecture logistique',
          body: 'Le volume unitaire et le MOQ permettent d’évaluer rapidement l’impact dans le container.',
        },
        {
          title: 'Tri plus clair',
          body: 'Les bancs et bains de soleil sont séparés des tables afin de simplifier la recherche côté admin comme côté client.',
        },
      ]}
      faqs={FAQ}
    />
  )
}
