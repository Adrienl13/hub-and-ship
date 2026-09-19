import { Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { CompositionPiece } from '@/lib/products'

/**
 * Composition d'un ensemble — ce que l'acheteur voit sur la photo.
 *
 * Un salon de jardin n'a pas de dimensions : il a un canapé, deux fauteuils
 * et une table basse, chacun avec les siennes. La fiche annonçait pourtant un
 * unique « L × l × H », qui ne pouvait décrire qu'un meuble sur quatre — sur
 * ROP-031, tarifée en salon, ce sont restées les cotes d'une chaise.
 *
 * Vide = produit d'une seule pièce : les champs L / l / H au-dessus suffisent
 * et rien ne change.
 */

/** Ligne en cours de saisie : des chaînes, pour laisser taper librement. */
export interface CompositionDraftRow {
  label: string
  qty: string
  l: string
  w: string
  h: string
}

export function compositionToDraft(
  pieces: ReadonlyArray<CompositionPiece> | null | undefined,
): CompositionDraftRow[] {
  return (pieces ?? []).map((piece) => ({
    label: piece.label,
    qty: String(piece.qty),
    l: String(piece.l),
    w: String(piece.w),
    h: String(piece.h),
  }))
}

function toNumber(raw: string): number {
  const parsed = Number(raw.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

/**
 * Transforme la saisie en composition stockable, ou explique ce qui cloche.
 * Mêmes règles que la contrainte SQL, pour que l'admin lise l'erreur ici et
 * pas dans un échec de base incompréhensible.
 */
export function buildCompositionPayload(
  rows: ReadonlyArray<CompositionDraftRow>,
):
  | { readonly payload: ReadonlyArray<CompositionPiece> | null }
  | { readonly error: string } {
  // Une ligne entièrement vide est ignorée : c'est une ligne ajoutée puis
  // abandonnée, pas une erreur de saisie.
  const filled = rows.filter((row) =>
    [row.label, row.qty, row.l, row.w, row.h].some((v) => v.trim() !== ''),
  )
  if (filled.length === 0) return { payload: null }
  if (filled.length > 20) {
    return { error: 'Vingt pièces au maximum dans une composition.' }
  }

  const pieces: CompositionPiece[] = []
  for (const [index, row] of filled.entries()) {
    const rang = `Pièce ${index + 1}`
    const label = row.label.trim()
    if (!label) return { error: `${rang} : il manque le nom de la pièce.` }
    if (label.length > 80) {
      return { error: `${rang} : nom trop long (80 caractères au maximum).` }
    }
    const qty = toNumber(row.qty)
    if (!Number.isInteger(qty) || qty < 1 || qty > 50) {
      return { error: `${rang} (${label}) : quantité entre 1 et 50.` }
    }
    const dims = { l: toNumber(row.l), w: toNumber(row.w), h: toNumber(row.h) }
    for (const [cle, valeur] of Object.entries(dims)) {
      if (!Number.isFinite(valeur) || valeur <= 0 || valeur > 1000) {
        return {
          error: `${rang} (${label}) : la cote ${cle.toUpperCase()} doit être renseignée, positive et sous 1000 cm.`,
        }
      }
    }
    pieces.push({ label, qty, ...dims })
  }
  return { payload: pieces }
}

export function AdminCompositionEditor({
  rows,
  onChange,
}: {
  readonly rows: ReadonlyArray<CompositionDraftRow>
  readonly onChange: (rows: CompositionDraftRow[]) => void
}) {
  const check = buildCompositionPayload(rows)
  const error = 'error' in check ? check.error : null
  const total =
    'payload' in check && check.payload
      ? check.payload.reduce((sum, piece) => sum + piece.qty, 0)
      : 0

  function update(index: number, field: keyof CompositionDraftRow, value: string) {
    onChange(
      rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    )
  }

  return (
    <div className="rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="label-eyebrow text-muted-foreground">
            Composition de l’ensemble
          </div>
          <p className="mt-1 max-w-xl text-xs text-muted-foreground">
            Pour un salon ou un lot : une ligne par meuble visible sur la
            photo, avec ses propres cotes. Laissé vide, le produit est traité
            comme une pièce unique et ce sont les champs L / l / H ci-dessus
            qui font foi.
          </p>
        </div>
        {total > 0 && (
          <span className="shrink-0 rounded-sm bg-card px-2 py-1 text-xs font-medium">
            {total} pièce{total > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {rows.length > 0 && (
        <div className="mt-3 space-y-2">
          {rows.map((row, index) => (
            <div
              key={index}
              className="grid grid-cols-2 gap-2 rounded-sm border border-[color:var(--sand-deep)] bg-card p-2 sm:grid-cols-[1fr_auto_auto_auto_auto_auto]"
            >
              <label className="col-span-2 block sm:col-span-1">
                <span className="label-eyebrow text-muted-foreground">
                  Pièce
                </span>
                <Input
                  value={row.label}
                  placeholder="Canapé 3 places"
                  onChange={(e) => update(index, 'label', e.target.value)}
                  className="mt-0.5 h-9"
                />
              </label>
              {(
                [
                  ['qty', 'Qté'],
                  ['l', 'L (cm)'],
                  ['w', 'l (cm)'],
                  ['h', 'H (cm)'],
                ] as const
              ).map(([field, label]) => (
                <label key={field} className="block">
                  <span className="label-eyebrow text-muted-foreground">
                    {label}
                  </span>
                  <Input
                    type="number"
                    value={row[field]}
                    onChange={(e) => update(index, field, e.target.value)}
                    className="mt-0.5 h-9 w-20"
                  />
                </label>
              ))}
              <button
                type="button"
                aria-label={`Retirer la pièce ${index + 1}`}
                onClick={() => onChange(rows.filter((_, i) => i !== index))}
                className="self-end justify-self-start rounded-sm border border-[color:var(--sand-deep)] p-2 text-[color:var(--destructive)] hover:bg-[color:var(--sand-soft)]"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Button
        type="button"
        size="sm"
        variant="outline"
        className="mt-3 gap-1.5"
        onClick={() =>
          onChange([...rows, { label: '', qty: '1', l: '', w: '', h: '' }])
        }
      >
        <Plus className="h-3.5 w-3.5" />
        Ajouter une pièce
      </Button>

      {error && (
        <p className="mt-2 rounded-sm bg-[color:var(--destructive)]/10 px-2 py-1.5 text-xs text-[color:var(--destructive)]">
          {error}
        </p>
      )}
    </div>
  )
}
