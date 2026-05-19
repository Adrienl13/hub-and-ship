import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle,
  Loader2,
  Package,
  Ship,
  Star,
  Users,
} from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { catalogKeys, fetchContainerByReference, fetchContainerLineup } from "@/lib/catalog";
import { CATEGORY_LABEL } from "@/lib/products";

export const Route = createFileRoute("/containers/$reference")({
  component: ContainerDetailPage,
  head: ({ params }) => ({
    meta: [{ title: `Container ${params.reference} — Container Club` }],
  }),
});

function ContainerDetailPage() {
  const { reference } = useParams({ from: "/containers/$reference" });

  const containerQuery = useQuery({
    queryKey: catalogKeys.containerByRef(reference),
    queryFn: () => fetchContainerByReference(reference),
    staleTime: 60_000,
  });

  const lineupQuery = useQuery({
    queryKey: catalogKeys.containerLineup(containerQuery.data?.id ?? ""),
    queryFn: () => fetchContainerLineup(containerQuery.data!.id),
    enabled: !!containerQuery.data?.id,
    staleTime: 60_000,
  });

  if (containerQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (containerQuery.isError || !containerQuery.data) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto max-w-md px-6 py-24 text-center">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Container introuvable
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Référence <code>{reference}</code> inconnue.
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-1.5 text-sm text-foreground hover:text-[color:var(--ember)]"
          >
            <ArrowLeft className="h-3 w-3" /> Retour à l'accueil
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  const c = containerQuery.data;
  const lineup = lineupQuery.data ?? [];
  const isDelivered = c.status === "delivered";
  const isOpen = c.status === "open";
  const onTime =
    c.actualDays !== null && c.plannedDays !== null ? c.actualDays <= c.plannedDays : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto max-w-5xl px-6 py-12">
        <a
          href="/#livres"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Tous les containers
        </a>

        <header className="mt-6 grid gap-6 lg:grid-cols-2 lg:gap-10">
          <div>
            <div className="flex items-center gap-2 label-eyebrow text-[color:var(--ember)]">
              <Ship className="h-3 w-3" />
              {isDelivered ? "Container livré" : isOpen ? "Container ouvert" : "Container en cours"}
            </div>
            <h1 className="mt-2 font-display text-4xl tracking-tight">{c.reference}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Destination {c.port} · 20' High Cube · capacité {c.capacityCbm} m³
            </p>

            {/* Stats */}
            <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-deep)] text-xs sm:grid-cols-4">
              <Stat
                icon={<Users className="h-3 w-3" />}
                label="Pros servis"
                value={String(c.professionalsEngaged)}
              />
              <Stat
                icon={<Package className="h-3 w-3" />}
                label="Articles"
                value={String(c.totalItems)}
              />
              <Stat
                icon={<CheckCircle className="h-3 w-3" />}
                label="Séries"
                value={`${c.seriesReached}/${c.totalSeries}`}
              />
              {isDelivered && c.plannedDays !== null && c.actualDays !== null && (
                <Stat
                  icon={<CalendarClock className="h-3 w-3" />}
                  label="Délai"
                  value={`${c.actualDays}j / ${c.plannedDays}j`}
                  tone={onTime ? "success" : "warn"}
                />
              )}
            </div>

            {isDelivered && c.deliveredAt && (
              <p className="mt-4 text-sm text-foreground/80">
                Livré le{" "}
                <strong>
                  {new Date(c.deliveredAt).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </strong>
              </p>
            )}
          </div>

          <div className="overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card">
            {c.photoUrl ? (
              <img
                src={c.photoUrl}
                alt={`Container ${c.reference}`}
                className="aspect-[4/3] w-full object-cover"
              />
            ) : (
              <div className="flex aspect-[4/3] w-full items-center justify-center bg-[color:var(--sand)] text-xs text-muted-foreground">
                Pas de photo
              </div>
            )}
          </div>
        </header>

        {/* Témoignage */}
        {c.testimonial && (
          <section className="mt-12 rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="label-eyebrow text-muted-foreground">Témoignage</div>
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-3 w-3 ${
                      i < c.testimonial!.rating
                        ? "fill-[color:var(--ember)] text-[color:var(--ember)]"
                        : "text-[color:var(--sand-deep)]"
                    }`}
                  />
                ))}
              </div>
            </div>
            <blockquote className="mt-3 font-display text-xl leading-snug tracking-tight">
              « {c.testimonial.quote} »
            </blockquote>
            <p className="mt-3 text-sm text-foreground/80">
              — {c.testimonial.author}, {c.testimonial.location}
            </p>
          </section>
        )}

        {/* Lineup */}
        <section className="mt-12">
          <h2 className="font-display text-2xl tracking-tight">
            {isDelivered ? "Ce qui était à bord" : "Engagements en cours"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {lineup.length} référence(s) · {c.totalItems} articles au total
          </p>

          {lineupQuery.isLoading ? (
            <div className="mt-6 h-32 animate-pulse rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]" />
          ) : lineup.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">
              Aucun engagement enregistré pour ce container.
            </p>
          ) : (
            <ul className="mt-6 divide-y divide-[color:var(--sand-deep)]/60 overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card">
              {lineup.map((it) => (
                <li
                  key={it.variantId}
                  className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="h-4 w-4 shrink-0 rounded-full ring-1 ring-foreground/15"
                      style={{ background: it.variantHex }}
                    />
                    <div className="min-w-0">
                      <div className="truncate font-medium">{it.productName}</div>
                      <div className="text-xs text-muted-foreground">
                        {CATEGORY_LABEL[it.productCategory]} · {it.variantName}
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-xs tabular-nums">
                    <div className="font-display text-base font-semibold">{it.unitsCommitted}</div>
                    <div className="text-muted-foreground">{it.cbmTotal.toFixed(2)} m³</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* CTA */}
        {isOpen && (
          <div className="mt-12 rounded-md border border-[color:var(--sand-deep)] bg-foreground p-6 text-[color:var(--sand)]">
            <h3 className="font-display text-xl tracking-tight">Ce container est encore ouvert</h3>
            <p className="mt-2 text-sm text-[color:var(--sand)]/75">
              Engagez votre place avant la clôture estimée le{" "}
              {c.expectedCloseAt
                ? new Date(c.expectedCloseAt).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : "à venir"}
              .
            </p>
            <a
              href="/#catalogue"
              className="mt-4 inline-flex items-center gap-2 rounded-sm bg-[color:var(--ember)] px-4 py-2.5 text-sm font-medium text-foreground hover:bg-[color:var(--ember)]/90"
            >
              Voir le catalogue
            </a>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "success" | "warn";
}) {
  const toneCls =
    tone === "success"
      ? "text-[color:var(--forest)]"
      : tone === "warn"
        ? "text-[color:var(--ochre)]"
        : "text-foreground";
  return (
    <div className="bg-card p-3">
      <div className="flex items-center gap-1 label-eyebrow text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={`mt-1 font-display text-base font-semibold tabular-nums ${toneCls}`}>
        {value}
      </div>
    </div>
  );
}
