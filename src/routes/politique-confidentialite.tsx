import { createFileRoute } from "@tanstack/react-router";
import { StaticPageLayout } from "@/components/StaticPageLayout";

export const Route = createFileRoute("/politique-confidentialite")({
  component: PolitiqueConfidentialite,
  head: () => ({
    meta: [{ title: "Politique de confidentialité — Container Club" }],
  }),
});

function PolitiqueConfidentialite() {
  return (
    <StaticPageLayout
      eyebrow="Données personnelles"
      title="Politique de confidentialité"
      lastUpdated="—"
    >
      <p className="text-xs text-muted-foreground">
        ⚠️ Document modèle — à compléter et faire valider par un DPO / juriste avant la mise en
        production. Pensez à enregistrer votre traitement sur le registre RGPD.
      </p>

      <section>
        <h2 className="font-display text-xl">Responsable du traitement</h2>
        <p className="mt-2">
          Le responsable du traitement des données est <strong>[Raison sociale]</strong>, [adresse],
          joignable par email à dpo@container-club.fr.
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl">Données collectées</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>À la création de compte</strong> : raison sociale, nom du contact, email,
            téléphone, SIRET, code postal de livraison.
          </li>
          <li>
            <strong>À la réservation</strong> : produits sélectionnés, quantités, montants, notes
            éventuelles, code postal de livraison.
          </li>
          <li>
            <strong>Données techniques</strong> : adresse IP, identifiants de session, statistiques
            d'usage anonymisées.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="font-display text-xl">Bases légales et finalités</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            <strong>Exécution du contrat</strong> : traitement des réservations, facturation,
            livraison.
          </li>
          <li>
            <strong>Obligation légale</strong> : conservation des factures et justificatifs (10
            ans).
          </li>
          <li>
            <strong>Intérêt légitime</strong> : prévention de la fraude, statistiques d'usage.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="font-display text-xl">Hébergement et sous-traitants</h2>
        <p className="mt-2">
          Les données sont hébergées par Supabase (PostgreSQL, région Europe eu-west-1) et
          Cloudflare (CDN/hosting front). Stripe est utilisé pour les paiements [à confirmer]. Aucun
          transfert hors UE n'est effectué sans clauses contractuelles types.
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl">Durée de conservation</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Compte actif : pendant toute la durée de la relation contractuelle.</li>
          <li>Réservations et factures : 10 ans après la dernière interaction.</li>
          <li>Logs techniques : 12 mois maximum.</li>
        </ul>
      </section>

      <section>
        <h2 className="font-display text-xl">Vos droits</h2>
        <p className="mt-2">
          Conformément au RGPD vous disposez d'un droit d'accès, de rectification, d'effacement, de
          limitation et d'opposition. Pour exercer ces droits : dpo@container-club.fr. En cas de
          litige vous pouvez saisir la CNIL.
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl">Cookies</h2>
        <p className="mt-2">
          Le site utilise exclusivement des cookies fonctionnels nécessaires à la session de
          connexion. Aucun cookie tiers de tracking n'est déposé sans consentement.
        </p>
      </section>
    </StaticPageLayout>
  );
}
