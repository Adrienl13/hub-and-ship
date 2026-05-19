import { createFileRoute } from "@tanstack/react-router";
import { StaticPageLayout } from "@/components/StaticPageLayout";

export const Route = createFileRoute("/mentions-legales")({
  component: MentionsLegales,
  head: () => ({
    meta: [{ title: "Mentions légales — Container Club" }],
  }),
});

function MentionsLegales() {
  return (
    <StaticPageLayout eyebrow="Informations légales" title="Mentions légales" lastUpdated="—">
      <section>
        <h2 className="font-display text-xl">Éditeur du site</h2>
        <p className="mt-2">
          Le site Container Club est édité par <strong>[Raison sociale]</strong>, société [forme
          juridique] au capital de [montant] €, immatriculée au RCS de [ville] sous le numéro
          [SIREN].
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-foreground/80">
          <li>Siège social : [adresse complète]</li>
          <li>Numéro TVA intracommunautaire : [FRxx xxxxxxxxx]</li>
          <li>Téléphone : [+33 x xx xx xx xx]</li>
          <li>Email : contact@container-club.fr</li>
          <li>Directeur de la publication : [Nom Prénom]</li>
        </ul>
      </section>

      <section>
        <h2 className="font-display text-xl">Hébergement</h2>
        <p className="mt-2">
          Le site est hébergé par Cloudflare, Inc. — 101 Townsend St, San Francisco, CA 94107,
          États-Unis.
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl">Propriété intellectuelle</h2>
        <p className="mt-2">
          L'ensemble des contenus du site (textes, images, code, marques) est protégé par le droit
          d'auteur et la propriété intellectuelle. Toute reproduction sans autorisation expresse est
          interdite.
        </p>
      </section>

      <section>
        <h2 className="font-display text-xl">Médiateur de la consommation</h2>
        <p className="mt-2">
          Conformément à l'article L.612-1 du Code de la consommation, Container Club adhère à un
          service de médiation de la consommation. [Nom et coordonnées du médiateur à compléter.]
        </p>
      </section>

      <p className="text-xs text-muted-foreground">
        ⚠️ Document modèle — à compléter et faire valider par un conseil juridique avant la mise en
        production.
      </p>
    </StaticPageLayout>
  );
}
