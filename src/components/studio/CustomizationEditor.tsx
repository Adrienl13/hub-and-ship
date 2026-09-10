import {
  CUSTOMIZATION_FIELDS,
  STATUS_LABEL,
  capabilityFor,
  type CustomizationTarget,
  type CustomerSelection,
  type CapabilityData,
  type CustomizationKind,
} from '@/lib/studio/customization'
const control =
  'min-h-[44px] w-full rounded-md border border-[color:var(--sand-deep)] bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ink)]'
export function CustomizationEditor({
  title,
  target,
  selections,
  data,
  onChange,
}: {
  title: string
  target: CustomizationTarget
  selections: CustomerSelection[]
  data: CapabilityData
  onChange: (rows: CustomerSelection[]) => void
}) {
  const update = (
    kind: CustomizationKind,
    patch: Partial<CustomerSelection>,
  ) => {
    const previous = selections.find((s) => s.kind === kind) ?? {
      kind,
      value: '',
      note: '',
      requested: false,
    }
    onChange([
      ...selections.filter((s) => s.kind !== kind),
      { ...previous, ...patch },
    ])
  }
  return (
    <fieldset className="space-y-4 rounded-lg border border-[color:var(--sand-deep)] p-4">
      <legend className="px-2 font-semibold">{title}</legend>
      {(
        Object.entries(CUSTOMIZATION_FIELDS[target.scope]) as [
          CustomizationKind,
          string,
        ][]
      ).map(([kind, label]) => {
        const cap = capabilityFor(target, kind, data),
          selection = selections.find((s) => s.kind === kind)
        const special = kind.endsWith('_request')
        const status = cap?.status ?? 'unknown'
        const disabled = status === 'unavailable'
        const textAllowed =
          !cap || status === 'unknown' || cap.allows_free_text || special
        return (
          <div key={kind} className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">{label}</span>
              <span className="text-xs text-[color:var(--ink-soft)]">
                {STATUS_LABEL[status]}
              </span>
            </div>
            {cap && cap.values.length > 0 && !special && (
              <label className="block text-xs">
                Choix — {label}
                <select
                  aria-label={`${title} — ${label}`}
                  className={control}
                  disabled={disabled}
                  value={selection?.value ?? ''}
                  onChange={(e) => update(kind, { value: e.target.value })}
                >
                  <option value="">Conserver le choix catalogue</option>
                  {selection?.value &&
                    !cap.values.includes(selection.value) && (
                      <option value={selection.value}>
                        {selection.value} — à reconfirmer
                      </option>
                    )}
                  {cap.values.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {(special || (cap && !cap.values.length && !textAllowed)) && (
              <label className="flex min-h-[44px] items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={selection?.requested ?? false}
                  onChange={(e) =>
                    update(kind, {
                      requested: e.target.checked,
                      ...(!e.target.checked ? { note: '' } : {}),
                    })
                  }
                />
                Demander : {label}
              </label>
            )}
            {textAllowed && (!special || selection?.requested) && (
              <label className="block text-xs">
                {special
                  ? 'Précisions'
                  : status === 'unknown'
                    ? 'Votre souhait (à confirmer)'
                    : 'Précisions facultatives'}{' '}
                — {label}
                <textarea
                  aria-label={`${title} — Précisions ${label}`}
                  disabled={disabled}
                  className={control}
                  maxLength={600}
                  value={selection?.note ?? ''}
                  onChange={(e) => update(kind, { note: e.target.value })}
                />
              </label>
            )}
            {disabled && (
              <p className="text-xs">
                Option indisponible pour cette référence. Vous pouvez préciser
                un autre besoin dans la note de votre projet.
              </p>
            )}
            {selection &&
              (selection.value || selection.note || selection.requested) && (
                <button
                  type="button"
                  className="min-h-[44px] text-xs underline"
                  onClick={() =>
                    onChange(selections.filter((s) => s.kind !== kind))
                  }
                >
                  Effacer — {label}
                </button>
              )}
          </div>
        )
      })}
    </fieldset>
  )
}
