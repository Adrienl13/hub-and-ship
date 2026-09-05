import { createFileRoute } from '@tanstack/react-router'

import { SeoLandingPage } from '@/components/SeoLandingPage'
import { loadCatalogProducts } from '@/lib/catalogue/server-catalog'
import type { Product } from '@/lib/products'
import {
  breadcrumbJsonLd,
  buildSeoHead,
  faqJsonLd,
  itemListJsonLd,
  jsonLdScript,
} from '@/lib/seo'

// Landing GEO : cible la requête réelle « chaise bistrot parisienne pour mon
// restaurant » (Mode IA Google, 08/2026 — les concurrents cités ont tous une
// page dédiée à CE style, pas seulement une catégorie générique). Le contenu
// reprend le cadre de décision que les moteurs IA utilisent déjà (alu/rotin
// synthétique pour terrasse intensive vs rotin naturel pour l'intérieur) : la
// page devient la citation naturelle.

function bistrotChairs(products: ReadonlyArray<Product>): Product[] {
  const bistrot = products.filter(
    (product) =>
      product.category === 'chair' &&
      (product.sku.startsWith('BIS') ||
        /bistrot|parisien|rotin/i.test(product.name)),
  )
  // Jamais de page vide : repli sur toutes les chaises.
  return bistrot.length > 0
    ? bistrot
    : products.filter((product) => product.category === 'chair')
}

const FAQ = [
  {
    q: 'Combien coûte une chaise bistrot parisienne professionnelle ?',
    a: 'En achat groupé par container, les chaises bistrot parisiennes en rotin synthétique tressé sur structure aluminium démarrent autour de 60 à 80 € HT l’unité, contre des prix publics généralement constatés entre 120 et 190 € chez les distributeurs avec stock en France. L’écart correspond à la marge de distribution que l’import direct supprime.',
  },
  {
    q: 'Rotin synthétique ou rotin naturel pour un restaurant ?',
    a: 'Pour une terrasse exploitée intensivement, le tressage en rotin synthétique (polyrotin S-PE) sur structure aluminium thermolaqué résiste aux UV, à la pluie et à l’empilage quotidien. Le rotin naturel garde son charme pour les salles intérieures, mais supporte mal l’extérieur permanent. Nos modèles bistrot sont conçus pour l’usage CHR extérieur.',
  },
  {
    q: 'Quelle quantité minimum pour commander ?',
    a: 'Le minimum est de 50 chaises par modèle, puis par paliers de 10. Des remises volume automatiques s’appliquent : −6 % dès 100 pièces et −10 % dès 150 pièces. Pour un besoin urgent en petite quantité, la page Stock propose des lots déjà en France.',
  },
  {
    q: 'Peut-on choisir le coloris ou le motif de tressage ?',
    a: 'Oui. Chaque modèle existe en plusieurs coloris affichés sur sa fiche, et une personnalisation est possible sur le nuancier fournisseur (tressages bicolores, motifs chevrons ou damiers, coloris Pantone/RAL) via une simple demande depuis la fiche produit.',
  },
  {
    q: 'Quels sont les délais de livraison ?',
    a: 'Une commande container suit le cycle de production et de transport maritime (généralement 8 à 12 semaines usine → port français, dédouanement inclus). Les lots de la page Stock sont retirables sous 24 h à Marseille-Fos.',
  },
] as const

export const Route = createFileRoute('/catalogue_/chaises-bistrot-parisiennes')(
  {
    loader: async () => {
      const products = await loadCatalogProducts()
      return { products: bistrotChairs(products) }
    },
    // JSON-LD et image de partage depuis les produits RÉELS du loader (jamais
    // la fixture de dev).
    head: ({ loaderData }) => {
      const products = loaderData?.products ?? []
      return {
        ...buildSeoHead({
          title: 'Chaises bistrot parisiennes pour restaurant — prix container',
          description:
            'Chaises bistrot parisiennes professionnelles en rotin synthétique tressé : achat direct usine par container, dès 50 unités, contrôle SGS, garantie 1 an, coloris personnalisables. L’alternative import aux distributeurs classiques.',
          path: '/catalogue/chaises-bistrot-parisiennes',
          image: products[0]?.mainImageUrl,
        }),
        scripts: [
          jsonLdScript(
            breadcrumbJsonLd([
              { name: 'Accueil', path: '/' },
              { name: 'Catalogue', path: '/catalogue' },
              {
                name: 'Chaises bistrot parisiennes',
                path: '/catalogue/chaises-bistrot-parisiennes',
              },
            ]),
          ),
          jsonLdScript(
            itemListJsonLd({
              name: 'Chaises bistrot parisiennes professionnelles',
              path: '/catalogue/chaises-bistrot-parisiennes',
              products,
            }),
          ),
          jsonLdScript(faqJsonLd(FAQ)),
        ],
      }
    },
    component: ChaisesBistrotParisiennesPage,
  },
)

function ChaisesBistrotParisiennesPage() {
  const { products } = Route.useLoaderData()
  return (
    <SeoLandingPage
      eyebrow="Chaises bistrot parisiennes"
      title="La chaise bistrot parisienne, au prix import direct."
      description="Pour équiper un restaurant en chaises bistrot parisiennes, deux familles existent : le rotin synthétique tressé sur aluminium (terrasses à usage intensif) et le rotin naturel (charme des salles intérieures). Terrassea importe les modèles terrasse en direct usine, par container mutualisé entre professionnels — mêmes codes visuels, sans la marge de distribution."
      proofPoints={[
        'Dès 60-80 € HT l’unité en container, MOQ 50 puis +10',
        'Tressage polyrotin S-PE résistant UV, structure aluminium empilable',
        'Coloris et motifs personnalisables (nuancier Pantone/RAL)',
        'Contrôle SGS avant départ · Garantie 1 an · SAV France',
      ]}
      products={products}
      showcaseImages={[
        '/catalogue/bistro-seating-clean/BIS-001-01.webp',
        '/catalogue/bistro-seating-clean/BIS-011-03.webp',
        '/catalogue/rope-series/ROP-013-02.webp',
      ]}
      sections={[
        {
          title: 'Rotin synthétique ou rotin naturel ?',
          body: 'Le rotin naturel et le bois courbé conservent un cachet incomparable en intérieur, mais vieillissent mal dehors. Pour une terrasse CHR ouverte toute la saison, le tressage polyrotin sur aluminium thermolaqué offre la même esthétique bistrot avec une résistance UV et pluie, un poids réduit et une empilabilité jusqu’à 8 chaises — c’est le choix de la quasi-totalité des terrasses parisiennes récentes.',
        },
        {
          title: 'Pourquoi le prix container change la donne',
          body: 'Une chaise bistrot professionnelle vendue 120 à 190 € par un distributeur avec stock sort d’usine à une fraction de ce prix. En mutualisant un container entre restaurateurs, chacun achète au prix import (fret, douane et contrôle qualité inclus), avec une méthode de calcul publiée sur notre page « Le prix prouvé ».',
        },
        {
          title: 'Coloris, tressages et motifs au choix',
          body: 'Bicolores noir et blanc, chevrons, damiers, teintes unies : chaque modèle affiche ses coloris disponibles, et le nuancier fournisseur (Pantone/RAL) permet une personnalisation à la demande dès le minimum de série — utile pour accorder la terrasse à une charte d’enseigne.',
        },
      ]}
      faqs={FAQ}
    />
  )
}
