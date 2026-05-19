import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Loader2, Pencil, Save, Ship, X } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AdminGuard } from "@/components/AdminGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  adminKeys,
  fetchAllContainersAdmin,
  updateContainerAdmin,
  type ContainerRow,
  type ContainerUpdateInput,
} from "@/lib/admin";

export const Route = createFileRoute("/admin/containers")({
  component: AdminContainersPage,
  head: () => ({
    meta: [{ title: "Containers — Admin Container Club" }],
  }),
});

function AdminContainersPage() {
  return (
    <AdminGuard>
      <ContainersList />
    </AdminGuard>
  );
}

const STATUS_LABEL: Record<ContainerRow["status"], string> = {
  open: "Ouvert",
  locked: "Verrouillé",
  shipping: "En expédition",
  delivered: "Livré",
  cancelled: "Annulé",
};

const STATUS_TONE: Record<ContainerRow["status"], string> = {
  open: "border-[color:var(--forest)]/30 bg-[color:var(--forest)]/10 text-[color:var(--forest)]",
  locked: "border-[color:var(--ember)]/30 bg-[color:var(--ember)]/10 text-[color:var(--ember)]",
  shipping: "border-[color:var(--ochre)]/30 bg-[color:var(--ochre)]/10 text-[color:var(--ochre)]",
  delivered: "border-border bg-muted text-muted-foreground",
  cancelled: "border-border bg-muted text-muted-foreground",
};

function ContainersList() {
  const containersQuery = useQuery({
    queryKey: adminKeys.allContainers,
    queryFn: fetchAllContainersAdmin,
    staleTime: 30_000,
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="mx-auto max-w-6xl px-6 py-12">
        <Link
          to="/admin"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Tableau de bord
        </Link>

        <header className="mt-6 flex flex-wrap items-end justify-between gap-3 border-b border-[color:var(--sand-deep)] pb-6">
          <div>
            <div className="label-eyebrow text-[color:var(--ember)]">Admin</div>
            <h1 className="mt-2 font-display text-3xl tracking-tight">Containers</h1>
          </div>
          <p className="text-xs text-muted-foreground">
            {containersQuery.data?.length ?? 0} containers
          </p>
        </header>

        {containersQuery.isLoading ? (
          <div className="mt-8 space-y-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]"
              />
            ))}
          </div>
        ) : containersQuery.isError ? (
          <p className="mt-8 text-sm text-[color:var(--ember)]">Erreur de chargement.</p>
        ) : (
          <ul className="mt-8 space-y-3">
            {(containersQuery.data ?? []).map((c) => (
              <li key={c.id}>
                {editingId === c.id ? (
                  <ContainerEditCard
                    container={c}
                    onCancel={() => setEditingId(null)}
                    onSaved={() => setEditingId(null)}
                  />
                ) : (
                  <ContainerReadCard container={c} onEdit={() => setEditingId(c.id)} />
                )}
              </li>
            ))}
          </ul>
        )}

        <p className="mt-12 text-[11px] text-muted-foreground">
          La création d'un nouveau container passe pour l'instant par le SQL Editor Supabase. Pour
          ouvrir un nouveau cycle : insérer une ligne avec status='open' puis basculer le précédent
          en 'delivered'.
        </p>
      </main>
      <Footer />
    </div>
  );
}

function ContainerReadCard({
  container: c,
  onEdit,
}: {
  container: ContainerRow;
  onEdit: () => void;
}) {
  return (
    <article className="overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card">
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <Ship className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-display text-base font-semibold tracking-tight">
                {c.reference}
              </span>
              <span
                className={`rounded-sm border px-1.5 py-0.5 text-[10px] font-medium ${STATUS_TONE[c.status]}`}
              >
                {STATUS_LABEL[c.status]}
              </span>
            </div>
            <div className="label-eyebrow mt-0.5 text-muted-foreground">
              {c.port} · {c.capacity_cbm} m³ · seuil {c.threshold_percent}%
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {c.expected_close_at && (
                <>Clôture estimée {new Date(c.expected_close_at).toLocaleDateString("fr-FR")} · </>
              )}
              {c.delivered_at && (
                <>Livré {new Date(c.delivered_at).toLocaleDateString("fr-FR")} · </>
              )}
              Display : {c.display_pros_count} pros · {c.display_items_count} articles ·{" "}
              {c.display_series_target} séries cible
            </div>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            size="sm"
            asChild
            className="h-8 gap-1.5 rounded-sm border-[color:var(--sand-deep)] text-xs"
          >
            <Link to="/containers/$reference" params={{ reference: c.reference }}>
              <ExternalLink className="h-3 w-3" />
              Voir
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            className="h-8 gap-1.5 rounded-sm border-[color:var(--sand-deep)] text-xs"
          >
            <Pencil className="h-3 w-3" />
            Modifier
          </Button>
        </div>
      </div>
    </article>
  );
}

