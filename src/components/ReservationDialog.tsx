import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Mail, RefreshCcw, ShieldCheck, Lock } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { toast } from "sonner";

import { formatEUR, type CartItem, type OrderTotals } from "@/lib/order";
import {
  createReservation,
  type ReservationContact,
  type CreateReservationResult,
} from "@/lib/reservations";
import { createCheckoutSession } from "@/lib/checkout.server";

// ---------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------

const reservationSchema = z.object({
  name: z.string().trim().min(2, "Nom requis").max(120),
  company: z.string().trim().min(2, "Société requise").max(200),
  email: z.string().trim().toLowerCase().email("Email invalide").max(200),
  phone: z
    .string()
    .trim()
    .regex(
      /^(?:\+33|0)[1-9](?:[\s.-]?\d{2}){4}$/,
      "Téléphone FR invalide (ex : 06 12 34 56 78 ou +33 6 12 34 56 78)",
    ),
  zip: z
    .string()
    .trim()
    .regex(/^[0-9]{5}$/, "Code postal à 5 chiffres")
    .optional()
    .or(z.literal("")),
  siret: z
    .string()
    .trim()
    .regex(/^[0-9]{14}$/, "SIRET à 14 chiffres")
    .optional()
    .or(z.literal("")),
  consent: z.literal(true, {
    errorMap: () => ({ message: "Consentement requis" }),
  }),
});

type ReservationFormValues = z.infer<typeof reservationSchema>;

const DEFAULT_VALUES: ReservationFormValues = {
  name: "",
  company: "",
  email: "",
  phone: "",
  zip: "",
  siret: "",
  // Default checkbox to `false`. Zod treats it as invalid until user
  // ticks it, which is what we want.
  consent: false as unknown as true,
};

// ---------------------------------------------------------------
// Stored confirmation contract (mirrors /reservation/$id)
// ---------------------------------------------------------------

type StoredItem = {
  productName: string;
  productSku: string;
  mainImageUrl: string;
  variantName: string;
  variantHex: string;
  quantity: number;
  unitPriceHt: number;
};

type StoredConfirmation = {
  contact: ReservationContact;
  items: StoredItem[];
  totals: OrderTotals;
  containerReference: string;
  createdAt: string;
};

function toStoredItems(items: CartItem[]): StoredItem[] {
  return items.map((item) => ({
    productName: item.product.name,
    productSku: item.product.sku,
    mainImageUrl: item.product.mainImageUrl,
    variantName: item.variant.name,
    variantHex: item.variant.hex,
    quantity: item.quantity,
    unitPriceHt: item.product.basePriceHt,
  }));
}

// ---------------------------------------------------------------
// Component
// ---------------------------------------------------------------

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  totals: OrderTotals;
  items: CartItem[];
  containerReference: string;
  usedCbm: number;
};

