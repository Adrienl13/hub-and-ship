export class PriceModel {
  state = { step: 0, focus: null, tier: 0, open: 0, sub: false }
  I = 'https://cdn.jsdelivr.net/npm/@phosphor-icons/core@2/assets/duotone/'
  segDefs = {
    usine: {
      name: 'Usine',
      icon: 'factory-duotone.svg',
      desc: 'Le point de départ est identique : la même chaise, la même usine. Seul le chemin change.',
    },
    importateur: {
      name: 'Importateur',
      icon: 'boat-duotone.svg',
      desc: 'Achète en volume et revend au grossiste. Première marge empilée sur le prix usine.',
    },
    grossiste: {
      name: 'Grossiste',
      icon: 'warehouse-duotone.svg',
      desc: 'Stocke et redistribue aux réseaux de distribution. Deuxième marge.',
    },
    distributeur: {
      name: 'Distributeur',
      icon: 'truck-duotone.svg',
      desc: 'Commercialise auprès des showrooms et revendeurs. Troisième marge.',
    },
    showroom: {
      name: 'Showroom',
      icon: 'storefront-duotone.svg',
      desc: "Salle d'exposition, stocks, équipe de vente : la quatrième marge, la plus lourde.",
    },
    terrassea: {
      name: 'Terrassea',
      icon: 'hand-coins-duotone.svg',
      desc: 'Importateur officiel : fret partagé, douane, contrôle SGS, SAV France et garantie 1 an. Une seule marge, la nôtre.',
    },
    vous: {
      name: 'Vous',
      icon: 'umbrella-duotone.svg',
      desc: "La chaise arrive sur votre terrasse. Dans un cas après quatre marges, dans l'autre après une seule.",
    },
  }
  routeA = [
    'usine',
    'importateur',
    'grossiste',
    'distributeur',
    'showroom',
    'vous',
  ]
  routeB = ['usine', 'terrassea', 'vous']
  renderVals() {
    const s = this.state
    // Paliers de remise : une seule source pour le simulateur et pour la FAQ,
    // qui annonçaient auparavant les mêmes chiffres en double.
    const qty = [50, 100, 150],
      rates = [0, 0.06, 0.1],
      t = s.tier,
      step = s.step
    const pct = (r) => Math.round(r * 100) + ' %'
    const eur = (n) => {
      if (!Number.isFinite(n)) return 'À confirmer'
      const v = Math.round(n * 100) / 100
      return (
        v.toLocaleString('fr-FR', {
          minimumFractionDigits: Number.isInteger(v) ? 0 : 2,
          maximumFractionDigits: 2,
        }) + ' €'
      )
    }
    const mkRoute = (keys, accent, label, note, foot) => {
      const N = keys.length - 1,
        cur = Math.min(step, N),
        light = accent ? 'var(--color-accent-100)' : 'var(--color-neutral-200)',
        strong = accent ? 'var(--color-accent-700)' : 'var(--color-neutral-800)'
      return {
        label,
        note,
        foot,
        labelColor: accent
          ? '#8f6f33'
          : 'color-mix(in srgb,var(--color-text) 60%,transparent)',
        lineColor: strong,
        progress: (cur / N).toFixed(3),
        nodes: keys.map((k, i) => {
          const on = i <= cur,
            act = s.focus ? s.focus === k : accent ? i === cur : i === cur
          return {
            name: this.segDefs[k].name,
            icon: this.I + this.segDefs[k].icon,
            bg: on ? strong : light,
            filter: on ? 'brightness(0) invert(1)' : 'none',
            ring: act
              ? '0 0 0 3px var(--color-bg),0 0 0 5px var(--color-text)'
              : 'none',
            textColor: on
              ? 'var(--color-text)'
              : 'color-mix(in srgb,var(--color-text) 55%,transparent)',
            weight: act ? 600 : 400,
            pick: () => {
              this.pauseUntil = Date.now() + 8000
              this.setState({ step: i, focus: k })
            },
          }
        }),
      }
    }
    const focusKey = s.focus || this.routeA[Math.min(step, 5)]
    // Échéancier contractuel réellement appliqué (devis PDF, panier, moteur de
    // réservation) : frais 3 %, acompte 27 % au seuil, solde avant expédition.
    const pays = [
      {
        pct: '3 %',
        w: '3%',
        title: 'À la réservation',
        sub: 'Des frais modestes qui retiennent votre quantité, déduits du total.',
        bg: 'var(--color-text)',
        numColor: 'var(--color-text)',
      },
      {
        pct: '27 %',
        w: '27%',
        title: 'Au seuil de 80 %',
        sub: 'La production démarre — vous êtes prévenu 48 h avant.',
        bg: 'var(--color-accent-300)',
        numColor: 'var(--color-text)',
      },
      {
        pct: '70 %',
        w: '70%',
        title: 'Le solde, avant expédition',
        sub: 'Une fois le contrôle SGS validé en usine, avant le départ du container.',
        bg: 'var(--color-accent-700)',
        numColor: 'var(--color-accent-700)',
      },
    ]
    return {
      productImage: this.product?.img || '',
      productName: this.product?.name || 'Photo indisponible',
      productHref: this.product
        ? '/catalogue/#produit-' + encodeURIComponent(this.product.ref)
        : '/catalogue/',
      routes: [
        mkRoute(this.routeA, false, 'Circuit showroom', '4 intermédiaires', ''),
        mkRoute(
          this.routeB,
          true,
          'Terrassea',
          '1 intermédiaire',
          'Fret, douane et contrôle SGS existent dans les deux circuits. Chez Terrassea ils sont inclus dans notre unique marge.',
        ),
      ],
      focus: {
        name: this.segDefs[focusKey].name,
        desc: this.segDefs[focusKey].desc,
        icon: this.I + this.segDefs[focusKey].icon,
        bg:
          focusKey === 'terrassea'
            ? 'var(--color-accent-700)'
            : 'var(--color-neutral-800)',
      },
      bricks: [
        {
          title: 'Achat direct usine',
          body: "Prix FOB négocié sans agent ni bureau d'achat. Les mêmes usines que les grandes marques européennes.",
          icon: 'factory-duotone.svg',
        },
        {
          title: 'Fret mutualisé',
          body: 'Le container est réparti au prorata du volume. Plus il se remplit, plus la part par chaise baisse.',
          icon: 'boat-duotone.svg',
        },
        {
          title: 'Douane & conformité',
          body: "Dédouanement, taxes et normes UE (feu, fiches techniques) traités par l'importateur officiel.",
          icon: 'stamp-duotone.svg',
        },
        {
          title: 'Contrôle SGS',
          body: 'Inspection indépendante avant départ, rapport consultable. Inclus dans le prix, jamais en option.',
          icon: 'seal-check-duotone.svg',
        },
        {
          title: 'Une seule marge',
          body: 'Sourcing, logistique, SAV France et garantie 1 an. Pas de grossiste, pas de showroom à financer.',
          icon: 'hand-coins-duotone.svg',
        },
      ].map((b, i) => {
        const tones = [
          {
            bg: 'var(--color-neutral-200)',
            fg: 'var(--color-text)',
            iconBg: '#fff',
            f: 'none',
          },
          {
            bg: 'var(--color-accent-100)',
            fg: 'var(--color-accent-900)',
            iconBg: '#fff',
            f: 'none',
          },
          {
            bg: 'var(--color-accent-200)',
            fg: 'var(--color-accent-900)',
            iconBg: '#fff',
            f: 'none',
          },
          {
            bg: 'var(--color-accent-700)',
            fg: 'var(--color-bg)',
            iconBg: 'color-mix(in srgb,#fff 18%,transparent)',
            f: 'brightness(0) invert(1)',
          },
          {
            bg: 'var(--color-text)',
            fg: 'var(--color-bg)',
            iconBg: 'color-mix(in srgb,#fff 14%,transparent)',
            f: 'brightness(0) invert(1)',
          },
        ][i]
        return {
          ...b,
          num: '0' + (i + 1),
          icon: this.I + b.icon,
          bg: tones.bg,
          fg: tones.fg,
          iconBg: tones.iconBg,
          iconFilter: tones.f,
          delay: i * 0.1 + 's',
        }
      }),
      tiers: qty.map((q, i) => ({
        selected: i === t,
        label: q + ' pièces',
        border: i === t ? 'var(--color-text)' : 'var(--color-neutral-300)',
        bg: i === t ? 'var(--color-text)' : 'transparent',
        color: i === t ? 'var(--color-bg)' : 'var(--color-text)',
        pick: () => this.setState({ tier: i }),
      })),
      tier: (() => {
        const base = this.price,
          rate = rates[t],
          unit = Number.isFinite(base)
            ? Math.round((Math.round(base * 100) * (100 - rate * 100)) / 100) /
              100
            : null,
          q = qty[t]
        return {
          unit: eur(unit),
          base: t ? eur(base) : '',
          baseDeco: 'line-through',
          qtyLabel: q + ' chaises Quiberon',
          note: [
            'Tous les coûts inclus sauf la livraison finale. La remise se déclenche dès 100 pièces.',
            '−6 % appliqués automatiquement sur chaque chaise du projet.',
            '−10 %, le meilleur tarif volume, sur chaque chaise du projet.',
          ][t],
          pct: [33.3, 66.6, 100][t] + '%',
          badge: ['Tarif de base', 'Remise −6 %', 'Remise −10 %'][t],
          badgeBg: t ? 'var(--color-accent-700)' : 'var(--color-neutral-200)',
          badgeColor: t ? 'var(--color-bg)' : 'var(--color-text)',
          numColor: t ? 'var(--color-accent-700)' : 'var(--color-text)',
        }
      })(),
      pays,
      videos: [
        {
          src: this.settings.video1 || '',
          tag: 'Usine',
          title: 'Chargement du container',
          sub: 'Filmé le jour du départ, en usine.',
          delay: '0s',
        },
        {
          src: this.settings.video2 || '',
          tag: 'Dépôt',
          title: 'Réception à Fos-sur-Mer',
          sub: 'Ouverture des portes et contrôle des cartons.',
          delay: '.15s',
        },
      ].map((v) => ({ ...v, has: !!v.src, empty: !v.src })),
      trip: [
        {
          title: 'Usine & contrôle SGS',
          body: "Inspection indépendante avant chargement, rapport à l'appui.",
        },
        {
          title: 'Chargement',
          body: 'Empotage optimisé, scellé douanier, photos du manifeste.',
        },
        {
          title: 'Arrivée au port',
          body: 'Dédouanement par nos soins — importateur officiel enregistré.',
        },
        {
          title: 'Votre terrasse',
          body: 'Livraison organisée par nos soins ou enlèvement en zone de stockage — le mobilier entre en service.',
        },
      ].map((x, i) => ({ ...x, num: i + 1 + '/4', delay: i * 0.1 + 's' })),
      faq: [
        {
          q: 'Pourquoi le mobilier CHR coûte-t-il 2 à 3 fois plus cher en showroom ?',
          a: "Parce que chaque intermédiaire ajoute sa marge : le prix usine est multiplié par 2,5 à 3 avant d'arriver en showroom.",
          points: [
            "Circuit classique : usine → importateur → grossiste → distributeur → showroom. 4 marges empilées, plus le coût des stocks et des salles d'exposition.",
            'Notre circuit : usine → vous. Une seule marge, qui couvre fret, douane, contrôle SGS et SAV.',
            'Vérifiable : chaque fiche produit affiche le prix public conseillé en référence, à côté du nôtre.',
          ],
        },
        {
          q: 'Quelles remises de volume sont appliquées ?',
          a: "La remise est automatique et s'applique à chaque pièce du projet, selon le nombre total de pièces commandées, tous produits confondus.",
          points: [
            `En dessous de ${qty[1]} pièces : tarif de base, tous les coûts inclus sauf la livraison finale.`,
            `À partir de ${qty[1]} pièces : −${pct(rates[1])} sur chaque pièce du projet.`,
            `À partir de ${qty[2]} pièces : −${pct(rates[2])}, notre meilleur tarif volume.`,
          ],
        },
        {
          q: "Comment se passe le paiement d'une commande par container ?",
          a: "Le paiement suit l'avancement réel du container, en trois étapes : vous n'avancez jamais une grosse somme dans le vide.",
          points: [
            `${pays[0].pct} à la réservation (minimum 150 €, maximum 500 €) : ces frais retiennent votre place et votre quantité. Ils ne sont pas remboursables, sauf si Terrassea annule le container.`,
            `${pays[1].pct} au seuil de 80 % de remplissage : la production est lancée, vous êtes prévenu 48 h à l'avance.`,
            `${pays[2].pct} avant expédition : le solde est réglé une fois la production terminée et le contrôle SGS validé en usine, quand la marchandise est prête à charger.`,
          ],
        },
        {
          q: "Pourquoi ne pas acheter directement à l'usine moi-même ?",
          a: "Rien ne l'interdit, mais l'achat en solo suppose de réunir seul les minimums de production, d'avancer la totalité de la marchandise et de porter l'import de bout en bout.",
          points: [
            'Le container est partagé entre plusieurs professionnels : vous atteignez les minimums de production sans commander un container entier.',
            "Nous sommes l'importateur officiel : déclaration d'importation, dédouanement, TVA autoliquidée et conformité réglementaire sont pris en charge, et vous recevez une facture française.",
            "Contrôle SGS indépendant avant chargement, garantie 1 an et SAV en France : en cas de problème, votre interlocuteur est en France, pas à l'autre bout du monde.",
          ],
        },
        {
          q: 'Le prix affiché inclut-il le transport et la douane ?',
          a: "Oui : le prix comprend la marchandise, l'importation, la douane et l'acheminement jusqu'à notre zone de stockage de Fos-sur-Mer. Seule la livraison finale reste en option.",
          points: [
            "Inclus : fret maritime, dédouanement, TVA à l'import autoliquidée, contrôle SGS, garantie 1 an, SAV France et éco-participation.",
            "En option : la livraison jusqu'à votre établissement, dont le tarif vous est confirmé sous 24 h selon votre ville — il ne s'ajoute qu'après votre accord.",
            'Vous pouvez aussi enlever gratuitement la marchandise en zone de stockage, ou y envoyer votre propre transporteur.',
          ],
        },
      ].map((x, i) => ({
        ...x,
        expanded: s.open === i,
        sign: s.open === i ? '−' : '+',
        max: s.open === i ? '600px' : '0px',
        toggle: () => this.setState({ open: s.open === i ? -1 : i }),
      })),
      subscribe: (e) => this.subscribe(e),
      subLabel: s.sub ? 'Merci, vous serez prévenu ✓' : 'Prévenez-moi',
      formStatus: this.formStatus || '',
    }
  }
}
