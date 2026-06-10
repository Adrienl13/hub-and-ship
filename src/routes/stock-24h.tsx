import { createFileRoute } from '@tanstack/react-router'
import {
  ArrowUpDown,
  Clock3,
  Mail,
  MapPin,
  PackageCheck,
  Phone,
  Search,
} from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { RevealItem, RevealStagger } from '@/components/motion-helpers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useStockRequestCreation } from '@/hooks/useStockRequestCreation'
import { CATEGORY_LABEL } from '@/lib/products'
import {
  STOCK_CONDITION_LABEL,
  STOCK_FILTERS,
  AVAILABLE_STOCK,
  calculateStockKpis,
  filterAndSortStockLines,
  getAvailableStockLines,
  getStockCategoryCounts,
  type StockFilter,
  type StockLine,
  type StockSortKey,
} from '@/lib/stock'
import { buildStockRequestDraft } from '@/lib/stock-requests'
import { formatEUR } from '@/lib/order'
import {
  breadcrumbJsonLd,
  buildSeoHead,
  itemListJsonLd,
  jsonLdScript,
} from '@/lib/seo'

export const Route = createFileRoute('/stock-24h')({
  head: () => {
    const stockProducts = getAvailableStockLines(AVAILABLE_STOCK).map(
      (line) => line.product,
    )

    return {
      ...buildSeoHead({
        title: 'Stock mobilier terrasse disponible sous 24h',
        description:
          'Lots de mobilier outdoor professionnel déjà disponibles en France : chaises, fauteuils et tables pour terrasse urgente, retrait Marseille-Fos sous 24h.',
        path: '/stock-24h',
        image: stockProducts[0]?.mainImageUrl,
      }),
      scripts: [
        jsonLdScript(
          breadcrumbJsonLd([
            { name: 'Accueil', path: '/' },
            { name: 'Stock 24h', path: '/stock-24h' },
          ]),
        ),
        jsonLdScript(
          itemListJsonLd({
            name: 'Stock mobilier terrasse disponible sous 24h',
            path: '/stock-24h',
            products: stockProducts,
          }),
        ),
      ],
    }
  },
  component: Stock24hPage,
})

function Stock24hPage() {
  const lines = useMemo(() => getAvailableStockLines(), [])
  const kpis = useMemo(() => calculateStockKpis(lines), [lines])
  const counts = useMemo(() => getStockCategoryCounts(lines), [lines])
  const [filter, setFilter] = useState<StockFilter>('all')
  const [sort, setSort] = useState<StockSortKey>('priority')
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [selectedLineId, setSelectedLineId] = useState(lines[0]?.id ?? '')

  const filtered = useMemo(
    () =>
      filterAndSortStockLines({
        lines,
        filter,
        search: deferredSearch,
        sort,
      }),
    [deferredSearch, filter, lines, sort],
  )
  const selectedLine =
    lines.find((line) => line.id === selectedLineId) ?? filtered[0] ?? null

  const selectLine = (id: string) => {
    setSelectedLineId(id)
    // On mobile the request panel is below the grid — bring it into view.
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      requestAnimationFrame(() =>
        document
          .getElementById('stock-request-panel')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      )
    }
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <Header onReserve={() => setSelectedLineId(lines[0]?.id ?? '')} />

      <main>
        <section className="border-b border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]">
          <div className="mx-auto grid max-w-7xl gap-8 px-6 py-10 lg:grid-cols-[1fr_360px] lg:items-end">
            <div className="max-w-3xl">
              <div className="label-eyebrow text-[color:var(--ember)]">
                Stock disponible sous 24h
              </div>
              <h1 className="mt-2 font-display text-4xl tracking-tight md:text-5xl">
                Une solution rapide quand le container est trop loin.
              </h1>
              <p className="mt-4 text-sm leading-6 text-[color:var(--ink-soft)]">
                Quelques lots sont déjà en France. Ils permettent de dépanner
                une ouverture, une terrasse urgente ou un complément de mobilier
                sans attendre une précommande groupée.
              </p>
              <div className="mt-6 flex flex-wrap gap-2 text-xs">
                <Badge>Retrait Marseille-Fos</Badge>
                <Badge>Réponse commerciale rapide</Badge>
                <Badge>Quantités limitées</Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-md border border-[color:var(--sand-deep)] bg-card p-4 text-sm">
              <Kpi label="Références" value={`${kpis.references}`} />
              <Kpi label="Unités libres" value={`${kpis.availableUnits}`} />
              <Kpi label="Déjà optionnées" value={`${kpis.reservedUnits}`} />
              <Kpi label="Valeur HT" value={formatEUR(kpis.totalValueHt)} />
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <div className="bg-background/95 sticky top-16 z-20 border-b border-[color:var(--sand-deep)] py-4 backdrop-blur">
              <div className="flex flex-col gap-3">
                <div className="flex gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
                  {STOCK_FILTERS.map((entry) => {
                    const active = filter === entry.id
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => setFilter(entry.id)}
                        className={`min-h-11 shrink-0 rounded-sm px-3 py-1.5 text-xs font-medium transition-colors ${
                          active
                            ? 'bg-[color:var(--foreground)] text-[color:var(--background)]'
                            : 'text-foreground/75 hover:border-foreground/40 border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] hover:text-foreground'
                        }`}
                      >
                        {entry.label}
                        <span
                          className={`ml-1.5 tabular-nums ${
                            active ? 'opacity-70' : 'opacity-50'
                          }`}
                        >
                          {counts[entry.id]}
                        </span>
                      </button>
                    )
                  })}
                </div>

                <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                  <label className="relative block text-xs text-muted-foreground">
                    <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Rechercher modèle, SKU, design..."
                      className="h-11 w-full rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] pl-8 pr-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground"
                    />
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ArrowUpDown className="h-3 w-3" />
                    <select
                      value={sort}
                      onChange={(event) =>
                        setSort(event.target.value as StockSortKey)
                      }
                      className="h-11 min-w-48 rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-foreground"
                    >
                      <option value="priority">Priorité stock</option>
                      <option value="available-desc">
                        Quantité disponible
                      </option>
                      <option value="price-asc">Prix croissant</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="mt-5 rounded-md border border-[color:var(--sand-deep)] bg-card px-4 py-16 text-center text-sm text-muted-foreground">
                Aucun lot disponible ne correspond à cette recherche.
              </div>
            ) : (
              <RevealStagger className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
                {filtered.map((line) => (
                  <RevealItem key={line.id}>
                    <StockCard
                      line={line}
                      selected={selectedLine?.id === line.id}
                      onSelect={() => selectLine(line.id)}
                    />
                  </RevealItem>
                ))}
              </RevealStagger>
            )}
          </div>

          <aside className="lg:col-span-4">
            <div id="stock-request-panel" className="sticky top-24 scroll-mt-20">
              <StockRequestPanel line={selectedLine} />
            </div>
          </aside>
        </section>
      </main>

      <Footer />
    </div>
  )
}

