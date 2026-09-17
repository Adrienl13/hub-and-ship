import { useMemo, useState } from 'react'

import {
  PUBLIC_DISCOUNT_FAMILIES,
  describeFamilyTiersWithLabel,
} from '@/lib/pricing/discount-families'
import { getFamilyDiscountTiers } from '@/lib/pricing/public-rules'

// Simulateur de remise volume (handoff Prix prouvé). L'exemple porte sur une
// CHAISE : les paliers affichés sont donc ceux des assises, pris dans les
// règles publiques actives (mêmes valeurs que le panier/checkout). Les tables
// et les salons ont leurs propres seuils, rappelés sous le simulateur — sans
// quoi la page laisserait croire à une règle unique. Seul le prix de la chaise
// exemple (78 € HT) est illustratif, libellé comme tel.

const EXAMPLE_UNIT_PRICE_HT = 78

function formatAmount(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace('.', ',')
}

export function VolumeSimulator() {
  const assises = getFamilyDiscountTiers('assises')
  const options = useMemo(
    () => [
      { n: 50, discount: 0 },
      ...assises.map((tier) => ({
        n: tier.minUnits,
        discount: tier.discountPercent / 100,
      })),
    ],
    [assises],
  )
  const [selected, setSelected] = useState(0)
  const option = options[selected] ?? options[0]!

  const unit = EXAMPLE_UNIT_PRICE_HT * (1 - option.discount)
  const total = Math.round(unit * option.n)
  const reached = option.discount > 0

  return (
    <div className="flex flex-col gap-[22px] rounded-[20px] border border-[color:var(--sand-deep)] bg-white p-6 sm:p-10">
      <div>
        <div className="mb-3 text-[13px] font-bold uppercase tracking-[0.14em] text-[color:var(--ember)]">
          Les règles publiques
        </div>
        <h2 className="m-0 text-[26px] font-extrabold leading-[1.06] tracking-[-0.02em] sm:text-[34px]">
          Les remises ne se négocient pas. Elles se déclenchent.
        </h2>
      </div>
      <p className="m-0 text-base leading-[1.55] text-[color:var(--color-text-secondary)]">
        Mêmes paliers pour tous les professionnels, appliqués automatiquement
        au panier — sans code, sans négociation. Testez avec la chaise exemple
        à {EXAMPLE_UNIT_PRICE_HT} € HT :
      </p>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        {options.map((opt, index) => {
          const on = index === selected
          return (
            <button
              key={opt.n}
              type="button"
              onClick={() => setSelected(index)}
              aria-pressed={on}
              className={
                'flex-1 rounded-[11px] px-3 py-[13px] text-[15px] font-bold transition-colors ' +
                (on
                  ? 'border border-foreground bg-foreground text-[color:var(--sand)]'
                  : 'border border-[color:var(--border-strong)] bg-white text-[#4a443c] hover:border-foreground/40')
              }
            >
              {opt.n} pièces
            </button>
          )
        })}
      </div>
      <div className="flex flex-wrap items-end justify-between gap-5 rounded-[14px] border border-[#efe7d8] bg-[#faf5ec] px-6 py-[22px]">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-[color:var(--muted)]">
            Prix unitaire
          </div>
          <div className="mt-0.5 text-[34px] font-black tracking-[-0.02em] sm:text-[40px]">
            {formatAmount(unit)} €
            <span className="text-base font-semibold text-[color:var(--muted)]">
              {' '}
              HT
            </span>
          </div>
        </div>
        <div className="text-right">
          <div
            className={
              'inline-block rounded-full px-[13px] py-1.5 text-sm font-extrabold ' +
              (reached
                ? 'bg-[rgba(63,143,42,.12)] text-[color:var(--forest)]'
                : 'bg-[#efe7d8] text-[color:var(--muted)]')
            }
          >
            {reached
              ? `−${Math.round(option.discount * 100)} % appliqué`
              : 'Palier non atteint'}
          </div>
          <div className="mt-2 text-[13.5px] text-[color:var(--color-text-secondary)]">
            Total commande :{' '}
            <strong className="text-foreground">
              {total.toLocaleString('fr-FR')} € HT
            </strong>
          </div>
        </div>
      </div>
      <p className="m-0 text-[13.5px] leading-[1.55] text-[color:var(--color-text-secondary)]">
        Chaque famille a ses propres paliers, parce qu&apos;un salon de jardin
        et une chaise ne se commandent pas aux mêmes quantités —{' '}
        {PUBLIC_DISCOUNT_FAMILIES.map(describeFamilyTiersWithLabel).join(' ; ')}
        .
      </p>
    </div>
  )
}
