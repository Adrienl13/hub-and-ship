import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Loader2, Pencil, Save, X } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { AdminGuard } from "@/components/AdminGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatEUR } from "@/lib/order";
import { CATEGORY_LABEL, type ProductCategory } from "@/lib/products";
import {
  adminKeys,
  fetchAllProductsAdmin,
  updateProductAdmin,
  type ProductUpdateInput,
  type ProductWithVariants,
} from "@/lib/admin";

export const Route = createFileRoute("/admin/products")({
  component: AdminProductsPage,
  head: () => ({
    meta: [{ title: "Catalogue — Admin Container Club" }],
  }),
});

function AdminProductsPage() {
  return (
    <AdminGuard>
      <ProductsList />
    </AdminGuard>
  );
}

function ProductsList() {
  const productsQuery = useQuery({
    queryKey: adminKeys.allProducts,
    queryFn: fetchAllProductsAdmin,
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
            <h1 className="mt-2 font-display text-3xl tracking-tight">Catalogue produits</h1>
          </div>
          <p className="text-xs text-muted-foreground">
            {productsQuery.data?.length ?? 0} produit(s) ·{" "}
            {productsQuery.data?.reduce((s, p) => s + p.variants.length, 0) ?? 0} variante(s)
          </p>
        </header>

        {productsQuery.isLoading ? (
          <div className="mt-8 space-y-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]"
              />
            ))}
          </div>
        ) : productsQuery.isError ? (
          <p className="mt-8 text-sm text-[color:var(--ember)]">Erreur de chargement.</p>
        ) : (
          <ul className="mt-8 space-y-3">
            {(productsQuery.data ?? []).map((p) => (
              <li key={p.id}>
                {editingId === p.id ? (
                  <ProductEditCard
                    product={p}
                    onCancel={() => setEditingId(null)}
                    onSaved={() => setEditingId(null)}
                  />
                ) : (
                  <ProductReadCard product={p} onEdit={() => setEditingId(p.id)} />
                )}
              </li>
            ))}
          </ul>
        )}

        <p className="mt-12 text-[11px] text-muted-foreground">
          La création/suppression de produits passe pour l'instant par le SQL Editor Supabase.
          L'édition de variantes (couleurs, hex) n'est pas encore disponible ici.
        </p>
      </main>
      <Footer />
    </div>
  );
}

function ProductReadCard({
  product: p,
  onEdit,
}: {
  product: ProductWithVariants;
  onEdit: () => void;
}) {
  return (
    <article className="overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card">
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
        <div className="flex min-w-0 gap-4">
          <img
            src={p.main_image_url}
            alt={p.name}
            loading="lazy"
            className="h-16 w-16 shrink-0 rounded-md object-cover ring-1 ring-foreground/10"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-display text-base font-semibold tracking-tight">{p.name}</span>
              {!p.is_active && (
                <span className="rounded-sm border border-[color:var(--ochre)]/30 bg-[color:var(--ochre)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[color:var(--ochre)]">
                  Inactif
                </span>
              )}
            </div>
            <div className="label-eyebrow mt-0.5 text-muted-foreground">
              {CATEGORY_LABEL[p.category as ProductCategory]} · SKU {p.sku} · MOQ {p.moq_units}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {p.variants.map((v) => (
                <span
                  key={v.id}
                  className="inline-flex items-center gap-1 rounded-sm bg-[color:var(--sand-soft)] px-1.5 py-0.5 text-[10px] text-foreground/75"
                  title={v.name}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full ring-1 ring-foreground/15"
                    style={{ background: v.hex }}
                  />
                  {v.name}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-right">
          <div>
            <div className="font-display text-base font-semibold tabular-nums">
              {formatEUR(Number(p.base_price_ht))}
            </div>
            <div className="text-[10px] text-muted-foreground tabular-nums">
              retail {formatEUR(Number(p.retail_price_ref))}
            </div>
          </div>
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

function ProductEditCard({
  product: p,
  onCancel,
  onSaved,
}: {
  product: ProductWithVariants;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(p.name);
  const [description, setDescription] = useState(p.description);
  const [basePrice, setBasePrice] = useState(String(p.base_price_ht));
  const [retailPrice, setRetailPrice] = useState(String(p.retail_price_ref));
  const [eco, setEco] = useState(String(p.eco_contribution));
  const [moq, setMoq] = useState(String(p.moq_units));
  const [imageUrl, setImageUrl] = useState(p.main_image_url);
  const [isActive, setIsActive] = useState(p.is_active);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (patch: ProductUpdateInput) => updateProductAdmin(p.id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.allProducts });
      qc.invalidateQueries({ queryKey: ["catalog"] });
      toast.success("Produit mis à jour");
      onSaved();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Erreur");
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const basePriceN = Number(basePrice);
    const retailN = Number(retailPrice);
    const ecoN = Number(eco);
    const moqN = Number(moq);
    if (Number.isNaN(basePriceN) || basePriceN < 0) {
      setError("Prix de base invalide");
      return;
    }
    if (Number.isNaN(retailN) || retailN < 0) {
      setError("Prix retail invalide");
      return;
    }
    if (Number.isNaN(ecoN) || ecoN < 0) {
      setError("Éco-contribution invalide");
      return;
    }
    if (!Number.isInteger(moqN) || moqN < 1) {
      setError("MOQ invalide");
      return;
    }
    mutation.mutate({
      name: name.trim(),
      description: description.trim(),
      base_price_ht: basePriceN,
      retail_price_ref: retailN,
      eco_contribution: ecoN,
      moq_units: moqN,
      main_image_url: imageUrl.trim(),
      is_active: isActive,
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
          <h3 className="font-display text-base font-semibold tracking-tight">{p.name}</h3>
        </div>
        <div className="text-[11px] text-muted-foreground">
          SKU {p.sku} · {p.id}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <FieldText label="Nom *" value={name} onChange={setName} />
        <FieldText label="URL image principale" value={imageUrl} onChange={setImageUrl} />
      </div>

      <div>
        <Label className="text-xs font-medium">Description</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="mt-1 rounded-none border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] focus-visible:border-foreground focus-visible:ring-0"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <FieldText label="Prix HT *" value={basePrice} onChange={setBasePrice} />
        <FieldText label="Prix retail réf" value={retailPrice} onChange={setRetailPrice} />
        <FieldText label="Éco-part" value={eco} onChange={setEco} />
        <FieldText label="MOQ *" value={moq} onChange={setMoq} />
      </div>

      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="h-4 w-4"
        />
        Produit actif (visible dans le catalogue public)
      </label>

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

      {mutation.isSuccess && (
        <p className="flex items-center gap-1 text-[11px] text-[color:var(--forest)]">
          <Check className="h-3 w-3" /> Modifications sauvegardées
        </p>
      )}
    </form>
  );
}

function FieldText({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-none border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] focus-visible:border-foreground focus-visible:ring-0"
      />
    </div>
  );
}
