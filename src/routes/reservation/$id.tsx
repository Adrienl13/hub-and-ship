import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, Copy, Check, Mail, Phone, Truck, Factory } from "lucide-react";
import { toast } from "sonner";

import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";

import { formatEUR, formatEURprecise, type OrderTotals } from "@/lib/order";
import type { ReservationContact } from "@/lib/reservations";

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

export const Route = createFileRoute("/reservation/$id")({
  component: ReservationConfirmationPage,
  head: ({ params }) => ({
    meta: [
      {
        title: `Réservation ${params.id} — Container Club`,
      },
      {
        name: "robots",
        content: "noindex,nofollow",
      },
    ],
  }),
});

function readConfirmation(id: string): StoredConfirmation | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(`reservation_confirmation_${id}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredConfirmation;
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.contact || !Array.isArray(parsed.items) || !parsed.totals) return null;
    return parsed;
  } catch {
    return null;
  }
}

function ReservationConfirmationPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [confirmation, setConfirmation] = useState<StoredConfirmation | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setConfirmation(readConfirmation(id));
    setHydrated(true);
  }, [id]);

  const handleBackToCatalog = () => {
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header onReserve={handleBackToCatalog} />

      <main className="border-t border-[color:var(--sand-deep)]">
        <div className="mx-auto max-w-4xl px-6 py-16 sm:py-20">
          {!hydrated ? (
            <LoadingState />
          ) : confirmation ? (
            <FullConfirmation id={id} confirmation={confirmation} />
          ) : (
            <FallbackConfirmation id={id} />
          )}

          <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--sand-deep)] pt-8">
            <Button
              variant="ghost"
              onClick={handleBackToCatalog}
              className="h-11 gap-2 text-foreground/80 hover:bg-[color:var(--sand-soft)]"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour au catalogue
            </Button>
            <Button
              onClick={handleBackToCatalog}
              className="h-11 rounded-sm bg-foreground px-6 text-background hover:bg-foreground/90"
            >
              Voir d'autres containers
            </Button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
      Chargement…
    </div>
  );
}

function CopyableId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      toast.error("Copie indisponible");
      return;
    }
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      toast.success("Numéro copié");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Impossible de copier");
    }
  };

  return (
    <div className="inline-flex items-center gap-2 rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] px-3 py-2 font-mono text-xs tabular-nums sm:text-sm">
      <span className="text-foreground/80">{id}</span>
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copier le numéro de réservation"
        className="flex h-6 w-6 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-[color:var(--forest)]" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}

function FullConfirmation({ id, confirmation }: { id: string; confirmation: StoredConfirmation }) {
  const { contact, items, totals, containerReference } = confirmation;
  const firstName = contact.name.trim().split(/\s+/)[0] ?? contact.name;

  return (
    <div className="space-y-12">
      {/* Header succès */}
      <div className="space-y-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--forest)]/12 text-[color:var(--forest)]">
          <CheckCircle2 className="h-7 w-7" strokeWidth={2} />
        </div>
        <div>
          <div className="label-eyebrow text-[color:var(--ember)]">Réservation enregistrée</div>
          <h1 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">
            Merci {contact.name.trim()} — votre réservation est enregistrée.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[color:var(--ink-soft)]">
            Nous avons bien reçu votre demande pour le container{" "}
            <span className="font-medium text-foreground">{containerReference}</span>. Conservez ce
            numéro précieusement, il sera votre référence pour tout échange.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-muted-foreground">Numéro de réservation :</span>
          <CopyableId id={id} />
        </div>
      </div>

      {/* Récap items */}
      <section className="space-y-5">
        <div className="flex items-baseline justify-between border-b border-[color:var(--sand-deep)] pb-3">
          <h2 className="font-display text-xl tracking-tight">Récapitulatif de votre panier</h2>
          <span className="text-xs tabular-nums text-muted-foreground">
            {items.reduce((s, i) => s + i.quantity, 0)} unités · {items.length} référence
            {items.length > 1 ? "s" : ""}
          </span>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun article enregistré.</p>
        ) : (
          <ul className="divide-y divide-[color:var(--sand-deep)]/60 overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-card">
            {items.map((item, idx) => {
              const lineTotal = item.unitPriceHt * item.quantity;
              return (
                <li
                  key={`${item.productSku}-${idx}`}
                  className="flex items-center gap-4 p-4 sm:gap-5"
                >
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-sm border border-[color:var(--sand-deep)] bg-[color:var(--sand)] sm:h-20 sm:w-20">
                    {item.mainImageUrl ? (
                      <img
                        src={item.mainImageUrl}
                        alt={item.productName}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-sm font-semibold tracking-tight sm:text-base">
                      {item.productName}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span
                        className="inline-block h-3 w-3 rounded-full border border-[color:var(--sand-deep)]"
                        style={{ backgroundColor: item.variantHex }}
                        aria-hidden="true"
                      />
                      <span>{item.variantName}</span>
                      <span>·</span>
                      <span className="font-mono text-[10px] uppercase tracking-wide">
                        {item.productSku}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-display text-sm font-semibold tabular-nums sm:text-base">
                      {formatEUR(lineTotal)}
                    </div>
                    <div className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
                      {item.quantity} × {formatEUR(item.unitPriceHt)}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Totaux */}
        <dl className="overflow-hidden rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]">
          <TotalRow label="Total HT" value={formatEUR(totals.totalHt)} />
          <TotalRow
            label="Frais de réservation (3%)"
            value={formatEURprecise(totals.reservationFee)}
            hint="À régler maintenant pour bloquer votre place"
          />
          <TotalRow
            label="Solde à régler à 80% de remplissage"
            value={formatEUR(totals.payAt80Percent)}
          />
          <TotalRow
            label="Solde avant expédition"
            value={formatEUR(totals.payBeforeShipping)}
            last
          />
        </dl>
      </section>

      {/* Prochaines étapes */}
      <section className="space-y-5">
        <div className="border-b border-[color:var(--sand-deep)] pb-3">
          <h2 className="font-display text-xl tracking-tight">Prochaines étapes</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Voici ce qui va se passer dans les prochains jours.
          </p>
        </div>

        <ol className="space-y-4">
          <StepItem
            index={1}
            icon={<Mail className="h-4 w-4" />}
            title="Email de confirmation envoyé"
            description={
              <>
                Un récapitulatif complet vient d'être envoyé à{" "}
                <span className="font-medium text-foreground">{contact.email}</span>. Vérifiez vos
                spams si vous ne le voyez pas dans les minutes qui viennent.
              </>
            }
          />
          <StepItem
            index={2}
            icon={<Phone className="h-4 w-4" />}
            title="Appel sous 24 h ouvrées"
            description={
              <>
                Un membre de l'équipe Terrassea vous recontacte au{" "}
                <span className="font-medium text-foreground">{contact.phone}</span> pour finaliser
                le paiement des frais de réservation et valider votre commande.
              </>
            }
          />
          <StepItem
            index={3}
            icon={<Factory className="h-4 w-4" />}
            title="Suivi de remplissage hebdomadaire"
            description="Chaque semaine, vous recevez par email l'avancement du container : nouveaux pros engagés, taux de remplissage, ETA estimée."
          />
          <StepItem
            index={4}
            icon={<Truck className="h-4 w-4" />}
            title="Production lancée à 80% de remplissage"
            description={`Dès que le container ${containerReference} atteint 80% de capacité, nous déclenchons la production en usine. Vous serez notifié pour le solde et la livraison.`}
            last
          />
        </ol>
      </section>

      {/* Bloc rappel */}
      <div className="rounded-md border border-[color:var(--ember)]/25 bg-[color:var(--ember)]/8 p-5 text-sm leading-relaxed text-foreground/85">
        <span className="font-medium text-foreground">Une question ?</span> Répondez simplement à
        l'email de confirmation ou contactez-nous — votre numéro de réservation{" "}
        <span className="font-mono text-xs">{id}</span> nous permettra de retrouver votre dossier
        instantanément.
      </div>
    </div>
  );
}

function FallbackConfirmation({ id }: { id: string }) {
  return (
    <div className="space-y-8">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--forest)]/12 text-[color:var(--forest)]">
        <CheckCircle2 className="h-7 w-7" strokeWidth={2} />
      </div>
      <div>
        <div className="label-eyebrow text-[color:var(--ember)]">Réservation enregistrée</div>
        <h1 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">
          Réservation #{id} enregistrée.
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[color:var(--ink-soft)]">
          Nous vous avons envoyé un email de confirmation avec le récapitulatif complet de votre
          panier et les prochaines étapes. Consultez votre boîte de réception (et vos spams) — un
          membre Terrassea vous recontactera sous 24 h ouvrées.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-muted-foreground">Numéro de réservation :</span>
        <CopyableId id={id} />
      </div>
      <div className="rounded-md border border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)] p-5 text-sm leading-relaxed text-foreground/80">
        Le détail du panier n'est plus disponible sur cet appareil (page rechargée ou lien partagé).
        Le récapitulatif complet reste consultable dans l'email de confirmation.
      </div>
    </div>
  );
}

function TotalRow({
  label,
  value,
  hint,
  last,
}: {
  label: string;
  value: string;
  hint?: string;
  last?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 px-5 py-3 ${
        last ? "" : "border-b border-[color:var(--sand-deep)]/60"
      }`}
    >
      <div>
        <dt className="text-sm text-foreground/80">{label}</dt>
        {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
      </div>
      <dd className="font-display text-base font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function StepItem({
  index,
  icon,
  title,
  description,
  last,
}: {
  index: number;
  icon: React.ReactNode;
  title: string;
  description: React.ReactNode;
  last?: boolean;
}) {
  return (
    <li className="relative flex gap-4 pl-1">
      <div className="flex flex-col items-center">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[color:var(--sand-deep)] bg-card text-[color:var(--ember)]">
          {icon}
        </span>
        {!last && <span className="mt-1 w-px flex-1 bg-[color:var(--sand-deep)]" />}
      </div>
      <div className="flex-1 pb-2">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Étape {index}
          </span>
        </div>
        <div className="mt-0.5 font-display text-base font-semibold tracking-tight">{title}</div>
        <p className="mt-1 text-sm leading-relaxed text-foreground/75">{description}</p>
      </div>
    </li>
  );
}
