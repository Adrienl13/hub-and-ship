import type {
  PartnerActivityProfile,
  PartnerTargetStatus,
} from '@/lib/partner-applications'

export interface PartnerStat {
  readonly value: string
  readonly label: string
}

export const PARTNER_STATS: ReadonlyArray<PartnerStat> = [
  { value: '8%', label: 'commission apporteur, sur CA encaissé' },
  { value: '3–5%', label: 'RFA annuelle revendeur agréé' },
  { value: '−30/40%', label: 'vs retail FR pour vos clients' },
  { value: '48h', label: 'validation de candidature' },
]

export interface SelectorRecommendation {
  readonly targets: ReadonlyArray<PartnerTargetStatus>
  readonly note: string
}

/** Profile → recommended status(es) + guidance note (mirrors the mockup). */
export const SELECTOR_RECO: Record<
  PartnerActivityProfile,
  SelectorRecommendation
> = {
  brasseur: {
    targets: ['apporteur'],
    note: 'AP-08 recommandé — Vos tournées CHR deviennent un revenu mobilier : 8% sans stock ni facturation. Évolution naturelle vers revendeur agréé quand les volumes suivent.',
  },
  pisciniste: {
    targets: ['apporteur', 'revendeur'],
    note: 'AP-08 ou RV-AG — Simple recommandation à vos clients : apporteur (8%). Vous vendez l’aménagement complet avec le mobilier : revendeur agréé (marge + RFA).',
  },
  paysagiste: {
    targets: ['revendeur'],
    note: 'RV-AG recommandé — Vous intégrez le mobilier à vos projets et facturez vos clients : tarif revendeur + votre marge + RFA jusqu’à 5%.',
  },
  magasin: {
    targets: ['revendeur'],
    note: 'RV-AG recommandé — Le mobilier CHR entre à votre catalogue : grille revendeur dédiée, revente sous votre marque, RFA annuelle.',
  },
  chr: {
    targets: ['grand_compte'],
    note: 'GC-CA recommandé — Plusieurs établissements à équiper : commande cadre annuelle, meilleur palier garanti, containers à vos dates.',
  },
  agent: {
    targets: ['apporteur'],
    note: 'AP-08 recommandé — Votre carnet d’adresses travaille pour vous : 8% sur 12 mois par client apporté, tableau de bord de suivi inclus.',
  },
  export: {
    targets: ['distributeur'],
    note: 'DX-PAYS recommandé — Exclusivité contractuelle sur votre territoire et meilleures conditions de la grille. Belgique, Espagne et Allemagne ouvertes.',
  },
  autre: {
    targets: ['nsp'],
    note: 'Dites-nous en plus dans le formulaire — notre équipe vous oriente vers le statut le plus adapté sous 48 h.',
  },
}

export interface PartnerStatusCard {
  readonly status: PartnerTargetStatus
  readonly plate: string
  readonly title: string
  readonly tagline: string
  readonly gainLead: string
  readonly gainRest: string
  readonly included: ReadonlyArray<string>
  readonly excluded: ReadonlyArray<string>
  readonly conditions: string
  readonly cta: string
  readonly zoneBadge?: string
}

