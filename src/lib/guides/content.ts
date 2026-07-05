// Editorial guides for SEO / AEO / GEO. Data-driven: add a Guide entry and it
// appears at /guides and /guides/{slug} with Article + FAQ + Breadcrumb schema.
// Keep figures prudent and qualitative; link to the catalogue for live prices.

export interface GuideSection {
  readonly heading: string
  readonly paragraphs: ReadonlyArray<string>
  readonly bullets?: ReadonlyArray<string>
}

export interface GuideFaq {
  readonly q: string
  readonly a: string
}

export interface GuideLink {
  readonly label: string
  readonly href: string
}

export interface Guide {
  readonly slug: string
  readonly title: string
  readonly metaDescription: string
  /** 40–80 word direct answer shown first (answer block for AI/search). */
  readonly answer: string
  readonly updated: string
  readonly sections: ReadonlyArray<GuideSection>
  readonly faq: ReadonlyArray<GuideFaq>
  readonly related: ReadonlyArray<GuideLink>
}

const UPDATED = '2026-06-07'

export const GUIDES: ReadonlyArray<Guide> = [
  {
    slug: 'import-mobilier-chr-container',
    title: 'Importer du mobilier CHR par container : comment ça marche',
    metaDescription:
      "Guide pratique pour importer du mobilier CHR (restaurant, hôtel, camping) par container : achat groupé, MOQ, volume CBM, qualité, transport rendu port et délais.",
    answer:
      "Importer du mobilier CHR par container consiste à mutualiser des commandes professionnelles dans un même conteneur maritime pour obtenir des prix directs usine. Vous réservez une place sur un container actif, validez les quantités selon les MOQ et le volume (CBM), puis Pros Import gère l'import, le contrôle qualité et la logistique jusqu'au port de livraison.",
    updated: UPDATED,
    sections: [
      {
        heading: 'Le principe de l’achat groupé par container',
        paragraphs: [
          "Un container maritime a un volume fixe (environ 33 m³ pour un 20 pieds, 67 m³ pour un 40 pieds). Plutôt que chaque professionnel importe seul — ce qui implique des minimums de commande élevés et des frais fixes lourds — Container Club mutualise plusieurs commandes dans le même conteneur.",
          "Chaque participant réserve une part du volume. Quand le container atteint son seuil de départ, la commande est lancée. Vous bénéficiez d’un prix proche du prix usine sans avoir à remplir un conteneur entier à vous seul.",
        ],
      },
      {
        heading: 'MOQ, volume et remplissage',
        paragraphs: [
          "Chaque produit a un minimum de commande (MOQ) et un volume unitaire en CBM. Le panier calcule le remplissage du container en temps réel, ce qui vous permet de viser le bon seuil et d’optimiser le coût au m³.",
        ],
        bullets: [
          'MOQ : quantité minimale par référence pour rester sur un prix volume.',
          'CBM : volume unitaire qui détermine la place occupée dans le container.',
          'Remplissage : un container plus rempli répartit mieux les frais fixes.',
        ],
      },
      {
        heading: 'Qualité, conformité et transport',
        paragraphs: [
          "Le risque principal de l’import est la qualité. Pros Import publie des preuves de contrôle et de conformité, et documente les containers déjà livrés. Le transport est généralement proposé rendu port, avec une organisation logistique prise en charge.",
          "Les délais dépendent du remplissage du container et du transport maritime ; ils sont indiqués sur la réservation. Pour un besoin urgent déjà disponible en France, le stock 24h constitue une alternative.",
        ],
      },
    ],
    faq: [
      {
        q: 'Faut-il remplir un container entier ?',
        a: "Non. L’achat groupé mutualise plusieurs commandes : vous réservez seulement la part de volume dont vous avez besoin, dans la limite des MOQ par produit.",
      },
      {
        q: 'Quelle différence entre un container 20 et 40 pieds ?',
        a: "Un 20 pieds offre environ 33 m³ et un 40 pieds environ 67 m³. Le choix dépend du volume total réservé par les participants ; voir le guide dédié.",
      },
      {
        q: 'Comment sont garantis la qualité et le transport ?',
        a: "Pros Import documente les contrôles qualité et les containers livrés, et organise le transport rendu port. Les preuves sont consultables sur la page Qualité.",
      },
    ],
    related: [
      { label: 'Voir le catalogue', href: '/catalogue' },
      {
        label: 'Container 20 vs 40 pieds',
        href: '/guides/container-20-pieds-vs-40-pieds-mobilier',
      },
      { label: 'Preuves qualité & tests', href: '/qualite' },
      { label: 'Stock disponible sous 24h', href: '/stock-24h' },
    ],
  },
  {
    slug: 'prix-chaises-restaurant-volume',
    title: 'Réduire le prix des chaises de restaurant en volume',
    metaDescription:
      "Comment baisser le prix des chaises de restaurant en achetant en volume : MOQ, achat groupé par container, prix directs pros et arbitrages utiles.",
    answer:
      "Le prix d’une chaise de restaurant baisse surtout avec le volume : en atteignant les minimums de commande (MOQ) et en mutualisant l’achat dans un container, on accède aux prix directs pros plutôt qu’aux prix de revente. Container Club affiche ces prix publics au catalogue et calcule le coût selon les quantités et le remplissage du container.",
    updated: UPDATED,
    sections: [
      {
        heading: 'Pourquoi le volume fait baisser le prix',
        paragraphs: [
          "Le prix unitaire d’une chaise dépend largement des quantités produites et expédiées ensemble. Les frais fixes (production, contrôle, transport maritime) se répartissent sur plus d’unités quand la commande est volumineuse.",
          "C’est exactement ce que permet l’achat groupé : sans commander des centaines de chaises seul, vous rejoignez un container mutualisé pour atteindre le palier de prix volume.",
        ],
      },
      {
        heading: 'Les leviers concrets',
        paragraphs: [
          'Plusieurs arbitrages aident à optimiser le coût final :',
        ],
        bullets: [
          'Atteindre le MOQ par modèle plutôt que d’éparpiller les références.',
          'Privilégier des chaises empilables pour optimiser le volume CBM.',
          'Viser un bon remplissage du container pour répartir les frais fixes.',
          'Comparer prix direct pro et prix de revente sur des références équivalentes.',
        ],
      },
      {
        heading: 'Voir les prix réels',
        paragraphs: [
          "Les prix directs pros sont publics et affichés au catalogue, avec le MOQ et le volume de chaque modèle. C’est la référence la plus fiable : plutôt que des estimations, consultez les fiches pour votre projet précis.",
        ],
      },
    ],
    faq: [
      {
        q: 'Combien de chaises faut-il commander pour le prix volume ?',
        a: "Cela dépend du MOQ de chaque modèle, indiqué sur sa fiche au catalogue. L’achat groupé permet d’atteindre ce palier sans commander seul un container entier.",
      },
      {
        q: 'Les chaises empilables coûtent-elles moins cher à importer ?',
        a: "À prix d’achat équivalent, une chaise empilable occupe moins de volume (CBM), ce qui améliore le remplissage du container et le coût logistique au m³.",
      },
      {
        q: 'Où voir les prix exacts ?',
        a: "Sur le catalogue : les prix directs pros, le MOQ et le volume y sont publics pour chaque référence.",
      },
    ],
    related: [
      { label: 'Chaises de restaurant', href: '/catalogue/chaises-restaurant' },
      {
        label: 'Importer par container',
        href: '/guides/import-mobilier-chr-container',
      },
      { label: 'Catalogue complet', href: '/catalogue' },
    ],
  },
  {
    slug: 'container-20-pieds-vs-40-pieds-mobilier',
    title: 'Container 20 vs 40 pieds pour le mobilier : lequel choisir',
    metaDescription:
      "Container 20 ou 40 pieds pour importer du mobilier : volumes (CBM), nombre d’unités indicatif, remplissage et impact sur le coût au m³.",
    answer:
      "Un container 20 pieds offre environ 33 m³ et un 40 pieds environ 67 m³, soit près du double. Pour le mobilier, le choix dépend du volume total réservé : un 40 pieds répartit mieux les frais fixes au m³ s’il est bien rempli, tandis qu’un 20 pieds suffit pour des volumes plus modestes. L’achat groupé permet d’atteindre le bon palier sans remplir seul.",
    updated: UPDATED,
    sections: [
      {
        heading: 'Volumes et capacité indicative',
        paragraphs: [
          "Les deux formats standard ont des volumes utiles très différents. À titre indicatif, en fonction des modèles et de leur empilabilité, un 20 pieds accueille une partie d’un assortiment terrasse, là où un 40 pieds permet des volumes nettement plus élevés.",
        ],
        bullets: [
          '20 pieds : ~33 m³ de volume utile.',
          '40 pieds : ~67 m³ de volume utile (≈ 2×).',
          'Le nombre d’unités dépend du CBM de chaque référence (empilable ou non).',
        ],
      },
      {
        heading: 'Impact sur le coût au m³',
        paragraphs: [
          "Plus un container est rempli, mieux les frais fixes (transport, manutention) se répartissent. Un 40 pieds bien rempli est souvent plus efficace au m³ ; mal rempli, il peut coûter plus cher qu’un 20 pieds adapté.",
          "C’est pourquoi le remplissage en temps réel est affiché : il aide à choisir le format et à viser le bon seuil de départ.",
        ],
      },
      {
        heading: 'Comment décider',
        paragraphs: [
          "En pratique, le format est déterminé par le volume cumulé des participants au container. Avec l’achat groupé, vous n’avez pas à trancher seul : vous réservez votre part et le système oriente vers le format adapté.",
        ],
      },
    ],
    faq: [
      {
        q: 'Quel volume pour un container 20 et 40 pieds ?',
        a: "Environ 33 m³ pour un 20 pieds et 67 m³ pour un 40 pieds. Le nombre de meubles dépend du volume unitaire (CBM) de chaque référence.",
      },
      {
        q: 'Le 40 pieds est-il toujours plus économique ?',
        a: "Seulement s’il est bien rempli. Un 40 pieds peu rempli répartit mal les frais fixes ; un 20 pieds adapté peut alors être plus pertinent.",
      },
      {
        q: 'Dois-je choisir le format moi-même ?',
        a: "Non : l’achat groupé agrège les réservations et oriente vers le format adapté au volume total. Vous réservez seulement votre part.",
      },
    ],
    related: [
      {
        label: 'Importer par container',
        href: '/guides/import-mobilier-chr-container',
      },
      { label: 'Voir le catalogue', href: '/catalogue' },
      { label: 'Containers livrés', href: '/livres' },
    ],
  },
  {
    slug: 'moq-chaises-restaurant',
    title: 'MOQ des chaises de restaurant : ce qu’il faut savoir',
    metaDescription:
      "MOQ (quantité minimale de commande) des chaises de restaurant : à quoi ça sert, pourquoi ça existe et comment l’achat groupé réduit la contrainte.",
    answer:
      "Le MOQ (Minimum Order Quantity) est la quantité minimale à commander pour une référence afin d’obtenir un prix volume. Sur les chaises de restaurant importées, il évite des coûts unitaires élevés sur de petites séries. L’achat groupé par container permet d’atteindre ce minimum en mutualisant plusieurs commandes, sans avoir à commander seul des dizaines ou centaines d’unités.",
    updated: UPDATED,
    sections: [
      {
        heading: 'Pourquoi un MOQ existe',
        paragraphs: [
          "Produire et expédier en petite quantité coûte cher par unité : réglages de production, contrôle, manutention et transport se répartissent mal. Le MOQ fixe un seuil à partir duquel le prix volume devient possible.",
          "Sur le catalogue, chaque chaise affiche son MOQ : c’est l’information clé pour cadrer un projet et estimer le bon volume.",
        ],
      },
      {
        heading: 'Comment l’achat groupé réduit la contrainte',
        paragraphs: [
          "Le frein du MOQ est qu’un établissement seul n’a pas toujours besoin du minimum complet. Container Club agrège les commandes : plusieurs acheteurs atteignent ensemble le palier, chacun pour sa propre quantité.",
        ],
        bullets: [
          'Vous commandez la quantité utile à votre projet.',
          'Le palier MOQ est atteint collectivement sur le container.',
          'Le prix volume s’applique sans surstock de votre côté.',
        ],
      },
    ],
    faq: [
      {
        q: 'Quel est le MOQ d’une chaise de restaurant ?',
        a: "Il varie selon le modèle et figure sur chaque fiche du catalogue. L’achat groupé permet de l’atteindre sans commander seul tout le minimum.",
      },
      {
        q: 'Puis-je commander sous le MOQ ?',
        a: "Le prix volume suppose d’atteindre le MOQ, mais via la mutualisation du container vous n’avez à financer que votre part réelle.",
      },
    ],
    related: [
      { label: 'Chaises de restaurant', href: '/catalogue/chaises-restaurant' },
      {
        label: 'Prix des chaises en volume',
        href: '/guides/prix-chaises-restaurant-volume',
      },
      {
        label: 'Importer par container',
        href: '/guides/import-mobilier-chr-container',
      },
    ],
  },
  {
    slug: 'prix-net-revendeur-mobilier-chr',
    title: 'Prix net revendeur de mobilier CHR : comment ça fonctionne',
    metaDescription:
      "Prix net revendeur de mobilier CHR : principe de protection du revendeur, prix nets privés, marge libre et accès partenaire chez Pros Import.",
    answer:
      "Un revendeur de mobilier CHR accède à des conditions nettes via un programme partenaire, sans que ces prix nets soient jamais publics. Pros Import protège le revendeur (attribution par lien, SIRET ou email pro), lui laisse fixer librement sa marge, et opère l’import, la qualité et la logistique en back-office. Le client final ne voit que les prix publics.",
    updated: UPDATED,
    sections: [
      {
        heading: 'Le principe : protéger le revendeur',
        paragraphs: [
          "Le risque d’un revendeur qui partage une source d’import est de perdre son client. Le programme partenaire répond à cela : le projet apporté reste rattaché au revendeur via un lien co-brandé, le SIRET ou l’email professionnel du client.",
          "Les prix nets partenaires et les marges ne sont jamais exposés publiquement. Le revendeur garde la main sur son prix de revente.",
        ],
      },
      {
        heading: 'Ce que voit le client final',
        paragraphs: [
          "Le client final voit uniquement les prix publics directs pros. Les conditions nettes du revendeur restent privées, dans un espace partenaire authentifié.",
        ],
        bullets: [
          'Prix nets partenaires : privés, jamais publics.',
          'Marge de revente : libre, fixée par le revendeur.',
          'Attribution : lien co-brandé, SIRET ou email pro.',
        ],
      },
      {
        heading: 'Comment en bénéficier',
        paragraphs: [
          "L’accès se fait via la page Partenaires : demande de partenariat, puis protection des opportunités et accès à un espace dédié. C’est là que se gèrent les deals protégés et les sélections co-brandées.",
        ],
      },
    ],
    faq: [
      {
        q: 'Les prix nets revendeurs sont-ils publics ?',
        a: "Non. Les prix nets partenaires et les marges ne sont jamais affichés publiquement ; ils restent dans l’espace partenaire authentifié.",
      },
      {
        q: 'Le revendeur garde-t-il la liberté de son prix ?',
        a: "Oui. Pros Import n’impose pas de prix de revente : le revendeur fixe librement sa marge.",
      },
      {
        q: 'Comment un client apporté est-il protégé ?',
        a: "Par l’attribution : lien co-brandé capté, SIRET ou email professionnel reconnu, et enregistrement du deal protégé côté admin.",
      },
    ],
    related: [
      { label: 'Programme partenaires', href: '/partenaires' },
      {
        label: 'Importer par container',
        href: '/guides/import-mobilier-chr-container',
      },
      { label: 'Catalogue', href: '/catalogue' },
    ],
  },
]

export const GUIDE_SLUGS = GUIDES.map((g) => g.slug)

export function getGuideBySlug(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug)
}
