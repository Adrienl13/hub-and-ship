import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ReservationDialog } from "@/components/ReservationDialog";

export function StaticPageLayout({
  title,
  eyebrow,
  lastUpdated,
  children,
}: {
  title: string;
  eyebrow?: string;
  lastUpdated?: string;
  children: React.ReactNode;
}) {
  // Le ReservationDialog requiert items + containerId : sur une page statique
  // on n'a pas de panier, donc on ouvre la home pour réserver
  const [reserveOpen, setReserveOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header onReserve={() => setReserveOpen(true)} />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Retour à l'accueil
        </Link>

        <header className="mt-6 border-b border-[color:var(--sand-deep)] pb-6">
          {eyebrow && <div className="label-eyebrow text-[color:var(--ember)]">{eyebrow}</div>}
          <h1 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">{title}</h1>
          {lastUpdated && (
            <p className="mt-2 text-xs text-muted-foreground">
              Dernière mise à jour : {lastUpdated}
            </p>
          )}
        </header>

        <article className="prose-block mt-8 space-y-6 text-sm leading-relaxed text-foreground/85">
          {children}
        </article>
      </main>
      <Footer />

      <ReservationDialog
        open={reserveOpen}
        onOpenChange={setReserveOpen}
        totals={{
          subtotalHt: 0,
          ecoContributionTotal: 0,
          reservationFee: 0,
          payNow: 0,
          payAt80Percent: 0,
          payBeforeShipping: 0,
          totalHt: 0,
          vat: 0,
          totalTtc: 0,
          retailReference: 0,
          savings: 0,
          savingsPercent: 0,
        }}
        items={[]}
        containerId={undefined}
      />
    </div>
  );
}
