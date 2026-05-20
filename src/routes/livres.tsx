import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BadgeCheck, Boxes, Clock, Truck, Users, Star } from "lucide-react";

import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Reveal, RevealStagger, RevealItem, AnimatedNumber } from "@/components/motion-helpers";
import {
  CATEGORY_LABEL,
  PAST_CONTAINERS,
  getPastContainersStats,
  type PastContainer,
  type PastContainerTimelineStep,
} from "@/lib/products";

export const Route = createFileRoute("/livres")({
  component: LivresPage,
  head: () => ({
    meta: [
      {
        title: "Containers livrés — preuves & témoignages | Container Club",
      },
      {
        name: "description",
        content:
          "Containers déjà livrés par Container Club : timeline détaillée, contrôles qualité SGS, témoignages vérifiés, économies réelles. La preuve que l'achat groupé pro tient ses promesses.",
      },
      { property: "og:title", content: "Containers livrés — preuves | Container Club" },
      {
        property: "og:description",
        content: "Containers documentés de la cale au quai. Économies, témoignages, ponctualité.",
      },
    ],
  }),
});

const eurFmt = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function LivresPage() {
  const stats = getPastContainersStats();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <HeroSection stats={stats} />

      <main className="border-t border-[color:var(--sand-deep)]">
        <div className="mx-auto max-w-5xl space-y-20 px-6 py-20">
          {PAST_CONTAINERS.map((c, idx) => (
            <ContainerSection key={c.reference} container={c} index={idx + 1} />
          ))}
        </div>

        <BottomCta />
      </main>

      <Footer />
    </div>
  );
}

