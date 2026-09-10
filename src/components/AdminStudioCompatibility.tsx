import { useCallback, useEffect, useState } from 'react'
import type { AdminClient } from './AdminStudioTab'
import {
  fetchStudioCatalog,
  type StudioDbClient,
} from '@/lib/studio/repository'
import {
  fetchTableCompatibility,
  type TableRulesClient,
} from '@/lib/studio/table-repository'
import {
  resolveTableCompatibility,
  validTableDimensions,
  EMPTY_COMPATIBILITY,
  type TableCompatibilityData,
} from '@/lib/studio/compatibility'
import type { StudioProduct } from '@/lib/studio/types'

type Row = Record<string, unknown>
const fields = {
  studio_table_base_types: 'id,label',
  studio_table_base_profiles:
    'base_id,base_type_id,status,provenance,verified_by,verified_at',
  studio_tabletop_base_rules:
    'id,base_id,tabletop_id,base_type_id,shape,min_length_cm,min_width_cm,max_length_cm,max_width_cm,verdict,status,provenance,verified_by,verified_at',
}
const input = 'min-h-[44px] w-full rounded border bg-white px-3'
/** Human review within the existing Studio admin. RLS remains authoritative. */
export function AdminStudioCompatibility({ client }: { client: AdminClient }) {
  const [rows, setRows] = useState<Record<string, Row[]>>({})
  const [products, setProducts] = useState<StudioProduct[]>([])
  const [compat, setCompat] =
    useState<TableCompatibilityData>(EMPTY_COMPATIBILITY)
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false)
  const [base, setBase] = useState(''),
    [top, setTop] = useState(''),
    [type, setType] = useState(''),
    [label, setLabel] = useState('')
  const [mode, setMode] = useState('pair'),
    [shape, setShape] = useState('rectangular'),
    [minLength, setMinLength] = useState(''),
    [minWidth, setMinWidth] = useState(''),
    [length, setLength] = useState(''),
    [width, setWidth] = useState('')
  const [verdict, setVerdict] = useState('allowed'),
    [provenance, setProvenance] = useState('')
  const refresh = useCallback(async () => {
    const entries = await Promise.all(
      Object.entries(fields).map(async ([table, columns]) => {
        const all: Row[] = []
        for (let offset = 0; ; offset += 500) {
          const result = await client
            .from(table)
            .select(columns)
            .range(offset, offset + 499)
          if (result.error) throw Error(result.error.message)
          all.push(...result.data)
          if (result.data.length < 500) break
        }
        return [table, all] as const
      }),
    )
    const [catalog, data] = await Promise.all([
      fetchStudioCatalog(client as unknown as StudioDbClient),
      fetchTableCompatibility(client as unknown as TableRulesClient),
    ])
    setRows(Object.fromEntries(entries))
    setProducts([...catalog.products])
    setCompat(data)
    setReady(true)
  }, [client])
  useEffect(() => {
    void refresh().catch(() =>
      setError(
        'Compatibilité indisponible. Vérifiez que la migration Lot 4 est appliquée dans cet environnement.',
      ),
    )
  }, [refresh])
  async function save(
    table: string,
    value: Row,
    key?: { column: string; value: string },
  ) {
    setBusy(true)
    setError('')
    try {
      const result = await (key
        ? client.from(table).update(value).eq(key.column, key.value)
        : client.from(table).insert(value))
      if (result.error) throw Error(result.error.message)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enregistrement impossible')
    } finally {
      setBusy(false)
    }
  }
  const bases = products.filter(
    (p) =>
      p.isActive &&
      p.studio.studioRole === 'base' &&
      p.category === 'table_base',
  )
  const tops = products.filter(
    (p) =>
      p.isActive &&
      p.studio.studioRole === 'tabletop' &&
      p.category === 'table_top',
  )
  const rules = rows.studio_tabletop_base_rules ?? [],
    types = rows.studio_table_base_types ?? []
  const selectedBase = bases.find((p) => p.id === base),
    selectedTop = tops.find((p) => p.id === top)
  const name = (id: unknown) =>
    products.find((p) => p.id === id)?.name ?? String(id ?? '—')
  const validSource =
    provenance.trim().length >= 3 && provenance.trim().length <= 1000
  const optionalNumber = (value: string) =>
    value.trim() === '' ? null : Number(value)
  const dimensions = {
    min_length_cm: optionalNumber(minLength),
    min_width_cm: optionalNumber(minWidth),
    max_length_cm: optionalNumber(length),
    max_width_cm: optionalNumber(width),
  }
  const validDimensions = validTableDimensions({ shape, ...dimensions })
  function submitRule() {
    if (
      !validSource ||
      !(mode === 'pair' ? base && top : type && validDimensions)
    )
      return
    const existing = rules.find((r) =>
      mode === 'pair'
        ? r.base_id === base && r.tabletop_id === top
        : r.base_type_id === type && r.shape === shape,
    )
    void save(
      'studio_tabletop_base_rules',
      {
        base_id: mode === 'pair' ? base : null,
        tabletop_id: mode === 'pair' ? top : null,
        base_type_id: mode === 'type' ? type : null,
        shape: mode === 'type' ? shape : null,
        min_length_cm: mode === 'type' ? dimensions.min_length_cm : null,
        min_width_cm: mode === 'type' ? dimensions.min_width_cm : null,
        max_length_cm: mode === 'type' ? dimensions.max_length_cm : null,
        max_width_cm: mode === 'type' ? dimensions.max_width_cm : null,
        verdict,
        status: 'verified',
        provenance: provenance.trim(),
      },
      existing ? { column: 'id', value: String(existing.id) } : undefined,
    )
  }
  return (
    <section
      aria-label="Compatibilité tables"
      className="space-y-5 border-t pt-8"
    >
      <h2 className="text-xl font-semibold">Studio — compatibilité tables</h2>
      <p>
        Validation humaine uniquement. La provenance est obligatoire ; l’auteur
        et la date sont enregistrés par la base.
      </p>
      {error && <p role="alert">{error}</p>}
      {ready && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <label>
              Plateau
              <select
                className={input}
                value={top}
                onChange={(e) => setTop(e.target.value)}
              >
                <option value="">Choisir</option>
                {tops.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.dimensions.l} × {p.dimensions.w} cm
                  </option>
                ))}
              </select>
            </label>
            <label>
              Piètement
              <select
                className={input}
                value={base}
                onChange={(e) => setBase(e.target.value)}
              >
                <option value="">Choisir</option>
                {bases.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {selectedTop && selectedBase && (
            <p role="status">
              État du couple :{' '}
              {
                resolveTableCompatibility(selectedTop, selectedBase, compat)
                  .verdict
              }
            </p>
          )}
          <details>
            <summary className="min-h-[44px] cursor-pointer">
              Configurations non confirmées
            </summary>
            <ul className="max-h-64 overflow-auto">
              {tops.flatMap((t) =>
                bases
                  .filter(
                    (b) =>
                      resolveTableCompatibility(t, b, compat).verdict ===
                      'requires_confirmation',
                  )
                  .map((b) => (
                    <li key={`${t.id}:${b.id}`}>
                      <button
                        className={input}
                        onClick={() => {
                          setTop(t.id)
                          setBase(b.id)
                          setMode('pair')
                        }}
                      >
                        {t.name} · {b.name}
                      </button>
                    </li>
                  )),
              )}
            </ul>
          </details>
          <label className="block">
            Provenance de la validation
            <textarea
              className={input}
              maxLength={1000}
              value={provenance}
              onChange={(e) => setProvenance(e.target.value)}
              placeholder="Fiche technique, référence du fabricant, contrôle documenté…"
            />
          </label>
          <fieldset disabled={busy} className="space-y-4">
            <legend className="font-semibold">
              Déclarer une règle vérifiée
            </legend>
            <label className="block">
              Portée
              <select
                className={input}
                value={mode}
                onChange={(e) => setMode(e.target.value)}
              >
                <option value="pair">Exception plateau / piètement</option>
                <option value="type">Type de piètement</option>
              </select>
            </label>
            {mode === 'type' && (
              <div className="grid gap-3 md:grid-cols-2">
                <label>
                  Type
                  <select
                    className={input}
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                  >
                    <option value="">Choisir</option>
                    {types.map((t) => (
                      <option key={String(t.id)} value={String(t.id)}>
                        {String(t.label)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Forme
                  <select
                    className={input}
                    value={shape}
                    onChange={(e) => setShape(e.target.value)}
                  >
                    <option value="square">Carré</option>
                    <option value="rectangular">Rectangle</option>
                    <option value="round">Rond</option>
                  </select>
                </label>
                <p className="md:col-span-2">
                  Bornes facultatives : vide signifie non renseigné. Longueur =
                  grand côté, largeur = petit côté ; deux bornes renseignées
                  sont normalisées par rotation. Une règle sans borne exprime
                  uniquement la validation explicite de la forme.
                </p>
                <label>
                  Longueur minimale (cm)
                  <input
                    className={input}
                    type="number"
                    min="0"
                    step="any"
                    max="9999"
                    value={minLength}
                    onChange={(e) => setMinLength(e.target.value)}
                  />
                </label>
                <label>
                  Largeur minimale (cm)
                  <input
                    className={input}
                    type="number"
                    min="0"
                    step="any"
                    max="9999"
                    value={minWidth}
                    onChange={(e) => setMinWidth(e.target.value)}
                  />
                </label>
                <label>
                  Longueur maximale (cm)
                  <input
                    className={input}
                    type="number"
                    min="0"
                    step="any"
                    max="9999"
                    value={length}
                    onChange={(e) => setLength(e.target.value)}
                  />
                </label>
                <label>
                  Largeur maximale (cm)
                  <input
                    className={input}
                    type="number"
                    min="0"
                    step="any"
                    max="9999"
                    value={width}
                    onChange={(e) => setWidth(e.target.value)}
                  />
                </label>
              </div>
            )}
            <label className="block">
              Verdict
              <select
                className={input}
                value={verdict}
                onChange={(e) => setVerdict(e.target.value)}
              >
                <option value="allowed">Compatible</option>
                <option value="denied">Incompatible</option>
              </select>
            </label>
            <button
              className={input}
              disabled={
                !validSource ||
                !(mode === 'pair' ? base && top : type && validDimensions)
              }
              onClick={submitRule}
            >
              Enregistrer la validation
            </button>
          </fieldset>
          <details>
            <summary className="min-h-[44px] cursor-pointer">
              Types et rattachements vérifiés
            </summary>
            <div className="space-y-3">
              <label>
                Nouveau type
                <input
                  className={input}
                  value={label}
                  maxLength={120}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </label>
              <button
                className={input}
                disabled={busy || label.trim().length < 2}
                onClick={() =>
                  void save('studio_table_base_types', { label: label.trim() })
                }
              >
                Créer le type
              </button>
              <label>
                Type à rattacher
                <select
                  className={input}
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  <option value="">Choisir</option>
                  {types.map((t) => (
                    <option key={String(t.id)} value={String(t.id)}>
                      {String(t.label)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className={input}
                disabled={busy || !base || !type || !validSource}
                onClick={() =>
                  void save(
                    'studio_table_base_profiles',
                    {
                      base_id: base,
                      base_type_id: type,
                      status: 'verified',
                      provenance: provenance.trim(),
                    },
                    rows.studio_table_base_profiles?.some(
                      (r) => r.base_id === base,
                    )
                      ? { column: 'base_id', value: base }
                      : undefined,
                  )
                }
              >
                Valider le type du piètement choisi
              </button>
              {rows.studio_table_base_profiles?.map((p) => (
                <p key={String(p.base_id)}>
                  {name(p.base_id)} ·{' '}
                  {String(
                    types.find((t) => t.id === p.base_type_id)?.label ??
                      p.base_type_id,
                  )}{' '}
                  · {String(p.status)} · {String(p.provenance)}
                </p>
              ))}
            </div>
          </details>
          <h3 className="font-semibold">Règles enregistrées</h3>
          <ul className="space-y-3">
            {rules.map((r) => (
              <li key={String(r.id)} className="border-b pb-3">
                <p>
                  {r.base_type_id
                    ? `${String(types.find((t) => t.id === r.base_type_id)?.label ?? r.base_type_id)} · ${String(r.shape)} · min ${String(r.min_length_cm ?? '—')} × ${String(r.min_width_cm ?? '—')} cm · max ${String(r.max_length_cm ?? '—')} × ${String(r.max_width_cm ?? '—')} cm`
                    : `${name(r.tabletop_id)} · ${name(r.base_id)}`}{' '}
                  — {String(r.verdict)} / {String(r.status)}
                </p>
                <p className="text-sm">
                  {String(r.provenance ?? '')} ·{' '}
                  {String(r.verified_at ?? 'Non vérifiée')}
                </p>
                {r.status !== 'archived' && (
                  <button
                    className={input}
                    disabled={busy}
                    onClick={() =>
                      void save(
                        'studio_tabletop_base_rules',
                        { status: 'archived' },
                        { column: 'id', value: String(r.id) },
                      )
                    }
                  >
                    Archiver cette règle
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
