import { qualityOf } from '@/lib/studio/data-quality'
import { useState } from 'react'
import { formatEUR } from '@/lib/order'
import { TABLE_TOP_SHAPE_LABEL } from '@/lib/table-composer'
import type { StudioProduct } from '@/lib/studio/types'
import type { TableConfiguration } from '@/lib/studio/table-project'
import { StudioChoiceCard, studioButton } from './StudioChoices'
export function TabletopPicker({
  products,
  selection,
  onSelect,
  onCustom,
}: {
  products: ReadonlyArray<StudioProduct>
  selection: TableConfiguration['top']
  onSelect: (product: StudioProduct, variantId: string) => void
  onCustom: () => void
}) {
  const current = products.find((p) => p.id === selection?.productId)
  const [shape, setShape] = useState(current?.tableShape ?? null)
  const sizeOf = (p: StudioProduct) =>
    `${p.dimensions.l} × ${p.dimensions.w} cm`
  const [dimension, setDimension] = useState(current ? sizeOf(current) : '')
  const tops = products.filter(
    (p) =>
      p.isActive &&
      p.studio.studioRole === 'tabletop' &&
      p.category === 'table_top',
  )
  const valid = tops.filter(
    (p) =>
      p.tableShape &&
      p.dimensions.l > 0 &&
      p.dimensions.w > 0 &&
      p.variants.length > 0,
  )
  const filtered = valid.filter((p) => p.tableShape === shape)
  const sizes = [...new Set(filtered.map(sizeOf))]
  const choices = filtered.filter((p) => sizeOf(p) === dimension)
  return (
    <section aria-label="Choisir le plateau" className="space-y-7">
      {!valid.length && (
        <p role="status">
          Aucun plateau Studio prêt pour le moment. Vous pouvez conserver un
          besoin sur mesure.
        </p>
      )}
      <fieldset>
        <legend className="mb-3 text-sm font-semibold">
          Quelle forme pour vos tables ?
        </legend>
        <div className="flex flex-wrap gap-3">
          {(['rectangular', 'round'] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={shape === value}
              className={`${studioButton} ${shape === value ? 'bg-[color:var(--ink)] text-[color:var(--sand)]' : ''}`}
              onClick={() => {
                setShape(value)
                setDimension('')
              }}
            >
              {TABLE_TOP_SHAPE_LABEL[value]}
            </button>
          ))}
        </div>
      </fieldset>
      {shape && (
        <fieldset>
          <legend className="mb-3 text-sm font-semibold">Dimension</legend>
          <div className="flex flex-wrap gap-3">
            {sizes.map((size) => (
              <button
                key={size}
                type="button"
                aria-pressed={dimension === size}
                className={`${studioButton} ${dimension === size ? 'bg-[color:var(--ink)] text-[color:var(--sand)]' : ''}`}
                onClick={() => setDimension(size)}
              >
                {shape === 'round' ? `Ø ${size.split(' × ')[0]} cm` : size}
              </button>
            ))}
          </div>
          {!sizes.length && (
            <p className="mt-3 text-sm">
              Aucune dimension disponible pour cette forme.
            </p>
          )}
        </fieldset>
      )}
      {dimension && (
        <div>
          <h2 className="mb-3 text-sm font-semibold">Finition</h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {choices.flatMap((p) =>
              p.variants.map((v) => (
                <StudioChoiceCard
                  key={`${p.id}:${v.id}`}
                  image={v.imageUrl || p.mainImageUrl}
                  title={v.name}
                  detail={`${p.name} · ${sizeOf(p)}`}
                  selected={
                    selection?.productId === p.id &&
                    selection.variantId === v.id
                  }
                  onSelect={() => onSelect(p, v.id)}
                >
                  <p className="pt-2 text-sm">
                    {p.basePriceHt > 0 &&
                    p.visibility !== 'on_request' &&
                    qualityOf(p.studio.dataQuality, 'price').status ===
                      'verified'
                      ? `${formatEUR(p.basePriceHt)} HT / plateau`
                      : 'Prix à confirmer'}
                  </p>
                  <p className="text-xs text-[color:var(--ink-soft)]">
                    {p.moqUnits > 0
                      ? `Série indicative : ${p.moqUnits}`
                      : 'Minimum à confirmer'}
                    {v.minOrderUnits ? ` · coloris : ${v.minOrderUnits}` : ''}
                  </p>
                </StudioChoiceCard>
              )),
            )}
          </div>
        </div>
      )}
      {tops.some(
        (p) =>
          !p.tableShape ||
          p.dimensions.l <= 0 ||
          p.dimensions.w <= 0 ||
          !p.variants.length,
      ) && (
        <p className="text-sm text-[color:var(--ink-soft)]">
          Certains plateaux attendent leurs dimensions, leur forme ou leurs
          finitions. Ils ne sont pas proposés comme configurations validées.
        </p>
      )}
      <button
        type="button"
        onClick={onCustom}
        className={`${studioButton} underline underline-offset-4`}
      >
        Autre dimension ?
      </button>
    </section>
  )
}
