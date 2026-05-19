import { RevealStagger, RevealItem, Reveal } from "@/components/motion-helpers";

const STEPS = [
  {
    n: "01",
    title: "Réservation",
    desc: "Vous engagez votre commande avec 3% de frais (min 150€, max 500€). Non-remboursables sauf si Container Club annule.",
  },
  {
    n: "02",
    title: "Container à 80%",
    desc: "Quand le seuil de remplissage et le minimum de séries sont atteints, la production est lancée et l'acompte 27% complémentaire est appelé.",
  },
  {
    n: "03",
    title: "Production usine",
    desc: "45 jours de production en Asie, contrôle qualité SGS indépendant avant chargement.",
  },
  {
    n: "04",
    title: "Expédition + douane",
    desc: "30 jours de transit maritime + dédouanement géré par Terrassea SAS, votre importateur officiel.",
  },
  {
    n: "05",
    title: "Livraison au port",
    desc: "Enlèvement libre au port (Marseille ou Le Havre) ou livraison forfaitaire par zone géographique.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="comment"
      className="border-t border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]"
    >
      <div className="mx-auto max-w-7xl px-6 py-20">
        <Reveal className="mb-12 max-w-2xl">
          <div className="label-eyebrow text-[color:var(--ember)]">Le processus</div>
          <h2 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">
            Comment se déroule une commande container.
          </h2>
        </Reveal>

        {/* Timeline horizontale desktop, verticale mobile */}
        <RevealStagger className="grid grid-cols-1 gap-px bg-[color:var(--sand-deep)] md:grid-cols-5">
          {STEPS.map((s) => (
            <RevealItem key={s.n} className="bg-[color:var(--sand-soft)] p-5">
              <div className="font-display text-xs font-semibold tracking-widest text-[color:var(--ember)]">
                {s.n}
              </div>
              <h3 className="mt-3 font-display text-base font-semibold tracking-tight">
                {s.title}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-[color:var(--ink-soft)]">{s.desc}</p>
            </RevealItem>
          ))}
        </RevealStagger>

        <div className="mt-6 text-xs">
          <a href="#faq" className="text-[color:var(--ember)] underline-offset-4 hover:underline">
            Politique de remboursement complète →
          </a>
        </div>
      </div>
    </section>
  );
}
