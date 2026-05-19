import { Star } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { catalogKeys, fetchPastContainers } from "@/lib/catalog";
import { Reveal, RevealStagger, RevealItem } from "@/components/motion-helpers";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function PastContainers() {
  const { data, isLoading } = useQuery({
    queryKey: catalogKeys.pastContainers,
    queryFn: fetchPastContainers,
    staleTime: 5 * 60_000,
  });

  const containers = data ?? [];

  return (
    <section id="livres" className="border-t border-[color:var(--sand-deep)]">
      <div className="mx-auto max-w-7xl px-6 py-20">
        <Reveal className="mb-12 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <div className="label-eyebrow text-[color:var(--ember)]">Preuves</div>
            <h2 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">
              Containers déjà livrés.
            </h2>
          </div>
          <p className="max-w-sm text-sm text-[color:var(--ink-soft)]">
            Chaque container est documenté de la cale au quai : transparence sur les délais réels et
            la qualité reçue.
          </p>
        </Reveal>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-96 animate-pulse rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]"
              />
            ))}
          </div>
        ) : containers.length === 0 ? (
          <div className="rounded-md border border-dashed border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] py-16 text-center text-sm text-muted-foreground">
            Aucun container livré pour le moment.
          </div>
        ) : (
          <RevealStagger className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {containers.map((c) => {
              const onTime =
                c.actualDays !== null && c.plannedDays !== null
                  ? c.actualDays <= c.plannedDays
                  : true;
              return (
                <RevealItem key={c.id}>
                  <article className="group h-full overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card transition-all hover:-translate-y-1 hover:border-foreground/30 hover:shadow-paper">
                    <div className="aspect-[4/3] overflow-hidden bg-[color:var(--sand)]">
                      {c.photoUrl && (
                        <img
                          src={c.photoUrl}
                          alt={`Container ${c.reference}`}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                        />
                      )}
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
                            {c.professionalsEngaged}
                          </strong>{" "}
                          pros servis
                        </span>
                        <span>
                          <strong className="font-semibold text-foreground tabular-nums">
                            {c.totalItems}
                          </strong>{" "}
                          articles
                        </span>
                        {c.plannedDays !== null && c.actualDays !== null && (
                          <span
                            className={
                              onTime ? "text-[color:var(--forest)]" : "text-[color:var(--ochre)]"
                            }
                          >
                            Annoncé {c.plannedDays}j / Réel {c.actualDays}j
                          </span>
                        )}
                      </div>

                      {c.testimonial && (
                        <>
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
                                  className={`h-3 w-3 ${i < (c.testimonial?.rating ?? 0) ? "fill-[color:var(--ember)] text-[color:var(--ember)]" : "text-[color:var(--sand-deep)]"}`}
                                />
                              ))}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </article>
                </RevealItem>
              );
            })}
          </RevealStagger>
        )}
      </div>
    </section>
  );
}
