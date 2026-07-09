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

const TESLIN_PRODUCTS = PRODUCTS.filter((product) =>
  product.sku.startsWith('TES-'),
)

const FAQ = [
  {
    q: 'À quoi sert le textilène pour du mobilier extérieur ?',
    a: 'Le textilène est apprécié pour les assises outdoor faciles à entretenir, respirantes et adaptées aux terrasses professionnelles.',
  },
  {
    q: 'Quels produits sont disponibles en textilène ?',
    a: 'La famille peut regrouper chaises, fauteuils, chaises hautes, ensembles repas et bains de soleil selon les références actives.',
  },
  {
    q: 'Pourquoi une page dédiée au textilène ?',
    a: 'Elle permet aux acheteurs et aux moteurs de recherche de comprendre clairement cette matière, ses usages et les références associées.',
  },
] as const

export const Route = createFileRoute('/catalogue_/mobilier-textilene')({
  head: () => ({
    ...buildSeoHead({
      title: 'Mobilier textilène extérieur professionnel',
      description:
        'Mobilier extérieur en textilène pour restaurants, campings, hôtels et terrasses CHR : chaises, fauteuils, bains de soleil et ensembles repas.',
      path: '/catalogue/mobilier-textilene',
      image: TESLIN_PRODUCTS[0]?.mainImageUrl,
    }),
    scripts: [
      jsonLdScript(
        breadcrumbJsonLd([
          { name: 'Accueil', path: '/' },
          { name: 'Catalogue', path: '/catalogue' },
          { name: 'Mobilier textilène', path: '/catalogue/mobilier-textilene' },
        ]),
      ),
      jsonLdScript(
        itemListJsonLd({
          name: 'Mobilier textilène extérieur professionnel',
          path: '/catalogue/mobilier-textilene',
          products: TESLIN_PRODUCTS,
        }),
      ),
      jsonLdScript(faqJsonLd(FAQ)),
    ],
  }),
  component: MobilierTextilenePage,
})

function MobilierTextilenePage() {
  return (
    <SeoLandingPage
      eyebrow="Mobilier textilène"
      title="Mobilier extérieur en textilène pour terrasses professionnelles."
      description="Une sélection textilène pour les projets CHR qui cherchent des assises légères, respirantes et simples à entretenir en extérieur."
      proofPoints={[
        'Assise textilène outdoor facile à nettoyer',
        'Chaises, fauteuils, chaises hautes et bains de soleil',
        'Pages et données structurées dédiées à la matière',
      ]}
      products={TESLIN_PRODUCTS}
      primaryHref="/catalogue?recherche=textilène"
      primaryLabel="Voir le textilène"
      sections={[
        {
          title: 'Usage intensif',
          body: 'Le textilène convient aux terrasses et zones extérieures où l’entretien rapide compte autant que le confort.',
        },
        {
          title: 'Famille claire',
          body: 'Les références textilène sont regroupées pour faciliter la sélection par matière, type de produit et projet.',
        },
        {
          title: 'Visibilité SEO',
          body: 'Une page crawlable aide les moteurs et assistants IA à associer clairement le catalogue aux recherches textilène outdoor.',
        },
      ]}
      faqs={FAQ}
    />
  )
}
