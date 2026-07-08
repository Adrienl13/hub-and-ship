import { ArrowDown, ArrowRight, BadgeCheck } from 'lucide-react'

import {
  BRASSEUR_STEPS,
  COMPARISON_HEAD,
  COMPARISON_ROWS,
  PARTNER_FAQ,
  PARTNER_STATS,
  PROCESS_STEPS,
} from './data'

const HERO_TRUST_CHIPS = [
  'Vérification SIRET sous 48 h',
  'Commissions sur CA encaissé',
  'Zéro stock, zéro avance',
] as const

export function PartnerHero({ onApply }: { readonly onApply: () => void }) {
  return (
    <section className="relative overflow-hidden border-b border-[color:var(--sand-deep)] py-16 md:py-20">
      {/* Halo discret pour donner de la profondeur sans image. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 -top-40 h-[480px] w-[480px] rounded-full bg-[color:var(--ember)]/10 blur-3xl"
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 lg:grid-cols-[1.15fr_1fr]">
        <div>
          <div className="mb-5 flex items-center gap-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--ember)]" />
            <span className="mono text-[11px] uppercase tracking-[0.14em] text-[color:var(--ink-soft)]">
              Programme partenaires · Manifeste CC-2026-P01
            </span>
          </div>
          <h1 className="max-w-[16ch] font-display text-4xl font-black leading-[1.04] tracking-tight sm:text-5xl md:text-6xl">
            Vos clients ont des terrasses.{' '}
            <em className="not-italic text-[color:var(--ember)]">
              Nous avons les containers.
            </em>
          </h1>
          <p className="mt-5 max-w-[54ch] text-[17px] leading-relaxed text-[color:var(--ink-soft)]">
            Quatre statuts partenaires pour gagner sur le mobilier CHR sans les
            risques de l’import : commission, marge de revente, conditions grand
            compte ou exclusivité territoriale. Vous choisissez le niveau
            d’engagement — nous gérons l’usine, la douane, la garantie et le
            SAV.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onApply}
              className="inline-flex h-12 items-center gap-2 rounded-[4px] bg-[color:var(--ember)] px-6 text-[15px] font-semibold text-white transition-colors hover:bg-[color:var(--ember-hover)]"
            >
              Devenir partenaire
              <ArrowRight className="h-4 w-4" />
            </button>
            <a
              href="#statuts"
              className="inline-flex h-12 items-center gap-2 rounded-[4px] border border-[color:var(--border-strong)] px-6 text-[15px] font-semibold transition-colors hover:border-[color:var(--ink)]"
            >
              Comparer les 4 statuts
              <ArrowDown className="h-4 w-4" />
            </a>
          </div>
          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
            {HERO_TRUST_CHIPS.map((chip) => (
              <li
                key={chip}
                className="inline-flex items-center gap-1.5 text-[13px] text-[color:var(--ink-soft)]"
              >
                <BadgeCheck className="h-3.5 w-3.5 text-[color:var(--forest)]" />
                {chip}
              </li>
            ))}
          </ul>
        </div>

        {/* Panneau chiffres : la promesse du programme, lisible en 3 secondes. */}
        <div className="relative">
          <div
            aria-hidden
            className="absolute -inset-1.5 rounded-xl bg-[color:var(--ink)]/[0.04]"
          />
          <dl className="relative grid grid-cols-2 overflow-hidden rounded-lg border border-[color:var(--sand-deep)] bg-[color:var(--paper)] shadow-paper">
            {PARTNER_STATS.map((stat, index) => (
              <div
                key={stat.label}
                className={`p-6 ${index % 2 === 0 ? 'border-r' : ''} ${
                  index < 2 ? 'border-b' : ''
                } border-[color:var(--sand-deep)]`}
              >
                <dt className="font-display text-3xl font-black tracking-tight text-[color:var(--ember)] md:text-4xl">
                  {stat.value}
                </dt>
                <dd className="mt-1.5 text-[13px] leading-snug text-[color:var(--ink-soft)]">
                  {stat.label}
                </dd>
              </div>
            ))}
            <div className="col-span-2 border-t border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-6 py-3.5">
              <p className="mono text-[10.5px] uppercase tracking-[0.12em] text-[color:var(--muted)]">
                Pros Import EURL · importateur officiel · contrôle SGS ·
                garantie 2 ans
              </p>
            </div>
          </dl>
        </div>
      </div>
    </section>
  )
}

