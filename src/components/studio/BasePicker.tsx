import { qualityOf } from '@/lib/studio/data-quality'
import {
  resolveTableCompatibility,
  type TableCompatibilityData,
} from '@/lib/studio/compatibility'
import type { StudioProduct } from '@/lib/studio/types'
import type { TableConfiguration } from '@/lib/studio/table-project'
import { formatEUR } from '@/lib/order'
import { StudioChoiceCard, studioButton } from './StudioChoices'
export function BasePicker({
  top,
  products,
  data,
  selected,
  onSelect,
  onVerify,
  requested,
}: {
  top: StudioProduct
  products: ReadonlyArray<StudioProduct>
  data: TableCompatibilityData
  selected: TableConfiguration['base']
  onSelect: (p: StudioProduct, variantId: string) => void
  onVerify: () => void
  requested: boolean
}) {
  const bases = products.filter(
    (p) =>
      p.isActive &&
      p.studio.studioRole === 'base' &&
      p.category === 'table_base' &&
      p.variants.length > 0,
  )
  const allowed = bases.filter(
    (p) => resolveTableCompatibility(top, p, data).verdict === 'allowed',
  )
  return (
    <section aria-label="Choisir le piètement" className="space-y-4">
      <div>
        <p className="label-eyebrow text-[color:var(--ember)]">Le piètement</p>
        <h2 className="mt-2 text-2xl font-bold">
          La bonne base pour votre plateau
        </h2>
        <p className="mt-2 text-sm text-[color:var(--ink-soft)]">
          Seules les compatibilités déclarées sont proposées.
        </p>
      </div>
      {!data.available && (
        <p role="status" className="text-sm">
          Les règles de compatibilité ne sont pas disponibles. Aucune
          combinaison ne peut être confirmée pour le moment.
        </p>
      )}
      {!bases.length && <p>Aucun piètement Studio prêt pour le moment.</p>}
      {allowed.length ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {allowed.flatMap((p) =>
            p.variants.map((v) => (
              <StudioChoiceCard
                key={`${p.id}:${v.id}`}
                image={v.imageUrl || p.mainImageUrl}
                title={p.name}
                detail={v.name}
                selected={
                  selected?.productId === p.id && selected.variantId === v.id
                }
                onSelect={() => onSelect(p, v.id)}
              >
                <p className="pt-2 text-sm">
                  {p.basePriceHt > 0 &&
                  p.visibility !== 'on_request' &&
                  qualityOf(p.studio.dataQuality, 'price').status === 'verified'
                    ? `${formatEUR(p.basePriceHt)} HT / piètement`
                    : 'Prix à confirmer'}
                </p>
                <p className="text-xs">
                  {p.moqUnits > 0
                    ? `Série indicative : ${p.moqUnits}`
                    : 'Minimum à confirmer'}
                </p>
              </StudioChoiceCard>
            )),
          )}
        </div>
      ) : (
        <p className="border-l-2 border-[color:var(--ember)] pl-4">
          Aucun piètement compatible vérifié pour cette configuration.
        </p>
      )}
      {!selected && (
        <button
          type="button"
          onClick={onVerify}
          disabled={requested}
          className={studioButton}
        >
          {requested
            ? 'Vérification à prévoir dans votre projet'
            : 'Demander une vérification'}
        </button>
      )}
      {requested && (
        <p role="status" className="text-sm">
          Le besoin est conservé sur cet appareil. Aucune demande n’a encore été
          envoyée.
        </p>
      )}
    </section>
  )
}