export const PARTNER_STATUS_CARDS: ReadonlyArray<PartnerStatusCard> = [
  {
    status: 'apporteur',
    plate: 'AP-08',
    title: 'Apporteur d’affaires',
    tagline: 'Vous connaissez des pros. Nous faisons tout le reste.',
    gainLead: '8% de commission',
    gainRest:
      ' sur tout le chiffre d’affaires encaissé de chaque client apporté, pendant 12 mois.',
    included: [
      'Lien et QR code de suivi personnels — chaque vente vous est attribuée',
      'Corner démo fourni après validation (2–3 chaises + 2 tables)',
      'Tableau de bord : clients apportés, réservations, commissions en temps réel',
      'Zéro stock, zéro facturation, zéro SAV — Container Club facture le client final',
    ],
    excluded: [
      'Tarif d’achat préférentiel (vous n’achetez pas)',
      'Exclusivité territoriale',
    ],
    conditions:
      'SIRET actif. Commission versée à l’encaissement complet du client. Aucun engagement de volume.',
    cta: 'Devenir apporteur',
  },
  {
    status: 'revendeur',
    plate: 'RV-AG',
    title: 'Revendeur agréé',
    tagline: 'Votre catalogue s’agrandit. Votre marge aussi.',
    gainLead: 'Tarif d’achat revendeur',
    gainRest:
      ' + votre marge libre à la revente + RFA annuelle jusqu’à 5%.',
    included: [
      'Grille tarifaire revendeur dédiée (communiquée après validation du statut)',
      'RFA : 3% dès 1 container cumulé / 5% dès 2 — versée en janvier, sur CA encaissé',
      'Revente sous votre marque, facturation en votre nom',
      'Corner démo + kit commercial (fiches produits, visuels, argumentaires)',
      'Accès prioritaire aux containers en cours de remplissage',
    ],
    excluded: [
      'Remises volume du canal direct (la RFA les remplace)',
      'Offres d’appel grand public',
      'Exclusivité territoriale (réservée au statut distributeur)',
    ],
    conditions:
      'SIRET, activité de revente ou d’installation établie. Minimum de commande par lot.',
    cta: 'Demander la grille revendeur',
  },
  {
    status: 'grand_compte',
    plate: 'GC-CA',
    title: 'Grand compte',
    tagline: 'Vos volumes méritent un calendrier, pas un panier.',
    gainLead: 'Commande cadre annuelle',
    gainRest:
      ' au meilleur palier direct garanti, containers planifiés à vos dates.',
    included: [
      'Meilleur palier tarifaire direct garanti toute l’année, quel que soit le volume par commande',
      'Calendrier de containers réservés à vos dates d’ouverture',
      'Personnalisation produits sur volume (coloris, marquage)',
      'Interlocuteur dédié + SAV prioritaire',
    ],
    excluded: [
      'Revente (statut réservé à l’usage de votre propre réseau)',
      'Commission d’apport',
    ],
    conditions:
      'Engagement annuel sur volume ou containers. Étude sur dossier, rendez-vous conseillé.',
    cta: 'Planifier un rendez-vous',
  },
  {
    status: 'distributeur',
    plate: 'DX-PAYS',
    title: 'Distributeur exclusif',
    tagline: 'Un territoire. Un partenaire. Point.',
    gainLead: 'Les meilleures conditions de la grille',
    gainRest: ' + exclusivité contractuelle sur votre territoire.',
    included: [
      'Conditions distributeur — le niveau le plus avantageux de notre grille',
      'Exclusivité territoriale contractuelle (pays ou région)',
      'Priorité absolue sur la production et les départs de containers',
      'Support marketing et co-branding',
    ],
    excluded: [
      'Entrée sans engagement — un volume annuel contractuel est requis',
    ],
    conditions:
      'Structure logistique en place, engagement pluriannuel. Candidature sur dossier uniquement.',
    cta: 'Candidater sur dossier',
    zoneBadge:
      'ZONES OUVERTES · BELGIQUE — ESPAGNE — ALLEMAGNE · RÉGIONS FR SUR ÉTUDE',
  },
]

export interface ComparisonRow {
  readonly label: string
  readonly cells: readonly [string, string, string, string]
}

export const COMPARISON_HEAD = [
  'AP-08 · Apporteur',
  'RV-AG · Revendeur',
  'GC-CA · Grand compte',
  'DX-PAYS · Distributeur',
] as const

