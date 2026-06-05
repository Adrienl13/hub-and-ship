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

const CHAIR_PRODUCTS = PRODUCTS.filter(
  (product) => product.category === 'chair',
)

const FAQ = [
  {
    q: 'Quelle quantité minimale pour commander des chaises restaurant ?',
    a: 'Les chaises sont commandées avec un minimum de 50 unités par modèle, puis par paliers de 10 unités. Cette règle permet de garder un prix import cohérent et une logistique container stable.',
  },
  {
    q: 'Les chaises sont-elles adaptées aux terrasses CHR ?',
    a: 'Les modèles proposés ciblent les usages restaurant, hôtel, camping et brasserie : empilabilité, structure aluminium, résistance UV et entretien simple.',
  },
  {
    q: 'Pourquoi passer par un achat groupé container ?',
    a: "L'achat groupé mutualise le volume entre professionnels. Il permet d'accéder à des prix usine tout en gardant un cadre français pour la réservation, le contrôle qualité et la facturation.",
  },
] as const

export const Route = createFileRoute('/catalogue_/chaises-restaurant')({
  head: () => ({
    ...buildSeoHead({
      title: 'Chaises restaurant terrasse pro par container',
      description:
        'Chaises de restaurant et terrasse professionnelle : modèles empilables, MOQ 50 unités, achat groupé par container, prix usine et contrôle qualité avant expédition.',
      path: '/catalogue/chaises-restaurant',
      image: CHAIR_PRODUCTS[0]?.mainImageUrl,
    }),
    scripts: [
      jsonLdScript(
        breadcrumbJsonLd([
          { name: 'Accueil', path: '/' },
          { name: 'Catalogue', path: '/catalogue' },
          {
            name: 'Chaises restaurant',
            path: '/catalogue/chaises-restaurant',
          },
        ]),
      ),
      jsonLdScript(
        itemListJsonLd({
          name: 'Chaises restaurant terrasse professionnelle',
          path: '/catalogue/chaises-restaurant',
          products: CHAIR_PRODUCTS,
        }),
      ),
      jsonLdScript(faqJsonLd(FAQ)),
    ],
  }),
  component: ChaisesRestaurantPage,
})

function ChaisesRestaurantPage() {
  return (
    <SeoLandingPage
      eyebrow="Chaises restaurant"
      title="Chaises de terrasse professionnelles, commandées par container."
      description="Une page pensée pour les restaurants, hôtels, campings et brasseries qui veulent acheter des chaises outdoor en volume sans passer par un grossiste classique."
      proofPoints={[
        'MOQ 50 unités par modèle, puis ajout par 10',
        'Modèles empilables pour optimiser le stockage et le container',
        'Prix HT direct usine avec réservation groupée entre pros',
      ]}
      products={CHAIR_PRODUCTS}
      sections={[
        {
          title: 'Pour terrasses à forte rotation',
          body: 'Les modèles chaises privilégient la légèreté, la résistance UV et une manutention simple au quotidien.',
        },
        {
          title: 'Volume maîtrisé',
          body: 'Les piles de chaises sont intégrées au configurateur container pour visualiser la place disponible avant réservation.',
        },
        {
          title: 'Achat pro cadré',
          body: 'Réservation, seuil de container, contrôle qualité et facture française gardent le processus lisible pour une commande CHR.',
        },
      ]}
      faqs={FAQ}
    />
  )
}