function HeroSection({ stats }: { stats: ReturnType<typeof getPastContainersStats> }) {
  return (
    <section className="border-b border-[color:var(--sand-deep)]">
      <div className="mx-auto max-w-7xl px-6 pb-14 pt-16 sm:pt-20">
        <Reveal className="max-w-3xl">
          <div className="label-eyebrow text-[color:var(--ember)]">Preuves & transparence</div>
          <h1 className="mt-2 font-display text-4xl leading-[1.05] sm:text-5xl md:text-6xl">
            Containers livrés.
            <br />
            <span className="text-[color:var(--ember)]">Documentés étape par étape.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-[color:var(--ink-soft)]">
            Chaque container que Container Club a livré est ici, dans le détail : timeline réelle,
            contrôle qualité SGS, photos, témoignage long. Aucune promesse marketing — juste les
            faits.
          </p>
        </Reveal>

        <RevealStagger className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-deep)] sm:grid-cols-4">
          <StatCard label="Containers livrés" value={stats.totalContainers} suffix="" />
          <StatCard label="Pros servis" value={stats.totalPros} suffix="" />
          <StatCard label="Articles livrés" value={stats.totalArticles} suffix="" />
          <StatCard
            label="Économies cumulées"
            value={Math.round(stats.totalSavings / 1000)}
            suffix=" k€"
            hint={`≈ ${stats.avgSavingsPercent.toFixed(0)}% en moyenne`}
          />
        </RevealStagger>

        <Reveal className="mt-6 flex flex-wrap items-center gap-2 text-xs" delay={0.15}>
          <span className="text-muted-foreground">Ponctualité globale :</span>
          <span className="rounded-sm bg-[color:var(--forest)]/12 px-2 py-0.5 font-medium text-[color:var(--forest)]">
            {stats.onTimeRate.toFixed(0)}% des containers livrés à date annoncée
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="text-foreground/70">
            Retard moyen sur les exceptions : 5 jours (toujours communiqué et compensé)
          </span>
        </Reveal>
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
  suffix,
  hint,
}: {
  label: string;
  value: number;
  suffix: string;
  hint?: string;
}) {
  return (
    <RevealItem className="bg-card p-5">
      <div className="label-eyebrow text-muted-foreground">{label}</div>
      <div className="mt-2 font-display text-3xl font-semibold tabular-nums tracking-tight sm:text-4xl">
        <AnimatedNumber value={value} suffix={suffix} />
      </div>
      {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
    </RevealItem>
  );
}

function ContainerSection({ container: c, index }: { container: PastContainer; index: number }) {
  const onTime = c.actualDays <= c.plannedDays;
  const deltaDays = c.actualDays - c.plannedDays;

  return (
    <article id={c.slug} className="scroll-mt-24">
      <Reveal className="space-y-8">
        {/* Header de container */}
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[color:var(--sand-deep)] pb-6">
          <div>
            <div className="label-eyebrow text-[color:var(--ember)]">
              Container nº{String(index).padStart(2, "0")}
            </div>
            <h2 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">{c.reference}</h2>
            <div className="mt-1 text-sm text-muted-foreground">
              {c.originPort} → {c.port} · Livré le {formatDate(c.deliveredAt)}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={
                onTime
                  ? "rounded-sm bg-[color:var(--forest)]/12 px-2.5 py-1 text-xs font-medium text-[color:var(--forest)]"
                  : "rounded-sm bg-[color:var(--ochre)]/15 px-2.5 py-1 text-xs font-medium text-[color:var(--ochre)]"
              }
            >
              {onTime
                ? deltaDays === 0
                  ? "Pile à date annoncée"
                  : `${Math.abs(deltaDays)}j d'avance`
                : `+${deltaDays}j de retard (transparent)`}
            </span>
            <span className="rounded-sm border border-[color:var(--ember)]/30 bg-[color:var(--ember)]/8 px-2.5 py-1 text-xs font-medium text-[color:var(--ember)]">
              −{c.savingsPercent}% vs retail
            </span>
          </div>
        </div>

        {/* Hero image + meta principales */}
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <div className="overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card">
              <div className="aspect-[16/10] overflow-hidden bg-[color:var(--sand)]">
                <img
                  src={c.photoUrl}
                  alt={`Container ${c.reference}`}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-deep)] lg:col-span-2">
            <MetaTile
              icon={<Users className="h-3.5 w-3.5" />}
              label="Pros mutualisés"
              value={`${c.professionalsServed}`}
            />
            <MetaTile
              icon={<Boxes className="h-3.5 w-3.5" />}
              label="Articles livrés"
              value={`${c.totalItems}`}
            />
            <MetaTile
              icon={<Clock className="h-3.5 w-3.5" />}
              label="Annoncé / Réel"
              value={`${c.plannedDays}j / ${c.actualDays}j`}
              valueClass={onTime ? "text-[color:var(--forest)]" : "text-[color:var(--ochre)]"}
            />
            <MetaTile
              icon={<Truck className="h-3.5 w-3.5" />}
              label="Économies cumulées"
              value={eurFmt.format(c.savingsTotalEur)}
              valueClass="text-[color:var(--ember)]"
            />
          </div>
        </div>

        {/* Histoire */}
        <div className="rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] p-6">
          <div className="label-eyebrow text-muted-foreground">Le récit du container</div>
          <p className="mt-3 text-sm leading-relaxed text-foreground/85">{c.story}</p>
        </div>

        {/* Timeline + breakdown produits côte à côte */}
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <Timeline steps={c.timeline} />
          </div>
          <div className="lg:col-span-2">
            <BreakdownCard breakdown={c.productBreakdown} />
            <CertificationsCard certifications={c.certifications} />
          </div>
        </div>

        {/* Galerie */}
        {c.gallery.length > 0 && (
          <div>
            <div className="label-eyebrow mb-3 text-muted-foreground">Galerie</div>
            <RevealStagger className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {c.gallery.map((g) => (
                <RevealItem
                  key={g.url}
                  className="overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card"
                >
                  <div className="aspect-[4/3] overflow-hidden bg-[color:var(--sand)]">
                    <img
                      src={g.url}
                      alt={g.caption}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-700 hover:scale-[1.04]"
                    />
                  </div>
                  <div className="px-3 py-2 text-[11px] text-muted-foreground">{g.caption}</div>
                </RevealItem>
              ))}
            </RevealStagger>
          </div>
        )}

        {/* Témoignage long */}
        <TestimonialCard testimonial={c.testimonial} />
      </Reveal>
    </article>
  );
}

function MetaTile({
  icon,
  label,
  value,
  valueClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="bg-card p-4">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="label-eyebrow">{label}</span>
      </div>
      <div
        className={`mt-1.5 font-display text-lg font-semibold tabular-nums tracking-tight ${valueClass ?? ""}`}
      >
        {value}
      </div>
    </div>
  );
}

