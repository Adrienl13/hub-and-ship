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

const ARMCHAIR_PRODUCTS = PRODUCTS.filter(
  (product) => product.category === 'armchair',
)

const FAQ = [
  {
    q: 'Quelle différence entre chaise et fauteuil de terrasse ?',
    a: 'Le fauteuil ajoute des accoudoirs et une assise plus enveloppante. Il convient aux restaurants, hôtels et terrasses où le confort long repas est prioritaire.',
  },
  {
    q: 'Quel minimum de commande pour les fauteuils restaurant ?',
    a: 'La plupart des fauteuils outdoor suivent une logique de commande professionnelle à partir de 50 unités par modèle, afin de stabiliser le prix et le chargement container.',
  },
  {
    q: 'Peut-on personnaliser les couleurs ?',
    a: 'Oui, les projets en volume peuvent prévoir des finitions, tressages ou coloris spécifiques selon les possibilités du modèle.',
  },
] as const

export const Route = createFileRoute('/catalogue_/fauteuils-restaurant')({
  head: () => ({
    ...buildSeoHead({
      title: 'Fauteuils restaurant terrasse pro par container',
      description:
        'Fauteuils de restaurant outdoor pour terrasse CHR : accoudoirs, aluminium, tressage ou cordage, MOQ pro et achat groupé par container.',
      path: '/catalogue/fauteuils-restaurant',
      image: ARMCHAIR_PRODUCTS[0]?.mainImageUrl,
    }),
    scripts: [
      jsonLdScript(
        breadcrumbJsonLd([
          { name: 'Accueil', path: '/' },
          { name: 'Catalogue', path: '/catalogue' },
          {
            name: 'Fauteuils restaurant',
            path: '/catalogue/fauteuils-restaurant',
          },
        ]),
      ),
      jsonLdScript(
        itemListJsonLd({
          name: 'Fauteuils restaurant terrasse professionnelle',
          path: '/catalogue/fauteuils-restaurant',
          products: ARMCHAIR_PRODUCTS,
        }),
      ),
      jsonLdScript(faqJsonLd(FAQ)),
    ],
  }),
  component: FauteuilsRestaurantPage,
})

function FauteuilsRestaurantPage() {
  return (
    <SeoLandingPage
      eyebrow="Fauteuils restaurant"
      title="Fauteuils outdoor professionnels pour terrasses CHR."
      description="Une sélection de fauteuils avec accoudoirs pour restaurants, hôtels, cafés, campings et terrasses qui cherchent du mobilier extérieur en volume."
      proofPoints={[
        'Accoudoirs et assises confort pour usage long repas',
        'Structures aluminium adaptées aux terrasses professionnelles',
        'Réservation par container avec prix HT lisible',
      ]}
      products={ARMCHAIR_PRODUCTS}
      primaryHref="/catalogue?categorie=armchair"
      primaryLabel="Voir les fauteuils"
      sections={[
        {
          title: 'Confort terrasse',
          body: 'Le fauteuil apporte une perception plus premium qu’une chaise simple, tout en gardant une logique de volume professionnel.',
        },
        {
          title: 'Finitions outdoor',
          body: 'Les modèles combinent aluminium, tressage, cordage ou textilène pour résister à un usage extérieur intensif.',
        },
        {
          title: 'Achat groupé',
          body: 'Les quantités sont regroupées par container afin de maintenir un prix direct pro et une logistique maîtrisée.',
        },
      ]}
      faqs={FAQ}
    />
  )
}