function StockCard({
  line,
  selected,
  onSelect,
}: {
  readonly line: StockLine
  readonly selected: boolean
  readonly onSelect: () => void
}) {
  return (
    <article
      className={`shadow-paper group flex flex-col overflow-hidden rounded-md border bg-card transition-shadow ${
        selected
          ? 'border-[color:var(--ember)] ring-2 ring-[color:var(--ember)]/40'
          : 'border-[color:var(--sand-deep)]'
      }`}
      style={{ contentVisibility: 'auto', containIntrinsicSize: '420px' }}
    >
      <div className="relative">
        <button
          type="button"
          onClick={onSelect}
          className="block aspect-square w-full overflow-hidden bg-[color:var(--sand)] text-left"
          aria-label={`Sélectionner ${line.product.name}`}
        >
          <img
            src={line.product.mainImageUrl}
            alt={line.product.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        </button>

        <span className="absolute left-2 top-2 inline-flex items-center rounded-sm bg-[color:var(--forest)] px-2 py-0.5 text-[11px] font-medium text-white shadow-sm">
          {STOCK_CONDITION_LABEL[line.condition]}
        </span>
        <span className="absolute right-2 top-2 inline-flex items-center rounded-sm bg-white/90 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[color:var(--ink)] shadow-sm backdrop-blur">
          {line.availableUnits} libre{line.availableUnits > 1 ? 's' : ''}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-2.5 text-foreground">
        <div className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
          {CATEGORY_LABEL[line.product.category]} · {line.location}
        </div>
        <h3 className="mt-1 line-clamp-2 font-display text-sm font-semibold leading-tight tracking-tight">
          {line.product.name}
        </h3>
        <div className="mt-auto flex items-end justify-between gap-2 pt-2.5">
          <div>
            <div className="font-display text-base font-semibold tabular-nums">
              {formatEUR(line.stockPriceHt)}
            </div>
            <div className="text-[10px] text-muted-foreground">{line.readyLabel}</div>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={onSelect}
            className={`h-8 shrink-0 rounded-sm px-2.5 text-xs ${
              selected
                ? 'bg-[color:var(--ember)] text-white hover:bg-[color:var(--ember)]/90'
                : 'bg-[color:var(--foreground)] text-[color:var(--background)] hover:bg-[color:var(--ink-soft)]'
            }`}
          >
            Demander
          </Button>
        </div>
      </div>
    </article>
  )
}

function StockRequestPanel({ line }: { readonly line: StockLine | null }) {
  const stockRequestCreation = useStockRequestCreation()
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    company: '',
    email: '',
    phone: '',
    quantity: '',
  })

  const requestedQuantity = Number.parseInt(form.quantity, 10)
  const valid =
    Boolean(line) &&
    form.company.trim().length > 1 &&
    form.email.includes('@') &&
    form.phone.trim().length >= 6 &&
    Number.isFinite(requestedQuantity) &&
    requestedQuantity > 0

  const submit = async () => {
    if (!line || !valid) return

    const draftResult = buildStockRequestDraft({
      line,
      companyName: form.company,
      contactEmail: form.email,
      contactPhone: form.phone,
      requestedQuantity,
    })

    if (!draftResult.ok) {
      toast.error('Demande stock à compléter', {
        description:
          draftResult.issues[0]?.message ?? 'Vérifiez les champs obligatoires.',
      })
      return
    }

    setSubmitting(true)
    const creation = await stockRequestCreation.createStockRequest(
      draftResult.draft,
    )
    setSubmitting(false)

    if (!creation.ok) {
      toast.error('Demande stock non enregistrée', {
        description: creation.error,
      })
      return
    }

    toast.success('Demande stock préparée', {
      description: creation.persisted
        ? `${form.company} · ${requestedQuantity} ${line.product.name} · enregistré dans Supabase.`
        : `${form.company} · ${requestedQuantity} ${line.product.name} · conservé sur cet appareil, rappel manuel conseillé.`,
    })
    setForm({ company: '', email: '', phone: '', quantity: '' })
  }

  if (!line) {
    return (
      <div className="rounded-md border border-[color:var(--sand-deep)] bg-card p-5 text-sm text-muted-foreground">
        Sélectionnez un lot disponible pour préparer une demande.
      </div>
    )
  }

  return (
    <div className="rounded-md border border-[color:var(--sand-deep)] bg-card p-5">
      <div className="label-eyebrow text-[color:var(--ember)]">
        Demande rapide
      </div>
      <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight">
        {line.product.name}
      </h2>
      <div className="mt-3 space-y-2 text-xs text-muted-foreground">
        <PanelFact Icon={Clock3} text={line.readyLabel} />
        <PanelFact
          Icon={PackageCheck}
          text={`${line.availableUnits} unités libres`}
        />
        <PanelFact Icon={MapPin} text={line.location} />
      </div>
      <p className="mt-4 rounded-sm bg-[color:var(--sand-soft)] px-3 py-2 text-xs leading-5 text-muted-foreground">
        {line.note}
      </p>

      <div className="mt-5 space-y-3">
        <Input
          value={form.company}
          onChange={(event) =>
            setForm((previous) => ({
              ...previous,
              company: event.target.value,
            }))
          }
          placeholder="Société"
          className="h-11 rounded-sm border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]"
        />
        <Input
          value={form.email}
          onChange={(event) =>
            setForm((previous) => ({ ...previous, email: event.target.value }))
          }
          type="email"
          placeholder="Email professionnel"
          className="h-11 rounded-sm border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]"
        />
        <Input
          value={form.phone}
          onChange={(event) =>
            setForm((previous) => ({ ...previous, phone: event.target.value }))
          }
          type="tel"
          placeholder="Téléphone"
          className="h-11 rounded-sm border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]"
        />
        <Input
          value={form.quantity}
          onChange={(event) =>
            setForm((previous) => ({
              ...previous,
              quantity: event.target.value,
            }))
          }
          type="number"
          min={1}
          max={line.availableUnits}
          placeholder={`Quantité souhaitée, max ${line.availableUnits}`}
          className="h-11 rounded-sm border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]"
        />
      </div>

      <div className="mt-4 rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] p-3 text-xs">
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">Prix stock HT</span>
          <span className="font-medium tabular-nums">
            {formatEUR(line.stockPriceHt)} / unité
          </span>
        </div>
        <div className="mt-1 flex justify-between gap-3">
          <span className="text-muted-foreground">Total estimé</span>
          <span className="font-medium tabular-nums">
            {Number.isFinite(requestedQuantity) && requestedQuantity > 0
              ? formatEUR(requestedQuantity * line.stockPriceHt)
              : 'À compléter'}
          </span>
        </div>
      </div>

      <Button
        type="button"
        disabled={!valid || submitting}
        onClick={submit}
        className="mt-4 h-11 w-full rounded-sm bg-[color:var(--foreground)] text-[color:var(--background)] hover:bg-[color:var(--ink-soft)]"
      >
        <Phone className="h-4 w-4" />
        {submitting ? 'Enregistrement...' : 'Être rappelé'}
      </Button>
      <a
        href={`mailto:contact@prosimport.com?subject=Stock 24h - ${encodeURIComponent(
          line.product.name,
        )}`}
        className="hover:border-foreground/40 mt-3 inline-flex w-full items-center justify-center gap-2 rounded-sm border border-[color:var(--sand-deep)] px-3 py-2 text-sm transition-colors"
      >
        <Mail className="h-4 w-4" />
        Envoyer un email
      </a>
    </div>
  )
}

function Kpi({
  label,
  value,
}: {
  readonly label: string
  readonly value: string
}) {
  return (
    <div className="rounded-sm bg-[color:var(--sand-soft)] p-3">
      <div className="label-eyebrow text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-xl font-semibold tabular-nums">
        {value}
      </div>
    </div>
  )
}

function Badge({ children }: { readonly children: string }) {
  return (
    <span className="rounded-sm border border-[color:var(--sand-deep)] bg-card px-2.5 py-1 font-medium">
      {children}
    </span>
  )
}

function PanelFact({
  Icon,
  text,
}: {
  readonly Icon: typeof Clock3
  readonly text: string
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="text-foreground/70 h-4 w-4" />
      <span>{text}</span>
    </div>
  )
}
