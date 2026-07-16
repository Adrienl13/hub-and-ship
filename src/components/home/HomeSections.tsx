import { useState } from 'react'
import { Link } from '@tanstack/react-router'

import { ContainerNotifyForm } from '@/components/ContainerNotifyForm'
import type { SiteMediaItem } from '@/lib/site-media'

// Sections statiques de l'accueil v2 (handoff design 07/2026). Les textes
// sont ceux du prototype hifi ; les liens pointent tous vers des pages
// réelles du site (checklist « aucun lien mort »).

const WRAP = 'mx-auto max-w-[1240px] px-5 sm:px-10'
const EYEBROW =
  'mb-3.5 text-[13px] font-bold uppercase tracking-[0.14em] text-[color:var(--ember)]'
const H2 =
  'm-0 text-[26px] font-extrabold leading-[1.05] tracking-[-0.025em] sm:text-[33px] lg:text-[44px]'

/* ============ GAMMES ============ */

export function GammesSection({ media }: { media: SiteMediaItem }) {
  return (
    <section className={`${WRAP} pt-16 lg:pt-[104px]`}>
      <div className="mb-10 flex flex-wrap items-end justify-between gap-6 lg:gap-10">
        <div>
          <div className={EYEBROW}>Quatre gammes, quatre terrasses</div>
          <h2 className={`${H2} max-w-[640px]`}>
            Le mobilier que vos clients verront, avant tout discours.
          </h2>
        </div>
        <Link
          to="/catalogue"
          className="whitespace-nowrap border-b-2 border-[color:var(--ember)] pb-0.5 text-[15px] font-semibold text-[#4a443c] transition-colors hover:text-foreground"
        >
          Ouvrir le catalogue →
        </Link>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-[1.35fr_1fr]">
        <Link
          to="/catalogue"
          search={{ collection: 'cordage' }}
          className="group relative min-h-[320px] overflow-hidden rounded-[20px] bg-[color:var(--sand-deep)] lg:min-h-[520px]"
        >
          <img
            src={media.url}
            alt={media.alt}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(0deg,rgba(20,18,15,.62)_0%,rgba(20,18,15,0)_44%)]"
          />
          <div className="pointer-events-none absolute bottom-6 left-6 right-6">
            <div className="text-[22px] font-extrabold tracking-[-0.01em] text-[#F9F6F0] sm:text-[26px]">
              Cordage &amp; tressage main
            </div>
            <div className="mt-1 text-[15px] text-[rgba(244,239,231,.82)]">
              Corde tressée, cadre alu — coloris au choix, MOQ 50 par design.
            </div>
          </div>
        </Link>

        <div className="flex flex-col gap-3.5">
          <Link
            to="/catalogue"
            search={{ collection: 'bistrot' }}
            className="flex flex-1 flex-col justify-center gap-1 rounded-2xl border border-[color:var(--sand-deep)] bg-white px-6 py-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="text-xs font-bold uppercase tracking-[0.1em] text-[color:var(--ember)]">
              Bistrot
            </div>
            <div className="text-xl font-extrabold">La terrasse parisienne</div>
            <div className="text-[14.5px] text-[color:var(--color-text-secondary)]">
              Tressage chevrons, cadre alu bambou.
            </div>
          </Link>
          <Link
            to="/catalogue"
            search={{ collection: 'textilene' }}
            className="flex flex-1 flex-col justify-center gap-1 rounded-2xl border border-[color:var(--sand-deep)] bg-white px-6 py-5 transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="text-xs font-bold uppercase tracking-[0.1em] text-[color:var(--ember)]">
              Textilène
            </div>
            <div className="text-xl font-extrabold">
              La brasserie contemporaine
            </div>
            <div className="text-[14.5px] text-[color:var(--color-text-secondary)]">
              Toile tendue, lignes nettes.
            </div>
          </Link>
          <Link
            to="/catalogue"
            search={{ collection: 'pietements' }}
            className="flex flex-1 flex-col justify-center gap-1 rounded-2xl bg-foreground px-6 py-5 transition-all hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div className="text-xs font-bold uppercase tracking-[0.1em] text-[color:var(--ember-bright)]">
              Piètements
            </div>
            <div className="text-xl font-extrabold text-[#F9F6F0]">
              La base du métier
            </div>
            <div className="text-[14.5px] text-[rgba(244,239,231,.72)]">
              Fonte et alu, plateaux au choix.
            </div>
          </Link>
        </div>
      </div>
    </section>
  )
}

/* ============ BANDEAU CLIENTÈLE ============ */

