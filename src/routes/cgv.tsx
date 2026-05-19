import { createFileRoute } from "@tanstack/react-router";
import { StaticPageLayout } from "@/components/StaticPageLayout";

export const Route = createFileRoute("/cgv")({
  component: CGV,
  head: () => ({
    meta: [{ title: "CGV — Container Club" }],
  }),
});

function CGV() {
  return (
    <StaticPageLayout
      eyebrow="Conditions générales"
      title="Conditions générales de vente"
      lastUpdated="—"
    >
      <p className="text-xs text-muted-foreground">
        ⚠️ Document modèle — à compléter et faire valider par un conseil juridique avant la mise en
        production. Container Club s'adresse à des clients professionnels (BtoB) ; un régime CGV
        spécifique s'applique.
      </p>

      <section>
        <h2 className="font-display text-xl">1. Champ d'application</h2>
        <p className="mt-2">
          Les présentes Conditions Générales de Vente (CGV) régissent les relations contractuelles
          entre Container Club (l'« Éditeur ») et tout professionnel (le « Client ») effectuant une
          réservation sur le site container-club.fr. La validation d'une réservation emporte
          adhésion sans réserve aux présentes CGV.
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl">2. Mécanique de pré-commande groupée</h2>
        <p className="mt-2">
          Container Club organise des pré-commandes groupées par container maritime. Chaque
          container est ouvert pendant une période définie, à l'issue de laquelle le départ est
          confirmé sous réserve d'avoir atteint le seuil minimum de remplissage (par défaut 80 % du
          volume CBM et un nombre minimum de séries déclenchées par variante).
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl">3. Réservation et paiement</h2>
        <p className="mt-2">
          La réservation s'effectue par l'engagement d'une quantité par référence et variante, suivi
          du paiement des frais de réservation (3 % du sous-total HT, planchers/plafonds appliqués).
          Ces frais sont non-remboursables sauf cas d'annulation du container par l'Éditeur.
        </p>
        <p className="mt-2">Le solde est exigible en deux temps :</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            Acompte de 30 % du sous-total HT (moins les frais déjà payés) dû lorsque le container
            atteint 80 % de remplissage.
          </li>
          <li>Solde de 70 % avant expédition depuis le port d'origine.</li>
        </ul>
      </section>

      <section>
        <h2 className="font-display text-xl">4. Livraison et délais</h2>
        <p className="mt-2">
          Les délais annoncés sont des estimations basées sur les transit times maritimes et la
          chaîne logistique. Aucune pénalité ne peut être réclamée en cas de retard non imputable à
          l'Éditeur (aléas douaniers, intempéries, conflits portuaires).
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl">5. Garantie et SAV</h2>
        <p className="mt-2">
          Les produits sont garantis 2 ans (garantie contractuelle). Container Club assure un
          contrôle qualité SGS au port d'origine avant expédition. Toute réserve à la livraison doit
          être consignée sur le bon de livraison sous 48h.
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl">6. Droit de rétractation</h2>
        <p className="mt-2">
          Les présentes CGV s'appliquent à des relations BtoB. Conformément à l'article L.221-3 du
          Code de la consommation, le droit de rétractation des consommateurs ne s'applique pas,
          sauf pour les professionnels employant moins de 5 salariés et ayant un objet social hors
          du champ de l'activité (à étudier au cas par cas).
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl">7. Loi applicable</h2>
        <p className="mt-2">
          Les présentes CGV sont régies par le droit français. Tout litige est soumis aux tribunaux
          compétents du ressort du siège de l'Éditeur, sauf accord amiable préalable.
        </p>
      </section>
    </StaticPageLayout>
  );
}