export function ReservationDialog({
  open,
  onOpenChange,
  totals,
  items,
  containerReference,
  usedCbm,
}: Props) {
  const navigate = useNavigate();
  const hasItems = items.length > 0;
  const startCheckout = useServerFn(createCheckoutSession);

  const form = useForm<ReservationFormValues>({
    resolver: zodResolver(reservationSchema),
    defaultValues: DEFAULT_VALUES,
    mode: "onBlur",
  });

  const mutation = useMutation<CreateReservationResult, Error, { contact: ReservationContact }>({
    mutationFn: async ({ contact }) => {
      return createReservation({
        containerReference,
        contact,
        items,
        totals,
        usedCbm,
      });
    },
    onSuccess: async (result, variables) => {
      if (!result.ok) {
        toast.error("Réservation impossible", { description: result.error });
        return;
      }

      const reservationId = result.reservationId;

      // Persist confirmation payload for the /reservation/$id page.
      // Done BEFORE attempting Stripe so that, regardless of outcome
      // (Stripe redirect, skipped, or error), the confirmation page
      // can always render the full recap.
      const stored: StoredConfirmation = {
        contact: variables.contact,
        items: toStoredItems(items),
        totals,
        containerReference,
        createdAt: new Date().toISOString(),
      };

      try {
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(
            `reservation_confirmation_${reservationId}`,
            JSON.stringify(stored),
          );
        }
      } catch {
        // Storage disabled — fallback page handles missing payload.
      }

      // Close the dialog and reset the form before any redirect.
      onOpenChange(false);
      form.reset(DEFAULT_VALUES);

      // Attempt to launch Stripe Checkout. Three branches:
      //   1. `skipped: false` → redirect to Stripe (success/cancel will
      //      bring the user back to /reservation/$id with query params).
      //   2. `skipped: true`  → Stripe not configured server-side → keep
      //      the legacy success UX (navigate to the confirmation page).
      //   3. Error            → reservation IS in DB but we failed to
      //      start the payment session. Show a toast and still take the
      //      user to the confirmation page so they have their reference.
      try {
        const checkout = await startCheckout({ data: { reservationId } });

        if (!checkout.skipped) {
          if (typeof window !== "undefined") {
            window.location.assign(checkout.url);
          }
          return;
        }

        // Stripe not configured → legacy path.
        toast.success("Réservation enregistrée", {
          description: `Confirmation envoyée à ${variables.contact.email}.`,
        });
        navigate({
          to: "/reservation/$id",
          params: { id: reservationId },
        });
      } catch (err) {
        // Reservation is saved; only the payment hand-off failed.
        const message = err instanceof Error ? err.message : "Erreur inconnue";
        toast.error("Paiement indisponible", {
          description: `Votre réservation #${reservationId} est bien enregistrée, mais nous n'avons pas pu lancer le paiement Stripe (${message}). Un membre Terrassea vous recontacte.`,
        });
        navigate({
          to: "/reservation/$id",
          params: { id: reservationId },
        });
      }
    },
    onError: (err) => {
      toast.error("Une erreur est survenue", {
        description: err.message || "Veuillez réessayer dans quelques instants.",
      });
    },
  });

  // If the parent closes the dialog programmatically while we are
  // pending, we cancel the mutation state visually but keep form
  // values intact (user can reopen and submit again).
  useEffect(() => {
    if (!open) {
      mutation.reset();
    }
    // We only want this on `open` changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onSubmit = form.handleSubmit((values) => {
    if (!hasItems) return;

    const contact: ReservationContact = {
      name: values.name.trim(),
      company: values.company.trim(),
      email: values.email.trim().toLowerCase(),
      phone: values.phone.trim(),
      zip: values.zip?.trim() ? values.zip.trim() : undefined,
      siret: values.siret?.trim() ? values.siret.trim() : undefined,
    };

    mutation.mutate({ contact });
  });

  const submitting = mutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto bg-[color:var(--sand-soft)] sm:max-w-2xl">
        <DialogHeader>
          <div className="label-eyebrow text-[color:var(--ember)]">Réservation</div>
          <DialogTitle className="font-display text-2xl tracking-tight">
            Vos informations
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
              <span className="text-xs text-foreground/80">Réservation (acompte différé)</span>
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

        {!hasItems ? (
          <EmptyState onClose={() => onOpenChange(false)} />
        ) : (
          <Form {...form}>
            <form className="space-y-4" onSubmit={onSubmit} noValidate>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-xs font-medium">Nom complet *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          autoComplete="name"
                          className="h-10 rounded-none border-[color:var(--sand-deep)] bg-card focus-visible:border-foreground focus-visible:ring-0"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-xs font-medium">
                        Société / établissement *
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          autoComplete="organization"
                          className="h-10 rounded-none border-[color:var(--sand-deep)] bg-card focus-visible:border-foreground focus-visible:ring-0"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-xs font-medium">Email pro *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          autoComplete="email"
                          inputMode="email"
                          className="h-10 rounded-none border-[color:var(--sand-deep)] bg-card focus-visible:border-foreground focus-visible:ring-0"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-xs font-medium">Téléphone *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="tel"
                          autoComplete="tel"
                          inputMode="tel"
                          placeholder="06 12 34 56 78"
                          className="h-10 rounded-none border-[color:var(--sand-deep)] bg-card focus-visible:border-foreground focus-visible:ring-0"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="zip"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-xs font-medium">Code postal livraison</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          autoComplete="postal-code"
                          inputMode="numeric"
                          placeholder="75001"
                          className="h-10 rounded-none border-[color:var(--sand-deep)] bg-card focus-visible:border-foreground focus-visible:ring-0"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="siret"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-xs font-medium">SIRET (optionnel)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          inputMode="numeric"
                          placeholder="14 chiffres"
                          className="h-10 rounded-none border-[color:var(--sand-deep)] bg-card focus-visible:border-foreground focus-visible:ring-0"
                        />
                      </FormControl>
                      <FormDescription className="text-[10px]">
                        Demandé plus tard pour la facturation
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="consent"
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-1.5 rounded-sm border border-[color:var(--sand-deep)] bg-card p-3">
                    <div className="flex items-start gap-3">
                      <FormControl>
                        <Checkbox
                          checked={field.value === true}
                          onCheckedChange={(checked) => field.onChange(checked === true)}
                          onBlur={field.onBlur}
                          ref={field.ref}
                          aria-label="Consentement RGPD"
                          className="mt-0.5"
                        />
                      </FormControl>
                      <FormLabel className="text-xs leading-relaxed font-normal text-foreground/85">
                        J'accepte que mes données soient utilisées pour gérer ma réservation. Voir{" "}
                        <a
                          href="/legal/confidentialite"
                          target="_blank"
                          rel="noreferrer"
                          className="underline underline-offset-2 hover:text-foreground"
                        >
                          politique de confidentialité
                        </a>
                        .
                      </FormLabel>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Reassurance (no Stripe, no 3DS) */}
              <div className="space-y-1.5 text-[11px] text-muted-foreground">
                <Reassure Icon={Lock} t="Données protégées · RGPD" />
                <Reassure Icon={Mail} t="Confirmation immédiate par email" />
                <Reassure
                  Icon={RefreshCcw}
                  t="Réservation remboursée à 100% si Container Club annule le container"
                />
                <Reassure Icon={ShieldCheck} t="Importation officielle · garantie 2 ans" />
              </div>

              <div className="space-y-2">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="h-11 w-full rounded-sm bg-foreground text-background hover:bg-foreground/90"
                >
                  {submitting ? "Enregistrement…" : "Réserver et payer ma place"}
                </Button>
                <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
                  Paiement sécurisé via Stripe ({formatEUR(totals.payNow)}) pour bloquer votre
                  place. En cas d'indisponibilité du paiement en ligne, un membre Terrassea vous
                  recontacte sous 24 h ouvrées.
                </p>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EmptyState({ onClose }: { onClose: () => void }) {
  return (
    <div className="space-y-4 py-6 text-center">
      <p className="text-sm text-foreground/80">
        Ajoutez d'abord des produits à votre commande avant de réserver.
      </p>
      <Button
        type="button"
        variant="outline"
        onClick={onClose}
        className="h-10 rounded-sm border-[color:var(--sand-deep)]"
      >
        Fermer
      </Button>
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
