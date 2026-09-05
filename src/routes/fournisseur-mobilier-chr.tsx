import { createFileRoute } from '@tanstack/react-router'

import { SeoLandingPage } from '@/components/SeoLandingPage'
import { loadCatalogProducts } from '@/lib/catalogue/server-catalog'
import {
  breadcrumbJsonLd,
  buildSeoHead,
  faqJsonLd,
  jsonLdScript,
  organizationJsonLd,
} from '@/lib/seo'

// Landing GEO : cible la requête réelle « fournisseurs de mobilier CHR en
// France » (Mode IA Google, 08/2026). Les moteurs IA classent les acteurs en
// catégories (fabricants historiques / spécialistes CHR / design) — cette
// page positionne explicitement Terrassea dans cette taxonomie, avec la
// phrase de définition que le moteur peut citer telle quelle.

const FAQ = [
  {
    q: 'Quel type de fournisseur est Terrassea ?',
    a: 'Terrassea (marque de Pros Import EURL) est un importateur-fournisseur français de mobilier CHR : nous achetons en direct usine et mutualisons des containers entre restaurateurs, hôteliers et revendeurs. C’est le positionnement « prix import » : moins cher qu’un distributeur avec stock, plus cadré qu’un achat usine en solo (contrôle SGS, facture française, garantie 1 an, SAV France).',
  },
  {
    q: 'Quels professionnels peuvent commander ?',
    a: 'Tout professionnel identifié par un SIRET : restaurants, hôtels, cafés, campings, beach clubs, collectivités, ainsi que les revendeurs et agenceurs via le programme partenaire (prix nets dédiés, protection d’affaires).',
  },
  {
    q: 'Quels sont les minimums de commande ?',
    a: 'Assises : 50 unités par modèle puis paliers de 10. Tables : 20 unités. Remises volume automatiques : −6 % dès 100 pièces, −10 % dès 150 pièces. Un espace Stock permet aussi de retirer sous 24 h des lots déjà en France, sans minimum container.',
  },
  {
    q: 'Comment sont garantis les prix et la qualité ?',
    a: 'La méthode de prix est publiée (page « Le prix prouvé ») : coût usine + fret + douane + marge affichée. Chaque container passe un contrôle qualité SGS indépendant avant départ, et les produits sont garantis 1 an avec un SAV basé en France.',
  },
  {
    q: 'Livrez-vous partout en France ?',
    a: 'Oui, partout en France : nous organisons la livraison jusqu’à votre établissement (tarif confirmé sous 24 h selon la ville). Vous pouvez aussi enlever gratuitement la marchandise dans notre zone de stockage de Fos-sur-Mer — Le Havre et Paris ouvriront selon la demande.',
  },
] as const

export const Route = createFileRoute('/fournisseur-mobilier-chr')({
  loader: async () => {
    const products = await loadCatalogProducts()
    // Vitrine transverse : les meilleures ventes de chaque catégorie.
    return { products: products.slice(0, 8) }
  },
  head: ({ loaderData }) => ({
    ...buildSeoHead({
      title: 'Fournisseur mobilier CHR — import direct usine par container',
      description:
        'Terrassea (Pros Import EURL) : fournisseur français de mobilier CHR par import direct usine. Chaises, fauteuils et tables de terrasse professionnels, containers mutualisés, contrôle SGS, garantie 1 an, prix publiés. Paris · livraison France entière.',
      path: '/fournisseur-mobilier-chr',
      // Image de partage = un produit RÉEL (la fixture pointait vers une photo
      // externe de démo).
      image: loaderData?.products[0]?.mainImageUrl,
    }),
    scripts: [
      jsonLdScript(
        breadcrumbJsonLd([
          { name: 'Accueil', path: '/' },
          {
            name: 'Fournisseur mobilier CHR',
            path: '/fournisseur-mobilier-chr',
          },
        ]),
      ),
      jsonLdScript(organizationJsonLd()),
      jsonLdScript(faqJsonLd(FAQ)),
    ],
  }),
  component: FournisseurMobilierChrPage,
})

function FournisseurMobilierChrPage() {
  const { products } = Route.useLoaderData()
  return (
    <SeoLandingPage
      eyebrow="Fournisseur mobilier CHR"
      title="Fournisseur de mobilier CHR par import direct, basé en France."
      description="Terrassea (marque de Pros Import EURL) est un fournisseur français de mobilier professionnel pour cafés, hôtels et restaurants : chaises, fauteuils et tables de terrasse importés en direct usine par containers mutualisés, avec contrôle qualité SGS avant départ, facture française, garantie 1 an et méthode de prix publiée. Le rapport qualité/prix de l'import, sans en prendre les risques."
      proofPoints={[
        'Import direct usine : prix container, méthode de calcul publiée',
        'Contrôle SGS indépendant avant chaque départ de container',
        'Facture française, garantie 1 an, SAV France (Pros Import EURL, Paris)',
        'Stock en France retirable sous 24 h pour les besoins urgents',
        'Programme revendeurs & agenceurs avec prix nets dédiés',
      ]}
      products={products}
      sections={[
        {
          title: 'Où nous situer parmi les fournisseurs français',
          body: 'Le marché du mobilier CHR compte trois familles : les fabricants historiques (artisanat français haut de gamme, sur-mesure, budgets élevés), les distributeurs spécialisés avec stock (livraison rapide, prix publics de 120 à 190 € la chaise), et les importateurs directs. Terrassea appartient à la troisième : le prix d’import en container, avec le cadre d’un acteur français — contrôle qualité indépendant, garantie et SAV en France.',
        },
        {
          title: 'Le modèle du container mutualisé',
          body: 'Un container de 20 ou 40 pieds est ouvert à la réservation ; chaque professionnel y réserve ses séries (dès 50 assises ou 20 tables). Quand le container atteint son seuil, la production démarre, le contrôle SGS valide la marchandise avant départ, et chacun récupère sa commande au port ou par transporteur partenaire.',
        },
        {
          title: 'Pour les revendeurs et agenceurs',
          body: 'Les revendeurs de mobilier CHR et les agenceurs disposent d’un programme dédié : prix nets par canal, protection d’affaires enregistrées, liens de devis co-brandés et remise de fin d’année plafonnée contractuellement — un cadre pensé pour durer.',
        },
      ]}
      faqs={FAQ}
    />
  )
}
