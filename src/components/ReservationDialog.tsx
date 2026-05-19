import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Lock,
  LogIn,
  Mail,
  RefreshCcw,
  ShieldCheck,
  CreditCard,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatEUR, type CartItem, type OrderTotals } from "@/lib/order";
import { useProfessional, useSession } from "@/lib/auth";
import { createReservation } from "@/lib/reservations";
import { AuthDialog } from "@/components/AuthDialog";

export function ReservationDialog({
  open,
  onOpenChange,
  totals,
  items,
  containerId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  totals: OrderTotals;
  items: CartItem[];
  containerId: string | undefined;
}) {
  const sessionQuery = useSession();
  const proQuery = useProfessional();
  const qc = useQueryClient();

  const [step, setStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [deliveryZip, setDeliveryZip] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const user = sessionQuery.data?.user;
  const pro = proQuery.data;

  useEffect(() => {
    if (open && pro?.delivery_zip && !deliveryZip) {
      setDeliveryZip(pro.delivery_zip);
    }
  }, [open, pro, deliveryZip]);

  const reset = () => {
    setStep(1);
    setSubmitting(false);
    setError(null);
  };

  const submit = async () => {
    if (!containerId || !pro) return;
    setSubmitting(true);
    setError(null);
    try {
      await createReservation({
        containerId,
        professionalId: pro.id,
        items,
        totals,
        deliveryZip: deliveryZip.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      qc.invalidateQueries({ queryKey: ["catalog"] });
      onOpenChange(false);
      reset();
      toast.success("Réservation enregistrée", {
        description: `Confirmation envoyée à ${user?.email}. Paiement Stripe à connecter.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Échec de la réservation";
      setError(msg);
      setSubmitting(false);
    }
  };

  // --- Auth gate ---
  if (open && !user) {
    return (
      <>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            onOpenChange(v);
            if (!v) reset();
          }}
        >
          <DialogContent className="bg-[color:var(--sand-soft)] sm:max-w-md">
            <DialogHeader>
              <div className="label-eyebrow text-[color:var(--ember)]">Connexion requise</div>
              <DialogTitle className="font-display text-xl tracking-tight">
                Réservé aux pros connectés
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Pour engager votre place sur ce container, connectez-vous avec votre compte pro (ou
              créez-en un en moins de 2 minutes).
            </p>
            <Button
              onClick={() => setAuthOpen(true)}
              className="h-11 w-full rounded-sm bg-foreground text-background hover:bg-foreground/90"
            >
              <LogIn className="h-4 w-4" />
              Se connecter / créer un compte
            </Button>
          </DialogContent>
        </Dialog>
        <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
      </>
    );
  }

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
            {step === 1 ? "Confirmer votre réservation" : "Paiement de la réservation"}
          </DialogTitle>
        </DialogHeader>

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
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setStep(2);
            }}
          >
            <div className="rounded-md border border-[color:var(--sand-deep)] bg-card p-3 text-xs">
              <div className="label-eyebrow mb-1 text-muted-foreground">Pro connecté</div>
              {pro ? (
                <div className="space-y-0.5">
                  <div className="font-medium text-foreground">{pro.company_name}</div>
                  <div className="text-muted-foreground">
                    {pro.contact_name} · {pro.email} · SIRET {pro.siret}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Chargement du profil…
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field
                label="Code postal livraison"
                id="zip"
                value={deliveryZip}
                onChange={setDeliveryZip}
              />
              <Field label="Notes (optionnel)" id="notes" value={notes} onChange={setNotes} />
            </div>

            <Button
              type="submit"
              disabled={!pro}
              className="h-11 w-full rounded-sm bg-foreground text-background hover:bg-foreground/90"
            >
              Continuer vers le paiement
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
        ) : (
          <div className="space-y-4">
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

            {error && (
              <p className="text-xs text-[color:var(--ember)]" role="alert">
                {error}
              </p>
            )}

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
                disabled={submitting}
              >
                <ArrowLeft className="h-4 w-4" />
                Retour
              </Button>
              <Button
                type="button"
                className="h-11 flex-1 rounded-sm bg-foreground text-background hover:bg-foreground/90"
                onClick={submit}
                disabled={submitting || !pro || !containerId}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Traitement…
                  </>
                ) : (
                  <>Confirmer et payer {formatEUR(totals.payNow)}</>
                )}
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
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
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
