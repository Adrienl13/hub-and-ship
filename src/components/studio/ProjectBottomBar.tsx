// Barre projet mobile (lot 2) : résumé compact fixé en bas, ouverture du
// projet complet en feuille (Sheet Radix : Escape ferme, focus piégé).
// Mêmes données que le rail : un seul store.

import { ChevronUp } from 'lucide-react'
import { useState } from 'react'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { formatEUR } from '@/lib/order'

import {
  ProjectSummary,
  projectOverview,
  type ProjectSummaryProps,
} from './ProjectSummary'

const STATE_SHORT: Record<string, string> = {
  reservation_ready: 'prêt',
  auto_quote_ready: 'devis',
  feasibility_review: 'étude',
  manual_quote_required: 'devis manuel',
}

export function ProjectBottomBar(props: ProjectSummaryProps) {
  const [open, setOpen] = useState(false)
  const { items, productsById } = props
  const tables = props.tables ?? []
  const { state, unresolved, totalUnits, totalHt } = projectOverview(props)
  const first = items[0] ? productsById.get(items[0].productId) : undefined

  return (
    <>
      <div
        data-testid="project-bottom-bar"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[color:var(--foreground)] pb-[env(safe-area-inset-bottom)] text-[color:var(--sand)]"
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-label="Ouvrir mon projet"
          className="mx-auto flex min-h-[56px] w-full max-w-7xl items-center justify-between gap-3 px-4 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--ember-bright)]"
        >
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">
              {items.length === 0
                ? tables.length
                  ? `Votre projet · ${totalUnits} éléments`
                  : 'Votre projet commence ici'
                : tables.length
                  ? `Votre projet · ${totalUnits} éléments`
                  : `${first?.name ?? 'Référence à vérifier'} · ${totalUnits} unité${totalUnits > 1 ? 's' : ''}`}
            </span>
            <span className="text-[color:var(--sand)]/70 block text-xs">
              {items.length === 0 && !tables.length
                ? 'Choisissez une assise pour la retrouver ici'
                : `${unresolved ? 'Montant à vérifier' : `${formatEUR(totalHt)} HT indicatif`}${state ? ` · ${STATE_SHORT[state] ?? state}` : ''}`}
            </span>
          </span>
          <ChevronUp className="h-5 w-5 shrink-0" aria-hidden />
        </button>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] overflow-y-auto rounded-t-lg bg-[color:var(--sand-soft)] motion-reduce:animate-none motion-reduce:transition-none [&>button]:flex [&>button]:items-center [&>button]:justify-center [&_button]:min-h-[44px] [&_button]:min-w-[44px]"
        >
          <SheetHeader className="pr-12 text-left">
            <SheetTitle>Mon projet</SheetTitle>
            <SheetDescription>
              Votre sélection, vos quantités et l&apos;état du projet.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            <ProjectSummary {...props} compact />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
