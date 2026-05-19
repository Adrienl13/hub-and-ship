const FAQ = [
  {
    q: "Que se passe-t-il si le container n'atteint pas 80% de remplissage ?",
    a: "Si le seuil n'est pas atteint à la date de clôture estimée, Container Club peut prolonger la collecte de 2 semaines maximum. Si le seuil reste non atteint, le container est annulé et l'intégralité des frais (réservation + acompte) vous est remboursée sous 5 jours ouvrés.",
  },
  {
    q: "Que se passe-t-il si ma couleur n'atteint pas le MOQ de 50 ?",
    a: "Vous avez 3 options communiquées dès la clôture : 1/ migrer votre commande vers une couleur confirmée du même produit, 2/ reporter automatiquement sur le container suivant (sans frais supplémentaires), 3/ être remboursé sur cette ligne uniquement.",
  },
  {
    q: "Quand suis-je débité ? Et de combien à chaque étape ?",
    a: "Étape 1 : 3% (min 150€, max 500€) à la réservation, non-remboursables sauf annulation Container Club. Étape 2 : 27% complémentaire quand le container atteint 80% (vous êtes prévenu 48h à l'avance). Étape 3 : solde 70% avant expédition usine après contrôle qualité SGS.",
  },
  {
    q: "Qui s'occupe de la douane et de la TVA à l'import ?",
    a: "Container Club est l'importateur officiel : numéro EORI FR, déclaration douanière, TVA autoliquidée, conformité produit (CE, REACH, classement feu). Vous recevez une facture HT française avec TVA 20% en sus, parfaitement déductible.",
  },
  {
    q: "Comment se passe la livraison ? Combien ça coûte ?",
    a: "Deux options : enlèvement libre au port (Marseille-Fos ou Le Havre) gratuit, ou livraison forfaitaire par zone géographique (à partir de 89€ HT pour Île-de-France, 149€ HT pour le sud, devis transparent à la commande).",
  },
  {
    q: "Quelle garantie sur les produits ? Et le SAV ?",
    a: "Garantie commerciale 2 ans pièces et structure, par Container Club en France. SAV par email sous 48h, pièces détachées disponibles. Eco-participation Eco-mobilier incluse dans le prix (recyclage en fin de vie).",
  },
  {
    q: "Puis-je annuler ma réservation ? Sous quelles conditions ?",
    a: "Avant la clôture du container, vous pouvez retirer une ligne (frais de réservation perdus). Après le passage à 80% et l'appel d'acompte, l'engagement devient ferme — sauf défaillance Container Club, auquel cas remboursement intégral.",
  },
  {
    q: "Comment vérifiez-vous la qualité avant expédition ?",
    a: "Nous mandatons SGS, organisme de certification indépendant, pour un contrôle physique en usine avant chargement (échantillonnage AQL 2.5). Rapport photo et vidéo partagé à tous les pros engagés. Aucun container ne quitte l'usine sans validation.",
  },
];

export function FaqAccordion() {
  return (
    <section
      id="faq"
      className="border-t border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]"
    >
      <div className="mx-auto max-w-3xl px-6 py-20">
        <div className="mb-10">
          <div className="label-eyebrow text-[color:var(--ember)]">Questions fréquentes</div>
          <h2 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">
            Tout ce que vous devez savoir avant de réserver.
          </h2>
        </div>

        <div className="divide-y divide-[color:var(--sand-deep)] border-y border-[color:var(--sand-deep)]">
          {FAQ.map((item, i) => (
            <details key={i} className="group [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 py-5 text-sm transition-colors hover:text-[color:var(--ember)]">
                <span className="font-display text-base font-medium tracking-tight">{item.q}</span>
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center text-xl font-light text-foreground/60 transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="pb-5 pr-9 text-sm leading-relaxed text-[color:var(--ink-soft)]">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
