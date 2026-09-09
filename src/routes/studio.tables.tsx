import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { CustomTableTopDialog } from '@/components/CustomTableTopDialog'
import { SafeImage } from '@/components/SafeImage'
import { BasePicker } from '@/components/studio/BasePicker'
import { TabletopPicker } from '@/components/studio/TabletopPicker'
import { TableQuantityField } from '@/components/studio/TableQuantityField'
import { ProjectRail } from '@/components/studio/ProjectRail'
import { ProjectBottomBar } from '@/components/studio/ProjectBottomBar'
import { StudioShell } from '@/components/studio/StudioShell'
import {
  StudioSectionHeader,
  studioButton,
} from '@/components/studio/StudioChoices'
import { UndoButton } from '@/components/studio/UndoButton'
import { useStudioCatalog } from '@/hooks/useStudioCatalog'
import { useStudioProjectSummary } from '@/hooks/useStudioProjectSummary'
import { useStudioTracker } from '@/hooks/useStudioTracker'
import { suggestTableQuantity } from '@/lib/studio/table-suggestion'
import {
  configurationProducts,
  evaluateTable,
  type TableConfiguration,
} from '@/lib/studio/table-project'
import { buildSeoHead } from '@/lib/seo'
import { isStudioEnabled } from '@/lib/studio/flags'
import { useStudioStore, createStudioSessionId } from '@/stores/studio.store'
export const Route = createFileRoute('/studio/tables')({
  validateSearch: (
    s: Record<string, unknown>,
  ): { entry?: 'tables'; configuration?: string } => ({
    ...(s.entry === 'tables' ? { entry: 'tables' as const } : {}),
    ...(typeof s.configuration === 'string' &&
    /^[A-Za-z0-9-]{1,80}$/.test(s.configuration)
      ? { configuration: s.configuration }
      : {}),
  }),
  head: () =>
    buildSeoHead({
      title: 'Studio — Tables',
      description:
        'Composez les tables de votre projet : plateau, finition et piètement compatible.',
      path: '/studio/tables',
      noindex: !isStudioEnabled(),
    }),
  component: StudioTables,
})
function StudioTables() {
  const search = Route.useSearch()
  const catalog = useStudioCatalog()
  const summary = useStudioProjectSummary(catalog.catalog)
  const project = useStudioStore((s) => s.project)
  const canUndo = useStudioStore((s) => s.journal.length > 0)
  const sessionId = useStudioStore((s) => s.sessionId)
  const tracker = useStudioTracker()
  const started = useRef('')
  useEffect(() => {
    const store = useStudioStore.getState()
    store.initializeAlgorithm('v0.1')
    if (
      (search.entry === 'tables' || !store.project.entry) &&
      store.project.entry !== 'tables'
    )
      store.setEntry('tables')
    if (started.current !== sessionId) {
      started.current = sessionId
      tracker.track('studio_tables_started')
    }
  }, [search.entry, sessionId, tracker])
  const [newId, setNewId] = useState(createStudioSessionId)
  const requested = search.configuration
  const config =
    project.tables?.find(
      (t) => t.id === (requested === 'new' ? newId : requested),
    ) ?? (!requested ? project.tables?.at(-1) : undefined)
  const [picking, setPicking] = useState(false)
  const [customOpen, setCustomOpen] = useState(false)
  const customTrigger = useRef<HTMLElement | null>(null)
  const openCustom = () => {
    customTrigger.current = document.activeElement as HTMLElement
    setCustomOpen(true)
  }
  const products = catalog.catalog?.products ?? []
  const suggestion = suggestTableQuantity(project.items)
  const details = config
    ? configurationProducts(config, summary.productsById)
    : null
  const evaluation = config
    ? evaluateTable(
        config,
        summary.productsById,
        summary.compatibility,
        summary.context,
      )
    : null
  const update = (next: TableConfiguration) =>
    useStudioStore.getState().saveTable(next, products, summary.compatibility)
  const initial = (): TableConfiguration =>
    config ?? {
      id: requested && requested !== 'new' ? requested : newId,
      top: null,
      base: null,
      quantity: suggestion,
      quantityEdited: false,
      custom: null,
      verificationRequested: false,
      baseInvalidated: false,
    }
  const focus = useRef<HTMLDivElement>(null)
  const showBases = () => {
    setPicking(false)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
  useEffect(() => {
    const heading = focus.current?.querySelector<HTMLElement>('h1')
    if (heading) {
      heading.tabIndex = -1
      heading.focus({ preventScroll: true })
    }
  }, [picking])
  return (
    <StudioShell
      rail={<ProjectRail {...summary} />}
      bottomBar={<ProjectBottomBar {...summary} />}
    >
      <div ref={focus}>
        <nav
          aria-label="Navigation Studio"
          className="mb-6 flex flex-wrap items-center justify-between gap-3"
        >
          <Link to="/studio" className={studioButton}>
            ← Studio
          </Link>
          <UndoButton
            canUndo={canUndo}
            onUndo={() => {
              useStudioStore.getState().undo()
              tracker.track('undo', {
                payload: { undone: 'table_configuration' },
              })
            }}
          />
        </nav>
        <StudioSectionHeader
          eyebrow="Tables · Votre projet"
          title={
            picking || !config
              ? 'Composez vos tables'
              : 'Votre table prend forme'
          }
        >
          Un plateau, sa finition, puis un piètement dont la compatibilité est
          déclarée.
        </StudioSectionHeader>
        {catalog.status === 'loading' && (
          <div
            role="status"
            className="h-64 animate-pulse bg-[color:var(--sand-deep)] motion-reduce:animate-none"
          >
            Chargement des plateaux…
          </div>
        )}
        {catalog.status === 'error' && (
          <div role="alert">
            Les plateaux n’ont pas pu être chargés. Votre projet est conservé.
            <button
              className={studioButton}
              onClick={() => window.location.reload()}
            >
              Réessayer
            </button>
          </div>
        )}
        {catalog.status === 'ready' && (
          <div className="space-y-8">
            {requested && requested !== 'new' && !config && (
              <p role="status">
                Cette configuration a été retirée. Vous pouvez composer une
                nouvelle table.
              </p>
            )}
            {picking || !config ? (
              <TabletopPicker
                key={config?.id ?? newId}
                products={products}
                selection={config?.top ?? null}
                onSelect={(top, variantId) => {
                  update({
                    ...initial(),
                    top: { productId: top.id, variantId },
                    custom: null,
                    verificationRequested: false,
                  })
                  tracker.track('tabletop_selected', {
                    productId: top.id,
                    variantId,
                  })
                  showBases()
                }}
                onCustom={openCustom}
              />
            ) : (
              <>
                <div className="flex items-center gap-4 border-b border-[color:var(--sand-deep)] pb-6">
                  <SafeImage
                    src={
                      details?.topVariant?.imageUrl ||
                      details?.top?.mainImageUrl
                    }
                    alt={details?.top?.name ?? 'Plateau sur mesure'}
                    className="h-28 w-28 shrink-0 bg-white"
                    imgClassName="h-28 w-28 shrink-0 bg-white object-contain p-3"
                  />
                  <div className="min-w-0 flex-1">
                    <h2 className="text-xl font-semibold">
                      {config.custom
                        ? 'Plateau sur mesure'
                        : (details?.top?.name ?? 'Plateau à vérifier')}
                    </h2>
                    <p className="mt-1 text-sm">
                      {config.custom
                        ? `${config.custom.length} × ${config.custom.width} cm · ${config.custom.finish}`
                        : details?.top
                          ? `${details.topVariant?.name ?? 'Finition à vérifier'} · ${details.top.dimensions.l} × ${details.top.dimensions.w} cm`
                          : ''}
                    </p>
                    <button
                      className={`${studioButton} mt-3`}
                      onClick={() => setPicking(true)}
                    >
                      Changer le plateau
                    </button>
                  </div>
                </div>
                {(config.baseInvalidated ||
                  (config.base && !evaluation?.compatible)) && (
                  <p
                    role="status"
                    className="border-l-2 border-[color:var(--ember)] pl-4"
                  >
                    Le piètement précédent n’est plus validé pour ce plateau.
                    Choisissez un autre piètement ou demandez une vérification.
                  </p>
                )}
                <TableQuantityField
                  config={config}
                  top={details?.top}
                  base={evaluation?.compatible ? details?.base : undefined}
                  suggestion={suggestion}
                  onChange={(quantity) => {
                    update({ ...config, quantity, quantityEdited: true })
                    tracker.track('table_quantity_changed', {
                      payload: { quantity: Math.max(1, Math.trunc(quantity)) },
                    })
                  }}
                />
                {config.custom ? (
                  <p role="status">
                    Ce plateau sur mesure nécessite une étude. Aucun prix ni
                    piètement compatible n’est confirmé. Votre besoin reste dans
                    le projet sur cet appareil.
                  </p>
                ) : details?.top && details.topVariant ? (
                  <BasePicker
                    top={details.top}
                    products={products}
                    data={summary.compatibility}
                    selected={evaluation?.compatible ? config.base : null}
                    requested={config.verificationRequested}
                    onSelect={(base, variantId) => {
                      update({
                        ...config,
                        base: { productId: base.id, variantId },
                        verificationRequested: false,
                      })
                      tracker.track('base_selected', {
                        productId: base.id,
                        variantId,
                      })
                    }}
                    onVerify={() => {
                      update({
                        ...config,
                        base: null,
                        verificationRequested: true,
                      })
                      tracker.track('compatibility_verification_requested', {
                        productId: config.top?.productId,
                      })
                    }}
                  />
                ) : (
                  <p role="status">
                    Ce plateau ou cette finition n’est plus disponible. Votre
                    besoin reste conservé ; choisissez un autre plateau.
                  </p>
                )}
                {evaluation?.compatible && (
                  <section
                    aria-label="Configuration"
                    className="border-t border-[color:var(--sand-deep)] pt-6"
                  >
                    <h2 className="text-2xl font-bold">
                      Votre configuration est dans le projet
                    </h2>
                    <p className="mt-2 text-sm">
                      {config.quantity} tables · {details?.topVariant?.name} ·{' '}
                      {details?.base?.name}. La compatibilité est déclarée ; la
                      disponibilité reste liée aux voies de fabrication ou au
                      stock.
                    </p>
                  </section>
                )}
                <div className="flex flex-wrap gap-3">
                  <button className={studioButton} onClick={openCustom}>
                    Autre dimension ?
                  </button>
                  <Link
                    to="/studio/tables"
                    search={{ configuration: 'new' }}
                    className={studioButton}
                    onClick={() => {
                      setNewId(createStudioSessionId())
                      setPicking(true)
                    }}
                  >
                    Ajouter une autre table
                  </Link>
                </div>
              </>
            )}
          </div>
        )}
        <CustomTableTopDialog
          open={customOpen}
          onOpenChange={setCustomOpen}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            const target = customTrigger.current?.isConnected
              ? customTrigger.current
              : focus.current?.querySelector<HTMLElement>('h1')
            target?.focus()
          }}
          onSaveProject={(request) => {
            update({
              ...initial(),
              top: null,
              base: null,
              custom: request,
              verificationRequested: true,
            })
            tracker.track('custom_tabletop_requested')
            showBases()
          }}
        />
      </div>
    </StudioShell>
  )
}
