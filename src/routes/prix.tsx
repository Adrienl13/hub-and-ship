import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Camera } from 'lucide-react'

import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { PriceChart } from '@/components/prix/PriceChart'
import { VolumeSimulator } from '@/components/prix/VolumeSimulator'
import { useCatalog } from '@/hooks/useCatalog'
import { useSiteMedia } from '@/hooks/useSiteMedia'
import { productPath } from '@/lib/catalogue/product-slug'
import {
  listPublishedDeliveredContainers,
} from '@/lib/delivered-containers/repository'
import { refreshPublicPricingRules } from '@/lib/pricing/public-rules'
import {
  aggregateReviews,
  reviewFromRow,
  type ProductReviewRow,
} from '@/lib/reviews/reviews'
import { buildSeoHead, faqJsonLd, jsonLdScript } from '@/lib/seo'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { getSupabasePublicConfig } from '@/lib/supabase/env'

// Page « Le prix prouvé » v2 (handoff design 07/2026) : hero sombre #332E27
// avec graphique de circuit interactif, sommaire d'ancres, méthode en 5
// briques, simulateur branché sur les paliers publics RÉELS, frise photo
// administrable, preuves dynamiques (jamais de faux chiffres) et FAQ.

const FAQ = [
  {
    q: 'Pourquoi le mobilier CHR coûte-t-il 2 à 3 fois plus cher en showroom ?',
    direct:
      "Parce que chaque intermédiaire ajoute sa marge : le prix usine est multiplié par 2,5 à 3 avant d'arriver en showroom.",
    bullets: [
      'Circuit classique : usine → importateur → grossiste → distributeur → showroom. 4 marges empilées, plus le coût des stocks et des salles d’exposition.',
      'Notre circuit : usine → vous. Une seule marge, qui couvre fret, douane, contrôle SGS et SAV.',
      'Vérifiable : chaque fiche produit affiche le prix public conseillé en référence, à côté du nôtre.',
    ],
  },
  {
    q: 'Quelles remises de volume sont appliquées ?',
    direct:
      'Deux paliers publics, appliqués automatiquement au panier — sans négociation ni code promo.',
    bullets: [
      '−6 % dès 100 pièces cumulées dans la commande (toutes références confondues).',
      '−10 % dès 150 pièces cumulées.',
      'Mêmes conditions pour tous les professionnels — testez avec le simulateur ci-dessus.',
    ],
  },
  {
    q: "Comment se passe le paiement d'une commande par container ?",
    direct:
      'En 3 temps, calés sur la vie du container — vous ne payez jamais tout d’avance.',
    bullets: [
      '3 % à la réservation (min 150 €, plafonné à 500 €) — déduits du total, votre place est bloquée.',
      '27 % au seuil de 80 % de remplissage — la production démarre, vous êtes prévenu 48 h avant.',
      '70 % avant expédition — uniquement après validation du contrôle SGS en usine.',
    ],
  },
  {
    q: "Pourquoi ne pas acheter directement à l'usine moi-même ?",
    direct:
      "Vous pouvez — c'est notre métier. Mais en direct, l'usine impose des conditions difficiles à tenir seul :",
    bullets: [
      'MOQ de plusieurs centaines de pièces par référence, payées d’avance à l’international.',
      'Statut d’importateur obligatoire : EORI, TVA à l’import, conformité UE, dédouanement, fret.',
      'Aucun recours pratique en cas de défaut constaté à l’arrivée, sans contrôle qualité sur place.',
    ],
    after:
      'Notre marge unique couvre exactement ce travail : accéder aux conditions usine dès quelques dizaines de pièces, avec contrôle SGS, garantie 2 ans et SAV en France.',
  },
  {
    q: 'Le prix affiché inclut-il le transport et la douane ?',
    direct:
      'Oui, jusqu’au port d’arrivée (Marseille-Fos ou Le Havre) : le prix est « rendu port », sans frais caché.',
    bullets: [
      'Inclus : achat usine, fret maritime mutualisé, dédouanement, taxes, conformité UE, contrôle SGS.',
      'Ensuite, au choix : enlèvement libre gratuit au port, votre transporteur, ou mise en relation avec nos transporteurs partenaires à tarif négocié.',
    ],
  },
] as const

