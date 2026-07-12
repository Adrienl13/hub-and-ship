import { createFileRoute } from '@tanstack/react-router'

import { SeoLandingPage } from '@/components/SeoLandingPage'
import { loadCatalogProducts } from '@/lib/catalogue/server-catalog'
import { PRODUCTS } from '@/lib/products'
import {
  breadcrumbJsonLd,
  buildSeoHead,
  faqJsonLd,
  itemListJsonLd,
  jsonLdScript,
} from '@/lib/seo'

const TABLE_PRODUCTS = PRODUCTS.filter(
  (product) => product.category === 'table',
)

const FAQ = [
  {
    q: 'Quelle quantité minimale pour commander des tables restaurant ?',
    a: 'Les tables sont pensées pour une commande professionnelle à partir de 20 unités par modèle, avec ajout possible à l’unité selon le configurateur.',
  },
  {
    q: 'Les tables sont-elles expédiées montées ?',
    a: 'Les tables sont intégrées au chargement comme colis démontés et plats, ce qui améliore le volume transporté et évite de surestimer la place occupée dans le container.',
  },
  {
    q: 'Quels usages viser avec ces tables outdoor ?',
    a: 'Les formats ronds et rectangulaires couvrent les terrasses de restaurants, hôtels, campings, brasseries et zones événementielles.',
  },
] as const

export const Route = createFileRoute('/catalogue_/tables-restaurant')({
  // Produits LIVE (fallback statique) : les liens fiches produit doivent
  // pointer vers des slugs qui existent réellement en base, pas vers le mock.
  loader: async () => {
    const products = await loadCatalogProducts()
    const filtered = products.filter((p) => p.category === 'table')
    return { products: filtered }
  },
  head: () => ({
    ...buildSeoHead({
      title: 'Tables restaurant outdoor pro par container',
      description:
        'Tables outdoor pour restaurant, brasserie et hôtel : plateaux HPL, pieds aluminium, MOQ 20 unités, achat groupé container et prix HT direct usine.',
      path: '/catalogue/tables-restaurant',
      image: TABLE_PRODUCTS[0]?.mainImageUrl,
    }),
    scripts: [
      jsonLdScript(
        breadcrumbJsonLd([
          { name: 'Accueil', path: '/' },
          { name: 'Catalogue', path: '/catalogue' },
          { name: 'Tables restaurant', path: '/catalogue/tables-restaurant' },
        ]),
      ),
      jsonLdScript(
        itemListJsonLd({
          name: 'Tables restaurant outdoor professionnelles',
          path: '/catalogue/tables-restaurant',
          products: TABLE_PRODUCTS,
        }),
      ),
      jsonLdScript(faqJsonLd(FAQ)),
    ],
  }),
  component: TablesRestaurantPage,
})

function TablesRestaurantPage() {
  const { products } = Route.useLoaderData()
  return (
    <SeoLandingPage
      eyebrow="Tables restaurant"
      title="Tables outdoor professionnelles pour restaurants et brasseries."
      description="Sélection de tables de terrasse pour les professionnels qui veulent acheter en volume, réserver leur place dans un container et comparer le volume réel avant validation."
      proofPoints={[
        'MOQ 20 unités sur les tables du catalogue',
        'Colis plats pour optimiser le chargement container',
        'Formats ronds et rectangulaires pour 2 à 6 couverts',
      ]}
      products={products}
      showcaseImages={[
        '/catalogue/rope-series/ROP-013-01.webp',
        '/catalogue/table-base-series/TBA-005-01.webp',
        '/catalogue/table-base-series/TBA-003-01.webp',
      ]}
      sections={[
        {
          title: 'Formats CHR pratiques',
          body: 'Tables rondes pour terrasses compactes, formats rectangulaires pour zones plus denses et grandes tablées.',
        },
        {
          title: 'Transport optimisé',
          body: 'Les tables démontées occupent moins de hauteur et peuvent compléter le chargement au-dessus des piles stables.',
        },
        {
          title: 'Achat groupé visible',
          body: 'Le configurateur affiche le volume engagé et aide à décider entre un container 20 pieds et un format distributeur.',
        },
      ]}
      faqs={FAQ}
    />
  )
}
