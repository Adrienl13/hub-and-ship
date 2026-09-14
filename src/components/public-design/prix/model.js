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
    const qty = [50, 100, 150],
      t = s.tier,
      step = s.step
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
          rate = [0, 0.06, 0.1][t],
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
      pays: [
        {
          pct: '3 %',
          w: '3%',
          title: 'À la réservation',
          sub: 'Un acompte modeste, déduit du total.',
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
          pct: '40 %',
          w: '40%',
          title: 'Avant expédition',
          sub: 'Après validation du contrôle SGS en usine.',
          bg: 'var(--color-accent-700)',
          numColor: 'var(--color-accent-700)',
        },
        {
          pct: '30 %',
          w: '30%',
          title: 'À la livraison sur votre terrasse',
          sub: 'Le solde, une fois le mobilier réceptionné chez vous.',
          bg: '#b8924a',
          numColor: '#8f6f33',
        },
      ],
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
          a: '[Réponse à reprendre du site actuel]',
          points: [],
        },
        {
          q: "Comment se passe le paiement d'une commande par container ?",
          a: '[Réponse à reprendre du site actuel]',
          points: [],
        },
        {
          q: "Pourquoi ne pas acheter directement à l'usine moi-même ?",
          a: '[Réponse à reprendre du site actuel]',
          points: [],
        },
        {
          q: 'Le prix affiché inclut-il le transport et la douane ?',
          a: '[Réponse à reprendre du site actuel]',
          points: [],
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