export function ClienteleBand({ media }: { media: SiteMediaItem }) {
  return (
    <section className="relative mt-16 lg:mt-[104px]">
      <div className="relative h-[560px] overflow-hidden sm:h-[420px]">
        <img
          src={media.url}
          alt={media.alt}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(20,18,15,.88)_0%,rgba(20,18,15,.62)_42%,rgba(20,18,15,.2)_100%)]"
        />
        <div className="pointer-events-none absolute inset-0 flex items-center">
          <div className={`${WRAP} w-full`}>
            <div className="max-w-[560px]">
              <div className="mb-3.5 text-[13px] font-bold uppercase tracking-[0.14em] text-[color:var(--ember-bright)]">
                Pensé pour les pros de la terrasse
              </div>
              <h2 className="m-0 text-[26px] font-extrabold leading-[1.05] tracking-[-0.02em] text-[#F9F6F0] sm:text-[33px] lg:text-[42px]">
                Restaurants, hôtels, campings, bars : équipez à prix usine,
                sans compromis sur la qualité.
              </h2>
              <p className="mt-5 text-[17px] leading-normal text-[rgba(244,239,231,.82)]">
                Un mobilier robuste, garanti 2 ans et contrôlé SGS avant
                expédition — pensé pour l&apos;exigence d&apos;un usage
                professionnel intensif.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ============ 3 PILIERS ============ */

const PILLARS = [
  {
    title: 'Direct usine',
    text: 'Prix négociés au niveau container, sans empilement de marges ni stock dormant à financer.',
  },
  {
    title: 'Groupé entre pros',
    text: 'Chaque réservation contribue au remplissage. Le départ se déclenche quand le seuil est atteint.',
  },
  {
    title: 'Tout est géré',
    text: 'Import, douane, conformité, contrôle SGS, facture française et garantie 2 ans centralisés chez nous.',
  },
] as const

