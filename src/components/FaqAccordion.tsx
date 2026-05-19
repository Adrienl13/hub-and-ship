import { useState } from "react";

type FaqItem = { q: string; a: string };
type FaqCategory = { id: string; label: string; description: string; items: FaqItem[] };

const FAQ_CATEGORIES: FaqCategory[] = [
  {
    id: "commande",
    label: "Commande & MOQ",
    description: "Comment se déclenche un container, les seuils et les engagements.",
    items: [
      {
        q: "Que se passe-t-il si le container n'atteint pas 80% de remplissage ?",
        a: "Si le seuil n'est pas atteint à la date de clôture estimée, Container Club peut prolonger la collecte de 2 semaines maximum. Si le seuil reste non atteint, le container est annulé et l'intégralité des frais (réservation + acompte) vous est remboursée sous 5 jours ouvrés.",
      },
      {
        q: "Que se passe-t-il si ma couleur n'atteint pas le MOQ de 50 ?",
        a: "Vous avez 3 options communiquées dès la clôture : 1/ migrer votre commande vers une couleur confirmée du même produit, 2/ reporter automatiquement sur le container suivant (sans frais supplémentaires), 3/ être remboursé sur cette ligne uniquement. Vous disposez de 5 jours ouvrés pour choisir.",
      },
      {
        q: "Puis-je modifier ma commande après réservation ?",
        a: "Oui, tant que le container n'a pas atteint 80% de remplissage. Vous pouvez augmenter une quantité, changer de variante de couleur, retirer une ligne. Une fois le seuil franchi et l'acompte appelé, la commande devient ferme — sauf défaillance Container Club.",
      },
      {
        q: "Qui peut réserver ? Particuliers acceptés ?",
        a: "Container Club est strictement réservé aux professionnels (hôtels, restaurants, campings, brasseries, parcs, collectivités, paysagistes pros). Un SIRET valide est exigé avant le passage à l'acompte 27%. Pas de vente aux particuliers — c'est un club B2B.",
      },
    ],
  },
  {
    id: "paiement",
    label: "Paiement & sécurité",
    description: "Échéancier, sécurité de la carte, remboursement.",
    items: [
      {
        q: "Quand suis-je débité ? Et de combien à chaque étape ?",
        a: "Étape 1 : 3% (min 150€, max 500€) à la réservation, non-remboursables sauf annulation Container Club. Étape 2 : 27% complémentaire quand le container atteint 80% (vous êtes prévenu 48h à l'avance par email + SMS). Étape 3 : solde 70% avant expédition usine après contrôle qualité SGS. Total = 100% du HT, TVA appliquée à la facturation finale.",
      },
      {
        q: "Comment est sécurisé mon paiement ?",
        a: "Paiement Stripe avec 3D Secure systématique. Container Club ne stocke jamais le numéro de carte (PAN), seul un token Stripe est conservé pour le rappel de l'acompte et du solde. Conformité PCI-DSS niveau 1 via Stripe. Aucune carte stockée chez nous, jamais.",
      },
      {
        q: "Puis-je payer par virement plutôt que par carte ?",
        a: "Pour la réservation initiale (3%), uniquement par carte (sécurisation immédiate). Pour l'acompte 27% et le solde 70%, virement SEPA accepté sur demande à hello@terrassea.fr. Délai de traitement : 1-2 jours ouvrés.",
      },
      {
        q: "La TVA est-elle incluse ?",
        a: "Tous les prix affichés sont HT (B2B). La TVA 20% française est appliquée à la facturation finale. Container Club étant l'importateur officiel (EORI FR), la TVA est autoliquidée à l'import et entièrement déductible pour votre entreprise.",
      },
    ],
  },
  {
    id: "qualite",
    label: "Qualité & garantie",
    description: "Contrôle qualité, normes, garantie commerciale.",
    items: [
      {
        q: "Comment vérifiez-vous la qualité avant expédition ?",
        a: "Nous mandatons SGS, organisme de certification indépendant, pour un contrôle physique en usine avant chargement (échantillonnage AQL 2.5, équivalent ISO 2859-1). Rapport photo et vidéo partagé à tous les pros engagés. Aucun container ne quitte l'usine sans validation. Coût intégré dans nos prix.",
      },
      {
        q: "Quelle garantie sur les produits ? Et le SAV ?",
        a: "Garantie commerciale 2 ans pièces et structure, par Container Club en France. SAV par email sous 48h ouvrées, pièces détachées disponibles 5 ans. Eco-participation Eco-mobilier incluse dans le prix (recyclage en fin de vie). En cas de défaut majeur, échange ou remboursement intégral à notre charge.",
      },
      {
        q: "Vos produits sont-ils conformes aux normes françaises et européennes ?",
        a: "Oui. Tous nos produits sont certifiés CE (sécurité), REACH (substances), classement feu M1 ou M2 (selon référence) pour usage en ERP, et conformité ergonomique EN 16139 pour les assises commerciales. Documentation technique disponible sur demande pour vos commissions de sécurité.",
      },
      {
        q: "Que se passe-t-il si un article arrive endommagé ?",
        a: "Vous disposez de 7 jours après livraison pour signaler tout défaut visible (photos par email). Échange à nos frais sur le container suivant, ou avoir si plus de stock. Pour les défauts non-visibles (rupture, casse à l'usage), la garantie 2 ans couvre — déclaration via votre espace client.",
      },
    ],
  },
  {
    id: "livraison",
    label: "Livraison & douane",
    description: "Délais, transport, frais, importation officielle.",
    items: [
      {
        q: "Combien de temps entre la clôture et la livraison ?",
        a: "75 jours en moyenne : 30 jours de production usine + 25 jours de transit maritime + 10 jours de dédouanement et livraison. Notre objectif est de livrer pile à date annoncée, avec un taux de ponctualité de 67% sur les 3 derniers containers. Les retards (rares) sont communiqués sous 24h.",
      },
      {
        q: "Comment se passe la livraison ? Combien ça coûte ?",
        a: "Deux options : enlèvement libre au port (Marseille-Fos ou Le Havre) gratuit, ou livraison forfaitaire par zone géographique. Tarifs indicatifs : 89€ HT Île-de-France, 129€ HT Grand Ouest, 149€ HT Sud / PACA, 179€ HT Corse et îles. Devis transparent calculé à la commande, hayon inclus.",
      },
      {
        q: "Qui s'occupe de la douane et de la TVA à l'import ?",
        a: "Container Club (Terrassea SAS) est l'importateur officiel : numéro EORI FR, déclaration douanière, TVA autoliquidée, conformité produit (CE, REACH, classement feu). Vous recevez une facture HT française avec TVA 20% en sus, parfaitement déductible. Aucune démarche douanière ni administrative à votre charge.",
      },
      {
        q: "Puis-je grouper la réception avec un autre pro de ma région ?",
        a: "Oui — vous pouvez désigner un point de livraison commun à plusieurs pros et coordonner la répartition entre vous. Un seul bon de livraison sera émis. Idéal pour les regroupements hôteliers ou les chaînes. Contactez-nous en amont à hello@terrassea.fr pour configurer.",
      },
    ],
  },
  {
    id: "sav",
    label: "SAV, retours & annulations",
    description: "Vos droits après commande, annulation, médiation.",
    items: [
      {
        q: "Puis-je annuler ma réservation ? Sous quelles conditions ?",
        a: "Avant la clôture du container, vous pouvez retirer une ligne (frais de réservation perdus). Après le passage à 80% et l'appel d'acompte, l'engagement devient ferme — sauf défaillance Container Club, auquel cas remboursement intégral. Pour les commandes B2B, le délai de rétractation 14j ne s'applique pas (article L221-3 du Code de la consommation).",
      },
      {
        q: "Qui contacter en cas de problème ?",
        a: "Votre espace client (à venir) ou par email à sav@terrassea.fr. Réponse sous 48h ouvrées. Pour un litige non résolu, vous pouvez saisir le médiateur de la consommation FEVAD (ou le médiateur compétent de votre secteur) — coordonnées dans nos CGV.",
      },
      {
        q: "Que se passe-t-il si Container Club fait faillite ?",
        a: "Vos paiements transitent par Stripe (acompte) et notre compte séquestre (solde si applicable), avec garantie financière conforme à l'article L211-18 du Code du tourisme appliqué par analogie au commerce groupé. En cas de défaillance, remboursement intégral sous 30 jours via notre garant.",
      },
    ],
  },
  {
    id: "confidentialite",
    label: "Confidentialité & données",
    description: "RGPD, données collectées, vos droits.",
    items: [
      {
        q: "Quelles données personnelles collectez-vous ?",
        a: "À la réservation : nom complet, société, email pro, téléphone, code postal, SIRET (optionnel jusqu'à l'acompte). Pour le paiement : Stripe collecte les données carte selon ses propres CGU. Aucune donnée personnelle sensible (santé, biométrie) collectée. Détails dans notre politique de confidentialité.",
      },
      {
        q: "Mes données sont-elles partagées avec des tiers ?",
        a: "Uniquement avec les sous-traitants nécessaires à l'exécution de votre commande : Stripe (paiement), SGS (contrôle qualité — données limitées au container), transporteur (livraison — nom et adresse uniquement). Pas de revente, pas de mailing tiers, pas de publicité externe. Liste complète des sous-traitants dans notre politique de confidentialité.",
      },
      {
        q: "Combien de temps gardez-vous mes données ?",
        a: "Données client actives : durée de la relation commerciale + 3 ans (prospection). Données comptables et factures : 10 ans (obligation légale). Données paiement Stripe : conformément à leurs propres règles. Vous pouvez demander l'effacement à tout moment après la fin de la relation, sauf obligation légale de conservation.",
      },
      {
        q: "Comment exercer mes droits RGPD ?",
        a: "Email à privacy@terrassea.fr avec une pièce d'identité pour vérification. Vos droits : accès, rectification, effacement, portabilité, limitation, opposition. Réponse sous 30 jours. Vous pouvez aussi saisir la CNIL (www.cnil.fr) à tout moment si vous estimez vos droits non respectés.",
      },
    ],
  },
];

