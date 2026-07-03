import { Check, Minus } from 'lucide-react'

import type { PartnerTargetStatus } from '@/lib/partner-applications'
import { PARTNER_STATUS_CARDS, type PartnerStatusCard } from './data'
import { SectionHead } from './sections'

export function PartnerStatusCards({
  recommended,
  onPickStatus,
}: {
  readonly recommended: ReadonlyArray<PartnerTargetStatus>
  readonly onPickStatus: (status: PartnerTargetStatus) => void
}) {
  return (
    <section id="statuts" className="py-14">
      <div className="mx-auto max-w-5xl px-6">
        <SectionHead eyebrow="Les 4 statuts" title="Choisissez comment vous gagnez" />
        <div className="grid gap-5 md:grid-cols-2">
          {PARTNER_STATUS_CARDS.map((card) => (
            <StatusCard
              key={card.status}
              card={card}
              highlighted={recommended.includes(card.status)}
              onPick={() => onPickStatus(card.status)}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

function StatusCard({
  card,
  highlighted,
  onPick,
}: {
  readonly card: PartnerStatusCard
  readonly highlighted: boolean
  readonly onPick: () => void
}) {
  return (
    <article
      className={`relative flex flex-col rounded-lg border bg-[color:var(--paper)] py-6 pl-9 pr-6 transition-all ${
        highlighted
          ? 'border-[color:var(--ember)] shadow-[0_0_0_2px_var(--ember-soft),0_6px_18px_rgba(184,92,31,0.10)]'
          : 'border-[color:var(--sand-deep)]'
      }`}
    >
      {highlighted && (
        <span className="mono absolute right-[-8px] top-4 rotate-[6deg] rounded-[3px] border-2 border-[color:var(--stamp)] bg-[color:var(--stamp-bg)]/60 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.1em] text-[color:var(--stamp)]">
          Recommandé pour vous
        </span>
      )}
      <span className="mono w-fit rounded-[3px] bg-[color:var(--ink)] px-2.5 py-1 text-[12.5px] font-bold tracking-[0.1em] text-[color:var(--sand-soft)]">
        {card.plate}
      </span>
      <h3 className="mt-3.5 text-xl font-extrabold">{card.title}</h3>
      <p className="mt-1 text-sm text-[color:var(--ink-soft)]">{card.tagline}</p>

      <div className="mt-4 rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-3.5 py-3 text-[14.5px]">
        <span className="mono mb-1.5 block text-[10.5px] uppercase tracking-[0.13em] text-[color:var(--muted)]">
          Comment vous gagnez
        </span>
        <b>{card.gainLead}</b>
        {card.gainRest}
      </div>

      <ul className="mt-4 flex-1 text-sm">
        {card.included.map((item) => (
          <li key={item} className="relative py-1.5 pl-6.5">
            <Check
              className="absolute left-0 top-2 h-3.5 w-3.5 text-[color:var(--forest)]"
              strokeWidth={3}
            />
            {item}
          </li>
        ))}
        <li className="mono mt-3.5 mb-0.5 list-none pl-0 text-[10.5px] uppercase tracking-[0.13em] text-[color:var(--stamp)]">
          Non inclus dans ce statut
        </li>
        {card.excluded.map((item) => (
          <li
            key={item}
            className="relative border-t-0 py-1.5 pl-6.5 text-[color:var(--ink-soft)]"
          >
            <Minus
              className="absolute left-0 top-2 h-3.5 w-3.5 text-[color:var(--stamp)]"
              strokeWidth={3}
            />
            {item}
          </li>
        ))}
      </ul>

      <p className="mt-4 text-[12.5px] text-[color:var(--muted)]">
        <b className="font-semibold text-[color:var(--ink-soft)]">Conditions :</b>{' '}
        {card.conditions}
      </p>
      {card.zoneBadge && (
        <p className="mono mt-2.5 text-[11px] tracking-[0.04em] text-[color:var(--info)]">
          {card.zoneBadge}
        </p>
      )}

      <button
        type="button"
        onClick={onPick}
        className="mt-4.5 inline-flex w-fit items-center justify-center rounded-[4px] bg-[color:var(--ink)] px-5 py-2.5 text-sm font-semibold text-[color:var(--sand-soft)] transition-colors hover:bg-[#2a2a2c]"
      >
        {card.cta}
      </button>
    </article>
  )
}
