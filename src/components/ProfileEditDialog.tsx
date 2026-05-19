import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type Professional, authKeys, updateProfile } from "@/lib/auth";

export function ProfileEditDialog({
  open,
  onOpenChange,
  professional,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  professional: Professional;
}) {
  const qc = useQueryClient();
  const [companyName, setCompanyName] = useState(professional.company_name);
  const [contactName, setContactName] = useState(professional.contact_name);
  const [phone, setPhone] = useState(professional.phone);
  const [deliveryZip, setDeliveryZip] = useState(professional.delivery_zip ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resync à chaque ouverture
  useEffect(() => {
    if (open) {
      setCompanyName(professional.company_name);
      setContactName(professional.contact_name);
      setPhone(professional.phone);
      setDeliveryZip(professional.delivery_zip ?? "");
      setError(null);
    }
  }, [open, professional]);

  const canSubmit =
    companyName.trim().length > 0 && contactName.trim().length > 0 && phone.length >= 6;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await updateProfile(professional.id, {
        companyName: companyName.trim(),
        contactName: contactName.trim(),
        phone,
        deliveryZip: deliveryZip.trim() || null,
      });
      qc.invalidateQueries({ queryKey: authKeys.professional(professional.id) });
      toast.success("Profil mis à jour");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[color:var(--sand-soft)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl tracking-tight">
            Modifier mon profil
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Le SIRET et l'email ne sont pas modifiables ici.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-3">
          <Field id="company" label="Société *" value={companyName} onChange={setCompanyName} />
          <Field
            id="contact"
            label="Nom du contact *"
            value={contactName}
            onChange={setContactName}
          />
          <Field id="phone" label="Téléphone *" value={phone} onChange={setPhone} type="tel" />
          <Field
            id="zip"
            label="Code postal livraison"
            value={deliveryZip}
            onChange={setDeliveryZip}
            inputMode="numeric"
          />

          <div className="space-y-1">
            <Label className="text-xs font-medium text-muted-foreground">
              SIRET (non modifiable)
            </Label>
            <div className="h-10 rounded-none border border-[color:var(--sand-deep)] bg-muted px-3 py-2.5 text-sm text-muted-foreground tabular-nums">
              {professional.siret}
            </div>
          </div>

          {error && (
            <p className="text-xs text-[color:var(--ember)]" role="alert">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={!canSubmit || submitting}
            className="h-11 w-full rounded-sm bg-foreground text-background hover:bg-foreground/90"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Enregistrer
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  inputMode,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
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
        inputMode={inputMode}
        className="h-10 rounded-none border-[color:var(--sand-deep)] bg-card focus-visible:border-foreground focus-visible:ring-0"
      />
    </div>
  );
}
