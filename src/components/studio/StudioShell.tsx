// Coque du Studio (lot 2) : zone produit dominante (≈ 70 % sur desktop),
// rail projet persistant à droite sur desktop, barre projet en bas sur
// mobile. Espace de travail de projet, pas une grille catalogue.

import type { ReactNode } from 'react'

export function StudioShell({
  children,
  rail,
  bottomBar,
}: {
  readonly children: ReactNode
  /** Rail projet desktop (≥ lg). */
  readonly rail: ReactNode
  /** Barre projet mobile (< lg), fixée en bas. */
  readonly bottomBar: ReactNode
}) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-28 pt-4 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(300px,30%)] lg:gap-8 lg:pb-10 lg:pt-8">
      <div className="min-w-0">{children}</div>
      <aside
        aria-label="Mon projet"
        className="hidden lg:block lg:sticky lg:top-24 lg:self-start"
      >
        {rail}
      </aside>
      <div className="lg:hidden">{bottomBar}</div>
    </div>
  )
}
