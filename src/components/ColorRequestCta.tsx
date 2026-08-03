import { Link } from '@tanstack/react-router'
import { Palette } from 'lucide-react'

import type { Product } from '@/lib/products'

// « Demander un coloris » — UNE ligne + un lien, volontairement minimal :
// chaque modèle est personnalisable (nuancier tressages/toiles fournisseur,
// Pantone/RAL) mais un configurateur complet noierait l'acheteur. Le lien
// ouvre /contact pré-rempli avec la référence produit → demande qualifiée
// sans friction.

export function ColorRequestCta({ product }: { readonly product: Product }) {
  const message = `Bonjour, je suis intéressé par ${product.name} (réf. ${product.sku}) dans un coloris ou tressage différent de ceux affichés. Coloris souhaité : `

  return (
    <div className="flex items-start gap-2 rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-3 py-2.5 text-xs">
      <Palette className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--ember)]" />
      <span className="text-muted-foreground">
        Autre coloris ou tressage ? Ce modèle est personnalisable (nuancier
        Pantone / RAL).{' '}
        <Link
          to="/contact"
          search={{ topic: 'produit', message }}
          className="font-medium text-[color:var(--ember)] underline-offset-2 hover:underline"
        >
          Demander un coloris
        </Link>
      </span>
    </div>
  )
}
