import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Boxes, Package, Ship, Users } from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AdminGuard } from "@/components/AdminGuard";
import { adminKeys, fetchAdminDashboardStats } from "@/lib/admin";

export const Route = createFileRoute("/admin")({
  component: AdminDashboardPage,
  head: () => ({
    meta: [{ title: "Admin — Container Club" }],
  }),
});

function AdminDashboardPage() {
  return (
    <AdminGuard>
      <Dashboard />
    </AdminGuard>
  );
}

function Dashboard() {
  const statsQuery = useQuery({
    queryKey: adminKeys.dashboardStats,
    queryFn: fetchAdminDashboardStats,
    staleTime: 30_000,
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto max-w-6xl px-6 py-12">
        <header className="border-b border-[color:var(--sand-deep)] pb-6">
          <div className="label-eyebrow text-[color:var(--ember)]">Back-office</div>
          <h1 className="mt-2 font-display text-3xl tracking-tight">Tableau de bord</h1>
        </header>

        {/* Stats */}
        <section className="mt-8">
          {statsQuery.isLoading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-24 animate-pulse rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]"
                />
              ))}
            </div>
          ) : statsQuery.isError ? (
            <p className="text-sm text-[color:var(--ember)]">Erreur de chargement.</p>
          ) : (
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-deep)] sm:grid-cols-4">
              <StatBlock
                icon={<Package className="h-4 w-4" />}
                label="Produits"
                value={statsQuery.data!.productsCount}
                sub={`${statsQuery.data!.variantsCount} variantes`}
              />
              <StatBlock
                icon={<Ship className="h-4 w-4" />}
                label="Containers ouverts"
                value={statsQuery.data!.containersOpen}
                sub={`${statsQuery.data!.containersDelivered} livrés`}
              />
              <StatBlock
                icon={<Boxes className="h-4 w-4" />}
                label="Réservations"
                value={statsQuery.data!.totalReservations}
                sub={`${statsQuery.data!.pendingReservations} en attente paiement`}
              />
              <StatBlock
                icon={<Users className="h-4 w-4" />}
                label="Pros inscrits"
                value={statsQuery.data!.totalProfessionals}
              />
            </div>
          )}
        </section>

        {/* Nav */}
        <section className="mt-12">
          <h2 className="font-display text-xl tracking-tight">Gérer</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <AdminCard
              to="/admin/products"
              icon={<Package className="h-5 w-5" />}
              title="Catalogue produits"
              desc="Modifier les prix, MOQ, descriptions, activer/désactiver"
            />
            <AdminCard
              to="/admin/containers"
              icon={<Ship className="h-5 w-5" />}
              title="Containers"
              desc="Créer un nouveau container, changer le statut, ajouter témoignages"
            />
          </div>
        </section>

        <p className="mt-12 text-[11px] text-muted-foreground">
          ⚠️ Toute modification est immédiatement appliquée. Pas d'historique /rollback automatique.
        </p>
      </main>
      <Footer />
    </div>
  );
}

function StatBlock({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <div className="bg-card p-5">
      <div className="flex items-center gap-1.5 label-eyebrow text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-2 font-display text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function AdminCard({
  to,
  icon,
  title,
  desc,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <Link
      to={to}
      className="group block rounded-md border border-[color:var(--sand-deep)] bg-card p-5 transition-colors hover:border-foreground/30"
    >
      <div className="flex items-center gap-2 text-foreground">
        {icon}
        <h3 className="font-display text-base font-semibold tracking-tight">{title}</h3>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{desc}</p>
    </Link>
  );
}