const METHOD_STEPS = [
  {
    num: '01',
    title: 'Achat direct usine',
    text: 'Prix FOB négocié sans agent ni bureau d’achat. Les mêmes usines que les grandes marques européennes.',
  },
  {
    num: '02',
    title: 'Fret mutualisé',
    text: "Le container 40' HC est réparti au prorata du volume. Plus il se remplit, plus la part par chaise baisse.",
  },
  {
    num: '03',
    title: 'Douane & conformité',
    text: 'Dédouanement, taxes et normes UE (feu, fiches techniques) traités par l’importateur officiel.',
  },
  {
    num: '04',
    title: 'Contrôle SGS',
    text: 'Inspection indépendante avant départ, rapport consultable. Inclus dans le prix, jamais en option.',
  },
  {
    num: '05',
    title: 'Une seule marge',
    text: 'Sourcing, logistique, SAV France et garantie 2 ans. Pas de grossiste, pas de showroom à financer.',
    dark: true,
  },
] as const

const TRAJET_STEPS = [
  {
    title: 'Usine & contrôle SGS',
    text: 'Inspection indépendante avant chargement, rapport à l’appui.',
  },
  {
    title: 'Chargement',
    text: 'Empotage optimisé, scellé douanier, photos du manifeste.',
  },
  {
    title: 'Arrivée au port',
    text: 'Dédouanement par nos soins — importateur officiel enregistré.',
  },
  {
    title: 'Votre terrasse',
    text: 'Enlèvement port ou livraison — le mobilier entre en service.',
  },
] as const

const ANCHORS = [
  ['#methode', 'La méthode'],
  ['#remises', 'Remises & paiement'],
  ['#trajet', 'Le trajet'],
  ['#preuves', 'Les preuves'],
  ['#faq', 'FAQ'],
] as const

const WRAP = 'mx-auto max-w-[1240px] px-5 sm:px-10'
const EYEBROW =
  'mb-3.5 text-[13px] font-bold uppercase tracking-[0.14em] text-[color:var(--ember)]'
const H2 =
  'm-0 text-[26px] font-extrabold leading-[1.05] tracking-[-0.025em] sm:text-[33px] lg:text-[40px]'

export const Route = createFileRoute('/prix')({
  head: () => ({
    ...buildSeoHead({
      title: 'Le prix prouvé — d’où vient le prix de votre mobilier CHR',
      description:
        'Un meuble CHR passe par 4 à 5 intermédiaires qui multiplient le prix usine par 2,5 à 3. Container Club achète en direct usine, mutualise le container entre pros et applique une seule marge : la méthode, les paliers de remise et les preuves.',
      path: '/prix',
    }),
    scripts: [
      jsonLdScript(
        faqJsonLd(
          FAQ.map((item) => ({
            q: item.q,
            a: [item.direct, ...item.bullets, 'after' in item ? item.after : '']
              .filter(Boolean)
              .join(' '),
          })),
        ),
      ),
    ],
  }),
  component: PrixPage,
})

interface ProofStats {
  readonly avgRating: string | null
  readonly reviewCount: number
  readonly containersDelivered: number
}

