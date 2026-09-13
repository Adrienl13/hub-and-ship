export class PartnersModel {
  state = {
    profile: null,
    tab: 0,
    formProfile: '',
    formStatus: '',
    open: 0,
    sent: false,
    sub: false,
    fab: false,
  }
  I = 'https://cdn.jsdelivr.net/npm/@phosphor-icons/core@2/assets/duotone/'
  GOLD = '#b8924a'
  GOLDD = '#8f6f33'
  GOLDL = '#e2c27a'
  defs = [
    {
      id: 'apporteur',
      code: 'AP-08',
      name: "Apporteur d'affaires",
      tag: 'Vous connaissez des pros. Nous faisons tout le reste.',
      headline: '8 %',
      gain: "8 % de commission sur tout le chiffre d'affaires encaissé de chaque client apporté, pendant 12 mois.",
      pros: [
        'Lien et QR code de suivi personnels — chaque vente vous est attribuée',
        'Corner démo fourni après validation (2–3 chaises + 2 tables)',
        'Tableau de bord : clients apportés, réservations, commissions en temps réel',
        'Zéro stock, zéro facturation, zéro SAV — Terrassea facture le client final',
      ],
      cons: [
        "Tarif d'achat préférentiel (vous n'achetez pas)",
        'Exclusivité territoriale',
      ],
      cond: "SIRET actif. Commission versée à l'encaissement complet du client. Aucun engagement de volume.",
      valid: '48 h',
      cta: 'Devenir apporteur',
      icon: 'handshake-duotone.svg',
      tone: 0,
    },
    {
      id: 'revendeur',
      code: 'RV-AG',
      name: 'Revendeur agréé',
      tag: "Votre catalogue s'agrandit. Votre marge aussi.",
      headline: 'Marge + RFA 5 %',
      gain: "Tarif d'achat revendeur + votre marge libre à la revente + RFA annuelle jusqu'à 5 %.",
      pros: [
        'Grille tarifaire revendeur dédiée (communiquée après validation du statut)',
        'RFA : 3 % dès 1 container cumulé / 5 % dès 2 — versée en janvier, sur CA encaissé',
        'Revente sous votre marque, facturation en votre nom',
        'Corner démo + kit commercial (fiches produits, visuels, argumentaires)',
        'Accès prioritaire aux containers en cours de remplissage',
      ],
      cons: [
        'Remises volume du canal direct (la RFA les remplace)',
        "Offres d'appel grand public",
        'Exclusivité territoriale (réservée au statut distributeur)',
      ],
      cond: "SIRET, activité de revente ou d'installation établie. Minimum de commande par lot.",
      valid: '48–72 h',
      cta: 'Demander la grille revendeur',
      icon: 'storefront-duotone.svg',
      tone: 1,
    },
    {
      id: 'grandcompte',
      code: 'GC-CA',
      name: 'Grand compte',
      tag: 'Vos volumes méritent un calendrier, pas un panier.',
      headline: 'Meilleur palier',
      gain: 'Commande cadre annuelle au meilleur palier direct garanti, containers planifiés à vos dates.',
      pros: [
        "Meilleur palier tarifaire direct garanti toute l'année, quel que soit le volume par commande",
        "Calendrier de containers réservés à vos dates d'ouverture",
        'Personnalisation produits sur volume (coloris, marquage)',
        'Interlocuteur dédié + SAV prioritaire',
      ],
      cons: [
        "Revente (statut réservé à l'usage de votre propre réseau)",
        "Commission d'apport",
      ],
      cond: 'Engagement annuel sur volume ou containers. Étude sur dossier, rendez-vous conseillé.',
      valid: 'rendez-vous',
      cta: 'Planifier un rendez-vous',
      icon: 'buildings-duotone.svg',
      tone: 2,
    },
    {
      id: 'distributeur',
      code: 'DX-PAYS',
      name: 'Distributeur exclusif',
      tag: 'Un territoire. Un partenaire. Point.',
      headline: 'Exclusivité',
      gain: 'Les meilleures conditions de la grille + exclusivité contractuelle sur votre territoire.',
      pros: [
        'Conditions distributeur — le niveau le plus avantageux de notre grille',
        'Exclusivité territoriale contractuelle (pays ou région)',
        'Priorité absolue sur la production et les départs de containers',
        'Support marketing et co-branding',
      ],
      cons: [
        'Entrée sans engagement — un volume annuel contractuel est requis',
      ],
      cond: 'Structure logistique en place, engagement pluriannuel. Candidature sur dossier uniquement.',
      zones:
        'Zones ouvertes · Belgique — Espagne — Allemagne · Régions FR sur étude',
      valid: 'sur dossier',
      cta: 'Candidater sur dossier',
      icon: 'globe-hemisphere-west-duotone.svg',
      tone: 3,
    },
  ]
  profileDefs = [
    {
      label: 'Distributeur boissons / brasseur',
      reco: 0,
      why: 'un corner démo au dépôt et un QR code sur vos tournées, sans stock.',
    },
    {
      label: 'Pisciniste',
      reco: 1,
      why: 'le mobilier entre à votre catalogue, revendu sous votre marque avec RFA.',
    },
    {
      label: 'Paysagiste / aménageur',
      reco: 1,
      why: 'vous installez déjà : revendez à votre marge, facturez en votre nom.',
    },
    {
      label: 'Magasin / revendeur mobilier',
      reco: 1,
      why: 'grille revendeur dédiée, kit commercial et accès prioritaire aux containers.',
    },
    {
      label: 'Groupe CHR · camping · hôtellerie',
      reco: 2,
      why: "commande cadre annuelle, containers planifiés à vos dates d'ouverture.",
    },
    {
      label: 'Agent commercial / consultant',
      reco: 0,
      why: '8 % sur le CA encaissé de chaque client apporté, pendant 12 mois.',
    },
    {
      label: 'Importateur / distributeur étranger',
      reco: 3,
      why: 'exclusivité contractuelle sur votre pays, priorité sur la production.',
    },
  ]
  renderVals() {
    const s = this.state
    const tones = [
      {
        panelBg: '#fff',
        panelFg: 'var(--color-text)',
        bar: this.GOLD,
        big: this.GOLDD,
        check: this.GOLDD,
        line: 'var(--color-neutral-300)',
        btnBg: 'var(--color-text)',
        btnFg: 'var(--color-bg)',
        iconBg: 'var(--color-neutral-200)',
        f: 'none',
        th: 'var(--color-neutral-200)',
      },
      {
        panelBg: 'var(--color-accent-100)',
        panelFg: 'var(--color-accent-900)',
        bar: 'var(--color-accent-700)',
        big: 'var(--color-accent-700)',
        check: 'var(--color-accent-700)',
        line: 'var(--color-accent-300)',
        btnBg: 'var(--color-accent-700)',
        btnFg: 'var(--color-bg)',
        iconBg: 'var(--color-accent-200)',
        f: 'none',
        th: 'var(--color-accent-100)',
      },
      {
        panelBg: 'var(--color-accent-700)',
        panelFg: 'var(--color-bg)',
        bar: 'var(--color-accent-700)',
        big: this.GOLDL,
        check: this.GOLDL,
        line: 'color-mix(in srgb,#fff 35%,transparent)',
        btnBg: 'var(--color-bg)',
        btnFg: 'var(--color-text)',
        iconBg: 'var(--color-accent-700)',
        f: 'brightness(0) invert(1)',
        th: 'var(--color-accent-200)',
      },
      {
        panelBg: 'var(--color-text)',
        panelFg: 'var(--color-bg)',
        bar: this.GOLD,
        big: this.GOLDL,
        check: this.GOLDL,
        line: 'color-mix(in srgb,#fff 30%,transparent)',
        btnBg: this.GOLD,
        btnFg: '#fff',
        iconBg: 'var(--color-text)',
        f: 'brightness(0) invert(1)',
        th: 'color-mix(in srgb,#b8924a 25%,transparent)',
      },
    ]
    const reco = s.profile != null ? this.profileDefs[s.profile] : null
    const recoDef = reco ? this.defs[reco.reco] : null
    const d = this.defs[s.tab],
      t = tones[d.tone]
    return {
      phoneHref: this.settings.phone
        ? 'tel:' + this.settings.phone
        : '/#contact',
      phoneHint: this.settings.phone
        ? ''
        : 'Coordonnées téléphoniques à compléter — formulaire de contact',
      applicationFeedback: this.feedback.application,
      newsletterFeedback: this.feedback.newsletter,
      kpis: [
        {
          num: '8 %',
          label: 'commission apporteur, sur CA encaissé',
          color: this.GOLDL,
        },
        {
          num: '3–5 %',
          label: 'RFA annuelle revendeur agréé',
          color: 'var(--color-accent-300)',
        },
        {
          num: '−30 à 40 %',
          label: 'vs retail FR pour vos clients',
          color: 'var(--color-bg)',
        },
        {
          num: '48 h',
          label: 'validation de candidature',
          color: 'var(--color-bg)',
        },
      ],
      ticker: Array(2)
        .fill([
          'Vérification SIRET sous 48 h',
          'Commissions sur CA encaissé',
          'Zéro stock, zéro avance',
          'Importateur officiel',
          'Contrôle SGS avant départ',
          'Garantie 1 an + SAV France',
        ])
        .flat()
        .map((x) => x + '  ·'),
      profiles: this.profileDefs.map((p, i) => {
        const on = s.profile === i
        return {
          selected: on,
          label: p.label,
          border: on ? 'var(--color-text)' : 'var(--color-neutral-300)',
          bg: on ? 'var(--color-text)' : 'transparent',
          color: on ? 'var(--color-bg)' : 'var(--color-text)',
          pick: () =>
            this.setState({
              profile: on ? null : i,
              tab: on ? s.tab : p.reco,
              formProfile: on ? '' : p.label,
              formStatus: on ? '' : this.defs[p.reco].id,
            }),
        }
      }),
      orientHint: reco
        ? 'Statut recommandé ouvert ci-dessous'
        : 'Cliquez sur votre activité',
      recoMax: recoDef ? '200px' : '0px',
      reco: recoDef
        ? {
            code: recoDef.code,
            name: recoDef.name,
            why: reco.why,
            href: '#statuts',
          }
        : { code: '', name: '', why: '', href: '#statuts' },
      tabs: this.defs.map((x, i) => {
        const tt = tones[x.tone],
          on = i === s.tab
        return {
          selected: on,
          tabindex: on ? 0 : -1,
          id: x.id,
          code: x.code,
          name: x.name,
          icon: this.I + x.icon,
          iconBg: on ? tt.iconBg : 'var(--color-neutral-200)',
          iconFilter: on ? tt.f : 'none',
          bar: on ? tt.bar : 'transparent',
          bg: on ? 'var(--color-bg)' : '#fff',
          fg: 'var(--color-text)',
          arrowOp: on ? 1 : 0.25,
          thBg: on ? tt.th : 'transparent',
          thFg: 'var(--color-text)',
          pick: () => this.setState({ tab: i, formStatus: x.id }),
        }
      }),
      cur: {
        ...d,
        ...t,
        zones: d.zones || false,
        apply: () => this.setState({ formStatus: d.id }),
      },
      applyAP: () => this.setState({ formStatus: 'apporteur', tab: 0 }),
      tour: [
        {
          num: 'Étape 01',
          title: 'Corner démo au dépôt',
          body: '2–3 chaises + 2 tables fournies. Vos clients touchent le produit là où ils viennent déjà.',
          icon: 'armchair-duotone.svg',
        },
        {
          num: 'Étape 02',
          title: 'QR code sur vos tournées',
          body: 'Chaque commande passée via votre lien vous est attribuée automatiquement, sans paperasse.',
          icon: 'qr-code-duotone.svg',
        },
        {
          num: 'Étape 03',
          title: "Commission à l'encaissement",
          body: '8 % du CA encaissé, pendant 12 mois par client. Évolution possible vers le statut revendeur.',
          icon: 'hand-coins-duotone.svg',
        },
      ].map((x) => ({ ...x, icon: this.I + x.icon })),
      compare: [
        [
          'Comment vous gagnez',
          [
            'Commission 8 %',
            'Marge revente + RFA',
            'Prix direct optimisé',
            'Conditions distributeur',
          ],
        ],
        [
          'Achat de stock',
          ['Non', 'Oui, à votre rythme', 'Oui, planifié', 'Oui, engagement'],
        ],
        [
          'Vous facturez le client final',
          ['Non — nous', 'Oui', '— (usage propre)', 'Oui'],
        ],
        ['RFA annuelle', ['—', '3 % / 5 %', '—', 'Selon contrat']],
        ['Exclusivité territoriale', ['Non', 'Non', 'Non', 'Oui']],
        ['Corner démo fourni', ['Oui', 'Oui', '—', 'Oui']],
        [
          'Engagement minimum',
          ['Aucun', 'Par lot', 'Annuel', 'Containers / an'],
        ],
        ['Validation', ['48 h', '48–72 h', 'Rendez-vous', 'Sur dossier']],
      ].map((r) => ({
        label: r[0],
        cells: r[1].map((v, i) => ({
          v,
          w: i === s.tab ? 600 : 400,
          bg:
            i === s.tab
              ? 'color-mix(in srgb,' +
                tones[this.defs[i].tone].th +
                ' 55%,transparent)'
              : 'transparent',
        })),
      })),
      steps: [
        {
          num: '01',
          title: 'Candidature',
          body: "2 minutes. Raison sociale, SIRET, profil d'activité, zone.",
          bg: this.GOLD,
          fg: '#fff',
        },
        {
          num: '02',
          title: 'Validation sous 48 h',
          body: 'Vérification SIRET + échange téléphonique si besoin. Le statut est attribué par notre équipe.',
          bg: 'var(--color-text)',
          fg: 'var(--color-bg)',
        },
        {
          num: '03',
          title: 'Kit de démarrage',
          body: 'Corner démo, QR code, accès à votre espace partenaire et à vos conditions.',
          bg: 'var(--color-text)',
          fg: 'var(--color-bg)',
        },
        {
          num: '04',
          title: 'Premiers gains',
          body: "Commission à l'encaissement ou grille d'achat active dès la première commande.",
          bg: 'var(--color-accent-700)',
          fg: 'var(--color-bg)',
        },
      ].map((x, i) => ({ ...x, delay: i * 0.12 + 's' })),
      trust: [
        {
          k: 'SGS',
          v: 'Rapports de contrôle qualité consultables sur chaque container livré',
        },
        {
          k: 'SIRET',
          v: '988 269 981 00011 — RCS Paris · Importation et douane incluses',
        },
        {
          k: '1 AN',
          v: "Garantie fabricant + SAV France sur l'ensemble du catalogue",
        },
        {
          k: '€ ENC.',
          v: 'Commissions et RFA versées sur CA encaissé — comptabilité saine, zéro mauvaise surprise',
        },
      ],
      profileOptions: [...this.profileDefs.map((p) => p.label), 'Autre'],
      statusOptions: [
        ...this.defs.map((x) => ({ v: x.id, l: x.code + ' · ' + x.name })),
        { v: 'conseil', l: 'Je ne sais pas encore — conseillez-moi' },
      ],
      formProfile: s.formProfile,
      setFormProfile: (e) => this.setState({ formProfile: e.target.value }),
      formStatus: s.formStatus,
      setFormStatus: (e) => this.setState({ formStatus: e.target.value }),
      submit: (e) => this.send(e, 'application'),
      submitLabel: s.sent
        ? 'Candidature envoyée — réponse sous 48 h ✓'
        : 'Envoyer ma candidature — réponse sous 48 h →',
      faq: [
        {
          q: 'Quand suis-je payé ?',
          a: "Les commissions apporteur et les RFA revendeur sont calculées et versées sur le chiffre d'affaires encaissé — jamais sur du « signé mais non payé ». Les commissions sont versées mensuellement, la RFA en janvier sur l'année écoulée.",
        },
        {
          q: 'Puis-je cumuler deux statuts ?',
          a: 'Un statut principal par SIRET. Le statut évolue avec vos volumes : beaucoup de partenaires démarrent apporteur, puis passent revendeur agréé quand la demande de leurs clients se confirme.',
        },
        {
          q: 'Pourquoi les tarifs revendeur ne sont-ils pas affichés ?',
          a: "Pour protéger votre marge. Nos grilles partenaires garantissent que le prix public direct reste toujours supérieur à votre prix d'achat — elles sont communiquées après validation du statut, sous conditions.",
        },
        {
          q: 'Qui gère le SAV et la garantie ?',
          a: "Terrassea, intégralement. Garantie 1 an, pièces et SAV traités en France. En statut apporteur, vous n'avez aucune obligation après la mise en relation.",
        },
      ].map((x, i) => ({
        ...x,
        expanded: s.open === i,
        sign: s.open === i ? '−' : '+',
        max: s.open === i ? '400px' : '0px',
        toggle: () => this.setState({ open: s.open === i ? -1 : i }),
      })),
      subscribe: (e) => this.send(e, 'newsletter'),
      subLabel: s.sub ? 'Merci, vous serez prévenu ✓' : "M'avertir",
      fabOp: s.fab ? 1 : 0,
      fabY: s.fab ? '0' : '20px',
      fabPe: s.fab ? 'auto' : 'none',
    }
  }
}
