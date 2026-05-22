/**
 * Transporteurs partenaires recommandés.
 *
 * V1: liste statique éditée dans le code. Container Club ne facture rien
 * sur le transport post-port — le client contacte directement le partenaire.
 *
 * V2 (futur): table Supabase `carrier_partners` + admin CRUD.
 */

export type CarrierSpecialty =
  | 'national'
  | 'regional_sud_est'
  | 'regional_ouest'
  | 'international'
  | 'plateforme'

export interface CarrierContact {
  readonly phone?: string
  readonly email?: string
  readonly website?: string
}

export interface Carrier {
  readonly slug: string
  readonly name: string
  readonly specialty: CarrierSpecialty
  readonly specialtyLabel: string
  readonly summary: string
  readonly strengths: ReadonlyArray<string>
  readonly coverage: string
  readonly indicativePricing: string
  readonly contact: CarrierContact
  readonly source: 'partenaire-direct' | 'plateforme-publique'
}

export const CARRIERS: ReadonlyArray<Carrier> = [
  {
    slug: 'geodis',
    name: 'Geodis',
    specialty: 'national',
    specialtyLabel: 'Réseau national',
    summary:
      'Filiale SNCF, premier acteur français de la logistique. Couverture nationale, tournées quotidiennes au départ de Marseille-Fos et du Havre.',
    strengths: [
      'Tournées quotidiennes depuis les 2 ports',
      'Suivi en temps réel + preuve de livraison',
      'Manutention au déchargement incluse pour les palettes',
    ],
    coverage: 'France entière + Belgique, Luxembourg, Suisse',
    indicativePricing:
      '~ 8 à 18 € HT le m³ selon zone (Île-de-France 8-12 €, régions 12-18 €). Devis ferme sous 48 h.',
    contact: {
      phone: '+33 (0)1 56 76 26 00',
      website: 'https://geodis.com/fr/',
    },
    source: 'partenaire-direct',
  },
  {
    slug: 'heppner',
    name: 'Heppner',
    specialty: 'national',
    specialtyLabel: 'Réseau national & européen',
    summary:
      'Transporteur indépendant français. Bon rapport qualité/prix sur le sud-est et le grand quart sud, terminal hub à Saint-Vulbas (Lyon).',
    strengths: [
      'Hub Lyon (Saint-Vulbas) idéal pour le sud-est',
      'Prise en charge des marchandises hors gabarit',
      'API tracking ouverte (intégration ERP possible)',
    ],
    coverage:
      'France (forte densité sud-est et grand ouest), Allemagne, Italie',
    indicativePricing:
      '~ 9 à 16 € HT le m³ selon zone. Tarif dégressif au-dessus de 5 m³.',
    contact: {
      phone: '+33 (0)3 88 64 64 00',
      website: 'https://www.heppner.fr',
    },
    source: 'partenaire-direct',
  },
  {
    slug: 'mauffrey',
    name: 'Mauffrey',
    specialty: 'regional_ouest',
    specialtyLabel: 'Spécialité grand ouest',
    summary:
      'Transporteur ancré sur le grand ouest (Pays de la Loire, Bretagne, Normandie). Cabotage maritime port-à-quai possible depuis Le Havre.',
    strengths: [
      'Densité ouest exceptionnelle',
      'Cabotage maritime Le Havre → Saint-Nazaire / Brest',
      'Adapté aux livraisons saisonnières campings / hôtellerie de plein air',
    ],
    coverage: 'Grand ouest + Île-de-France',
    indicativePricing: '~ 10 à 17 € HT le m³ depuis Le Havre.',
    contact: {
      phone: '+33 (0)3 84 90 24 00',
      website: 'https://www.groupemauffrey.com',
    },
    source: 'partenaire-direct',
  },
  {
    slug: 'dachser',
    name: 'Dachser',
    specialty: 'international',
    specialtyLabel: 'International + Europe',
    summary:
      "Acteur européen. Idéal pour des livraisons multi-pays (groupements d'achats multi-établissements en Allemagne, Italie, Espagne).",
    strengths: [
      'Couverture 31 pays européens',
      'Procédures douanières maîtrisées',
      'Idéal flotte hôtelière multi-pays',
    ],
    coverage: 'Europe occidentale + centrale',
    indicativePricing:
      'Devis personnalisé selon volume et destination — généralement compétitif au-delà de 10 m³.',
    contact: {
      phone: '+33 (0)4 78 66 06 00',
      website: 'https://www.dachser.com/fr/',
    },
    source: 'partenaire-direct',
  },
  {
    slug: 'upela',
    name: 'Upela',
    specialty: 'plateforme',
    specialtyLabel: 'Comparateur multi-transporteurs',
    summary:
      'Plateforme française qui compare en temps réel 10+ transporteurs (DHL, UPS, TNT, Chronopost, DPD…). Souple pour les petits volumes ou les zones rurales.',
    strengths: [
      'Devis instantané en ligne',
      'Comparaison de 10+ transporteurs',
      'Adapté volumes < 5 m³ et zones isolées',
    ],
    coverage: 'France métropolitaine + international',
    indicativePricing:
      'Variable selon transporteur retenu — généralement 15 à 35 € HT par palette selon distance.',
    contact: {
      website: 'https://www.upela.com',
    },
    source: 'plateforme-publique',
  },
] as const

export function findCarrierBySlug(slug: string): Carrier | undefined {
  return CARRIERS.find((c) => c.slug === slug)
}

export const CARRIER_FAQ: ReadonlyArray<{ q: string; a: string }> = [
  {
    q: 'Container Club touche-t-il une commission sur les transporteurs ?',
    a: "Non. Aucun pourcentage, aucun apporteur d'affaires, aucune rétrocession. La liste est éditoriale : on ne référence que les transporteurs qu'on connaît et qu'on recommanderait à un confrère. Vous contactez directement le partenaire, négociez et payez en direct.",
  },
  {
    q: 'Quand dois-je organiser le transport ?',
    a: "Idéalement dès que le container atteint 80 % de remplissage (clôture commande) — vous avez ~6 à 8 semaines avant l'arrivée au port. Les transporteurs locaux préfèrent un préavis de 10 jours minimum.",
  },
  {
    q: "Et si je n'arrive pas à trouver de transporteur ?",
    a: "Écrivez-nous (adrienlaniez1@gmail.com) en précisant votre code postal de livraison, le volume (m³) et la date d'arrivée prévue. On vous met en relation directement avec un partenaire qui couvre votre zone.",
  },
  {
    q: 'Les prix indiqués sont-ils fermes ?',
    a: "Non — ce sont des fourchettes indicatives observées en 2025/2026. Le prix final dépend du volume exact, du quai d'enlèvement, de la zone de livraison et de la saisonnalité. Demandez systématiquement un devis ferme.",
  },
  {
    q: 'Puis-je organiser moi-même mon transport ?',
    a: "Bien sûr. Sélectionnez « J'ai déjà mon transporteur » au moment de la réservation — on vous communiquera les coordonnées et la documentation douanière dès l'arrivée du container au port.",
  },
]
