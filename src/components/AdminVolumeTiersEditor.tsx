import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  DISCOUNT_FAMILIES,
  DISCOUNT_FAMILY_LABEL,
  MAX_VOLUME_DISCOUNT_PERCENT,
  type DiscountFamily,
} from '@/lib/pricing/discount-families'
import type { VolumeFamilyTiers } from '@/lib/pricing/public-rules'
import type { VolumeDiscountFamiliesJson } from '@/lib/supabase/types'

/**
 * Grille de remise volume, famille par famille.
 *
 * Tant qu'elle est désactivée, le site compte TOUTES les pièces du panier et
 * applique la grille unique (les champs « Palier 2 / Palier 3 » au-dessus).
 * Activée, chaque famille compte ses propres pièces et suit ses propres
 * paliers — un salon de jardin et une chaise ne déclenchent pas un volume au
 * même seuil.
 *
 * Le format stocké accepte un nombre quelconque de paliers ; cet éditeur en
 * expose deux par famille, comme la grille unique qu'il remplace.
 */

export interface VolumeTiersDraft {
  readonly enabled: boolean
  readonly rows: Record<DiscountFamily, FamilyDraft>
}

interface FamilyDraft {
  readonly qty1: string
  readonly discount1: string
  readonly qty2: string
  readonly discount2: string
}

function emptyRow(qty1: number, discount1: number, qty2: number, discount2: number): FamilyDraft {
  return {
    qty1: String(qty1),
    discount1: String(discount1),
    qty2: String(qty2),
    discount2: String(discount2),
  }
}

/** Pré-remplissage : la grille unique actuelle, pour chaque famille. */
function draftFromValue(
  value: VolumeFamilyTiers | null,
  fallback: { readonly qty2: number; readonly discount2: number; readonly qty3: number; readonly discount3: number },
): VolumeTiersDraft {
  const rows = {} as Record<DiscountFamily, FamilyDraft>
  for (const family of DISCOUNT_FAMILIES) {
    const tiers = value?.[family]
    rows[family] =
      tiers && tiers.length >= 2
        ? emptyRow(
            tiers[0]!.minUnits,
            tiers[0]!.discountPercent,
            tiers[1]!.minUnits,
            tiers[1]!.discountPercent,
          )
        : emptyRow(
            fallback.qty2,
            fallback.discount2,
            fallback.qty3,
            fallback.discount3,
          )
  }
  return { enabled: value !== null, rows }
}

