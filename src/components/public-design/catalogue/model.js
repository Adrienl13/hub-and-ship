/* global document, window */
import { encodeCartSelection } from '../../../lib/catalogue/share-cart'
import {
  PUBLIC_DISCOUNT_FAMILIES,
  describeFamilyTiersWithLabel,
} from '../../../lib/pricing/discount-families'
import {
  buildVolumeScales,
  nextVolumeStep,
} from '../../../lib/pricing/volume-progress'
import {
  calculateOrderLines,
  describeVolumeDiscounts,
} from '../../../lib/order'

export class CatalogueModel {
  state = {
    fam: null,
    cat: null,
    col: null,
    stockOnly: false,
    intro: false,
    tick: 0,
    sort: 'pop',
    sheet: null,
    sheetVar: 0,
    sheetImg: 0,
    qty: 50,
    cart: [],
    cartOpen: false,
    delivery: 'terrasse',
  }
  P = 'https://terrassea.com/catalogue/'
  S =
    'https://mkfztwibolswqcggukeq.supabase.co/storage/v1/object/public/catalogue-images/products/'
  I = 'https://cdn.jsdelivr.net/npm/@phosphor-icons/core@2/assets/duotone/'
  url(p) {
    return !p
      ? ''
      : /^(https?:|\/)/.test(p)
        ? p
        : p.startsWith('S:')
          ? this.S + p.slice(2)
          : p.startsWith('uploads/')
            ? p
            : this.P + p
  }
  C = {
    noir: '#201e1d',
    blanc: '#f4f1ea',
    creme: '#e9dfc9',
    vert: '#2f6b4f',
    bleu: '#2f4f8f',
    bordeaux: '#7b2a35',
    sable: '#d8c3a0',
    terracotta: '#b9573d',
    naturel: '#c8a878',
    gris: '#9a9a96',
    ecru: '#efe8d8',
  }
  CN = {
    noir: 'Noir',
    blanc: 'Blanc',
    creme: 'Crème',
    vert: 'Vert',
    bleu: 'Bleu',
    bordeaux: 'Bordeaux',
    sable: 'Sable',
    terracotta: 'Terracotta',
    naturel: 'Naturel',
    gris: 'Gris',
    ecru: 'Écru',
  }
  families = [
    { name: 'Bistrot', key: 'Tressage', img: 'uploads/BIS-005-02.webp' },
    { name: 'Cordage', key: 'Cordage', img: 'uploads/ROP-003-02.webp' },
    {
      name: 'Textilène',
      key: 'Textilène',
      img: 'teslin-series/TES-001-01.webp',
    },
    {
      name: 'Tables & piètements',
      key: 'Tables',
      img: 'S:1788691404245-o0yi86.webp',
    },
  ]
  catList = ['Chaise', 'Fauteuil', 'Table', 'Banc', 'Salon & lounge']
  introByCat = {
    Chaise:
      'Chaises de bistrot tressées ou textilène léger : toutes en aluminium, empilables et conçues pour rester dehors. Chaque série est testée et contrôlée avant départ, puis facturée en France.',
    Fauteuil:
      'Fauteuils en cordage tressé main ou de bistrot avec accoudoirs, sur structure aluminium. Chaque série est testée et contrôlée avant départ, puis facturée en France.',
    Table:
      "Piètements en fonte d'aluminium et plateaux stratifiés ou effet marbre, combinables librement. Chaque série est testée et contrôlée avant départ, puis facturée en France.",
    Banc: 'Bancs et banquettes de bistrot pour les grandes tablées et les terrasses exposées. Chaque série est testée et contrôlée avant départ, puis facturée en France.',
    'Salon & lounge':
      'Fauteuils lounge et salons en cordage, coussins déhoussables, structure aluminium thermolaqué. Chaque série est testée et contrôlée avant départ, puis facturée en France.',
  }
  products = []
  designsOf(p) {
    return p.variants.map((v) => ({
      name: v[0],
      key: v[1],
      img: this.url(v[2] || p.img),
    }))
  }
  eur(n) {
    return Number.isFinite(n)
      ? n.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' €'
      : 'À confirmer'
  }
  scrollGrid() {
    const el = document.getElementById('grille')
    if (el)
      window.scrollTo({
        top: el.getBoundingClientRect().top + window.scrollY - 72,
        behavior: 'smooth',
      })
  }
  /**
   * `/panier?panier=…` portant la sélection courante. Les lignes dont
   * l'identifiant de design est synthétique (produit sans coloris en base)
   * partent quand même : /panier retombe sur le design par défaut.
   */
  quoteHref(cartRows) {
    const entries = cartRows
      .filter((row) => row.p.id && row.qty > 0)
      .map((row) => ({
        productId: row.p.id,
        variantId: row.p.variantIds?.[row.varIdx] || '',
        qty: row.qty,
      }))
    const encoded = encodeCartSelection(entries)
    return encoded ? '/panier?panier=' + encoded : '/panier'
  }