function ContainerEditCard({
  container: c,
  onCancel,
  onSaved,
}: {
  container: ContainerRow;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<ContainerRow["status"]>(c.status);
  const [port, setPort] = useState(c.port);
  const [capacityCbm, setCapacityCbm] = useState(String(c.capacity_cbm));
  const [thresholdPercent, setThresholdPercent] = useState(String(c.threshold_percent));
  const [expectedCloseAt, setExpectedCloseAt] = useState(c.expected_close_at ?? "");
  const [deliveredAt, setDeliveredAt] = useState(c.delivered_at ?? "");
  const [plannedDays, setPlannedDays] = useState(
    c.planned_days !== null ? String(c.planned_days) : "",
  );
  const [actualDays, setActualDays] = useState(c.actual_days !== null ? String(c.actual_days) : "");
  const [photoUrl, setPhotoUrl] = useState(c.photo_url ?? "");
  const [displayProsCount, setDisplayProsCount] = useState(String(c.display_pros_count));
  const [displayItemsCount, setDisplayItemsCount] = useState(String(c.display_items_count));
  const [displaySeriesTarget, setDisplaySeriesTarget] = useState(String(c.display_series_target));
  const [tQuote, setTQuote] = useState(c.testimonial_quote ?? "");
  const [tAuthor, setTAuthor] = useState(c.testimonial_author ?? "");
  const [tLocation, setTLocation] = useState(c.testimonial_location ?? "");
  const [tRating, setTRating] = useState(
    c.testimonial_rating !== null ? String(c.testimonial_rating) : "",
  );
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (patch: ContainerUpdateInput) => updateContainerAdmin(c.id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.allContainers });
      qc.invalidateQueries({ queryKey: ["catalog"] });
      toast.success("Container mis à jour");
      onSaved();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Erreur");
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const ratingNum = tRating ? Number(tRating) : null;
    if (ratingNum !== null && (ratingNum < 1 || ratingNum > 5)) {
      setError("Note doit être entre 1 et 5");
      return;
    }

    mutation.mutate({
      status,
      port: port.trim(),
      capacity_cbm: Number(capacityCbm),
      threshold_percent: Number(thresholdPercent),
      expected_close_at: expectedCloseAt || null,
      delivered_at: deliveredAt || null,
      planned_days: plannedDays ? Number(plannedDays) : null,
      actual_days: actualDays ? Number(actualDays) : null,
      photo_url: photoUrl.trim() || null,
      display_pros_count: Number(displayProsCount),
      display_items_count: Number(displayItemsCount),
      display_series_target: Number(displaySeriesTarget),
      testimonial_quote: tQuote.trim() || null,
      testimonial_author: tAuthor.trim() || null,
      testimonial_location: tLocation.trim() || null,
      testimonial_rating: ratingNum,
    });
  };

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-md border border-foreground/30 bg-card p-5"
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="label-eyebrow text-[color:var(--ember)]">Édition</div>
          <h3 className="font-display text-base font-semibold tracking-tight">{c.reference}</h3>
        </div>
        <div className="text-[11px] text-muted-foreground">{c.id}</div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs font-medium">Statut</Label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ContainerRow["status"])}
            className="h-9 w-full rounded-none border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-2 text-sm focus:outline-none focus:ring-1 focus:ring-foreground"
          >
            {Object.entries(STATUS_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <FieldText label="Port" value={port} onChange={setPort} />
        <FieldText label="Capacité (m³)" value={capacityCbm} onChange={setCapacityCbm} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <FieldText
          label="Seuil départ (%)"
          value={thresholdPercent}
          onChange={setThresholdPercent}
        />
        <FieldText
          label="Clôture estimée"
          value={expectedCloseAt}
          onChange={setExpectedCloseAt}
          placeholder="YYYY-MM-DD"
        />
        <FieldText
          label="Date livraison"
          value={deliveredAt}
          onChange={setDeliveredAt}
          placeholder="YYYY-MM-DD"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <FieldText label="Délai annoncé (jours)" value={plannedDays} onChange={setPlannedDays} />
        <FieldText label="Délai réel (jours)" value={actualDays} onChange={setActualDays} />
      </div>

      <FieldText label="URL photo container" value={photoUrl} onChange={setPhotoUrl} />

      <details className="rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] p-3">
        <summary className="cursor-pointer text-xs font-medium">
          Compteurs affichés (social proof / containers passés)
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <FieldText
            label="Pros affichés"
            value={displayProsCount}
            onChange={setDisplayProsCount}
          />
          <FieldText
            label="Articles affichés"
            value={displayItemsCount}
            onChange={setDisplayItemsCount}
          />
          <FieldText
            label="Séries cible"
            value={displaySeriesTarget}
            onChange={setDisplaySeriesTarget}
          />
        </div>
      </details>

      <details className="rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] p-3">
        <summary className="cursor-pointer text-xs font-medium">
          Témoignage (containers livrés)
        </summary>
        <div className="mt-3 space-y-3">
          <div>
            <Label className="text-xs font-medium">Citation</Label>
            <Textarea
              value={tQuote}
              onChange={(e) => setTQuote(e.target.value)}
              rows={2}
              className="mt-1 rounded-none border-[color:var(--sand-deep)] bg-card focus-visible:border-foreground focus-visible:ring-0"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <FieldText label="Auteur" value={tAuthor} onChange={setTAuthor} />
            <FieldText label="Lieu" value={tLocation} onChange={setTLocation} />
            <FieldText label="Note 1-5" value={tRating} onChange={setTRating} />
          </div>
        </div>
      </details>

      {error && (
        <p className="text-xs text-[color:var(--ember)]" role="alert">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2 border-t border-[color:var(--sand-deep)] pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={mutation.isPending}
          className="h-9 gap-1.5 rounded-sm border-[color:var(--sand-deep)] text-xs"
        >
          <X className="h-3 w-3" />
          Annuler
        </Button>
        <Button
          type="submit"
          disabled={mutation.isPending}
          className="h-9 gap-1.5 rounded-sm bg-foreground text-xs text-background hover:bg-foreground/90"
        >
          {mutation.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Save className="h-3 w-3" />
          )}
          Enregistrer
        </Button>
      </div>
    </form>
  );
}

function FieldText({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 rounded-none border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] focus-visible:border-foreground focus-visible:ring-0"
      />
    </div>
  );
}