function toNumber(raw: string): number {
  const parsed = Number(raw.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

/**
 * Transforme la saisie en grille stockable. Renvoie `null` si l'éditeur est
 * désactivé, ou un message d'erreur si la saisie ne tient pas debout — les
 * mêmes règles que la contrainte SQL, pour que l'admin lise l'erreur ici et
 * pas dans un échec de base incompréhensible.
 */
export function buildVolumeFamiliesPayload(
  draft: VolumeTiersDraft,
): { readonly payload: VolumeDiscountFamiliesJson | null } | { readonly error: string } {
  if (!draft.enabled) return { payload: null }

  const payload: Record<string, Array<{ min_units: number; discount: number }>> =
    {}
  for (const family of DISCOUNT_FAMILIES) {
    const row = draft.rows[family]
    const label = DISCOUNT_FAMILY_LABEL[family]
    const tiers = [
      { min_units: toNumber(row.qty1), discount: toNumber(row.discount1) / 100 },
      { min_units: toNumber(row.qty2), discount: toNumber(row.discount2) / 100 },
    ]
    for (const tier of tiers) {
      if (!Number.isFinite(tier.min_units) || !Number.isFinite(tier.discount)) {
        return { error: `${label} : seuil ou remise illisible.` }
      }
      if (tier.min_units < 1) {
        return { error: `${label} : le seuil doit valoir au moins 1 pièce.` }
      }
      if (tier.discount <= 0) {
        return { error: `${label} : la remise doit être supérieure à 0 %.` }
      }
      if (tier.discount * 100 > MAX_VOLUME_DISCOUNT_PERCENT) {
        return {
          error: `${label} : au-delà de ${MAX_VOLUME_DISCOUNT_PERCENT} %, un client direct paierait moins cher qu'un revendeur.`,
        }
      }
    }
    if (tiers[1]!.min_units <= tiers[0]!.min_units) {
      return { error: `${label} : le second seuil doit être plus haut que le premier.` }
    }
    if (tiers[1]!.discount <= tiers[0]!.discount) {
      return { error: `${label} : le second palier doit remiser davantage.` }
    }
    payload[family] = tiers.map((tier) => ({
      min_units: Math.round(tier.min_units),
      discount: Math.round(tier.discount * 10000) / 10000,
    }))
  }
  return { payload }
}

export function AdminVolumeTiersEditor({
  value,
  fallback,
  onChange,
}: {
  readonly value: VolumeFamilyTiers | null
  readonly fallback: {
    readonly qty2: number
    readonly discount2: number
    readonly qty3: number
    readonly discount3: number
  }
  readonly onChange: (draft: VolumeTiersDraft) => void
}) {
  const [draft, setDraft] = useState<VolumeTiersDraft>(() =>
    draftFromValue(value, fallback),
  )

  useEffect(() => {
    const next = draftFromValue(value, fallback)
    setDraft(next)
    onChange(next)
    // Rejouer la grille active quand la version de paramètres change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  function update(next: VolumeTiersDraft): void {
    setDraft(next)
    onChange(next)
  }

  function setField(
    family: DiscountFamily,
    field: keyof FamilyDraft,
    raw: string,
  ): void {
    update({
      ...draft,
      rows: { ...draft.rows, [family]: { ...draft.rows[family], [field]: raw } },
    })
  }

  const check = buildVolumeFamiliesPayload(draft)
  const error = 'error' in check ? check.error : null

  return (
    <div className="rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="label-eyebrow text-muted-foreground">
            Remises volume par famille
          </div>
          <p className="mt-1 max-w-xl text-xs text-muted-foreground">
            {draft.enabled
              ? 'Chaque famille compte ses propres pièces et suit ses propres paliers. Les champs « Palier 2 / Palier 3 » ci-dessus ne servent plus qu’aux catégories non classées.'
              : 'Désactivé : toutes les pièces du panier sont comptées ensemble et suivent la grille unique ci-dessus.'}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant={draft.enabled ? 'outline' : 'default'}
          onClick={() => update({ ...draft, enabled: !draft.enabled })}
        >
          {draft.enabled ? 'Revenir à la grille unique' : 'Activer par famille'}
        </Button>
      </div>

      {draft.enabled && (
        <>
          <div className="mt-3 space-y-2">
            {DISCOUNT_FAMILIES.map((family) => (
              <div
                key={family}
                className="grid grid-cols-2 gap-2 rounded-sm border border-[color:var(--sand-deep)] bg-card p-2 sm:grid-cols-5"
              >
                <div className="col-span-2 self-center text-sm font-medium sm:col-span-1">
                  {DISCOUNT_FAMILY_LABEL[family]}
                </div>
                <TierInput
                  label="Dès (pièces)"
                  value={draft.rows[family].qty1}
                  onChange={(raw) => setField(family, 'qty1', raw)}
                />
                <TierInput
                  label="Remise (%)"
                  value={draft.rows[family].discount1}
                  onChange={(raw) => setField(family, 'discount1', raw)}
                />
                <TierInput
                  label="Puis dès"
                  value={draft.rows[family].qty2}
                  onChange={(raw) => setField(family, 'qty2', raw)}
                />
                <TierInput
                  label="Remise (%)"
                  value={draft.rows[family].discount2}
                  onChange={(raw) => setField(family, 'discount2', raw)}
                />
              </div>
            ))}
          </div>

          <p className="mt-2 text-[11px] text-muted-foreground">
            « Autres pièces » s’applique à une catégorie ajoutée au catalogue
            qui ne serait encore rattachée à aucune famille.
          </p>

          {error && (
            <p className="mt-2 rounded-sm bg-[color:var(--destructive)]/10 px-2 py-1.5 text-xs text-[color:var(--destructive)]">
              {error}
            </p>
          )}
        </>
      )}
    </div>
  )
}

function TierInput({
  label,
  value,
  onChange,
}: {
  readonly label: string
  readonly value: string
  readonly onChange: (raw: string) => void
}) {
  return (
    <label className="block">
      <span className="label-eyebrow text-muted-foreground">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-0.5 w-full rounded-sm border border-[color:var(--sand-deep)] bg-white px-2 py-1 text-sm tabular-nums"
      />
    </label>
  )
}
