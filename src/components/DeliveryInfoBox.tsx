import { ArrowRight, Handshake, PackageCheck, Truck } from "lucide-react";

import { Reveal } from "@/components/motion-helpers";

const OPTIONS = [
  {
    Icon: PackageCheck,
    title: "Enlèvement libre au port",
    description:
      "Vous récupérez la marchandise au Havre ou à Marseille-Fos avec votre organisation habituelle.",
  },
  {
    Icon: Handshake,
    title: "Transporteur recommandé",
    description:
      "Nous fournissons une liste de transporteurs présélectionnés à contacter directement.",
  },
] as const;

export function DeliveryInfoBox() {
  return (
    <section className="border-t border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <Reveal className="grid gap-8 rounded-md border border-[color:var(--sand-deep)] bg-card p-5 shadow-paper md:grid-cols-[0.9fr_1.1fr] md:p-7">
          <div>
            <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-sm bg-[color:var(--ember-soft)] text-[color:var(--ember)]">
              <Truck className="h-5 w-5" />
            </div>
            <div className="label-eyebrow text-[color:var(--ember)]">
              Comment la livraison fonctionne
            </div>
            <h2 className="mt-2 font-display text-3xl tracking-tight">
              Notre prix s'arrête au port d'arrivée.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-[color:var(--ink-soft)]">
              Le transport final varie fortement selon votre zone, votre quai, votre
              volume et vos habitudes logistiques. Container Club ne prend pas de
              marge cachée dessus.
            </p>
          </div>

          <div className="space-y-4">
            {OPTIONS.map(({ Icon, title, description }) => (
              <div
                key={title}
                className="flex gap-3 border-b border-[color:var(--sand-deep)] pb-4 last:border-b-0 last:pb-0"
              >
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-foreground/65" />
                <div>
                  <h3 className="font-display text-base font-semibold tracking-tight">
                    {title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-[color:var(--ink-soft)]">
                    {description}
                  </p>
                </div>
              </div>
            ))}

            <a
              href="/transport-partenaires"
              className="inline-flex min-h-11 items-center gap-2 rounded-sm border border-[color:var(--foreground)] px-4 py-2 text-sm font-medium transition-colors hover:bg-[color:var(--foreground)] hover:text-[color:var(--background)]"
            >
              Voir les transporteurs recommandés
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
