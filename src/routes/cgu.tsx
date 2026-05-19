import { createFileRoute } from "@tanstack/react-router";
import { StaticPageLayout } from "@/components/StaticPageLayout";

export const Route = createFileRoute("/cgu")({
  component: CGU,
  head: () => ({
    meta: [{ title: "CGU — Container Club" }],
  }),
});

function CGU() {
  return (
    <StaticPageLayout
      eyebrow="Conditions générales"
      title="Conditions générales d'utilisation"
      lastUpdated="—"
    >
      <p className="text-xs text-muted-foreground">
        ⚠️ Document modèle — à compléter et faire valider par un conseil juridique avant la mise en
        production.
      </p>

      <section>
        <h2 className="font-display text-xl">1. Objet</h2>
        <p className="mt-2">
          Les présentes Conditions Générales d'Utilisation (CGU) régissent l'accès et l'utilisation
          du site Container Club. Toute consultation ou utilisation du site implique l'acceptation
          pleine et entière des présentes CGU.
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl">2. Accès au service</h2>
        <p className="mt-2">
          Le site est accessible 24h/24, 7j/7, sous réserve des opérations de maintenance et des
          éventuelles défaillances techniques. Le service de réservation est exclusivement réservé
          aux professionnels détenant un numéro SIRET valide.
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl">3. Compte utilisateur</h2>
        <p className="mt-2">
          La création d'un compte requiert la fourniture d'informations professionnelles exactes
          (raison sociale, contact, téléphone, SIRET à 14 chiffres). L'utilisateur est seul
          responsable de la confidentialité de ses identifiants.
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl">4. Responsabilités</h2>
        <p className="mt-2">
          L'Éditeur ne peut être tenu responsable des dommages indirects résultant de l'utilisation
          du site (perte d'exploitation, perte de chance, etc.). L'utilisateur s'engage à ne pas
          perturber le fonctionnement du site (scraping, attaques, faux comptes).
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl">5. Modification des CGU</h2>
        <p className="mt-2">
          L'Éditeur se réserve le droit de modifier les présentes CGU à tout moment. Les
          utilisateurs sont notifiés des changements substantiels par email.
        </p>
      </section>
    </StaticPageLayout>
  );
}