function useProofStats(): ProofStats {
  const [stats, setStats] = useState<ProofStats>({
    avgRating: null,
    reviewCount: 0,
    containersDelivered: 0,
  })

  useEffect(() => {
    const config = getSupabasePublicConfig()
    if (!config.isConfigured) return
    let cancelled = false

    const load = async () => {
      let avgRating: string | null = null
      let reviewCount = 0
      let containersDelivered = 0
      try {
        const res = await fetch(
          `${config.url}/rest/v1/product_reviews?status=eq.published&select=*`,
          {
            headers: {
              apikey: config.anonKey,
              Authorization: `Bearer ${config.anonKey}`,
            },
          },
        )
        if (res.ok) {
          const rows = (await res.json()) as ProductReviewRow[]
          const aggregate = aggregateReviews(rows.map(reviewFromRow))
          if (aggregate.count > 0) {
            avgRating = `${aggregate.average.toFixed(1).replace('.', ',')}/5`
            reviewCount = aggregate.count
          }
        }
      } catch {
        // pas d'avis chargés → la carte reste masquée
      }
      try {
        const client = createSupabaseBrowserClient(config)
        const delivered = await listPublishedDeliveredContainers(client)
        containersDelivered = delivered.length
      } catch {
        // pas d'historique chargé → la carte reste masquée
      }
      if (!cancelled) {
        setStats({ avgRating, reviewCount, containersDelivered })
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return stats
}

function PrixPage() {
  const media = useSiteMedia()
  const { products } = useCatalog()
  const proof = useProofStats()
  const [faqOpen, setFaqOpen] = useState(0)
  // Le simulateur lit les règles publiques du module : on les rafraîchit
  // depuis le serveur puis on force un re-render (mêmes paliers qu'au panier).
  const [rulesVersion, setRulesVersion] = useState(0)
  useEffect(() => {
    void refreshPublicPricingRules().then(() => setRulesVersion((v) => v + 1))
  }, [])

  const exampleProduct = products.find((p) => p.category === 'chair')
  const productHref = exampleProduct ? productPath(exampleProduct) : '/catalogue'

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <Header onReserve={() => window.location.assign('/catalogue')} />

      {/* HERO sombre : promesse + graphique */}
      <section className="relative bg-[#332E27]">
        <div className="absolute inset-0">
          <img
            src={media.prixHero.url}
            alt={media.prixHero.alt}
            className="h-full w-full object-cover"
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(90deg,rgba(43,38,31,.96)_0%,rgba(43,38,31,.9)_45%,rgba(43,38,31,.78)_100%)]"
          />
        </div>
        <div className={`${WRAP} relative z-[1] py-16 lg:pb-[88px] lg:pt-20`}>
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="flex flex-col gap-6">
              <div className="text-[13px] font-bold uppercase tracking-[0.14em] text-[color:var(--ember-bright)]">
                Le prix prouvé
              </div>
              <h1 className="m-0 text-[34px] font-extrabold leading-[1.02] tracking-[-0.025em] text-[#F9F6F0] sm:text-[44px] lg:text-[56px]">
                On ne vous demande pas de nous croire.{' '}
                <span className="text-[color:var(--ember-bright)]">
                  On vous montre la méthode.
                </span>
              </h1>
              <p className="m-0 max-w-[480px] text-lg leading-[1.55] text-[rgba(244,239,231,.78)]">
                Un meuble CHR vendu en showroom passe par 4 à 5 intermédiaires
                qui multiplient le prix usine par 2,5 à 3. Nous achetons en
                direct, mutualisons le container entre pros et appliquons{' '}
                <strong className="text-[#F9F6F0]">une seule marge</strong>.
              </p>
              <div className="flex flex-wrap gap-3.5">
                <Link
                  to="/catalogue"
                  className="rounded-[11px] bg-[color:var(--ember)] px-6 py-[15px] text-base font-bold text-white transition-colors hover:bg-[color:var(--ember-hover)]"
                >
                  Vérifier au catalogue →
                </Link>
                <a
                  href="/qualite"
                  className="rounded-[11px] border border-[rgba(244,239,231,.28)] bg-[rgba(244,239,231,.1)] px-6 py-[15px] text-base font-semibold text-[color:var(--sand)] transition-colors hover:bg-[rgba(244,239,231,.18)]"
                >
                  Rapports SGS
                </a>
              </div>
            </div>
            <PriceChart productHref={productHref} />
          </div>
        </div>
      </section>

      {/* SOMMAIRE ancres */}
      <div className="sticky top-16 z-40 border-b border-[color:var(--sand-deep)] bg-[rgba(244,239,231,.9)] backdrop-blur">
        <div className={`${WRAP} flex gap-2 overflow-x-auto py-2.5`}>
          {ANCHORS.map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="whitespace-nowrap rounded-full border border-[color:var(--border-strong)] bg-white px-3.5 py-[7px] text-[13px] font-semibold text-[#4a443c] transition-colors hover:border-foreground/40"
            >
              {label}
            </a>
          ))}
        </div>
      </div>

      <main>
        {/* LA MÉTHODE */}
        <section
          id="methode"
          className={`${WRAP} scroll-mt-[130px] pt-16 lg:pt-[104px]`}
        >
          <div className={EYEBROW}>La méthode</div>
          <h2 className={`${H2} mb-10 max-w-[720px]`}>
            D&apos;où vient le prix — les 5 briques, rien d&apos;autre.
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {METHOD_STEPS.map((step) => (
              <div
                key={step.num}
                className={
                  'flex flex-col gap-2.5 rounded-2xl p-5 pb-6 ' +
                  ('dark' in step && step.dark
                    ? 'bg-[#332E27]'
                    : 'border border-[color:var(--sand-deep)] bg-white')
                }
              >
                <div
                  className={
                    'text-[34px] font-black ' +
                    ('dark' in step && step.dark
                      ? 'text-[color:var(--ember-bright)]'
                      : 'text-[#e0d3bd]')
                  }
                >
                  {step.num}
                </div>
                <div
                  className={
                    'text-[17px] font-extrabold ' +
                    ('dark' in step && step.dark ? 'text-[#F9F6F0]' : '')
                  }
                >
                  {step.title}
                </div>
                <p
                  className={
                    'm-0 text-[13.5px] leading-[1.45] ' +
                    ('dark' in step && step.dark
                      ? 'text-[rgba(244,239,231,.72)]'
                      : 'text-[color:var(--color-text-secondary)]')
                  }
                >
                  {step.text}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* REMISES & PAIEMENT */}
        <section
          id="remises"
          className={`${WRAP} scroll-mt-[130px] pt-16 lg:pt-[104px]`}
        >
          <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2">
            <VolumeSimulator key={rulesVersion} />

            <div className="flex flex-col rounded-[20px] bg-[#332E27] p-6 sm:p-10">
              <div className="mb-[22px] text-[13px] font-bold uppercase tracking-[0.14em] text-[color:var(--ember-bright)]">
                Le paiement suit le container
              </div>
              <div className="flex flex-1 flex-col justify-center">
                {[
                  {
                    pct: '3 %',
                    title: 'À la réservation',
                    text: 'Min 150 €, max 500 € — déduits du total.',
                  },
                  {
                    pct: '27 %',
                    title: 'Au seuil de 80 %',
                    text: 'La production démarre — vous êtes prévenu 48 h avant.',
                  },
                  {
                    pct: '70 %',
                    title: 'Avant expédition',
                    text: 'Après validation du contrôle SGS en usine.',
                  },
                ].map((row, index) => (
                  <div
                    key={row.pct}
                    className={
                      'flex items-start gap-[18px] py-4 ' +
                      (index < 2
                        ? 'border-b border-[rgba(244,239,231,.12)]'
                        : '')
                    }
                  >
                    <div className="min-w-[76px] text-[26px] font-black text-[color:var(--ember-bright)]">
                      {row.pct}
                    </div>
                    <div>
                      <div className="text-base font-bold text-[#F9F6F0]">
                        {row.title}
                      </div>
                      <div className="mt-[3px] text-[13.5px] text-[rgba(244,239,231,.65)]">
                        {row.text}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-[22px] border-t border-[rgba(244,239,231,.12)] pt-[18px] text-[13.5px] leading-normal text-[rgba(244,239,231,.65)]">
                Vous ne payez jamais la totalité d&apos;un mobilier qui
                n&apos;a pas encore de date de départ. Enlèvement au port
                gratuit · Garantie 2 ans + SAV France.
              </div>
            </div>
          </div>
        </section>

        {/* LE TRAJET — photos admin ou slots « à venir » honnêtes */}
        <section
          id="trajet"
          className={`${WRAP} scroll-mt-[130px] pt-16 lg:pt-[104px]`}
        >
          <div className={EYEBROW}>La preuve en images</div>
          <h2 className={`${H2} mb-3 max-w-[720px]`}>
            Le trajet de votre container, documenté à chaque étape.
          </h2>
          <p className="mb-10 mt-0 max-w-[640px] text-[17px] text-[color:var(--color-text-secondary)]">
            Des photos réelles sont publiées à chaque étape du container en
            cours — pas des visuels de banque d&apos;images.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TRAJET_STEPS.map((step, index) => {
              const photo = media.trajet[index] ?? null
              return (
                <div
                  key={step.title}
                  className="flex flex-col overflow-hidden rounded-2xl border border-[color:var(--sand-deep)] bg-white"
                >
                  <div className="relative h-[170px] bg-[color:var(--sand-deep)]">
                    {photo ? (
                      <img
                        src={photo.url}
                        alt={photo.alt || step.title}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-2 border-b border-dashed border-[color:var(--border-strong)] bg-[color:var(--sand-soft)] px-4 text-center">
                        <Camera className="h-5 w-5 text-[color:var(--muted)]" />
                        <span className="text-xs leading-5 text-[color:var(--muted)]">
                          Photo publiée à cette étape du container en cours
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 px-5 py-[18px]">
                    <div className="text-xs font-extrabold text-[color:var(--ember)]">
                      {index + 1}/4
                    </div>
                    <div className="text-[17px] font-extrabold">
                      {step.title}
                    </div>
                    <p className="m-0 text-[13.5px] leading-[1.45] text-[color:var(--color-text-secondary)]">
                      {step.text}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* LES PREUVES — chiffres réels uniquement */}
        <section
          id="preuves"
          className={`${WRAP} scroll-mt-[130px] pt-16 lg:pt-[104px]`}
        >
          <h2 className={`${H2} mb-9 max-w-[640px]`}>
            Pourquoi on peut le prouver.
          </h2>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="flex flex-col gap-2.5 rounded-[18px] border border-[color:var(--sand-deep)] bg-white p-8">
              <div className="text-[38px] font-black tracking-[-0.02em] text-[color:var(--ember)]">
                100 %
              </div>
              <h3 className="m-0 text-[19px] font-extrabold sm:text-[21px]">
                des containers contrôlés SGS
              </h3>
              <p className="m-0 text-[15px] leading-normal text-[color:var(--color-text-secondary)]">
                Contrôle indépendant avant chaque départ, rapports
                consultables.
              </p>
              <a
                href="/qualite"
                className="mt-auto w-max border-b-2 border-[color:var(--ember)] pb-0.5 text-[14.5px] font-bold text-foreground"
              >
                Consulter →
              </a>
            </div>
            {proof.avgRating && (
              <div className="flex flex-col gap-2.5 rounded-[18px] border border-[color:var(--sand-deep)] bg-white p-8">
                <div className="text-[38px] font-black tracking-[-0.02em] text-[color:var(--ember)]">
                  {proof.avgRating}
                </div>
                <h3 className="m-0 text-[19px] font-extrabold sm:text-[21px]">
                  d&apos;avis d&apos;achat vérifié
                </h3>
                <p className="m-0 text-[15px] leading-normal text-[color:var(--color-text-secondary)]">
                  Seuls les professionnels ayant commandé peuvent noter (
                  {proof.reviewCount} avis).
                </p>
                <a
                  href="/avis"
                  className="mt-auto w-max border-b-2 border-[color:var(--ember)] pb-0.5 text-[14.5px] font-bold text-foreground"
                >
                  Lire les avis →
                </a>
              </div>
            )}
            {proof.containersDelivered > 0 && (
              <div className="flex flex-col gap-2.5 rounded-[18px] border border-[color:var(--sand-deep)] bg-white p-8">
                <div className="text-[38px] font-black tracking-[-0.02em] text-[color:var(--ember)]">
                  {proof.containersDelivered}
                </div>
                <h3 className="m-0 text-[19px] font-extrabold sm:text-[21px]">
                  {proof.containersDelivered > 1
                    ? 'containers livrés'
                    : 'container livré'}
                </h3>
                <p className="m-0 text-[15px] leading-normal text-[color:var(--color-text-secondary)]">
                  L&apos;historique réel des commandes groupées déjà servies.
                </p>
                <a
                  href="/livres"
                  className="mt-auto w-max border-b-2 border-[color:var(--ember)] pb-0.5 text-[14.5px] font-bold text-foreground"
                >
                  Voir l&apos;historique →
                </a>
              </div>
            )}
          </div>
        </section>

        {/* FAQ */}
        <section
          id="faq"
          className="mx-auto max-w-[900px] scroll-mt-[130px] px-5 pt-16 sm:px-10 lg:pt-[104px]"
        >
          <div className={EYEBROW}>Questions fréquentes</div>
          <h2 className={`${H2} mb-9`}>Sur nos prix, précisément.</h2>
          <div className="flex flex-col gap-3">
            {FAQ.map((item, index) => {
              const isOpen = faqOpen === index
              return (
                <div
                  key={item.q}
                  className="overflow-hidden rounded-[14px] border border-[color:var(--sand-deep)] bg-white"
                >
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setFaqOpen(isOpen ? -1 : index)}
                    className="flex w-full items-center justify-between gap-5 px-6 py-5 text-left"
                  >
                    <span className="text-[15px] font-bold sm:text-[16.5px]">
                      {item.q}
                    </span>
                    <span
                      aria-hidden
                      className="text-[22px] leading-none text-[color:var(--ember)]"
                    >
                      {isOpen ? '−' : '+'}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-[22px]">
                      <p className="m-0 mb-2.5 text-[15px] font-bold leading-[1.55]">
                        {item.direct}
                      </p>
                      <div className="flex flex-col gap-1.5 text-[15px] leading-normal text-[color:var(--color-text-secondary)]">
                        {item.bullets.map((bullet) => (
                          <div key={bullet} className="flex gap-2.5">
                            <span className="font-extrabold text-[color:var(--ember)]">
                              ·
                            </span>
                            <span>{bullet}</span>
                          </div>
                        ))}
                      </div>
                      {'after' in item && (
                        <p className="m-0 mt-2.5 text-[15px] leading-[1.55] text-[color:var(--color-text-secondary)]">
                          {item.after}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* FONDATEUR + CTA */}
        <section className={`${WRAP} py-16 lg:py-[104px]`}>
          <div className="flex flex-col items-center gap-8 rounded-[22px] bg-[#332E27] p-8 sm:p-14 lg:flex-row lg:gap-12">
            <div className="flex h-[88px] w-[88px] min-w-[88px] items-center justify-center rounded-full bg-[color:var(--ember)] text-[30px] font-extrabold text-white">
              AL
            </div>
            <div className="flex-1">
              <p className="m-0 text-[19px] font-semibold leading-[1.4] text-[#F9F6F0] sm:text-[23px]">
                « Cette page décrit exactement comment nos prix sont
                construits. Si un point reste flou, écrivez-moi : je réponds
                personnellement. »
              </p>
              <div className="mt-4 text-[15px] text-[rgba(244,239,231,.65)]">
                <strong className="text-[#F9F6F0]">Adrien Laniez</strong> ·
                Fondateur &amp; gérant, Pros Import EURL
              </div>
            </div>
            <div className="flex w-full flex-col gap-3 lg:w-auto">
              <Link
                to="/catalogue"
                className="whitespace-nowrap rounded-[11px] bg-[color:var(--ember)] px-6 py-[15px] text-center text-[15.5px] font-bold text-white transition-colors hover:bg-[color:var(--ember-hover)]"
              >
                Voir les prix au catalogue →
              </Link>
              <Link
                to="/stock-24h"
                className="whitespace-nowrap rounded-[11px] border border-[rgba(244,239,231,.28)] bg-[rgba(244,239,231,.1)] px-6 py-[15px] text-center text-[15.5px] font-semibold text-[color:var(--sand)] transition-colors hover:bg-[rgba(244,239,231,.18)]"
              >
                Stock disponible sous 24 h
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