export function PartnerBrasseurs({ onApply }: { onApply: () => void }) {
  return (
    <section className="py-14">
      <div className="mx-auto max-w-5xl px-6">
        <div className="relative overflow-hidden rounded-[10px] bg-[color:var(--ink)] px-9 py-10 text-[color:var(--sand-soft)]">
          <span className="mono text-[11px] uppercase tracking-[0.14em] text-[color:var(--ember-soft)]">
            Réseaux &amp; tournées · Distributeurs boissons
          </span>
          <h2 className="mt-2.5 max-w-[24ch] font-display text-2xl font-black md:text-3xl">
            Vous livrez déjà les terrasses. Faites-les aussi rapporter.
          </h2>
          <p className="mt-3.5 max-w-[62ch] text-[15.5px] text-[#d8d2c6]">
            Vos clients CHR renouvellent leur mobilier extérieur tous les 3 à 5
            ans — aujourd’hui sans vous. Un corner démo dans votre dépôt, un QR
            code sur vos tournées : chaque terrasse équipée vous rapporte 8%,
            sans un seul carton à stocker ni une facture à émettre. Quand les
            volumes suivent, vous passez revendeur agréé et le mobilier entre à
            votre catalogue, à votre marge.
          </p>
          <div className="mt-6 grid gap-3.5 md:grid-cols-3">
            {BRASSEUR_STEPS.map((step) => (
              <div
                key={step.tag}
                className="rounded-md border border-[color:var(--sand-soft)]/20 p-4"
              >
                <span className="mono text-[11px] tracking-[0.12em] text-[color:var(--ember-soft)]">
                  {step.tag}
                </span>
                <b className="mt-1.5 block text-[14.5px]">{step.title}</b>
                <span className="mt-1 block text-[13px] text-[#b8b1a4]">
                  {step.desc}
                </span>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={onApply}
            className="mt-6 inline-flex items-center justify-center rounded-[4px] bg-[color:var(--ember)] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[color:var(--ember-hover)]"
          >
            Équiper mon dépôt d’un corner démo
          </button>
        </div>
      </div>
    </section>
  )
}

function comparisonCell(value: string) {
  if (value === 'Non' || value === 'Non — nous')
    return <span className="font-bold text-[color:var(--stamp)]">{value}</span>
  if (value.startsWith('Oui'))
    return <span className="font-bold text-[color:var(--forest)]">{value}</span>
  return value
}

export function PartnerComparison() {
  return (
    <section className="py-14">
      <div className="mx-auto max-w-5xl px-6">
        <SectionHead eyebrow="Comparatif" title="Les 4 statuts, côte à côte" />
        <div className="overflow-x-auto rounded-lg border border-[color:var(--sand-deep)] bg-[color:var(--paper)]">
          <table className="w-full min-w-[820px] border-collapse text-[13.5px]">
            <thead>
              <tr>
                <th className="border-b border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] p-3.5 text-left" />
                {COMPARISON_HEAD.map((head) => (
                  <th
                    key={head}
                    className="mono whitespace-nowrap border-b border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] p-3.5 text-left text-[11px] uppercase tracking-[0.1em] text-[color:var(--ink-soft)]"
                  >
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row) => (
                <tr key={row.label}>
                  <td className="whitespace-nowrap border-b border-[color:var(--sand-deep)] p-3.5 font-semibold text-[color:var(--ink)]">
                    {row.label}
                  </td>
                  {row.cells.map((cell, index) => (
                    <td
                      key={index}
                      className="border-b border-[color:var(--sand-deep)] p-3.5"
                    >
                      {comparisonCell(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[12.5px] text-[color:var(--muted)]">
          <b className="text-[color:var(--ink-soft)]">
            Règle commune à tous les statuts :
          </b>{' '}
          commissions et RFA sont calculées uniquement sur le chiffre d’affaires
          réellement encaissé. Les grilles tarifaires partenaires sont
          communiquées après validation du statut — jamais publiées.
        </p>
      </div>
    </section>
  )
}

export function PartnerSteps() {
  return (
    <section className="py-14">
      <div className="mx-auto max-w-5xl px-6">
        <SectionHead
          eyebrow="Démarrage"
          title="De la candidature aux premiers gains"
        />
        <div className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Fil conducteur entre les étapes (desktop). */}
          <div
            aria-hidden
            className="absolute left-[12%] right-[12%] top-[38px] hidden h-px bg-[color:var(--sand-deep)] lg:block"
          />
          {PROCESS_STEPS.map((step, index) => (
            <div
              key={step.num}
              className="relative rounded-lg border border-[color:var(--sand-deep)] bg-[color:var(--paper)] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(26,26,28,0.07)]"
            >
              <span
                className={`mono inline-flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-bold ${
                  index === PROCESS_STEPS.length - 1
                    ? 'bg-[color:var(--forest)] text-white'
                    : 'bg-[color:var(--ember)] text-white'
                }`}
              >
                {step.num}
              </span>
              <b className="mt-3 block text-[15.5px]">{step.title}</b>
              <span className="mt-1.5 block text-[13.5px] text-[color:var(--ink-soft)]">
                {step.desc}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function PartnerFaqSection() {
  return (
    <section className="py-14">
      <div className="mx-auto max-w-5xl px-6">
        <SectionHead
          eyebrow="Questions fréquentes"
          title="Ce que les partenaires demandent"
        />
        <div className="grid gap-4 md:grid-cols-2">
          {PARTNER_FAQ.map((item) => (
            <div
              key={item.q}
              className="rounded-lg border border-[color:var(--sand-deep)] bg-[color:var(--paper)] p-5"
            >
              <b className="text-[15px]">{item.q}</b>
              <p className="mt-1.5 text-sm text-[color:var(--ink-soft)]">
                {item.a}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function SectionHead({
  eyebrow,
  title,
}: {
  readonly eyebrow: string
  readonly title: string
}) {
  return (
    <div className="mb-7">
      <span className="mono block text-[11px] uppercase tracking-[0.14em] text-[color:var(--ink-soft)]">
        {eyebrow}
      </span>
      <h2 className="mt-1.5 font-display text-2xl font-black tracking-tight md:text-3xl">
        {title}
      </h2>
    </div>
  )
}