  renderVals() {
    const s = this.state,
      C = this.C
    this.tierBig = s.tick % 2 ? '−10 %' : '−6 %'
    let list = this.products.filter(
      (p) =>
        (!s.fam || p.material === s.fam) &&
        (!s.cat || p.cat === s.cat) &&
        (!s.col || p.variants.some((v) => v[1] === s.col)) &&
        (!s.stockOnly || p.stock),
    )
    if (s.sort === 'asc' || s.sort === 'desc')
      list = [...list].sort((a, b) => {
        if (!Number.isFinite(a.price)) return Number.isFinite(b.price) ? 1 : 0
        if (!Number.isFinite(b.price)) return -1
        return s.sort === 'asc' ? a.price - b.price : b.price - a.price
      })
    if (s.sort === 'new')
      list = [...list].sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0))
    const active = [s.fam, s.cat, s.col, s.stockOnly].filter(Boolean).length
    const inCart = (ref) =>
      s.cart.filter((c) => c.ref === ref).reduce((n, c) => n + c.qty, 0)
    const cartRows = s.cart
      .map((c) => {
        const p = this.products.find((x) => x.ref === c.ref)
        return p ? { ...c, p } : null
      })
      .filter(Boolean)
    const pieces = cartRows.reduce((n, r) => n + r.qty, 0)
    // MÊME moteur que /panier et que le devis : paliers par famille, remise
    // ligne par ligne, somme stricte. Recopier la règle ici donnait un total
    // différent de celui que l'acheteur voyait à l'étape suivante.
    const totals = calculateOrderLines(
      cartRows.map((r) => ({
        basePriceHt: Number.isFinite(r.p.price) ? r.p.price : 0,
        ecoContribution: 0,
        retailPriceRef: 0,
        category: r.p.category,
        quantity: r.qty,
      })),
      { channel: 'direct' },
    )
    const subtotal = totals.subtotalHt
    const discount = totals.volumeDiscountAmount
    const familleLignes = cartRows.map((r) => ({
      category: r.p.category,
      quantity: r.qty,
    }))
    const nextStep = nextVolumeStep(familleLignes)
    // Une jauge PAR FAMILLE : les paliers diffèrent d'une famille à l'autre,
    // une barre unique ne peut pas les décrire toutes. Voir buildVolumeScales().
    const scales = buildVolumeScales(familleLignes)
    const discountRows = describeVolumeDiscounts(totals)
    const sheetP = s.sheet ? this.products.find((p) => p.ref === s.sheet) : null
    const famOf = (m) =>
      (this.families.find((f) => f.key === m) || {}).name || m
    return {
      introLead:
        (s.cat ? this.introByCat[s.cat] : null) ||
        'Terrassea importe en direct usine du mobilier conçu pour un usage professionnel intensif. Chaque série est testée et contrôlée avant départ, puis livrée et facturée en France.',
      introExpanded: s.intro,
      stockSelected: s.stockOnly,
      introMax: s.intro ? 'none' : '0px',
      introLabel: s.intro
        ? 'Réduire ↑'
        : 'En savoir plus sur notre fonctionnement…',
      toggleIntro: () => this.setState({ intro: !s.intro }),
      included: [
        {
          icon: this.I + 'seal-check-duotone.svg',
          kicker: 'Inclus',
          big: '100 %',
          title: 'Contrôle SGS avant départ',
          sub: "Rapport indépendant, photos à l'appui",
          bg: 'var(--color-accent-100)',
          fg: 'var(--color-accent-900)',
          iconFilter: 'none',
        },
        {
          icon: this.I + 'shield-check-duotone.svg',
          kicker: 'Inclus',
          big: '1 an',
          title: 'Garantie + SAV France',
          sub: 'Un interlocuteur à Paris',
          bg: 'var(--color-neutral-200)',
          fg: 'var(--color-text)',
          iconFilter: 'none',
        },
        {
          icon: this.I + 'percent-duotone.svg',
          kicker: 'Sur votre projet',
          big: this.tierBig,
          title: 'Remise automatique',
          sub: 'Paliers propres à chaque famille : assises, tables, salons',
          bg: 'var(--color-accent-700)',
          fg: 'var(--color-bg)',
          iconFilter: 'brightness(0) invert(1)',
        },
      ].map((x, i) => ({ ...x, delay: i * 0.12 + 's' })),
      // Les paliers dépendent de la famille : une chaise et un salon ne
      // déclenchent pas le volume au même seuil. Les chiffres viennent de
      // PUBLISHED_VOLUME_TIERS, verrouillé sur la grille en base.
      tiersInline: PUBLIC_DISCOUNT_FAMILIES.map(
        describeFamilyTiersWithLabel,
      ).join(' ; '),
      cats: [
        { label: 'Tout', v: null },
        ...this.catList.map((c) => ({ label: c, v: c })),
      ].map((c) => {
        const on = s.cat === c.v
        return {
          label: c.label,
          selected: on,
          border: on ? 'var(--color-text)' : 'var(--color-neutral-300)',
          bg: on ? 'var(--color-text)' : 'transparent',
          color: on ? 'var(--color-bg)' : 'var(--color-text)',
          pick: () => this.setState({ cat: c.v }),
        }
      }),
      toggleStock: () => this.setState({ stockOnly: !s.stockOnly }),
      stockBg: s.stockOnly
        ? 'var(--color-accent-700)'
        : 'var(--color-accent-100)',
      stockColor: s.stockOnly ? 'var(--color-bg)' : 'var(--color-accent-800)',
      sort: s.sort,
      setSort: (e) => this.setState({ sort: e.target.value }),
      countLabel: list.length + ' modèle' + (list.length > 1 ? 's' : ''),
      clearFilters: () =>
        this.setState({ fam: null, cat: null, col: null, stockOnly: false }),
      clearOp: active ? 1 : 0,
      items: list.map((p, i) => {
        const n = inCart(p.ref)
        const di = (s.cardVar || {})[p.ref] || 0
        const designs = this.designsOf(p)
        return {
          ...p,
          moq: this.minimum(p, di),
          blocked: !this.minimum(p, di),
          img: designs[di].img,
          designName: designs[di].name,
          designCount: designs.length > 1 ? designs.length + ' designs' : '',
          inStock: this.isStocked(p, di),
          hasMore: designs.length > 4,
          moreLabel: '+' + (designs.length - 3),
          designs: (designs.length > 4
            ? [designs[di], ...designs.filter((_, k) => k !== di)]
                .slice(0, 3)
                .map((d) => ({ ...d, k: designs.indexOf(d) }))
            : designs.map((d, k) => ({ ...d, k }))
          ).map((d) => ({
            ...d,
            selected: d.k === di,
            border:
              d.k === di ? 'var(--color-text)' : 'var(--color-neutral-300)',
            pick: (e) => {
              e.stopPropagation()
              this.setState((st) => ({
                cardVar: { ...(st.cardVar || {}), [p.ref]: d.k },
              }))
            },
          })),
          amb: p.gallery[0] ? this.url(p.gallery[0]) : '',
          hasAmb: !!p.gallery[0],
          priceLabel: this.eur(p.price),
          colors: p.variants.map((v) => C[v[1]]),
          delay: (i % 4) * 0.08 + 's',
          open: () =>
            this.setState({
              sheet: p.ref,
              sheetVar: di,
              sheetImg: 0,
              qty: this.minimum(p, di),
            }),
          add: () => this.addToCart(p, di, this.minimum(p, di)),
          notInCart: !n,
          inCartFlag: n > 0,
          qtyLabel: n + ' pcs',
          inc: () => this.addToCart(p, di, 10),
          dec: () => {
            const rows = s.cart.filter((c) => c.ref === p.ref)
            const last = rows[rows.length - 1]
            if (!last) return
            if (last.qty - 10 < this.minimum(p, last.varIdx))
              this.saveCart(s.cart.filter((c) => c.key !== last.key))
            else
              this.saveCart(
                s.cart.map((c) =>
                  c.key === last.key ? { ...c, qty: c.qty - 10 } : c,
                ),
              )
          },
        }
      }),
      empty: list.length === 0,
      sheetOpen: !!sheetP,
      closeSheet: () => this.setState({ sheet: null }),
      stop: (e) => e.stopPropagation(),
      sheet: sheetP
        ? (() => {
            const vi = Math.min(s.sheetVar, sheetP.variants.length - 1)
            const selectedGallery = sheetP.variantGalleries?.[vi]?.length
              ? sheetP.variantGalleries[vi]
              : sheetP.gallery
            const imgs = [
              { src: this.url(sheetP.img), amb: false },
              ...selectedGallery.map((g) => ({ src: this.url(g), amb: true })),
            ]
            const designs = this.designsOf(sheetP)
            imgs[0] = { src: designs[vi].img, amb: false }
            const ii = Math.min(s.sheetImg, imgs.length - 1)
            return {
              ...sheetP,
              moq: this.minimum(sheetP, vi),
              blocked: !this.minimum(sheetP, vi),
              inStock: this.isStocked(sheetP, vi),
              family: famOf(sheetP.material),
              img: imgs[ii].src,
              fit: imgs[ii].amb ? 'cover' : 'contain',
              pad: imgs[ii].amb ? '0' : '32px',
              priceLabel: this.eur(sheetP.price),
              variantName: sheetP.variants[vi][0],
              gallery: imgs.slice(0, 5).map((im, i) => ({
                label: 'Vue ' + (i + 1),
                img: im.src,
                fit: im.amb ? 'cover' : 'contain',
                pad: im.amb ? '0' : '8px',
                border: i === ii ? 'var(--color-text)' : 'transparent',
                pick: () => this.setState({ sheetImg: i }),
              })),
              variants: designs.map((d, i) => ({
                name: d.name,
                img: d.img,
                border: i === vi ? 'var(--color-text)' : 'transparent',
                text:
                  i === vi
                    ? 'var(--color-text)'
                    : 'color-mix(in srgb,var(--color-text) 60%,transparent)',
                pick: () =>
                  this.setState({
                    sheetVar: i,
                    sheetImg: 0,
                    qty: this.minimum(sheetP, i),
                  }),
              })),
              add: () => {
                this.addToCart(
                  sheetP,
                  vi,
                  this.sheetQuantity(sheetP, vi, s.qty),
                )
                this.setState({ sheet: null, cartOpen: true })
              },
              addLabel:
                'Ajouter ' +
                this.sheetQuantity(sheetP, vi, s.qty) +
                ' pièces à mon projet',
            }
          })()
        : { gallery: [], variants: [] },
      sheetQty: s.qty,
      setQty: (e) => this.setState({ qty: +e.target.value }),
      handoff: () => this.prepareHandoff(),
      // Passage de relais vers le tunnel React : la sélection part encodée
      // dans l'URL, /panier la rejoue et affiche le devis. Sans ce lien, un
      // acheteur qui compose ici n'atteint jamais son devis — les deux
      // paniers ne partagent aucun stockage.
      quoteHref: this.quoteHref(cartRows),
      quoteHandoff: () => this.prepareHandoff(),
      cartCount: pieces ? String(pieces) : '0',
      openCart: () => this.setState({ cartOpen: true }),
      closeCart: () => this.setState({ cartOpen: false }),
      cartOpen: s.cartOpen,
      drawerX: s.cartOpen ? '0' : '100%',
      cartTitle: cartRows.length
        ? new Set(cartRows.map((r) => r.ref)).size +
          ' modèle' +
          (new Set(cartRows.map((r) => r.ref)).size > 1 ? 's' : '') +
          ' sélectionné' +
          (new Set(cartRows.map((r) => r.ref)).size > 1 ? 's' : '')
        : 'Votre sélection est vide',
      cartEmpty: cartRows.length === 0,
      cartHas: cartRows.length > 0,
      cart: cartRows.map((r) => ({
        name: r.p.name,
        img: this.designsOf(r.p)[r.varIdx].img,
        variantName:
          r.p.variants[Math.min(r.varIdx, r.p.variants.length - 1)][0],
        priceLabel: this.eur(r.p.price),
        qty: r.qty,
        lineTotal: Number.isFinite(r.p.price)
          ? this.eur(r.qty * r.p.price)
          : 'À confirmer',
        inc: () =>
          this.saveCart(
            s.cart.map((c) =>
              c.key === r.key ? { ...c, qty: c.qty + 10 } : c,
            ),
          ),
        dec: () =>
          this.saveCart(
            s.cart.map((c) =>
              c.key === r.key
                ? {
                    ...c,
                    qty: Math.max(this.minimum(r.p, r.varIdx), c.qty - 10),
                  }
                : c,
            ),
          ),
        remove: () => this.saveCart(s.cart.filter((c) => c.key !== r.key)),
      })),
      cartPieces: pieces,
      // La jauge suit la famille la plus proche de son palier suivant : c'est
      // le seul conseil actionnable.
      tierScales: scales,
      tierRate:
        discountRows.length === 1
          ? discountRows[0].label.replace('Remise volume ', '')
          : discount > 0
            ? '−' + this.eur(discount)
            : '',
      hasDiscount: discount > 0,
      // Plus de « Tarif dès 50 pièces » : 50 était le MOQ des assises, pas un
      // palier, et il ne voulait rien dire pour les tables ni les salons.
      tierLabel:
        discountRows.length === 0
          ? 'Tarif de base'
          : discountRows.length === 1
            ? discountRows[0].label + ' appliquée'
            : 'Remises volume appliquées',
      tierHint: nextStep
        ? nextStep.label
        : discount > 0
          ? 'Vous bénéficiez du meilleur tarif volume sur ce panier.'
          : 'Les paliers dépendent de la famille : ' +
            PUBLIC_DISCOUNT_FAMILIES.map(describeFamilyTiersWithLabel).join(
              ' ; ',
            ) +
            '.',
      deliveries: [
        {
          k: 'terrasse',
          title: "Livraison jusqu'à votre terrasse",
          price: 'tarif sous 24 h',
          sub: 'Transport organisé par Terrassea, confirmé selon votre ville.',
        },
        {
          k: 'depot',
          title: 'Enlèvement au dépôt',
          price: 'gratuit',
          sub: 'Fos-sur-Mer. Votre transporteur habituel y est le bienvenu.',
        },
      ].map((d) => {
        const on = s.delivery === d.k
        return {
          ...d,
          selected: on,
          border: on ? 'var(--color-text)' : 'var(--color-neutral-300)',
          bg: on ? '#fff' : 'transparent',
          pick: () => this.setState({ delivery: d.k }),
        }
      }),
      deliveryNote:
        s.delivery === 'depot'
          ? 'Enlèvement au dépôt sans frais.'
          : 'Livraison finale chiffrée après rappel.',
      cartSubtotal: this.totalLabel(cartRows, subtotal),
      cartDiscount: this.totalLabel(cartRows, discount),
      cartTotal: this.totalLabel(cartRows, totals.totalHt),
    }
  }
}
