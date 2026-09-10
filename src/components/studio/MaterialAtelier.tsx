import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Search,
  ArrowUpRight,
  Check,
  SlidersHorizontal,
  Expand,
  Layers,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { SafeImage } from '@/components/SafeImage'
import {
  STATUS_LABEL,
  evaluateCustomization,
  type CapabilityData,
  type CustomizationDraft,
  type CustomizationTarget,
} from '@/lib/studio/customization'
import { visualKind, type VisualLibraryItem } from '@/lib/studio/visual-library'
import type { VisualLibraryData } from '@/lib/studio/visual-library-repository'
import type { StudioProduct } from '@/lib/studio/types'
import { useStudioStore } from '@/stores/studio.store'
const families = [
  { id: 'weave', label: 'Tressages', detail: 'Le rythme du motif' },
  { id: 'rope', label: 'Cordages', detail: 'Le relief de la matière' },
  { id: 'textilene', label: 'Textilènes', detail: 'La finesse de la trame' },
]
const action =
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-current/20 px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-700'
export function MaterialAtelier({
  library,
  targets,
  draft,
  capabilities,
  onReview,
}: {
  library: VisualLibraryData
  targets: ReadonlyArray<{
    target: CustomizationTarget
    product: StudioProduct | undefined
  }>
  draft: CustomizationDraft
  capabilities: CapabilityData
  onReview: () => void
}) {
  const [family, setFamily] = useState('weave'),
    [query, setQuery] = useState(''),
    [limit, setLimit] = useState(12),
    [activeKey, setActiveKey] = useState(''),
    [compare, setCompare] = useState<string[]>([]),
    [zoom, setZoom] = useState<string[]>([])
  const active = targets.find((t) => t.target.key === activeKey) ?? targets[0]
  const [paletteDraft, setPaletteDraft] = useState<{
    key: string
    value: string
  } | null>(null)
  const [boardOpen, setBoardOpen] = useState(false)
  useEffect(() => {
    setBoardOpen(window.matchMedia('(min-width: 1024px)').matches)
  }, [])
  const zoomTrigger = useRef<HTMLElement | null>(null)
  const openZoom = (refs: string[]) => {
    zoomTrigger.current = document.activeElement as HTMLElement
    setZoom(refs)
  }
  const filtered = useMemo(
    () =>
      library.items.filter(
        (i) =>
          visualKind(i.family) !== undefined &&
          i.family === family &&
          `${i.label} ${i.public_ref} ${i.tag}`
            .toLocaleLowerCase()
            .includes(query.toLocaleLowerCase()),
      ),
    [library.items, family, query],
  )
  const kind = visualKind(family)
  const selected = active
    ? (draft[active.target.key] ?? []).find((s) => s.kind === kind)
    : undefined
  const paletteKey = JSON.stringify([
    active?.target.key,
    selected?.visual?.public_ref,
  ])
  const savedPalette = selected?.visual?.weave_colors.join(' / ') ?? ''
  const palette =
    paletteDraft?.key === paletteKey ? paletteDraft.value : savedPalette
  useEffect(() => {
    setPaletteDraft(null)
  }, [paletteKey])
  const choose = (item: VisualLibraryItem) => {
    if (!active) return
    setBoardOpen(true)
    const current = draft[active.target.key] ?? []
    const k = visualKind(item.family)
    if (!k) return
    if (
      current.some(
        (s) => s.kind === k && s.visual?.public_ref === item.public_ref,
      )
    )
      return
    useStudioStore.getState().setCustomization(active.target, [
      ...current.filter((s) => s.kind !== k),
      {
        kind: k,
        value: item.public_ref,
        note: '',
        requested: true,
        visual: { public_ref: item.public_ref, weave_colors: [] },
      },
    ])
  }
  const selectedItem = library.items.find(
    (i) => i.public_ref === selected?.visual?.public_ref,
  )
  const status =
    active && selected
      ? evaluateCustomization(
          [active.target],
          { [active.target.key]: [selected] },
          capabilities,
        ).selections[0]?.status
      : 'unknown'
  const unavailable = (item: VisualLibraryItem) => {
    const itemKind = visualKind(item.family)
    if (!itemKind) return true
    return active
      ? evaluateCustomization(
          [active.target],
          {
            [active.target.key]: [
              {
                kind: itemKind,
                value: item.public_ref,
                note: '',
                requested: true,
                visual: { public_ref: item.public_ref, weave_colors: [] },
              },
            ],
          },
          capabilities,
        ).selections[0]?.status === 'unavailable'
      : false
  }
  return (
    <section
      aria-label="Atelier matières"
      className="studio-atelier overflow-hidden rounded-[24px] border border-[#d8d5c9] bg-[#f4f2eb] text-[#23352e]"
    >
      <header className="grid gap-6 border-b border-[#d8d5c9] p-5 sm:p-8 lg:grid-cols-[1fr_260px]">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[.2em] text-[#9a4e34]">
            L’atelier · Matières & caractères
          </p>
          <h1 className="mt-3 max-w-xl font-display text-3xl leading-tight sm:text-5xl">
            Le détail qui rend votre projet singulier.
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-[#57665f]">
            Explorez les textures, rapprochez deux motifs, retenez une
            direction. Nous vérifierons avec vous ce qui peut être réalisé sur
            votre mobilier.
          </p>
        </div>
        <div
          className="grid w-full max-w-[210px] grid-cols-3 items-center gap-2 justify-self-end lg:max-w-none"
          aria-hidden
        >
          {['PI-TR-007', 'PI-RP-060', 'PI-TX-033'].map((ref, n) => (
            <img
              key={ref}
              src={library.items.find((i) => i.public_ref === ref)?.image}
              alt=""
              className={`aspect-[3/4] w-full rounded-t-full object-cover shadow-sm ${n === 1 ? 'mt-8' : '-rotate-3'}`}
            />
          ))}
        </div>
      </header>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 p-4 sm:p-7">
          <div
            className="mb-6 flex flex-wrap gap-2"
            aria-label="Familles de matières"
          >
            {families.map((f) => (
              <button
                key={f.id}
                aria-pressed={family === f.id}
                onClick={() => {
                  setFamily(f.id)
                  setLimit(12)
                  setQuery('')
                }}
                className={`${action} ${family === f.id ? 'border-[#23352e] bg-[#23352e] text-white' : 'bg-white'}`}
              >
                {f.label}
                <span className="text-xs opacity-60">
                  {library.items.filter((i) => i.family === f.id).length}
                </span>
              </button>
            ))}
          </div>
          <div className="mb-5 flex items-center gap-3">
            <Search size={18} aria-hidden />
            <input
              aria-label="Rechercher une matière"
              placeholder="Référence, motif, trame…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setLimit(12)
              }}
              className="min-h-[44px] min-w-0 flex-1 border-b border-[#b8beb2] bg-transparent text-sm outline-none focus:border-[#23352e]"
            />
            <span className="text-xs">{filtered.length} détails</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {filtered.slice(0, limit).map((item) => {
              const picked = selected?.visual?.public_ref === item.public_ref
              return (
                <article
                  key={item.public_ref}
                  className={`group overflow-hidden rounded-xl border bg-[#fffefa] transition-shadow hover:shadow-md ${picked ? 'border-[#9a4e34] ring-1 ring-[#9a4e34]' : 'border-[#dedfd6]'}`}
                >
                  <button
                    className="relative block aspect-square w-full overflow-hidden bg-[#e9e8df] focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-[#9a4e34]"
                    aria-label={`Agrandir ${item.public_ref}`}
                    onClick={() => openZoom([item.public_ref])}
                  >
                    <img
                      src={item.thumbnail}
                      alt={`${item.label}, détail de matière ${item.public_ref}`}
                      loading="lazy"
                      className={`h-full w-full transition-transform duration-300 group-hover:scale-105 ${item.family === 'rope' ? 'object-contain p-3' : 'object-cover'}`}
                    />
                    <span className="absolute bottom-2 right-2 rounded-full bg-white/90 p-2">
                      <Expand size={14} aria-hidden />
                    </span>
                  </button>
                  <div className="p-3">
                    <p className="text-[10px] uppercase tracking-widest text-[#7a837b]">
                      {item.tag}
                    </p>
                    <h3 className="mt-1 text-sm font-semibold">
                      {item.public_ref}
                    </h3>
                    <button
                      aria-pressed={picked}
                      disabled={!active || unavailable(item)}
                      className="mt-2 flex min-h-[44px] w-full items-center justify-between gap-2 border-t border-[#e4e5dd] text-left text-xs font-semibold disabled:opacity-40"
                      onClick={() => choose(item)}
                    >
                      {picked
                        ? 'Retenu · à confirmer'
                        : unavailable(item)
                          ? 'Indisponible'
                          : 'Retenir ce détail'}
                      {picked ? (
                        <Check size={15} />
                      ) : (
                        <ArrowUpRight size={15} />
                      )}
                    </button>
                    <button
                      aria-pressed={compare.includes(item.public_ref)}
                      className="min-h-[44px] text-xs text-[#57665f] underline underline-offset-4"
                      onClick={() =>
                        setCompare((c) =>
                          c.includes(item.public_ref)
                            ? c.filter((r) => r !== item.public_ref)
                            : [...c.slice(-1), item.public_ref],
                        )
                      }
                    >
                      Comparer {item.public_ref}
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
          {!filtered.length && (
            <p className="py-12 text-center text-sm">
              Aucun détail pour cette recherche. Essayez une autre référence.
            </p>
          )}
          {filtered.length > limit && (
            <button
              className={`${action} mx-auto mt-6 flex`}
              onClick={() => setLimit((n) => n + 12)}
            >
              Explorer les suivants <ArrowUpRight size={16} />
            </button>
          )}
          {compare.length > 0 && (
            <div className="sticky bottom-4 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#23352e] p-3 text-white shadow-lg">
              <span className="text-xs">{compare.join(' + ')}</span>
              <button
                disabled={compare.length !== 2}
                className={`${action} disabled:opacity-50`}
                onClick={() => openZoom(compare)}
              >
                Comparer les 2 détails <Layers size={16} />
              </button>
            </div>
          )}
        </div>
        <aside
          aria-label="Votre planche matière"
          className="order-first border-b border-[#d8d5c9] bg-[#e9ece2] p-5 lg:order-last lg:border-b-0 lg:border-l"
        >
          <details
            open={boardOpen}
            onToggle={(event) => setBoardOpen(event.currentTarget.open)}
            className="lg:sticky lg:top-24"
          >
            <summary className="min-h-[44px] cursor-pointer text-sm font-semibold">
              Votre planche matière
            </summary>
            {targets.length > 1 && (
              <label className="mt-4 block text-xs">
                Le mobilier à personnaliser
                <select
                  aria-label="Mobilier de la planche"
                  value={active?.target.key ?? ''}
                  onChange={(e) => setActiveKey(e.target.value)}
                  className="mt-2 min-h-[44px] w-full rounded-lg border bg-white px-2"
                >
                  {targets.map((t) => (
                    <option key={t.target.key} value={t.target.key}>
                      {t.product?.name ?? 'Assise à vérifier'}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="mt-4 rounded-2xl bg-[#fffefa] p-4">
              <SafeImage
                src={active?.product?.mainImageUrl}
                alt={active?.product?.name ?? 'Mobilier à sélectionner'}
                className="aspect-square w-full"
                imgClassName="aspect-square w-full object-contain"
                loading="eager"
              />
              <p className="mt-3 text-sm font-semibold">
                {active?.product?.name ??
                  'Choisissez une assise dans le Studio'}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-[#677269]">
                Photo catalogue d’origine. Le motif choisi n’est pas appliqué à
                cette photographie.
              </p>
            </div>
            {selectedItem ? (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-3">
                  <img
                    src={selectedItem.thumbnail}
                    alt={selectedItem.public_ref}
                    className="h-16 w-16 rounded-lg bg-white object-contain"
                  />
                  <div>
                    <p className="text-sm font-semibold">
                      {selectedItem.public_ref}
                    </p>
                    <p className="text-xs">
                      {STATUS_LABEL[status ?? 'unknown']}
                    </p>
                  </div>
                </div>
                {family === 'weave' && (
                  <div className="rounded-xl border border-[#c9cfc2] p-3">
                    <p className="flex items-center gap-2 text-xs font-semibold">
                      <SlidersHorizontal size={14} />
                      Le motif et vos couleurs
                    </p>
                    <p className="mt-2 text-xs leading-relaxed">
                      Les couleurs montrées appartiennent à l’échantillon. Une
                      autre combinaison doit être validée séparément.
                    </p>
                    <label className="mt-3 block text-xs">
                      Couleurs souhaitées (jusqu’à 4, séparées par /)
                      <input
                        aria-label="Couleurs du tressage souhaitées"
                        value={palette}
                        onChange={(e) =>
                          setPaletteDraft({
                            key: paletteKey,
                            value: e.target.value,
                          })
                        }
                        placeholder="Décrivez votre palette"
                        maxLength={320}
                        className="mt-2 min-h-[44px] w-full rounded border bg-white px-2"
                      />
                    </label>
                    <button
                      className={`${action} mt-3 w-full`}
                      onClick={() => {
                        if (!active || !selected) return
                        const colors = palette
                          .split('/')
                          .map((c) => c.trim())
                          .filter(Boolean)
                          .slice(0, 4)
                          .map((c) => c.slice(0, 80))
                        useStudioStore.getState().setCustomization(
                          active.target,
                          (draft[active.target.key] ?? []).map((s) =>
                            s === selected
                              ? {
                                  ...s,
                                  visual: {
                                    public_ref: selectedItem.public_ref,
                                    weave_colors: colors,
                                  },
                                }
                              : s,
                          ),
                        )
                      }}
                    >
                      Noter cette palette
                    </button>
                    {selected?.visual?.weave_colors.length ? (
                      <p className="mt-2 text-xs">
                        Palette demandée :{' '}
                        {selected.visual.weave_colors.join(' / ')} · à confirmer
                      </p>
                    ) : null}
                  </div>
                )}
                <p className="text-xs leading-relaxed">
                  Un choix de matière est une intention de projet, pas une
                  confirmation de disponibilité. Aucun prix ni délai
                  supplémentaire n’est calculé.
                </p>
              </div>
            ) : (
              <p className="mt-5 text-sm leading-relaxed text-[#57665f]">
                Retenez un détail pour commencer votre planche. Vous pourrez
                nous transmettre cette direction, même si elle reste à
                confirmer.
              </p>
            )}
            <button className={`${action} mt-5 w-full`} onClick={onReview}>
              Continuer avec cette direction
            </button>
          </details>
        </aside>
      </div>
      <Dialog
        open={zoom.length > 0}
        onOpenChange={(open) => {
          if (!open) setZoom([])
        }}
      >
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            zoomTrigger.current?.focus()
          }}
          className="max-h-[90vh] max-w-4xl overflow-y-auto bg-[#f4f2eb]"
        >
          <DialogHeader>
            <DialogTitle>
              {zoom.length === 2
                ? 'Deux matières, côte à côte'
                : 'Regarder le détail'}
            </DialogTitle>
            <DialogDescription>
              Échantillons réels agrandis. Les couleurs et l’échelle doivent
              être confirmées sur un échantillon physique.
            </DialogDescription>
          </DialogHeader>
          <div
            className={`grid gap-5 ${zoom.length === 2 ? 'grid-cols-2' : ''}`}
          >
            {zoom.map((ref) => {
              const item = library.items.find((i) => i.public_ref === ref)
              return item ? (
                <figure key={ref}>
                  <img
                    src={item.image}
                    alt={`Détail ${ref}`}
                    className="aspect-square max-h-[55vh] w-full rounded-xl bg-white object-contain"
                  />
                  <figcaption className="mt-3 text-center text-sm font-semibold">
                    {ref}
                  </figcaption>
                </figure>
              ) : null
            })}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
