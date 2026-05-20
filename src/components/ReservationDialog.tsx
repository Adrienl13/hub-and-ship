import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Lock,
  Mail,
  RefreshCcw,
  ShieldCheck,
  CreditCard,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatEUR, type OrderTotals } from "@/lib/order";

export function ReservationDialog({
  open,
  onOpenChange,
  totals,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  totals: OrderTotals;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    zip: "",
    siret: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const canContinue =
    form.name.trim() && form.company.trim() && form.email.includes("@") && form.phone.length >= 6;

  const reset = () => {
    setStep(1);
    setSubmitting(false);
  };

  const handlePay = () => {
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      onOpenChange(false);
      reset();
      toast.success("Réservation enregistrée", {
        description: `Confirmation envoyée à ${form.email}. Paiement Stripe à connecter.`,
      });
    }, 900);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto bg-[color:var(--sand-soft)] sm:max-w-2xl">
        <DialogHeader>
          <div className="label-eyebrow text-[color:var(--ember)]">
            Étape {step} / 2 · Réservation
          </div>
          <DialogTitle className="font-display text-2xl tracking-tight">
            {step === 1 ? "Vos informations" : "Paiement de la réservation"}
          </DialogTitle>
        </DialogHeader>

        {/* Récap toujours visible */}
        <div className="rounded-md border border-[color:var(--sand-deep)] bg-card p-4">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="label-eyebrow text-muted-foreground">Total commande HT</div>
              <div className="mt-0.5 font-display text-lg font-semibold tabular-nums">
                {formatEUR(totals.subtotalHt)}
              </div>
            </div>
            <div>
              <div className="label-eyebrow text-muted-foreground">Économie</div>
              <div className="mt-0.5 font-display text-lg font-semibold tabular-nums text-[color:var(--ember)]">
                −{formatEUR(totals.savings)}
              </div>
            </div>
          </div>
          <div className="mt-3 border-t border-[color:var(--sand-deep)] pt-3">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-foreground/80">À payer aujourd'hui</span>
              <span className="font-display text-2xl font-semibold tabular-nums">
                {formatEUR(totals.payNow)}
              </span>
            </div>
            <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
              <div className="flex justify-between">
                <span>Acompte 27% à 80% remplissage</span>
                <span className="tabular-nums">{formatEUR(totals.payAt80Percent)}</span>
              </div>
              <div className="flex justify-between">
                <span>Solde 70% avant expédition</span>
                <span className="tabular-nums">{formatEUR(totals.payBeforeShipping)}</span>
              </div>
            </div>
          </div>
        </div>

        {step === 1 ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (canContinue) setStep(2);
            }}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field
                label="Nom complet *"
                id="name"
                value={form.name}
                onChange={(v) => setForm({ ...form, name: v })}
              />
              <Field
                label="Société / établissement *"
                id="company"
                value={form.company}
                onChange={(v) => setForm({ ...form, company: v })}
              />
              <Field
                label="Email pro *"
                id="email"
                type="email"
                value={form.email}
                onChange={(v) => setForm({ ...form, email: v })}
              />
              <Field
                label="Téléphone *"
                id="phone"
                type="tel"
                value={form.phone}
                onChange={(v) => setForm({ ...form, phone: v })}
              />
              <Field
                label="Code postal livraison"
                id="zip"
                value={form.zip}
                onChange={(v) => setForm({ ...form, zip: v })}
              />
              <Field
                label="SIRET (optionnel)"
                id="siret"
                value={form.siret}
                onChange={(v) => setForm({ ...form, siret: v })}
                hint="Demandé plus tard pour la facturation"
              />
            </div>

            <Button
              type="submit"
              disabled={!canContinue}
              className="h-11 w-full rounded-sm bg-foreground text-background hover:bg-foreground/90"
            >
              Continuer vers le paiement
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
        ) : (
          <div className="space-y-4">
            {/* Stripe placeholder */}
            <div className="rounded-md border border-[color:var(--sand-deep)] bg-card p-4">
              <div className="mb-3 flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                <span className="text-sm font-medium">Carte bancaire</span>
                <span className="ml-auto label-eyebrow text-muted-foreground">
                  Powered by Stripe
                </span>
              </div>
              <div className="space-y-2">
                <div className="rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-3 py-2.5 text-sm text-muted-foreground">
                  4242 4242 4242 4242
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-3 py-2.5 text-sm text-muted-foreground">
                    MM / AA
                  </div>
                  <div className="rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-3 py-2.5 text-sm text-muted-foreground">
                    CVC
                  </div>
                </div>
              </div>
              <div className="mt-3 rounded-sm bg-[color:var(--sand)] px-3 py-2 text-[11px] text-foreground/75">
                Vous serez débité aujourd'hui de{" "}
                <strong className="font-semibold">{formatEUR(totals.payNow)}</strong> (frais de
                réservation non-remboursables sauf annulation Container Club). Aucun autre
                prélèvement avant que le container atteigne 80%.
              </div>
            </div>

            <div className="space-y-1.5 text-[11px] text-muted-foreground">
              <Reassure Icon={Lock} t="Paiement sécurisé par Stripe · 3D Secure" />
              <Reassure Icon={Mail} t="Confirmation immédiate par email avec devis PDF" />
              <Reassure
                Icon={RefreshCcw}
                t="Frais remboursés à 100% si Container Club annule le container"
              />
              <Reassure Icon={ShieldCheck} t="Importation officielle · garantie 2 ans" />
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-sm border-[color:var(--sand-deep)]"
                onClick={() => setStep(1)}
              >
                <ArrowLeft className="h-4 w-4" />
                Retour
              </Button>
              <Button
                type="button"
                className="h-11 flex-1 rounded-sm bg-foreground text-background hover:bg-foreground/90"
                onClick={handlePay}
                disabled={submitting}
              >
                {submitting ? "Traitement…" : `Confirmer et payer ${formatEUR(totals.payNow)}`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  id,
  value,
  onChange,
  type = "text",
  hint,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs font-medium">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 rounded-none border-[color:var(--sand-deep)] bg-card focus-visible:border-foreground focus-visible:ring-0"
      />
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Reassure({ Icon, t }: { Icon: typeof Lock; t: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3 w-3 text-foreground/50" strokeWidth={1.5} />
      <span>{t}</span>
    </div>
  );
}