export function PillarsSection() {
  return (
    <section className={`${WRAP} py-16 lg:py-[104px]`}>
      <div className="grid grid-cols-1 gap-7 sm:grid-cols-3">
        {PILLARS.map((pillar, index) => (
          <div key={pillar.title} className="flex flex-col gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[color:var(--ember-soft)] text-lg font-extrabold text-[color:var(--ember)]">
              {index + 1}
            </div>
            <h3 className="m-0 mt-1.5 text-[19px] font-extrabold tracking-[-0.01em] sm:text-[22px]">
              {pillar.title}
            </h3>
            <p className="m-0 text-[15.5px] leading-normal text-[color:var(--color-text-secondary)]">
              {pillar.text}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ============ DOUBLE PARCOURS ============ */

export function DualPathSection() {
  return (
    <section className={`${WRAP} pb-2`}>
      <div className={EYEBROW}>Deux parcours, une règle</div>
      <h2 className={`${H2} mb-9 max-w-[760px] lg:text-[40px]`}>
        Acheter en direct ou revendre : le canal reste clair.
      </h2>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Link
          to="/catalogue"
          className="group flex flex-col gap-3.5 rounded-[20px] border border-[color:var(--sand-deep)] bg-white p-7 transition-all hover:-translate-y-0.5 hover:shadow-md sm:p-9"
        >
          <div className="text-xs font-bold uppercase tracking-[0.1em] text-[color:var(--ember)]">
            J&apos;équipe mon établissement
          </div>
          <h3 className="m-0 text-[22px] font-extrabold tracking-[-0.01em] sm:text-[26px]">
            Prix direct pro
          </h3>
          <p className="m-0 text-base leading-normal text-[color:var(--color-text-secondary)]">
            MOQ clair, réservation container et stock 24h pour les besoins
            urgents.
          </p>
          <span className="mt-2 w-max border-b-2 border-[color:var(--ember)] pb-0.5 text-[15px] font-bold text-foreground">
            Explorer les produits →
          </span>
        </Link>
        <Link
          to="/partenaires"
          className="group flex flex-col gap-3.5 rounded-[20px] bg-foreground p-7 transition-all hover:-translate-y-0.5 hover:shadow-lg sm:p-9"
        >
          <div className="text-xs font-bold uppercase tracking-[0.1em] text-[color:var(--ember-bright)]">
            Je revends à mon réseau
          </div>
          <h3 className="m-0 text-[22px] font-extrabold tracking-[-0.01em] text-[#F9F6F0] sm:text-[26px]">
            Programme partenaire
          </h3>
          <p className="m-0 text-base leading-normal text-[rgba(244,239,231,.74)]">
            Prix nets réservés, opportunités protégées et sélections
            co-brandées à construire ensemble.
          </p>
          <span className="mt-2 w-max border-b-2 border-[color:var(--ember-bright)] pb-0.5 text-[15px] font-bold text-[#F9F6F0]">
            Voir le programme →
          </span>
        </Link>
      </div>
    </section>
  )
}

/* ============ COMMENT ÇA MARCHE ============ */

const STEPS = [
  {
    num: '01',
    title: 'Réservation',
    text: '3% de frais (min 150€, max 500€), non-remboursables sauf annulation de notre part.',
  },
  {
    num: '02',
    title: 'Container à 80%',
    text: "Seuil atteint : la production est lancée et l'acompte 27% est appelé.",
  },
  {
    num: '03',
    title: 'Production usine',
    text: '45 jours de production, contrôle qualité SGS indépendant avant chargement.',
  },
  {
    num: '04',
    title: 'Expédition + douane',
    text: '30 jours de transit maritime + dédouanement géré par Pros Import.',
  },
  {
    num: '05',
    title: 'Rendu port',
    text: 'Enlèvement libre, votre transporteur, ou mise en relation recommandée.',
    dark: true,
  },
] as const

export function ProcessSection() {
  return (
    <section id="comment" className={`${WRAP} scroll-mt-24 pt-16 lg:pt-[104px]`}>
      <div className={EYEBROW}>Le processus</div>
      <h2 className={`${H2} mb-10 max-w-[760px] lg:text-[40px]`}>
        Comment se déroule une commande container.
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {STEPS.map((step) => (
          <div
            key={step.num}
            className={
              'flex flex-col gap-2.5 rounded-2xl p-5 pb-6 ' +
              ('dark' in step && step.dark
                ? 'bg-foreground'
                : 'border border-[color:var(--sand-deep)] bg-white')
            }
          >
            <div
              className={
                'text-[34px] font-black tracking-[-0.02em] ' +
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
      <p className="mt-5 text-sm text-[color:var(--muted)]">
        Les détails complets sont dans la{' '}
        <a
          href="/legal/remboursement"
          className="underline underline-offset-2 hover:text-foreground"
        >
          politique de remboursement
        </a>{' '}
        et la <Link to="/faq" className="underline underline-offset-2 hover:text-foreground">FAQ achat groupé</Link>.
      </p>
    </section>
  )
}

/* ============ LIVRAISON ============ */

export function DeliverySection() {
  return (
    <section className={`${WRAP} pt-16 lg:pt-[104px]`}>
      <div className={EYEBROW}>Comment la livraison fonctionne</div>
      <h2 className={`${H2} mb-3 max-w-[760px] lg:text-[40px]`}>
        Notre prix s&apos;arrête au port d&apos;arrivée.
      </h2>
      <p className="mb-9 mt-0 max-w-[680px] text-[17px] text-[color:var(--color-text-secondary)]">
        Le transport final varie selon votre zone, votre quai et vos habitudes
        logistiques. Container Club ne prend aucune marge cachée dessus.
      </p>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-2.5 rounded-[18px] border border-[color:var(--sand-deep)] bg-white p-8">
          <h3 className="m-0 text-[19px] font-extrabold sm:text-[22px]">
            Enlèvement libre au port
          </h3>
          <p className="m-0 text-[15.5px] leading-normal text-[color:var(--color-text-secondary)]">
            Vous récupérez la marchandise au Havre ou à Marseille-Fos avec
            votre organisation habituelle.
          </p>
        </div>
        <div className="flex flex-col gap-2.5 rounded-[18px] border border-[color:var(--sand-deep)] bg-white p-8">
          <h3 className="m-0 text-[19px] font-extrabold sm:text-[22px]">
            Transporteur recommandé
          </h3>
          <p className="m-0 text-[15.5px] leading-normal text-[color:var(--color-text-secondary)]">
            Nous fournissons une liste de transporteurs présélectionnés à
            contacter directement.
          </p>
          <a
            href="/transport-partenaires"
            className="mt-1.5 w-max border-b-2 border-[color:var(--ember)] pb-0.5 text-[15px] font-bold text-foreground"
          >
            Voir les transporteurs →
          </a>
        </div>
      </div>
    </section>
  )
}

/* ============ FAQ (6 questions, une ouverte à la fois) ============ */

const FAQ = [
  {
    q: "Que se passe-t-il si le container n'atteint pas 80% de remplissage ?",
    a: "Tant que le seuil n'est pas atteint, rien n'est lancé et vous n'êtes débité que des frais de réservation. La collecte peut être prolongée de 2 semaines ; sinon le container est annulé et l'intégralité des sommes versées vous est remboursée sous 5 jours ouvrés, sans retenue.",
  },
  {
    q: "Que se passe-t-il si mon design n'atteint pas le MOQ de 50 ?",
    a: 'Trois options vous sont proposées : basculer vers un design confirmé au même prix, reporter votre ligne sur le container suivant sans frais, ou être remboursé sur cette ligne uniquement. Vous gardez la main, avec un délai clair pour choisir.',
  },
  {
    q: 'Quand suis-je débité, et de combien à chaque étape ?',
    a: 'Paiement en 3 étapes : 3% à la réservation (min 150€, max 500€), 27% au lancement à 80% (prévenu 48h avant), puis le solde de 70% une fois la production terminée et le contrôle SGS validé en usine.',
  },
  {
    q: "Qui s'occupe de la douane et de la TVA à l'import ?",
    a: "Tout est pris en charge par Pros Import EURL, votre importateur officiel français : déclaration, dédouanement, TVA à l'import autoliquidée et conformité (CE, REACH, classement au feu ERP). Vous recevez une facture française HT + TVA 20%, parfaitement déductible.",
  },
  {
    q: 'Quelle garantie sur les produits, et le SAV ?',
    a: "Garantie commerciale 2 ans sur pièces et structure, assurée en France. SAV par email sous 48h ouvrées, pièces détachées disponibles. L'éco-participation Eco-mobilier est incluse dans le prix.",
  },
  {
    q: 'Comment vérifiez-vous la qualité avant expédition ?',
    a: 'Avant chaque chargement, SGS — organisme indépendant — réalise un contrôle physique en usine (échantillonnage AQL 2.5 : dimensions, finitions, solidité, conformité). Un rapport photo/vidéo est partagé avec tous les pros engagés. Aucun container ne part sans cette validation.',
  },
] as const

export function HomeFaqSection() {
  const [open, setOpen] = useState<number>(0)

  return (
    <section className="mx-auto max-w-[900px] px-5 pt-16 sm:px-10 lg:pt-[104px]">
      <div className={EYEBROW}>Questions fréquentes</div>
      <h2 className={`${H2} mb-9 lg:text-[40px]`}>
        Tout ce qu&apos;il faut savoir avant de réserver.
      </h2>
      <div className="flex flex-col gap-3">
        {FAQ.map((item, index) => {
          const isOpen = open === index
          return (
            <div
              key={item.q}
              className="overflow-hidden rounded-[14px] border border-[color:var(--sand-deep)] bg-white"
            >
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? -1 : index)}
                className="flex w-full items-center justify-between gap-5 px-6 py-5 text-left"
              >
                <span className="text-[15px] font-bold text-foreground sm:text-[16.5px]">
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
                <div className="px-6 pb-[22px] text-[15px] leading-[1.55] text-[color:var(--color-text-secondary)]">
                  {item.a}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

/* ============ CTA FINAL + NEWSLETTER ============ */

export function FinalCtaSection({ onReserve }: { onReserve: () => void }) {
  return (
    <section className={`${WRAP} pt-16 lg:pt-[104px]`}>
      <div className="flex flex-wrap items-center justify-between gap-10 rounded-[22px] bg-foreground px-6 py-9 sm:px-14 sm:py-16">
        <div className="max-w-[600px]">
          <h2 className="m-0 text-[26px] font-extrabold leading-[1.06] tracking-[-0.02em] text-[#F9F6F0] sm:text-[38px]">
            Réservez votre volume sur le prochain container.
          </h2>
          <p className="mb-0 mt-4 text-[16.5px] leading-normal text-[rgba(244,239,231,.74)]">
            Les frais de réservation bloquent votre place. Le complément
            n&apos;est appelé qu&apos;au seuil de remplissage.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={onReserve}
            className="rounded-[11px] bg-[color:var(--ember)] px-8 py-4 text-center text-base font-bold text-white transition-colors hover:bg-[color:var(--ember-hover)]"
          >
            Confirmer ma réservation →
          </button>
          <span className="text-center text-[13px] text-[rgba(244,239,231,.6)]">
            Remboursé si le container ne part pas.
          </span>
        </div>
      </div>
    </section>
  )
}

export function NewsletterSection() {
  return (
    <section className={`${WRAP} py-16 lg:py-[104px]`}>
      <div className="flex flex-wrap items-center justify-between gap-8 rounded-[22px] border border-[color:var(--sand-deep)] px-5 py-7 sm:px-14 sm:py-12">
        <div className="max-w-[560px]">
          <h3 className="m-0 text-[22px] font-extrabold tracking-[-0.01em] sm:text-[26px]">
            Ne ratez pas le prochain départ.
          </h3>
          <p className="mb-0 mt-2.5 text-base leading-normal text-[color:var(--color-text-secondary)]">
            Les containers partent quand le seuil est atteint. Laissez votre
            email pour être prévenu en priorité à la prochaine ouverture. Pas
            de spam.
          </p>
        </div>
        <div className="min-w-[280px] flex-1 sm:min-w-[320px] sm:max-w-[460px]">
          <ContainerNotifyForm source="home-newsletter" />
        </div>
      </div>
    </section>
  )
}