export const COMPARISON_ROWS: ReadonlyArray<ComparisonRow> = [
  {
    label: 'Comment vous gagnez',
    cells: [
      'Commission 8%',
      'Marge revente + RFA',
      'Prix direct optimisé',
      'Conditions distributeur',
    ],
  },
  {
    label: 'Achat de stock',
    cells: ['Non', 'Oui, à votre rythme', 'Oui, planifié', 'Oui, engagement'],
  },
  {
    label: 'Vous facturez le client final',
    cells: ['Non — nous', 'Oui', '— (usage propre)', 'Oui'],
  },
  {
    label: 'RFA annuelle',
    cells: ['—', '3% / 5%', '—', 'Selon contrat'],
  },
  {
    label: 'Exclusivité territoriale',
    cells: ['Non', 'Non', 'Non', 'Oui'],
  },
  {
    label: 'Corner démo fourni',
    cells: ['Oui', 'Oui', '—', 'Oui'],
  },
  {
    label: 'Engagement minimum',
    cells: ['Aucun', 'Par lot', 'Annuel', 'Containers / an'],
  },
  {
    label: 'Validation',
    cells: ['48h', '48–72h', 'Rendez-vous', 'Sur dossier'],
  },
]

export interface ProcessStep {
  readonly num: string
  readonly title: string
  readonly desc: string
}

export const PROCESS_STEPS: ReadonlyArray<ProcessStep> = [
  {
    num: '01',
    title: 'Candidature',
    desc: '2 minutes. Raison sociale, SIRET, profil d’activité, zone.',
  },
  {
    num: '02',
    title: 'Validation sous 48h',
    desc: 'Vérification SIRET + échange téléphonique si besoin. Le statut est attribué par notre équipe.',
  },
  {
    num: '03',
    title: 'Kit de démarrage',
    desc: 'Corner démo, QR code, accès à votre espace partenaire et à vos conditions.',
  },
  {
    num: '04',
    title: 'Premiers gains',
    desc: 'Commission à l’encaissement ou grille d’achat active dès la première commande.',
  },
]

export interface BrasseurStep {
  readonly tag: string
  readonly title: string
  readonly desc: string
}

export const BRASSEUR_STEPS: ReadonlyArray<BrasseurStep> = [
  {
    tag: 'ÉTAPE 01',
    title: 'Corner démo au dépôt',
    desc: '2–3 chaises + 2 tables fournies. Vos clients touchent le produit là où ils viennent déjà.',
  },
  {
    tag: 'ÉTAPE 02',
    title: 'QR code sur vos tournées',
    desc: 'Chaque commande passée via votre lien vous est attribuée automatiquement, sans paperasse.',
  },
  {
    tag: 'ÉTAPE 03',
    title: 'Commission à l’encaissement',
    desc: '8% du CA encaissé, pendant 12 mois par client. Évolution possible vers le statut revendeur.',
  },
]

export interface PartnerFaqItem {
  readonly q: string
  readonly a: string
}

export const PARTNER_FAQ: ReadonlyArray<PartnerFaqItem> = [
  {
    q: 'Quand suis-je payé ?',
    a: 'Les commissions apporteur et les RFA revendeur sont calculées et versées sur le chiffre d’affaires encaissé — jamais sur du « signé mais non payé ». Les commissions sont versées mensuellement, la RFA en janvier sur l’année écoulée.',
  },
  {
    q: 'Puis-je cumuler deux statuts ?',
    a: 'Un statut principal par SIRET. Le statut évolue avec vos volumes : beaucoup de partenaires démarrent apporteur, puis passent revendeur agréé quand la demande de leurs clients se confirme.',
  },
  {
    q: 'Pourquoi les tarifs revendeur ne sont-ils pas affichés ?',
    a: 'Pour protéger votre marge. Nos grilles partenaires garantissent que le prix public direct reste toujours supérieur à votre prix d’achat — elles sont communiquées après validation du statut, sous conditions.',
  },
  {
    q: 'Qui gère le SAV et la garantie ?',
    a: 'Container Club, intégralement. Garantie 2 ans, pièces et SAV traités en France. En statut apporteur, vous n’avez aucune obligation après la mise en relation.',
  },
]
