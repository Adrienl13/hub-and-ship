import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { ContactForm } from '@/components/ContactForm'
import { CustomizationEditor } from '@/components/studio/CustomizationEditor'
import { ProjectSummary } from '@/components/studio/ProjectSummary'
import {
  studioButton,
  StudioSectionHeader,
} from '@/components/studio/StudioChoices'
import { useStudioCatalog } from '@/hooks/useStudioCatalog'
import { useStudioProjectSummary } from '@/hooks/useStudioProjectSummary'
import { useStudioStore } from '@/stores/studio.store'
import {
  lineTargets,
  seatKey,
  tableKey,
  projectTargets,
  type CustomizationTarget,
} from '@/lib/studio/customization'
import { customizationBrief } from '@/lib/studio/customization-brief'
export const Route = createFileRoute('/studio/personnalisation')({
  component: StudioCustomization,
})
function StudioCustomization() {
  const catalog = useStudioCatalog(),
    summary = useStudioProjectSummary(catalog.catalog)
  const project = useStudioStore((s) => s.project)
  const [stage, setStage] = useState<'edit' | 'summary'>('edit')
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const heading = root.current?.querySelector('h1')
    if (heading) {
      heading.tabIndex = -1
      heading.focus({ preventScroll: true })
    }
  }, [stage])
  const tables = project.tables ?? [],
    draft = project.customization ?? {}
  const field = (target: CustomizationTarget, title: string) => (
    <CustomizationEditor
      key={target.key}
      title={title}
      target={target}
      selections={draft[target.key] ?? []}
      data={summary.capabilities}
      onChange={(rows) =>
        useStudioStore.getState().setCustomization(target, rows)
      }
    />
  )
  const brief = customizationBrief(
    project.items,
    tables,
    summary.productsById,
    draft,
    summary.capabilities,
  )
  const empty = !project.items.length && !tables.length
  return (
    <div ref={root} className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6">
      <nav aria-label="Étapes du projet" className="flex flex-wrap gap-3">
        <Link to="/studio" className={studioButton}>
          ← Sélection
        </Link>
        <button
          className={studioButton}
          onClick={() => setStage('edit')}
          aria-current={stage === 'edit' ? 'step' : undefined}
        >
          Personnalisation
        </button>
        <button
          className={studioButton}
          onClick={() => setStage('summary')}
          aria-current={stage === 'summary' ? 'step' : undefined}
        >
          Résumé et envoi
        </button>
      </nav>
      <StudioSectionHeader
        eyebrow="Studio · Personnalisation"
        title={
          stage === 'edit'
            ? 'Un projet à votre image'
            : 'Votre projet, prêt à être étudié'
        }
      >
        Vos choix sont sauvegardés sur cet appareil. Une demande à confirmer ne
        vous empêche pas de nous transmettre votre projet.
      </StudioSectionHeader>
      <p className="text-sm text-[color:var(--ink-soft)]">
        Aucun supplément ni délai spécial n’est calculé ici. Les possibilités
        seront validées avec vous.
      </p>
      {empty ? (
        <p>
          Choisissez une assise ou une table pour personnaliser votre projet.
          Vous pouvez aussi nous décrire votre besoin ci-dessous.
        </p>
      ) : stage === 'edit' ? (
        <>
          {project.items.map((item) => (
            <article key={seatKey(item)} className="space-y-4">
              <h2 className="font-display text-xl">
                {summary.productsById.get(item.productId)?.name ??
                  'Assise à vérifier'}
              </h2>
              <label className="block">
                Quantité et besoin
                <input
                  aria-label={`Quantité pour ${item.productId}`}
                  className="ml-3 min-h-[44px] w-24 rounded border px-3"
                  type="number"
                  min={1}
                  value={item.requestedQuantity}
                  onChange={(e) =>
                    summary.onQuantityChange(item, Number(e.target.value))
                  }
                />
              </label>
              {lineTargets(seatKey(item), item.requestedQuantity, {
                seat: item.productId,
              }).map((t) =>
                field(
                  t,
                  t.scope === 'seat'
                    ? 'Apparence'
                    : 'Personnalisation spéciale et besoin',
                ),
              )}
            </article>
          ))}
          {tables.map((table) => (
            <article key={table.id} className="space-y-4">
              <h2 className="font-display text-xl">
                Table —{' '}
                {table.top
                  ? (summary.productsById.get(table.top.productId)?.name ??
                    'Plateau à vérifier')
                  : 'Sur mesure'}
              </h2>
              <label className="block">
                Quantité de tables
                <input
                  className="ml-3 min-h-[44px] w-24 rounded border px-3"
                  type="number"
                  min={1}
                  value={table.quantity}
                  onChange={(e) =>
                    summary.onTableQuantityChange(
                      table.id,
                      Number(e.target.value),
                    )
                  }
                />
              </label>
              {lineTargets(tableKey(table), table.quantity, {
                ...(table.top ? { tabletop: table.top.productId } : {}),
                ...(table.base ? { base: table.base.productId } : {}),
              }).map((t) =>
                field(
                  t,
                  t.scope === 'tabletop'
                    ? 'Plateau'
                    : t.scope === 'base'
                      ? 'Piètement'
                      : 'Besoins spécifiques',
                ),
              )}
            </article>
          ))}
          {projectTargets(project.items, tables)
            .filter((t) => t.scope === 'project')
            .map((t) => field(t, 'Besoins du projet'))}
          <button
            className={studioButton}
            onClick={() => {
              setStage('summary')
              window.scrollTo({ top: 0, behavior: 'instant' })
            }}
          >
            Voir le résumé et envoyer
          </button>
        </>
      ) : (
        <ProjectSummary {...summary} showCustomizationLink={false} />
      )}
      <details
        open={stage === 'summary' || empty}
        className="rounded-lg border border-[color:var(--sand-deep)] p-4"
      >
        <summary className="min-h-[44px] cursor-pointer font-semibold">
          Transmettre mon projet, même à confirmer
        </summary>
        <p className="mb-4 text-sm">
          Le formulaire joint votre sélection et toutes vos précisions. Votre
          brouillon reste sauvegardé après l’envoi.
        </p>
        <ContactForm
          initialTopic="produit"
          initialMessage="Bonjour, je souhaite étudier ce projet Studio avec vous."
          studioBrief={brief}
        />
      </details>
    </div>
  )
}
