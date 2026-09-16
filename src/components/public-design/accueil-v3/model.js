import { config } from './config.js'

// Onglets « Le mobilier » → catégories du catalogue public (adaptCatalogue).
const HOME_TAB_CATEGORIES = {
  Chaises: ['Chaise'],
  Fauteuils: ['Fauteuil'],
  Tables: ['Table'],
  Lounge: ['Salon & lounge', 'Banc'],
}
const HOME_CARDS_PER_TAB = 4
// Sélection éditoriale par onglet (références SKU, dans l'ordre d'affichage).
// Un onglet sans liste, ou une liste incomplète, est complété dans l'ordre du
// catalogue ; une référence absente du catalogue public est ignorée.
export const HOME_PICKS = {
  Chaises: ['SKU-659', 'BIS-045', 'BIS-003', 'SKU-569'],
  Fauteuils: ['BIS-061', 'BIS-012', 'ROP-049', 'ROP-007'],
  // Le catalogue n'a pas de catégorie « table » : l'onglet regroupe
  // piètements et plateaux sous ce mot, volontairement.
  Tables: ['TBA-001', 'TBA-005', 'SKU-801', 'SKU-566'],
}

const isCityToken = (token) =>
  token.length >= 2 && /^[A-ZÀ-Ý0-9][A-ZÀ-Ý0-9'-]*$/u.test(token)
const capitalize = (word) =>
  word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()

/**
 * « Chaise de bistrot ODEON » → { title: 'Odeon', kind: 'chaise de bistrot' } ;
 * « Salon de terrasse cordage PORTO-VECCHIO » → { title: 'Porto-Vecchio',
 * kind: 'salon de terrasse cordage' }. Sans nom de modèle en capitales, le
 * nom court reste le titre et `fallbackKind` (catégorie) sert de sous-titre.
 */
export function splitDisplayName(shortName, fallbackKind = '') {
  const tokens = shortName.trim().split(/\s+/)
  let split = tokens.length
  while (split > 1 && isCityToken(tokens[split - 1])) split -= 1
  if (split === tokens.length || split === 0) {
    return { title: shortName.trim(), kind: fallbackKind.toLowerCase() }
  }
  const title = tokens
    .slice(split)
    .map((token) => token.split('-').map(capitalize).join('-'))
    .join(' ')
  const kind = tokens.slice(0, split).join(' ')
  return { title, kind: kind.charAt(0).toLowerCase() + kind.slice(1) }
}

/** Cartes « Le mobilier » pour un onglet, depuis les produits réels. */
export function liveHomeCards(products, tab, picks = HOME_PICKS) {
  const cats = HOME_TAB_CATEGORIES[tab] || []
  const eligible = products.filter((p) => cats.includes(p.cat) && p.img)
  const picked = (picks[tab] || [])
    .map((ref) => eligible.find((p) => p.ref === ref))
    .filter(Boolean)
  return [...picked, ...eligible.filter((p) => !picked.includes(p))]
    .slice(0, HOME_CARDS_PER_TAB)
    .map((p) => {
      const { title, kind } = splitDisplayName(p.shortName || p.name, p.kind)
      return {
        name: title,
        kind,
        img: p.img,
        href: '/catalogue#produit-' + encodeURIComponent(p.ref),
      }
    })
}

/**
 * « Quelques directions déjà composées » : chaque carte dont le nom est une
 * référence du catalogue public reçoit la photo, le nom court et le lien de
 * la fiche. Une carte déjà pourvue d'une photo est conservée telle quelle ;
 * une référence introuvable sans photo est retirée (pas de carte vide).
 */
export function liveBandCards(bandDefs, products) {
  return bandDefs
    .map((b) => {
      const product = products.find((p) => p.ref === b.name && p.img)
      if (product) {
        return {
          ...b,
          name: product.shortName || product.name,
          img: product.img,
          href: '/catalogue#produit-' + encodeURIComponent(product.ref),
        }
      }
      return b.img ? b : null
    })
    .filter(Boolean)
}

export class Accueil {
  config = config

  state = {
    cat: 'Chaises',
    shown: 0,
    tiles: null,
    split: 50,
    tex: 0,
    ship: 0,
    swap: 0,
    kind: 'Restaurant',
    sent: false,
    sub: false,
    fab: false,
    needs: ['Chaises'],
    flow: 0,
  }
  P = '/catalogue/'
  S =
    'https://mkfztwibolswqcggukeq.supabase.co/storage/v1/object/public/catalogue-images/products/'
  famDefs = [
    {
      name: 'Bistrot',
      cat: 'Chaises',
      pool: [
        ['Deauville', 'bistro-seating-clean/BIS-027-01.webp'],
        ['Rivoli', 'bistro-seating-clean/BIS-001-01.webp'],
        ['Bastille', 'bistro-seating-clean/BIS-004-01.webp'],
        ['Monceau', 'bistro-seating-clean/BIS-002-01.webp'],
        ['Tuileries', 'bistro-seating-clean/BIS-005-01.webp'],
        ['Ibiza', 'bistro-seating-clean/BIS-045-01.webp'],
        ['Opéra', 'bistro-seating-clean/BIS-003-01.webp'],
        ['Antibes', 'bistro-seating-clean/BIS-023-01.webp'],
        ['Biarritz', 'bistro-seating-clean/BIS-026-01.webp'],
        ['Ravenna', 'bistro-seating-clean/BIS-039-01.webp'],
        ['Toledo', 'bistro-seating-clean/BIS-048-01.webp'],
        ['Santorin', 'bistro-seating-clean/BIS-057-01.webp'],
      ],
    },
    {
      name: 'Textilène',
      cat: 'Tables',
      pool: [
        ['Paros', 'teslin-series/TES-012-01.webp'],
        ['Camargue', 'teslin-series/TES-029-01.webp'],
        ['Rivage', 'teslin-series/TES-024-01.webp'],
        ['Opale', 'teslin-series/TES-038-01.webp'],
        ['Rhodes', 'teslin-series/TES-019-01.webp'],
        ['Medina', 'teslin-series/TES-022-01.webp'],
        ['Azur', 'teslin-series/TES-026-01.webp'],
        ['Monceau', 'teslin-series/TES-042-01.webp'],
        ['Opéra haute', 'teslin-series/TES-043-01.webp'],
        ['Bastille', 'teslin-series/TES-044-01.webp'],
        ['Teslin', 'teslin-series/TES-001-01.webp'],
      ],
    },
    {
      name: 'Cordage',
      cat: 'Fauteuils',
      pool: [
        ['Bonifacio', 'S:rop050-01.webp'],
        ['Palma', 'rope-series/ROP-024-01.webp'],
        ['Hydra', 'rope-series/ROP-034-01.webp'],
        ['Milos', 'rope-series/ROP-038-01.webp'],
        ['Medina', 'rope-series/ROP-042-01.webp'],
        ['Oasis', 'rope-series/ROP-043-01.webp'],
        ['Menton', 'bistro-seating-clean/BIS-024-01.webp'],
        ['Cassis', 'bistro-seating-clean/BIS-025-01.webp'],
      ],
    },
    {
      name: 'Lounge',
      cat: 'Lounge',
      pool: [
        ['Chaise basse', 'S:1785234022740-w6z9yk.jpg'],
        ['Cordage', 'rope-series/ROP-013-01.webp'],
        ['Cordage II', 'rope-series/ROP-013-02.webp'],
        ['Cannes', 'S:1780580641255-1cgxqd.jpg'],
        ['Trouville', 'S:1788678592117-74dhhi.webp'],
        ['Hossegor', 'S:1788679055174-vm61m9.webp'],
        ['Cabourg', 'S:1788680615546-w5le3n.webp'],
        ['Saint-Malo', 'S:1788682226368-ktm7zu.webp'],
      ],
    },
  ]
  url(p) {
    return !p
      ? ''
      : /^(https?:|\/)/.test(p)
        ? p
        : p.startsWith('S:')
          ? this.S + p.slice(2)
          : this.P + p
  }
  // Produits réels du catalogue (adaptCatalogue), injectés après chargement
  // par start.js ; tant qu'ils sont absents, la sélection statique s'affiche.
  liveProducts = null
  products = [
    {
      name: 'Deauville',
      kind: 'chaise de bistrot damier',
      cat: 'Chaises',
      img: 'bistro-seating-clean/BIS-027-01.webp',
    },
    {
      name: 'Rivoli',
      kind: 'chaise de bistrot chevron',
      cat: 'Chaises',
      img: 'bistro-seating-clean/BIS-001-01.webp',
    },
    {
      name: 'Bastille',
      kind: 'chaise de bistrot chevron bleu',
      cat: 'Chaises',
      img: 'bistro-seating-clean/BIS-004-01.webp',
    },
    {
      name: 'Tuileries',
      kind: 'chaise de bistrot damier',
      cat: 'Chaises',
      img: 'bistro-seating-clean/BIS-005-01.webp',
    },
    {
      name: 'Bonifacio',
      kind: 'fauteuil cordage écru',
      cat: 'Fauteuils',
      img: 'S:rop050-01.webp',
    },
    {
      name: 'Deauville',
      kind: 'fauteuil de bistrot',
      cat: 'Fauteuils',
      img: 'bistro-seating-clean/BIS-026-01.webp',
    },
    {
      name: 'Palma',
      kind: 'fauteuil tressage blanc',
      cat: 'Fauteuils',
      img: 'rope-series/ROP-024-01.webp',
    },
    {
      name: 'Hydra',
      kind: 'fauteuil cordage',
      cat: 'Fauteuils',
      img: 'rope-series/ROP-034-01.webp',
    },
    {
      name: 'Milos',
      kind: 'fauteuil cordage',
      cat: 'Fauteuils',
      img: 'rope-series/ROP-038-01.webp',
    },
    {
      name: 'Rivage',
      kind: 'chaise haute chevron',
      cat: 'Tables',
      img: 'teslin-series/TES-024-01.webp',
    },
    {
      name: 'Opéra',
      kind: 'chaise haute classique',
      cat: 'Tables',
      img: 'teslin-series/TES-043-01.webp',
    },
    {
      name: 'Paros',
      kind: 'chaise textilène',
      cat: 'Tables',
      img: 'teslin-series/TES-012-01.webp',
    },
    {
      name: 'Camargue',
      kind: 'chaise textilène beige',
      cat: 'Tables',
      img: 'teslin-series/TES-029-01.webp',
    },
    {
      name: 'Chaise basse',
      kind: 'lounge détente',
      cat: 'Lounge',
      img: 'S:1785234022740-w6z9yk.jpg',
    },
    {
      name: 'Cordage',
      kind: 'lounge cordage',
      cat: 'Lounge',
      img: 'rope-series/ROP-013-01.webp',
    },
    {
      name: 'Cordage II',
      kind: 'lounge cordage',
      cat: 'Lounge',
      img: 'rope-series/ROP-013-02.webp',
    },
    {
      name: 'Opale',
      kind: 'chaise tressage',
      cat: 'Lounge',
      img: 'teslin-series/TES-038-01.webp',
    },
    {
      name: 'Hossegor',
      kind: 'chaise de bistrot',
      cat: 'Chaises',
      img: 'bistro-seating-clean/BIS-027-01.webp',
    },
    {
      name: 'Chevrons',
      kind: 'chaise de bistrot chevron',
      cat: 'Chaises',
      img: 'bistro-seating-clean/BIS-001-01.webp',
    },
    {
      name: 'Montmartre',
      kind: 'fauteuil de bistrot',
      cat: 'Fauteuils',
      img: 'bistro-seating-clean/BIS-024-01.webp',
    },
    {
      name: 'Madeleine',
      kind: 'fauteuil de bistrot',
      cat: 'Fauteuils',
      img: 'bistro-seating-clean/BIS-025-01.webp',
    },
    {
      name: 'Louvres',
      kind: 'table',
      cat: 'Tables',
      img: 'S:1788691404245-o0yi86.webp',
    },
    {
      name: 'Avignon',
      kind: 'table',
      cat: 'Tables',
      img: 'table-base-series/TBA-005-01.webp',
    },
    {
      name: 'Provence',
      kind: 'table',
      cat: 'Tables',
      img: 'S:1788691404245-o0yi86.webp',
    },
    {
      name: 'Azur',
      kind: 'table',
      cat: 'Tables',
      img: 'table-base-series/TBA-005-01.webp',
    },
    {
      name: 'Siena',
      kind: 'lounge',
      cat: 'Lounge',
      img: 'rope-series/ROP-013-01.webp',
    },
    {
      name: 'Ravenna',
      kind: 'lounge',
      cat: 'Lounge',
      img: 'bistro-seating-clean/BIS-039-01.webp',
    },
    {
      name: 'Amalfi',
      kind: 'lounge',
      cat: 'Lounge',
      img: 'rope-series/ROP-013-02.webp',
    },
    {
      name: 'Cannes',
      kind: 'lounge',
      cat: 'Lounge',
      img: 'S:1780580641255-1cgxqd.jpg',
    },
  ]
  catList = ['Chaises', 'Fauteuils', 'Tables', 'Lounge']
  // « Quelques directions déjà composées » : photos d'ambiance. name = nom produit à afficher, href = fiche produit
  bandDefs = []
  // Sélection éditoriale « 02 / Le mobilier » : 4 produits par catégorie, à remplacer par vos choix
  picks = {
    Chaises: ['Hossegor', 'Chevrons', 'Opale', 'Tuileries'],
    Fauteuils: ['Bonifacio', 'Deauville', 'Montmartre', 'Madeleine'],
    Tables: ['Louvres', 'Avignon', 'Provence', 'Azur'],
    Lounge: ['Cannes', 'Siena', 'Ravenna', 'Amalfi'],
  }
  texDefs = [
    {
      label: 'Le rythme du tressage',
      word: 'Rythme',
      ref: 'PI-TR-007',
      bg: '#dfe6f3',
      rot: '-4deg',
    },
    {
      label: 'Le relief du cordage',
      word: 'Relief',
      ref: 'PI-CO-014',
      bg: '#dcebe6',
      rot: '3deg',
    },
    {
      label: 'La finesse du textilène',
      word: 'Finesse',
      ref: 'PI-TX-021',
      bg: '#e8e4dc',
      rot: '-2deg',
    },
  ]
  shipDefs = [
    {
      label: 'Votre projet seul',
      title: 'Un container pour un seul projet coûte cher.',
      body: 'Cinquante chaises et vingt tables ne remplissent pas un container. Seul, vous financez le vide autour de votre mobilier.',
    },
    {
      label: 'Volumes réunis',
      title: 'Les volumes se regroupent, pas les projets.',
      body: 'Plusieurs commandes Terrassea partagent le même container. Chaque projet reste identifié, emballé et contrôlé séparément, puis livré à son adresse.',
    },
    {
      label: 'Votre devis',
      title: 'Un transport optimisé, un meilleur prix.',
      body: 'Nous calculons le volume de chaque projet pour optimiser le chargement et répartir le coût du transport. Ce travail nous permet de vous proposer le meilleur prix, ajusté à votre projet.',
    },
  ]
  compareDefs = [
    {
      name: 'Monceau',
      kind: 'chaise de bistrot',
      before: null,
      after: null,
      beforeLabel: 'Noir / blanc',
      afterLabel: 'Vert / écru',
    },
    {
      name: 'Nice',
      kind: 'fauteuil cordage',
      before: null,
      after: null,
      beforeLabel: 'Sable',
      afterLabel: 'Terracotta',
    },
    {
      name: 'Madeleine',
      kind: 'fauteuil de bistrot',
      before: null,
      after: null,
      beforeLabel: 'Noir / blanc',
      afterLabel: 'Bordeaux / crème',
    },
  ]
  initTiles() {
    return this.famDefs.map(() =>
      [0, 1, 2, 3].map((i) => ({ a: i, b: i, showB: false })),
    )
  }
  swapTile(fi, ti) {
    this.setState((s) => {
      const tiles = (s.tiles || this.initTiles()).map((col) =>
        col.map((t) => ({ ...t })),
      )
      const col = tiles[fi],
        t = col[ti],
        pool = this.famDefs[fi].pool
      const used = new Set(col.map((x) => (x.showB ? x.b : x.a)))
      const free = pool.map((_, i) => i).filter((i) => !used.has(i))
      if (!free.length) return null
      const nxt = free[Math.floor(Math.random() * free.length)]
      if (t.showB) t.a = nxt
      else t.b = nxt
      t.showB = !t.showB
      return { tiles }
    })
    this.forceUpdate()
  }
  renderVals() {
    const s = this.state
    const list = this.liveProducts
      ? liveHomeCards(this.liveProducts, s.cat)
      : (this.picks[s.cat] || [])
          .map(
            (nm) =>
              this.products.find((p) => p.name === nm && p.cat === s.cat) ||
              this.products.find((p) => p.name === nm),
          )
          .filter(Boolean)
          .map((p) => ({ ...p, href: '/catalogue' }))
    const kinds = [
      'Restaurant',
      'Hôtel',
      'Bar / café',
      'Architecte',
      'Revendeur / partenaire',
    ]
    return {
      totalModels: this.famDefs.reduce((n, f) => n + f.pool.length, 0),
      families: this.famDefs.map((f, fi) => ({
        name: f.name,
        go: () => this.setState({ cat: f.cat }),
        tiles: [0, 1, 2, 3].map((ti) => {
          const t = (s.tiles || this.initTiles())[fi][ti],
            order = ti * 4 + fi,
            vis = order < s.shown
          return {
            a: this.url(f.pool[t.a][1]),
            b: this.url(f.pool[t.b][1]),
            name: f.pool[t.showB ? t.b : t.a][0],
            aOp: t.showB ? 0 : 1,
            bOp: t.showB ? 1 : 0,
            op: vis ? 1 : 0,
            tf: vis ? 'none' : 'translateY(18px) scale(.9)',
            delay: order * 0.09 + 's',
            pick: (e) => {
              e.preventDefault()
              e.stopPropagation()
              this.swapTile(fi, ti)
            },
          }
        }),
      })),
      quotes: [],
      proofs: [
        {
          icon: 'https://cdn.jsdelivr.net/npm/@phosphor-icons/core@2/assets/duotone/factory-duotone.svg',
          title: 'Direct usine',
          sub: 'Sans intermédiaire, prix pro',
        },
        {
          icon: 'https://cdn.jsdelivr.net/npm/@phosphor-icons/core@2/assets/duotone/palette-duotone.svg',
          title: 'Personnalisation',
          sub: 'Matières et couleurs dès 50 pièces',
        },
        {
          icon: 'https://cdn.jsdelivr.net/npm/@phosphor-icons/core@2/assets/duotone/seal-check-duotone.svg',
          title: 'Normes EU',
          sub: 'Usage professionnel, contrôle avant départ',
        },
        {
          icon: 'https://cdn.jsdelivr.net/npm/@phosphor-icons/core@2/assets/duotone/flag-duotone.svg',
          title: 'Marque française',
          sub: 'Pros Import, Paris · facture française',
        },
      ].map((p, i) => ({ ...p, delay: i * 0.1 + 's' })),
      cats: this.catList.map((c) => ({
        label: c,
        selected: c === s.cat,
        color:
          c === s.cat
            ? 'var(--color-text)'
            : 'color-mix(in srgb,var(--color-text) 60%,transparent)',
        line: c === s.cat ? 'var(--color-text)' : 'transparent',
        pick: () => this.setState({ cat: c }),
      })),
      shown: list.map((p, i) => ({
        ...p,
        img: this.url(p.img),
        delay: i * 0.12 + 's',
      })),
      band: (() => {
        const defs = this.liveProducts
          ? liveBandCards(this.bandDefs, this.liveProducts)
          : this.bandDefs
        const count = defs.length || 1
        return [...defs, ...defs].map((b, i) => ({
          ...b,
          num: String((i % count) + 1).padStart(2, '0'),
          rot: (((i % count) % 5) - 2) * 2 + 'deg',
        }))
      })(),
      tex: this.texDefs[s.tex],
      texLayers: this.texDefs.map((t, i) => ({
        pattern: t.pattern,
        size: t.size,
        op: i === s.tex ? 1 : 0,
      })),
      texList: this.texDefs.map((t, i) => ({
        label: t.label,
        selected: i === s.tex,
        num: '0' + (i + 1),
        color: i === s.tex ? 'var(--color-accent-700)' : 'var(--color-text)',
        line:
          i === s.tex ? 'var(--color-accent-700)' : 'var(--color-neutral-300)',
        pick: () => this.setState({ tex: i, swap: i }),
      })),
      pieces: [
        ['Chaise', this.config.pieceChair],
        ['Plateau', this.S + '1788691404245-o0yi86.webp'],
        ['Piètement', this.P + 'table-base-series/TBA-005-01.webp'],
      ].map((p, i) => {
        const on = i === s.swap % 3
        return {
          label: p[0],
          img: p[1],
          op: on ? 1 : 0,
          sc: on ? 1 : 1.08,
          bar: on ? 'var(--color-text)' : 'var(--color-neutral-300)',
        }
      }),
      pieceLabel: ['Chaise', 'Plateau', 'Piètement'][s.swap % 3],
      studioFacts: [
        {
          k: '01',
          t: 'Sans compte, sans engagement.',
          d: 'Vous composez, vous gardez, vous revenez.',
        },
        {
          k: '02',
          t: 'Vos couleurs, vraiment.',
          d: 'Coloris au nuancier ou à partir de votre devanture.',
        },
        {
          k: '03',
          t: 'Dès 50 pièces.',
          d: 'Le seuil pour une production à votre image.',
        },
        {
          k: '04',
          t: 'Vérifié par notre équipe.',
          d: 'Faisabilité et délai confirmés avant devis.',
        },
      ],
      swatches: this.texDefs.map((t, i) => {
        const front = i === s.swap % 3
        return {
          pattern: t.pattern,
          size: t.size,
          sc: front ? 1.18 : 1,
          y: front ? '-4px' : '0',
          z: front ? 2 : 1,
        }
      }),
      docLines: [
        ['92%', '70%'],
        ['60%', '85%'],
        ['82%', '55%'],
      ].map((w) => ({ w: w[s.swap % 2] })),
      lots: [
        ['Votre', 'projet', '28%', '#e2b96a'],
        ['Projet', 'B', '30%', '#c9cee0'],
        ['Projet', 'C', '24%', '#dfe2c8'],
        ['Projet', 'D', '18%', '#e6d3d0'],
      ].map((l, i) => {
        const cost = s.ship === 2,
          mine = i === 0,
          on = mine || s.ship >= 1
        return {
          a: cost ? (mine ? 'Votre projet' : '') : l[0],
          b: cost ? (mine ? 'prix optimisé' : '') : l[1],
          w: on ? l[2] : '0%',
          bg: cost && !mine ? 'var(--color-neutral-300)' : l[3],
          color: 'var(--color-text)',
          op: on ? 1 : 0,
          x: on ? '0' : '40px',
          delay: mine ? '0s' : i * 0.2 + 's',
        }
      }),
      emptyFrom: s.ship === 0 ? '28%' : '100%',
      emptyOp: s.ship === 0 ? 1 : 0,
      emptyLabel: '72 % de vide, facturé quand même',
      vizStep: [
        'Étape 1 / 3 — container seul',
        'Étape 2 / 3 — volumes réunis',
        'Étape 3 / 3 — coût réparti',
      ][s.ship],
      vizCaption: [
        "Seul, votre projet n'occupe qu'une partie du container. Le reste voyage vide.",
        "D'autres projets Terrassea complètent le volume. Chaque lot reste emballé et identifié séparément.",
        "Le coût du transport est réparti entre les projets : chacun bénéficie d'un meilleur prix.",
      ][s.ship],
      axisLabel:
        s.ship === 2 ? 'coût de transport réparti' : '1 container · 100 %',
      shipSteps: this.shipDefs.map((d, i) => ({
        label: d.label,
        selected: i === s.ship,
        num: '0' + (i + 1),
        border:
          i === s.ship
            ? 'var(--color-neutral-800)'
            : 'var(--color-neutral-300)',
        bg: i === s.ship ? 'var(--color-neutral-800)' : 'transparent',
        color: i === s.ship ? 'var(--color-bg)' : 'var(--color-text)',
        pick: () => this.selectShip(i),
      })),
      shipTitle: this.shipDefs[s.ship].title,
      shipBody: this.shipDefs[s.ship].body,
      replay: () => this.replayContainer(),
      pickPartner: () => this.setState({ kind: 'Revendeur / partenaire' }),
      reels: [
        {
          caption: 'Terrasse livrée, Paris 11e',
          placeholder: 'reel instagram — déballage et installation',
        },
        {
          caption: "Cordage terracotta, hôtel Côte d'Azur",
          placeholder: 'reel instagram — mobilier en situation',
        },
        {
          caption: 'Échantillons reçus par un client',
          placeholder: 'reel instagram — échantillons en main',
        },
        {
          caption: 'Contrôle qualité avant départ',
          placeholder: 'reel instagram — atelier / contrôle',
        },
      ].map((r, i) => {
        const v = (this.config.reels.map((r) => r.url) || [])[i]
        return {
          ...r,
          src: v,
          hasVideo: !!v,
          noVideo: !v,
          caption: this.config.reels[i]?.name || r.caption,
          href:
            this.config.reels[i]?.href ||
            'https://www.instagram.com/terrassea_france',
          delay: i * 0.1 + 's',
        }
      }),
      compares: this.compareDefs.map((c, i) => ({
        ...c,
        delay: i * 0.12 + 's',
      })),
      split: s.split,
      pct: s.split + '%',
      setSplit: (e) => this.setState({ split: +e.target.value }),
      kinds: kinds.map((k) => ({
        label: k,
        selected: k === s.kind,
        border: k === s.kind ? 'var(--color-text)' : 'var(--color-neutral-300)',
        bg: k === s.kind ? 'var(--color-text)' : 'transparent',
        color: k === s.kind ? 'var(--color-bg)' : 'var(--color-text)',
        pick: () => this.setState({ kind: k }),
      })),
      submit: (e) => this.submitForm(e, 'project'),
      submitLabel: s.sent
        ? 'Merci, nous vous rappelons sous 24 h ✓'
        : 'Être rappelé pour mon projet →',
      needs: ['Chaises', 'Fauteuils', 'Tables', 'Lounge'].map((n) => {
        const on = s.needs.includes(n)
        return {
          label: n,
          selected: on,
          border: on ? 'var(--color-text)' : 'var(--color-neutral-300)',
          bg: on ? 'var(--color-text)' : 'transparent',
          color: on ? 'var(--color-bg)' : 'var(--color-text)',
          pick: () =>
            this.setState((p) => ({
              needs: p.needs.includes(n)
                ? p.needs.filter((x) => x !== n)
                : [...p.needs, n],
            })),
        }
      }),
      subscribe: (e) => this.submitForm(e, 'newsletter'),
      subLabel: s.sub ? 'Inscrit ✓' : 'Me tenir informé',
      fabOp: s.fab ? 1 : 0,
      fabY: s.fab ? '0' : '20px',
      fabPe: s.fab ? 'auto' : 'none',
    }
  }
}
