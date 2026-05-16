import { Star } from "lucide-react";
import { PAST_CONTAINERS } from "@/lib/products";
import { Reveal, RevealStagger, RevealItem } from "@/components/motion-helpers";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function PastContainers() {
  return (
    <section
      id="livres"
      className="border-t border-[color:var(--sand-deep)]"
    >
      <div className="mx-auto max-w-7xl px-6 py-20">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <div className="label-eyebrow text-[color:var(--ember)]">Preuves</div>
            <h2 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">
              Containers déjà livrés.
            </h2>
          </div>
          <p className="max-w-sm text-sm text-[color:var(--ink-soft)]">
            Chaque container est documenté de la cale au quai : transparence sur
            les délais réels et la qualité reçue.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {PAST_CONTAINERS.map((c) => {
            const onTime = c.actualDays <= c.plannedDays;
            return (
              <article
                key={c.reference}
                className="overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card transition-colors hover:border-foreground/30"
              >
                <div className="aspect-[4/3] overflow-hidden bg-[color:var(--sand)]">
                  <img
                    src={c.photoUrl}
                    alt={`Container ${c.reference}`}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="space-y-3 p-5">
                  <div>
                    <div className="font-display text-base font-semibold tracking-tight">
                      {c.reference} · {c.port}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Livré le {formatDate(c.deliveredAt)}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground/75">
                    <span>
                      <strong className="font-semibold text-foreground tabular-nums">
                        {c.professionalsServed}
                      </strong>{" "}
                      pros servis
                    </span>
                    <span>
                      <strong className="font-semibold text-foreground tabular-nums">
                        {c.totalItems}
                      </strong>{" "}
                      articles
                    </span>
                    <span className={onTime ? "text-[color:var(--forest)]" : "text-[color:var(--ochre)]"}>
                      Annoncé {c.plannedDays}j / Réel {c.actualDays}j
                    </span>
                  </div>

                  <blockquote className="border-l-2 border-[color:var(--ember)]/40 pl-3 text-xs italic text-[color:var(--ink-soft)]">
                    "{c.testimonial.quote}"
                  </blockquote>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-foreground/80">
                      — {c.testimonial.author}, {c.testimonial.location}
                    </span>
                    <span className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`h-3 w-3 ${i < c.testimonial.rating ? "fill-[color:var(--ember)] text-[color:var(--ember)]" : "text-[color:var(--sand-deep)]"}`}
                        />
                      ))}
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
