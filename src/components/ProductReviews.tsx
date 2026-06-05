import { ShieldCheck, Star } from 'lucide-react'

// No official customer reviews exist yet. Rather than seed fake testimonials
// (misleading, and a credibility risk for a B2B audience), we show a clean
// empty state that frames the collection model: verified reviews are gathered
// after each container delivery. When a real reviews source lands, render the
// list here and keep this block as the zero-state fallback.
export function ProductReviews() {
  return (
    <div className="rounded-md border border-[color:var(--sand-deep)] bg-card p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="label-eyebrow text-muted-foreground">Avis clients</div>
        <span className="bg-[color:var(--forest)]/10 inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[10px] font-medium text-[color:var(--forest)]">
          <ShieldCheck className="h-3 w-3" />
          Vérifiés après livraison
        </span>
      </div>

      <div className="flex flex-col items-center gap-2 rounded-sm border border-dashed border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-3 py-5 text-center">
        <span className="flex items-center gap-0.5" aria-hidden="true">
          {Array.from({ length: 5 }).map((_, index) => (
            <Star key={index} className="h-4 w-4 text-[color:var(--sand-deep)]" />
          ))}
        </span>
        <div className="text-sm font-medium">Pas encore d'avis</div>
        <p className="max-w-xs text-[11px] leading-5 text-muted-foreground">
          Les avis sont collectés et publiés après chaque livraison de
          container — uniquement sur commande soldée et reçue. Soyez parmi les
          premiers à partager votre retour.
        </p>
      </div>
    </div>
  )
}
