import { useState } from 'react'

// Graphique « même chaise, deux circuits » du hero Prix prouvé (handoff
// 07/2026). Les montants (42/78/119 €) sont un EXEMPLE ILLUSTRATIF assumé,
// libellé comme tel — chaque segment est survolable/tapable et raconte ce
// qu'il contient. Segment actif par défaut : « notre marge unique ».

interface Segment {
  readonly label: string
  readonly height: number
  readonly color: string
  readonly title: string
  readonly text: string
  readonly lightText?: boolean
}

const SHOWROOM: ReadonlyArray<Segment> = [
  {
    label: 'Usine 42 €',
    height: 120,
    color: '#5f584d',
    title: 'Prix usine (FOB)',
    text: "Ce que l'usine facture réellement, chargé au port de départ. Identique dans les deux circuits.",
  },
  {
    label: 'Importateur',
    height: 51,
    color: '#77502f',
    title: 'Marge importateur',
    text: "L'importateur classique achète en volume, stocke et revend aux grossistes avec sa marge.",
  },
  {
    label: 'Grossiste',
    height: 57,
    color: '#8f5c2f',
    title: 'Marge grossiste',
    text: 'Le grossiste distribue aux revendeurs régionaux — deuxième empilement de marge.',
  },
  {
    label: 'Distributeur',
    height: 54,
    color: '#a86730',
    title: 'Marge distributeur',
    text: 'Le distributeur régional livre les showrooms — troisième empilement.',
    lightText: true,
  },
  {
    label: 'Showroom',
    height: 57,
    color: '#c47332',
    title: 'Marge showroom',
    text: "Salle d'exposition, commerciaux, stock tampon : la marge finale la plus élevée du circuit.",
    lightText: true,
  },
]

const CLUB: ReadonlyArray<Segment> = [
  {
    label: 'Usine 42 €',
    height: 120,
    color: '#5f584d',
    title: 'Prix usine (FOB)',
    text: 'Le même prix usine — nous achetons aux mêmes usines, sans agent ni bureau d’achat.',
  },
  {
    label: 'Fret partagé',
    height: 26,
    color: '#3e6e50',
    title: 'Fret partagé',
    text: "Votre part du container 40' HC, au prorata du volume. Plus il se remplit, moins vous payez.",
  },
  {
    label: 'Douane + SGS',
    height: 29,
    color: '#4d8a5f',
    title: 'Douane + contrôle SGS',
    text: 'Dédouanement, taxes, conformité UE et inspection SGS indépendante — inclus, jamais en option.',
    lightText: true,
  },
  {
    label: '1 marge',
    height: 49,
    color: '#D97A34',
    title: 'Notre marge unique',
    text: "Sourcing, logistique, SAV France, garantie 2 ans. La seule marge du circuit — c'est ça, le prix prouvé.",
    lightText: true,
  },
]

const ALL = [...SHOWROOM, ...CLUB]

function Bar({
  segments,
  offset,
  active,
  onSelect,
  delayed,
}: {
  readonly segments: ReadonlyArray<Segment>
  readonly offset: number
  readonly active: number
  readonly onSelect: (index: number) => void
  readonly delayed?: boolean
}) {
  return (
    <div
      className="flex w-[110px] flex-col-reverse overflow-hidden rounded-[10px]"
      style={{
        transformOrigin: 'bottom',
        animation: `prix-growup .9s cubic-bezier(.2,.7,.2,1) ${delayed ? '.25s' : '0s'} both`,
      }}
    >
      {segments.map((segment, i) => {
        const index = offset + i
        return (
          <button
            key={segment.title + segment.label}
            type="button"
            onMouseEnter={() => onSelect(index)}
            onClick={() => onSelect(index)}
            aria-label={segment.title}
            aria-pressed={active === index}
            className="flex cursor-pointer items-center justify-center font-semibold"
            style={{
              height: segment.height,
              background: segment.color,
              color: segment.lightText ? '#fff' : 'rgba(244,239,231,.85)',
              fontSize: i === 0 ? 11.5 : 11,
              outline: active === index ? '2px solid #F9F6F0' : 'none',
              outlineOffset: -2,
            }}
          >
            {segment.label}
          </button>
        )
      })}
    </div>
  )
}

export function PriceChart({
  productHref,
}: {
  /** Lien « vérifier sur une vraie fiche produit » (fiche réelle du catalogue). */
  readonly productHref: string
}) {
  const [active, setActive] = useState(8)
  const segment = ALL[active] ?? ALL[8]!

  return (
    <div className="rounded-[20px] border border-[rgba(244,239,231,.14)] bg-[rgba(244,239,231,.06)] p-6 sm:px-10 sm:pb-7 sm:pt-9">
      <style>{`@keyframes prix-growup { from { transform: scaleY(0); } to { transform: scaleY(1); } }`}</style>
      <div className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-[rgba(244,239,231,.6)]">
        Même chaise, prix usine 42 € — chiffres illustratifs
      </div>
      <div className="mb-5 text-[12.5px] text-[rgba(244,239,231,.45)]">
        Survolez ou touchez chaque segment pour voir ce qu&apos;il contient.
      </div>
      <div className="flex items-end justify-center gap-8 sm:gap-12">
        <div className="flex flex-col items-center gap-3">
          <div className="text-[30px] font-black text-[#F9F6F0]">
            119 €
            <span className="text-sm font-semibold text-[rgba(244,239,231,.5)]">
              {' '}
              HT
            </span>
          </div>
          <Bar
            segments={SHOWROOM}
            offset={0}
            active={active}
            onSelect={setActive}
          />
          <div className="text-[13px] font-semibold text-[rgba(244,239,231,.6)]">
            Circuit showroom
          </div>
        </div>
        <div className="flex flex-col items-center gap-3">
          <div className="text-[30px] font-black text-[#8FC96F]">
            78 €
            <span className="text-sm font-semibold text-[rgba(244,239,231,.5)]">
              {' '}
              HT
            </span>
          </div>
          <Bar
            segments={CLUB}
            offset={5}
            active={active}
            onSelect={setActive}
            delayed
          />
          <div className="text-[13px] font-bold text-[#F9F6F0]">
            Container Club
          </div>
        </div>
      </div>
      <div className="mt-[18px] flex min-h-[58px] flex-col justify-center gap-1 rounded-xl border border-[rgba(244,239,231,.12)] bg-[rgba(244,239,231,.08)] px-[18px] py-3.5">
        <div className="text-[13px] font-extrabold text-[color:var(--ember-bright)]">
          {segment.title}
        </div>
        <div className="text-[13px] leading-[1.45] text-[rgba(244,239,231,.75)]">
          {segment.text}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-4 border-t border-[rgba(244,239,231,.12)] pt-4">
        <a
          href={productHref}
          className="border-b-2 border-[rgba(232,150,63,.4)] pb-0.5 text-[13.5px] font-bold text-[color:var(--ember-bright)] transition-colors hover:border-[color:var(--ember-bright)]"
        >
          Vérifier sur une vraie fiche produit →
        </a>
        <span className="whitespace-nowrap rounded-full border border-[rgba(143,201,111,.35)] bg-[rgba(143,201,111,.14)] px-3.5 py-[7px] text-[15px] font-extrabold text-[#8FC96F]">
          −34 %
        </span>
      </div>
    </div>
  )
}
