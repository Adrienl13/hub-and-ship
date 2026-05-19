import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarClock,
  Check,
  CircleAlert,
  Loader2,
  Package,
  Ship,
  X,
} from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AuthDialog } from "@/components/AuthDialog";
import { Button } from "@/components/ui/button";
import { ReservationDialog } from "@/components/ReservationDialog";
import { useProfessional, useSession } from "@/lib/auth";
import {
  fetchMyReservations,
  reservationKeys,
  type ReservationWithItems,
} from "@/lib/reservations";
import { formatEUR } from "@/lib/order";

export const Route = createFileRoute("/compte")({
  component: AccountPage,
  head: () => ({
    meta: [{ title: "Mon compte — Container Club" }],
  }),
});

function AccountPage() {
  const sessionQuery = useSession();
  const proQuery = useProfessional();
  const user = sessionQuery.data?.user;
  const pro = proQuery.data;

  const [authOpen, setAuthOpen] = useState(false);
  const [reserveOpen, setReserveOpen] = useState(false);

  const reservationsQuery = useQuery({
    queryKey: reservationKeys.myReservations(pro?.id),
    queryFn: fetchMyReservations,
    enabled: !!pro?.id,
  });

  if (sessionQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header onReserve={() => setReserveOpen(true)} />
        <main className="mx-auto max-w-md px-6 py-24 text-center">
          <h1 className="font-display text-2xl font-semibold tracking-tight">Connexion requise</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Connectez-vous pour accéder à votre espace pro et voir vos réservations.
          </p>
          <Button
            onClick={() => setAuthOpen(true)}
            className="mt-6 h-11 w-full rounded-sm bg-foreground text-background hover:bg-foreground/90"
          >
            Se connecter / créer un compte
          </Button>
          <Link
            to="/"
            className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Retour à l'accueil
          </Link>
        </main>
        <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header onReserve={() => setReserveOpen(true)} />
      <main className="mx-auto max-w-5xl px-6 py-12">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Retour à l'accueil
        </Link>

        <header className="mt-6 flex flex-wrap items-end justify-between gap-4 border-b border-[color:var(--sand-deep)] pb-6">
          <div>
            <div className="label-eyebrow text-[color:var(--ember)]">Espace pro</div>
            <h1 className="mt-2 font-display text-3xl tracking-tight">
              {pro?.company_name ?? "Mon compte"}
            </h1>
          </div>
          {pro && (
            <div className="text-right text-xs text-muted-foreground">
              <div>SIRET {pro.siret}</div>
              <div>{pro.email}</div>
            </div>
          )}
        </header>

        {/* Profil */}
        {pro && (
          <section className="mt-8 grid gap-4 rounded-md border border-[color:var(--sand-deep)] bg-card p-5 sm:grid-cols-4">
            <ProfileRow label="Contact" value={pro.contact_name} />
            <ProfileRow label="Téléphone" value={pro.phone} />
            <ProfileRow label="Livraison" value={pro.delivery_zip ?? "Non renseignée"} />
            <ProfileRow
              label="Membre depuis"
              value={new Date(pro.created_at).toLocaleDateString("fr-FR")}
            />
          </section>
        )}

        {/* Réservations */}
        <section className="mt-10">
          <h2 className="font-display text-xl tracking-tight">Mes réservations</h2>

          {reservationsQuery.isLoading ? (
            <div className="mt-6 space-y-3">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="h-32 animate-pulse rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]"
                />
              ))}
            </div>
          ) : reservationsQuery.isError ? (
            <p className="mt-4 text-sm text-[color:var(--ember)]">
              Erreur de chargement. Réessayez plus tard.
            </p>
          ) : (reservationsQuery.data ?? []).length === 0 ? (
            <div className="mt-6 rounded-md border border-dashed border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] py-12 text-center text-sm text-muted-foreground">
              Aucune réservation pour le moment.{" "}
              <Link to="/" className="font-medium text-foreground hover:text-[color:var(--ember)]">
                Voir le catalogue
              </Link>
              .
            </div>
          ) : (
            <ul className="mt-6 space-y-4">
              {reservationsQuery.data!.map((r) => (
                <ReservationCard key={r.id} reservation={r} />
              ))}
            </ul>
          )}
        </section>
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

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="label-eyebrow text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

function ReservationCard({ reservation: r }: { reservation: ReservationWithItems }) {
  const totalUnits = r.items.reduce((s, i) => s + i.quantity, 0);
  const totalCbm = r.items.reduce((s, i) => s + i.quantity * i.cbm_per_unit, 0);

  return (
    <li className="overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-5 py-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Ship className="h-3 w-3" />
            <span className="font-medium tabular-nums text-foreground">
              {r.container_reference}
            </span>
            <span>·</span>
            <span>{r.container_port}</span>
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            Réservé le{" "}
            {new Date(r.created_at).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </div>
        </div>
        <StatusBadge status={r.status} />
      </header>

      <ul className="divide-y divide-[color:var(--sand-deep)]/60">
        {r.items.map((it) => (
          <li key={it.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-xs">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="h-3 w-3 shrink-0 rounded-full ring-1 ring-foreground/15"
                style={{ background: it.variant_hex }}
              />
              <span className="truncate">
                <span className="font-medium tabular-nums">{it.quantity}× </span>
                {it.product_name}
                <span className="text-muted-foreground"> · {it.variant_name}</span>
              </span>
            </div>
            <span className="shrink-0 tabular-nums font-medium">
              {formatEUR(it.unit_price_ht * it.quantity)}
            </span>
          </li>
        ))}
      </ul>

      <footer className="grid grid-cols-2 gap-px border-t border-[color:var(--sand-deep)] bg-[color:var(--sand-deep)] text-xs sm:grid-cols-4">
        <Stat
          icon={<Package className="h-3 w-3" />}
          label="Articles"
          value={`${totalUnits} unités`}
        />
        <Stat
          icon={<CalendarClock className="h-3 w-3" />}
          label="Volume"
          value={`${totalCbm.toFixed(2)} m³`}
        />
        <Stat label="Sous-total HT" value={formatEUR(r.subtotal_ht)} bold />
        <Stat label="Acompte payé" value={formatEUR(r.reservation_fee)} bold />
      </footer>
    </li>
  );
}

function Stat({
  icon,
  label,
  value,
  bold,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="bg-card p-3">
      <div className="flex items-center gap-1 label-eyebrow text-muted-foreground">
        {icon}
        {label}
      </div>
      <div
        className={`mt-1 tabular-nums ${bold ? "font-display text-sm font-semibold" : "text-foreground"}`}
      >
        {value}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ReservationWithItems["status"] }) {
  const map: Record<
    ReservationWithItems["status"],
    { label: string; icon: React.ReactNode; cls: string }
  > = {
    pending_payment: {
      label: "En attente paiement",
      icon: <CircleAlert className="h-3 w-3" />,
      cls: "border-[color:var(--ochre)]/30 bg-[color:var(--ochre)]/10 text-[color:var(--ochre)]",
    },
    confirmed: {
      label: "Confirmée",
      icon: <Check className="h-3 w-3" />,
      cls: "border-[color:var(--forest)]/30 bg-[color:var(--forest)]/12 text-[color:var(--forest)]",
    },
    cancelled: {
      label: "Annulée",
      icon: <X className="h-3 w-3" />,
      cls: "border-border bg-muted text-muted-foreground",
    },
  };
  const s = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[10px] font-medium ${s.cls}`}
    >
      {s.icon}
      {s.label}
    </span>
  );
}
