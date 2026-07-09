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

const ROPE_PRODUCTS = PRODUCTS.filter((product) =>
  product.sku.startsWith('ROP-'),
)

const FAQ = [
  {
    q: 'Pourquoi choisir du mobilier outdoor en cordage ?',
    a: 'Le cordage donne un rendu plus chaleureux et contemporain qu’une assise standard, tout en restant adapté aux terrasses professionnelles.',
  },
  {
    q: 'Quels types de produits existent en cordage ?',
    a: 'La collection peut inclure chaises, fauteuils, tables repas, salons et bancs selon les références disponibles au catalogue.',
  },
  {
    q: 'Les couleurs sont-elles personnalisables ?',
    a: 'Les coloris et tressages peuvent être étudiés pour les gros projets, sous réserve de faisabilité et de MOQ.',
  },
] as const

export const Route = createFileRoute('/catalogue_/mobilier-cordage')({
  head: () => ({
    ...buildSeoHead({
      title: 'Mobilier outdoor cordage professionnel',
      description:
        'Mobilier de terrasse en cordage pour restaurants, hôtels et campings : chaises, fauteuils, tables et salons à commander par container groupé.',
      path: '/catalogue/mobilier-cordage',
      image: ROPE_PRODUCTS[0]?.mainImageUrl,
    }),
    scripts: [
      jsonLdScript(
        breadcrumbJsonLd([
          { name: 'Accueil', path: '/' },
          { name: 'Catalogue', path: '/catalogue' },
          { name: 'Mobilier cordage', path: '/catalogue/mobilier-cordage' },
        ]),
      ),
      jsonLdScript(
        itemListJsonLd({
          name: 'Mobilier outdoor cordage professionnel',
          path: '/catalogue/mobilier-cordage',
          products: ROPE_PRODUCTS,
        }),
      ),
      jsonLdScript(faqJsonLd(FAQ)),
    ],
  }),
  component: MobilierCordagePage,
})

function MobilierCordagePage() {
  return (
    <SeoLandingPage
      eyebrow="Mobilier cordage"
      title="Mobilier de terrasse en cordage pour projets professionnels."
      description="Chaises, fauteuils, tables et salons en cordage outdoor pour les établissements qui veulent un rendu plus design sans perdre la logique prix container."
      proofPoints={[
        'Cordage outdoor sur structure aluminium',
        'Famille lisible pour comparer rapidement les modèles',
        'Achat groupé avec MOQ et volume CBM affichés',
      ]}
      products={ROPE_PRODUCTS}
      primaryHref="/catalogue?recherche=cordage"
      primaryLabel="Voir le cordage"
      sections={[
        {
          title: 'Rendu design',
          body: 'Le cordage apporte une lecture plus architecturale, intéressante pour hôtels, rooftops, plages privées et terrasses soignées.',
        },
        {
          title: 'Choix multi-produits',
          body: 'La famille réunit assises, tables et salons pour composer un projet cohérent avec une même matière.',
        },
        {
          title: 'Projet en volume',
          body: 'Les références restent compatibles avec la logique de réservation par container et de prix HT direct pro.',
        },
      ]}
      faqs={FAQ}
    />
  )
}
