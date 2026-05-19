import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Filter, Package, Ship, Star, Users } from "lucide-react";
import {
  catalogKeys,
  computePastContainersStats,
  fetchPastContainers,
  type Container,
} from "@/lib/catalog";
import { Reveal, RevealItem, RevealStagger } from "@/components/motion-helpers";

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

  const containers = useMemo(() => data ?? [], [data]);

  // Filtres
  const [portFilter, setPortFilter] = useState<string>("all");
  const [yearFilter, setYearFilter] = useState<string>("all");

  const ports = useMemo(() => {
    const set = new Set<string>();
    for (const c of containers) set.add(c.port);
    return Array.from(set).sort();
  }, [containers]);

  const years = useMemo(() => {
    const set = new Set<string>();
    for (const c of containers) {
      if (c.deliveredAt) set.add(String(new Date(c.deliveredAt).getFullYear()));
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [containers]);

  const filtered = useMemo(() => {
    return containers.filter((c) => {
      if (portFilter !== "all" && c.port !== portFilter) return false;
      if (yearFilter !== "all") {
        if (!c.deliveredAt) return false;
        if (String(new Date(c.deliveredAt).getFullYear()) !== yearFilter) return false;
      }
      return true;
    });
  }, [containers, portFilter, yearFilter]);

  const stats = useMemo(() => computePastContainersStats(containers), [containers]);

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

        {/* Stats agrégées */}
        <Reveal>
          <div className="mb-10 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-deep)] sm:grid-cols-4">
            <BigStat
              icon={<Ship className="h-4 w-4" />}
              label="Containers livrés"
              value={String(stats.totalContainers)}
            />
            <BigStat
              icon={<Users className="h-4 w-4" />}
              label="Pros servis"
              value={String(stats.totalProsServed)}
            />
            <BigStat
              icon={<Package className="h-4 w-4" />}
              label="Articles livrés"
              value={String(stats.totalItems)}
            />
            <BigStat
              icon={<Star className="h-4 w-4" />}
              label="Dans les délais"
              value={`${Math.round(stats.onTimeRate * 100)}%`}
            />
          </div>
        </Reveal>

        {/* Filtres */}
        {containers.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-3 border-b border-[color:var(--sand-deep)] pb-4">
            <span className="flex items-center gap-1.5 label-eyebrow text-muted-foreground">
              <Filter className="h-3 w-3" />
              Filtrer
            </span>
            <SelectFilter
              label="Port"
              value={portFilter}
              onChange={setPortFilter}
              options={[
                { value: "all", label: "Tous" },
                ...ports.map((p) => ({ value: p, label: p })),
              ]}
            />
            <SelectFilter
              label="Année"
              value={yearFilter}
              onChange={setYearFilter}
              options={[
                { value: "all", label: "Toutes" },
                ...years.map((y) => ({ value: y, label: y })),
              ]}
            />
            {(portFilter !== "all" || yearFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setPortFilter("all");
                  setYearFilter("all");
                }}
                className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                Réinitialiser
              </button>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-96 animate-pulse rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-md border border-dashed border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] py-16 text-center text-sm text-muted-foreground">
            {containers.length === 0
              ? "Aucun container livré pour le moment."
              : "Aucun container ne correspond à ces filtres."}
          </div>
        ) : (
          <RevealStagger className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {filtered.map((c) => (
              <RevealItem key={c.id}>
                <PastContainerCard container={c} />
              </RevealItem>
            ))}
          </RevealStagger>
        )}
      </div>
    </section>
  );
}

function PastContainerCard({ container: c }: { container: Container }) {
  const onTime =
    c.actualDays !== null && c.plannedDays !== null ? c.actualDays <= c.plannedDays : true;

  return (
    <Link
      to="/containers/$reference"
      params={{ reference: c.reference }}
      className="group block h-full overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card transition-all hover:-translate-y-1 hover:border-foreground/30 hover:shadow-paper"
    >
      <article className="h-full">
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
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-display text-base font-semibold tracking-tight">
                {c.reference} · {c.port}
              </div>
              <div className="text-xs text-muted-foreground">
                Livré le {formatDate(c.deliveredAt)}
              </div>
            </div>
            <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground/75">
            <span>
              <strong className="font-semibold text-foreground tabular-nums">
                {c.professionalsEngaged}
              </strong>{" "}
              pros servis
            </span>
            <span>
              <strong className="font-semibold text-foreground tabular-nums">{c.totalItems}</strong>{" "}
              articles
            </span>
            {c.plannedDays !== null && c.actualDays !== null && (
              <span className={onTime ? "text-[color:var(--forest)]" : "text-[color:var(--ochre)]"}>
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
                      className={`h-3 w-3 ${
                        i < (c.testimonial?.rating ?? 0)
                          ? "fill-[color:var(--ember)] text-[color:var(--ember)]"
                          : "text-[color:var(--sand-deep)]"
                      }`}
                    />
                  ))}
                </span>
              </div>
            </>
          )}
        </div>
      </article>
    </Link>
  );
}

function BigStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-card p-5">
      <div className="flex items-center gap-1.5 label-eyebrow text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-2 font-display text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function SelectFilter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-foreground"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
