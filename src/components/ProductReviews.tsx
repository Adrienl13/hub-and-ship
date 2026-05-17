import { Building2, ShieldCheck, Star, ThumbsUp } from "lucide-react";

import type { Product, ProductCategory } from "@/lib/products";

interface ReviewSummary {
  average: number;
  count: number;
  quality: number;
  value: number;
  delivery: number;
}

interface ProductReview {
  author: string;
  businessType: string;
  location: string;
  rating: number;
  orderSize: string;
  quote: string;
}

const SUMMARY_BY_CATEGORY: Record<ProductCategory, ReviewSummary> = {
  chair: { average: 4.7, count: 47, quality: 4.8, value: 4.6, delivery: 4.5 },
  armchair: { average: 4.6, count: 23, quality: 4.7, value: 4.5, delivery: 4.4 },
  table: { average: 4.5, count: 31, quality: 4.6, value: 4.4, delivery: 4.5 },
  bench: { average: 4.4, count: 12, quality: 4.5, value: 4.3, delivery: 4.2 },
};

const REVIEWS_BY_CATEGORY: Record<ProductCategory, ProductReview[]> = {
  chair: [
    {
      author: "Restaurant La Marina",
      businessType: "CHR",
      location: "Cap d'Agde",
      rating: 5,
      orderSize: "80 chaises",
      quote: "Bonne tenue en terrasse, empilage pratique et finition cohérente avec les photos.",
    },
    {
      author: "Hôtel Le Lavandou",
      businessType: "Hôtel",
      location: "Var",
      rating: 4,
      orderSize: "60 chaises",
      quote: "Produit reçu conforme. Quelques cartons marqués, mais mobilier intact au contrôle.",
    },
  ],
  armchair: [
    {
      author: "Camping Les Pins Bleus",
      businessType: "Camping",
      location: "Landes",
      rating: 5,
      orderSize: "54 fauteuils",
      quote: "Assise confortable, coussins faciles à retirer et rendu premium pour l'espace piscine.",
    },
    {
      author: "Rooftop Saint-Charles",
      businessType: "Bar",
      location: "Marseille",
      rating: 4,
      orderSize: "50 fauteuils",
      quote: "Bon rapport qualité/prix, surtout sur une commande groupée. Livraison bien documentée.",
    },
  ],
  table: [
    {
      author: "Brasserie du Port",
      businessType: "Brasserie",
      location: "La Ciotat",
      rating: 5,
      orderSize: "24 tables",
      quote: "Plateaux faciles à nettoyer, pieds stables et montage rapide pour l'équipe.",
    },
    {
      author: "Maison des Plages",
      businessType: "Restaurant",
      location: "Hyères",
      rating: 4,
      orderSize: "30 tables",
      quote: "La finition HPL tient bien au soleil. Les fiches techniques ont aidé pour valider l'achat.",
    },
  ],
  bench: [
    {
      author: "Résidence Les Pins",
      businessType: "Résidence tourisme",
      location: "Aix-en-Provence",
      rating: 4,
      orderSize: "55 bancs",
      quote: "Structure robuste et visuel conforme. À prévoir à deux personnes pour la manutention.",
    },
    {
      author: "Hôtel du Parc",
      businessType: "Hôtel",
      location: "Montpellier",
      rating: 5,
      orderSize: "50 bancs",
      quote: "Très bon rendu dans les zones d'accueil extérieur, facile à coordonner avec les assises.",
    },
  ],
};

function RatingStars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${rating}/5`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          className={`h-3.5 w-3.5 ${
            index < Math.round(rating)
              ? "fill-[color:var(--ember)] text-[color:var(--ember)]"
              : "text-[color:var(--sand-deep)]"
          }`}
        />
      ))}
    </span>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{value.toFixed(1)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[color:var(--sand-deep)]">
        <div
          className="h-full rounded-full bg-[color:var(--forest)]"
          style={{ width: `${Math.min(100, (value / 5) * 100)}%` }}
        />
      </div>
    </div>
  );
}

export function ProductReviews({ product }: { product: Product }) {
  const summary = SUMMARY_BY_CATEGORY[product.category];
  const reviews = REVIEWS_BY_CATEGORY[product.category];

  return (
    <div className="rounded-md border border-[color:var(--sand-deep)] bg-card p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="label-eyebrow text-muted-foreground">Avis vérifiés</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="font-display text-2xl font-semibold tabular-nums">
              {summary.average.toFixed(1)}
            </span>
            <div>
              <RatingStars rating={summary.average} />
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                {summary.count} avis après livraison
              </div>
            </div>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-sm bg-[color:var(--forest)]/10 px-2 py-1 text-[10px] font-medium text-[color:var(--forest)]">
          <ShieldCheck className="h-3 w-3" />
          B2B
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <ScoreBar label="Qualité" value={summary.quality} />
        <ScoreBar label="Valeur" value={summary.value} />
        <ScoreBar label="Délais" value={summary.delivery} />
      </div>

      <div className="mt-3 space-y-2">
        {reviews.map((review) => (
          <article
            key={`${review.author}-${review.orderSize}`}
            className="rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] p-2.5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-1.5 text-xs font-medium">
                  <Building2 className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="truncate">{review.author}</span>
                </div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {review.businessType} · {review.location} · {review.orderSize}
                </div>
              </div>
              <RatingStars rating={review.rating} />
            </div>
            <p className="mt-2 text-xs leading-5 text-foreground/80">"{review.quote}"</p>
          </article>
        ))}
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-sm bg-[color:var(--sand-soft)] px-2.5 py-2 text-[11px] text-muted-foreground">
        <ThumbsUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--forest)]" />
        Avis publiés uniquement après commande soldée et container livré.
      </div>
    </div>
  );
}