export function FaqAccordion() {
  const [activeCategory, setActiveCategory] = useState<string>(FAQ_CATEGORIES[0].id);
  const current = FAQ_CATEGORIES.find((c) => c.id === activeCategory) ?? FAQ_CATEGORIES[0];

  return (
    <section id="faq" className="border-t border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]">
      <div className="mx-auto max-w-5xl px-6 py-20">
        <div className="mb-10">
          <div className="label-eyebrow text-[color:var(--ember)]">Questions fréquentes</div>
          <h2 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">
            Tout ce que vous devez savoir avant de réserver.
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-[color:var(--ink-soft)]">
            Six thèmes, plus de 20 questions concrètes. Si la réponse n'est pas ici, écrivez-nous à{" "}
            <a
              href="mailto:hello@terrassea.fr"
              className="font-medium text-foreground underline-offset-2 hover:underline"
            >
              hello@terrassea.fr
            </a>
            {" "}— on répond sous 24h.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-12">
          {/* Sidebar catégories */}
          <aside className="lg:col-span-4">
            <nav className="sticky top-20 space-y-1">
              {FAQ_CATEGORIES.map((cat) => {
                const active = cat.id === activeCategory;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategory(cat.id)}
                    className={`flex w-full flex-col items-start gap-0.5 rounded-sm px-4 py-3 text-left transition-colors ${
                      active
                        ? "bg-foreground text-background"
                        : "border border-transparent text-foreground/75 hover:border-[color:var(--sand-deep)] hover:bg-card hover:text-foreground"
                    }`}
                  >
                    <span className="text-sm font-medium">{cat.label}</span>
                    <span
                      className={`text-[11px] leading-tight ${
                        active ? "text-background/65" : "text-muted-foreground"
                      }`}
                    >
                      {cat.description}
                    </span>
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Questions */}
          <div className="lg:col-span-8">
            <div className="divide-y divide-[color:var(--sand-deep)] border-y border-[color:var(--sand-deep)]">
              {current.items.map((item, i) => (
                <details
                  key={`${current.id}-${i}`}
                  className="group [&_summary::-webkit-details-marker]:hidden"
                >
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4 py-5 text-sm transition-colors hover:text-[color:var(--ember)]">
                    <span className="font-display text-base font-medium tracking-tight">
                      {item.q}
                    </span>
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
        </div>
      </div>
    </section>
  );
}
