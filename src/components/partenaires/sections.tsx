import {
  BRASSEUR_STEPS,
  COMPARISON_HEAD,
  COMPARISON_ROWS,
  PARTNER_FAQ,
  PARTNER_STATS,
  PROCESS_STEPS,
} from './data'

export function PartnerHero() {
  return (
    <section className="relative overflow-hidden border-b border-[color:var(--sand-deep)] py-16">
      <div className="mx-auto grid max-w-5xl gap-9 px-6">
        <div>
          <div className="mb-5 flex items-center gap-2.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--ember)]" />
            <span className="mono text-[11px] uppercase tracking-[0.14em] text-[color:var(--ink-soft)]">
              Programme partenaires · Manifeste CC-2026-P01
            </span>
          </div>
          <h1 className="max-w-[15ch] font-display text-4xl font-black leading-[1.04] tracking-tight sm:text-5xl md:text-6xl">
            Vos clients ont des terrasses.{' '}
            <em className="not-italic text-[color:var(--ember)]">
              Nous avons les containers.
            </em>
          </h1>
          <p className="mt-4 max-w-[56ch] text-[17px] text-[color:var(--ink-soft)]">
            Quatre statuts partenaires pour gagner sur le mobilier CHR sans les
            risques de l’import : commission, marge de revente, conditions grand
            compte ou exclusivité territoriale. Vous choisissez le niveau
            d’engagement — nous gérons l’usine, la douane, la garantie et le SAV.
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-[color:var(--border-strong)] bg-[color:var(--border-strong)] md:grid-cols-4">
          {PARTNER_STATS.map((stat) => (
            <div key={stat.label} className="bg-[color:var(--sand-soft)] p-4">
              <dt className="mono text-2xl font-bold tracking-tight">
                {stat.value}
              </dt>
              <dd className="mt-1 text-[12.5px] text-[color:var(--ink-soft)]">
                {stat.label}
              </dd>
            </div>
          ))}
        </dl>
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PROCESS_STEPS.map((step) => (
            <div
              key={step.num}
              className="rounded-lg border border-[color:var(--sand-deep)] bg-[color:var(--paper)] p-5"
            >
              <span className="mono text-[13px] font-bold text-[color:var(--ember)]">
                {step.num}
              </span>
              <b className="mt-2 block text-[15.5px]">{step.title}</b>
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
