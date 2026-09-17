import { createFileRoute } from '@tanstack/react-router'
import { useMemo } from 'react'

import { SeoLandingPage } from '@/components/SeoLandingPage'
import { useStockLines } from '@/hooks/useStockLines'
import { breadcrumbJsonLd, buildSeoHead, faqJsonLd, jsonLdScript } from '@/lib/seo'

const FAQ = [
  {
    q: 'Quel mobilier de terrasse peut partir sous 24h ?',
    a: 'La page stock regroupe uniquement les lots déjà disponibles en France, principalement à Marseille-Fos, avec quantité limitée et réponse commerciale rapide.',
  },
  {
    q: 'Le stock 24h remplace-t-il la précommande container ?',
    a: 'Non. Le stock 24h sert aux besoins urgents, ouvertures et compléments. Pour équiper une terrasse complète au meilleur prix, la précommande container reste le levier principal.',
  },
  {
    q: 'Puis-je mixer stock disponible et commande container ?',
    a: 'Oui. Un professionnel peut sécuriser un lot disponible immédiatement, puis compléter avec une réservation sur le prochain container.',
  },
] as const

export const Route = createFileRoute('/stock-mobilier-terrasse-24h')({
  // Head STATIQUE : aucun produit fixture annoncé aux crawlers — la grille de
  // produits du composant est DB-first (useStockLines) et se vide honnêtement.
  head: () => ({
    ...buildSeoHead({
      // Page d'entrée éditoriale (positionnement + questions fréquentes) ; le
      // stock lui-même vit sur /stock-24h, qui porte désormais un autre titre.
      // Les deux restent auto-canoniques : les contenus sont distincts.
      title: 'Stock mobilier de terrasse : équiper sans attendre le container',
      description:
        'Mobilier de terrasse professionnel déjà disponible en France : pourquoi et quand passer par le stock plutôt que par la précommande container, et comment combiner les deux.',
      path: '/stock-mobilier-terrasse-24h',
    }),
    scripts: [
      jsonLdScript(
        breadcrumbJsonLd([
          { name: 'Accueil', path: '/' },
          {
            name: 'Stock mobilier terrasse 24h',
            path: '/stock-mobilier-terrasse-24h',
          },
        ]),
      ),
      jsonLdScript(faqJsonLd(FAQ)),
    ],
  }),
  component: StockMobilierTerrasse24hPage,
})

function StockMobilierTerrasse24hPage() {
  // Stock réel uniquement (fixture réservée au dev local non configuré).
  const { lines } = useStockLines()
  const stockProducts = useMemo(
    () => lines.map((line) => line.product),
    [lines],
  )
  return (
    <SeoLandingPage
      eyebrow="Stock urgent"
      title="Mobilier de terrasse disponible rapidement pour les pros."
      description="Une solution pour les restaurants, hôtels et campings qui doivent ouvrir, remplacer ou compléter une terrasse sans attendre le prochain container."
      proofPoints={[
        'Lots ponctuellement disponibles en France, selon arrivages',
        'Retrait Marseille-Fos possible sous 24h selon disponibilité',
        'Complément compatible avec une future commande container',
      ]}
      products={stockProducts}
      sections={[
        {
          title: 'Pour les ouvertures urgentes',
          body: 'Le stock disponible sécurise une terrasse lorsque le calendrier container est trop loin pour le besoin opérationnel.',
        },
        {
          title: 'Quantités limitées',
          body: 'Chaque lot affiche une disponibilité courte. La demande permet de réserver un créneau commercial rapidement.',
        },
        {
          title: 'Pont vers le container',
          body: 'Le stock répond à l’urgence, puis la précommande groupée permet de compléter avec plus de choix et un meilleur coût volume.',
        },
      ]}
      faqs={FAQ}
      primaryHref="/stock-24h"
      primaryLabel="Voir le stock disponible"
    />
  )
}
