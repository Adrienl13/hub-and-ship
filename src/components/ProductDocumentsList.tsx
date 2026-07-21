import {
  Download,
  FileCheck2,
  FileText,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { Product } from '@/lib/products'

type ProductDocumentKind = 'technical' | 'fire' | 'warranty' | 'quality'

interface ProductDocument {
  kind: ProductDocumentKind
  title: string
  meta: string
  gated: boolean
}

const DOCUMENT_ICONS: Record<ProductDocumentKind, typeof FileText> = {
  technical: FileText,
  fire: ShieldCheck,
  warranty: FileCheck2,
  quality: FileCheck2,
}

function getProductDocuments(product: Product): ProductDocument[] {
  return [
    {
      kind: 'technical',
      title: 'Fiche technique',
      meta: `${product.dimensions.l}x${product.dimensions.w}x${product.dimensions.h} cm · ${product.weightKg} kg`,
      gated: false,
    },
    {
      kind: 'warranty',
      title: 'Garantie fournisseur',
      meta: 'Conditions outdoor & usage CHR',
      gated: true,
    },
    {
      kind: 'quality',
      title: 'Contrôle qualité SGS',
      meta: 'Rapport joint avant départ usine',
      gated: true,
    },
  ]
}

export function ProductDocumentsList({ product }: { product: Product }) {
  const documents = getProductDocuments(product)

  return (
    <div className="rounded-md border border-[color:var(--sand-deep)] bg-card p-3">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <div className="label-eyebrow text-muted-foreground">
            Documents pro
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Les documents sensibles seront disponibles dans l'espace client.
          </div>
        </div>
        <span className="rounded-sm bg-[color:var(--sand-soft)] px-2 py-1 text-[10px] font-medium text-muted-foreground">
          {documents.length} docs
        </span>
      </div>

      <div className="divide-y divide-[color:var(--sand-deep)]">
        {documents.map((document) => {
          const Icon = DOCUMENT_ICONS[document.kind]
          return (
            <div key={document.kind} className="flex items-center gap-3 py-2.5">
              <span className="text-foreground/70 grid h-8 w-8 shrink-0 place-items-center rounded-sm bg-[color:var(--sand-soft)]">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium">
                  {document.title}
                </div>
                <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {document.meta}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0 rounded-sm border-[color:var(--sand-deep)]"
                disabled={document.gated}
                aria-label={
                  document.gated
                    ? `${document.title} verrouillé`
                    : `Télécharger ${document.title}`
                }
              >
                {document.gated ? (
                  <LockKeyhole className="h-3.5 w-3.5" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
