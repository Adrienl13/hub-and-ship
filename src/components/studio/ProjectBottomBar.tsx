// Barre projet mobile (lot 2) : résumé compact fixé en bas, ouverture du
// projet complet en feuille (Sheet Radix : Escape ferme, focus piégé).
// Mêmes données que le rail : un seul store.

import { ChevronUp } from 'lucide-react'
import { useState } from 'react'

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { formatEUR } from '@/lib/order'

import { ProjectSummary, projectStateFor, type ProjectSummaryProps } from './ProjectSummary'

const STATE_SHORT: Record<string, string> = {
  reservation_ready: 'prêt',
  auto_quote_ready: 'devis',
  feasibility_review: 'étude',
  manual_quote_required: 'devis manuel',
}

export function ProjectBottomBar(props: ProjectSummaryProps) {
  const [open, setOpen] = useState(false)
  const { items, productsById, context } = props
  const totalUnits = items.reduce((sum, item) => sum + item.requestedQuantity, 0)
  const totalHt = items.reduce((sum, item) => {
    const product = productsById.get(item.productId)
    return sum + (product ? product.basePriceHt * item.requestedQuantity : 0)
  }, 0)
  const state = projectStateFor(items, productsById, context)
  const first = items[0] ? productsById.get(items[0].productId) : undefined

  return (
    <>
      <div
        data-testid="project-bottom-bar"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[color:var(--foreground)] text-[color:var(--sand)]"
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
                ? 'Mon projet : aucune assise choisie'
                : `${first?.name ?? 'Assise'} · ${totalUnits} unité${totalUnits > 1 ? 's' : ''}`}
            </span>
            <span className="block text-xs text-[color:var(--sand)]/70">
              {items.length === 0
                ? 'Choisissez une assise pour la retrouver ici'
                : `${formatEUR(totalHt)} HT indicatif${state ? ` · ${STATE_SHORT[state] ?? state}` : ''}`}
            </span>
          </span>
          <ChevronUp className="h-5 w-5 shrink-0" aria-hidden />
        </button>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-lg bg-[color:var(--sand-soft)]">
          <SheetHeader className="text-left">
            <SheetTitle>Mon projet</SheetTitle>
            <SheetDescription>Votre sélection, vos quantités et l&apos;état du projet.</SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            <ProjectSummary {...props} compact />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