function Timeline({ steps }: { steps: PastContainerTimelineStep[] }) {
  return (
    <div className="rounded-md border border-[color:var(--sand-deep)] bg-card">
      <div className="border-b border-[color:var(--sand-deep)] px-5 py-3">
        <div className="label-eyebrow text-muted-foreground">Timeline opérationnelle</div>
      </div>
      <ol className="relative space-y-5 px-5 py-5">
        {steps.map((step, i) => (
          <li key={i} className="relative pl-7">
            <span
              className={`absolute left-0 top-1.5 h-3 w-3 rounded-full ring-2 ring-[color:var(--sand-soft)] ${
                step.status === "delay" ? "bg-[color:var(--ochre)]" : "bg-[color:var(--forest)]"
              }`}
            />
            {i < steps.length - 1 && (
              <span className="absolute left-[5px] top-4 h-full w-px bg-[color:var(--sand-deep)]" />
            )}
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <div className="font-display text-sm font-semibold tracking-tight">{step.label}</div>
              <div className="text-[11px] tabular-nums text-muted-foreground">
                {formatDate(step.date)}
              </div>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-foreground/75">{step.description}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function BreakdownCard({ breakdown }: { breakdown: PastContainer["productBreakdown"] }) {
  return (
    <div className="rounded-md border border-[color:var(--sand-deep)] bg-card">
      <div className="border-b border-[color:var(--sand-deep)] px-5 py-3">
        <div className="label-eyebrow text-muted-foreground">Composition du container</div>
      </div>
      <ul className="divide-y divide-[color:var(--sand-deep)]/60 px-5">
        {breakdown.map((b) => (
          <li key={b.category} className="flex items-center justify-between gap-3 py-3 text-sm">
            <div>
              <div className="font-medium">{CATEGORY_LABEL[b.category]}</div>
              <div className="text-[11px] text-muted-foreground">{b.modelLabel}</div>
            </div>
            <div className="font-display text-base font-semibold tabular-nums">
              {b.units}
              <span className="ml-1 text-[10px] font-normal text-muted-foreground">unités</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CertificationsCard({ certifications }: { certifications: string[] }) {
  return (
    <div className="mt-3 rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] p-5">
      <div className="label-eyebrow text-muted-foreground">Certifications & conformité</div>
      <ul className="mt-3 space-y-1.5">
        {certifications.map((cert) => (
          <li key={cert} className="flex items-start gap-2 text-xs text-foreground/80">
            <BadgeCheck
              className="mt-0.5 h-3 w-3 shrink-0 text-[color:var(--forest)]"
              strokeWidth={2}
            />
            <span>{cert}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TestimonialCard({ testimonial: t }: { testimonial: PastContainer["testimonial"] }) {
  return (
    <figure className="rounded-md border border-[color:var(--ember)]/20 bg-card p-7 shadow-paper">
      <div className="flex items-center gap-1 text-[color:var(--ember)]">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`h-4 w-4 ${
              i < t.rating
                ? "fill-[color:var(--ember)] text-[color:var(--ember)]"
                : "text-[color:var(--sand-deep)]"
            }`}
          />
        ))}
      </div>
      <blockquote className="mt-4 font-display text-lg leading-relaxed text-foreground sm:text-xl">
        « {t.longQuote ?? t.quote} »
      </blockquote>
      <figcaption className="mt-4 flex flex-wrap items-baseline gap-x-2 text-sm">
        <span className="font-semibold text-foreground">{t.author}</span>
        <span className="text-muted-foreground">— {t.role}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">{t.location}</span>
      </figcaption>
    </figure>
  );
}

function BottomCta() {
  return (
    <section className="border-t border-[color:var(--sand-deep)] bg-foreground text-[color:var(--sand)]">
      <div className="mx-auto max-w-5xl px-6 py-20">
        <Reveal className="grid gap-8 lg:grid-cols-2 lg:items-center">
          <div>
            <div className="label-eyebrow text-[color:var(--ember-soft)]">Container en cours</div>
            <h2 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">
              Réservez votre place dans le prochain.
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-[color:var(--sand)]/75">
              Les containers livrés ci-dessus ont tous démarré comme une simple ligne de
              pré-commande à 3% de frais de réservation. Le suivant ferme bientôt.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 lg:justify-end">
            <Link
              to="/"
              hash="catalogue"
              className="inline-flex h-12 items-center gap-2 rounded-sm bg-[color:var(--sand)] px-6 text-sm font-semibold text-foreground transition-colors hover:bg-[color:var(--sand-soft)]"
            >
              Voir le catalogue
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/"
              hash="faq"
              className="inline-flex h-12 items-center gap-2 rounded-sm border border-[color:var(--sand)]/30 px-6 text-sm font-medium text-[color:var(--sand)] transition-colors hover:bg-[color:var(--sand)]/8"
            >
              Lire la FAQ
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
