import type { ReactNode } from 'react'

interface FaqItem {
  readonly q: string
  readonly category: string
  readonly a: ReactNode
}

const FAQ: ReadonlyArray<FaqItem> = [
  // ---- Sécurité financière ---------------------------------------
  {
    category: 'Sécurité',
    q: 'Que se passe-t-il si le container n’atteint pas 80 % de remplissage à la clôture ?',
    a: (
      <>
        <p>
          Container Club ne lance jamais un container à moitié vide. Si à la
          date de clôture estimée le seuil de 80 % de remplissage n’est pas
          atteint, deux scénarios sont possibles :
        </p>
        <ul>
          <li>
            <strong>Prolongation transparente.</strong> Nous prolongeons la
            collecte de 2 semaines maximum, en vous expliquant exactement
            combien de m³ manquent et combien de pros sont engagés. Vous
            recevez un email + une notification dans votre espace pro.
          </li>
          <li>
            <strong>Remboursement intégral si le seuil reste non atteint.</strong>{' '}
            Les frais de réservation <em>et</em> l’éventuel acompte vous sont
            remboursés sur la carte d’origine sous <strong>5 jours ouvrés</strong>{' '}
            (via Stripe). Aucun frais retenu, aucune pénalité — c’est notre
            risque, pas le vôtre.
          </li>
        </ul>
        <p>
          Vous gardez la possibilité de retirer votre commande à tout moment
          avant clôture sans aucune justification.
        </p>
      </>
    ),
  },
  {
    category: 'Sécurité',
    q: 'Que se passe-t-il si mon design spécifique n’atteint pas le MOQ de 50 unités ?',
    a: (
      <>
        <p>
          Le MOQ (Minimum Order Quantity) est fixé par l’usine pour lancer
          une série dédiée d’un design précis. Si à la clôture votre design
          n’a pas atteint 50 unités cumulées sur l’ensemble des pros, vous
          recevez un email automatique avec <strong>trois options à choisir
          en 48 h</strong> :
        </p>
        <ol>
          <li>
            <strong>Migrer vers un design confirmé du même produit</strong> —
            même prix, même fournisseur, même container. Aucun coût
            supplémentaire.
          </li>
          <li>
            <strong>Reporter automatiquement sur le container suivant</strong>{' '}
            (sans frais, sans nouvelle réservation). Votre acompte est
            conservé tel quel sur la nouvelle commande.
          </li>
          <li>
            <strong>Remboursement uniquement sur cette ligne</strong>. Le
            reste de votre commande continue normalement.
          </li>
        </ol>
        <p>
          En 18 mois d’opération, <strong>92 %</strong> des MOQ ont été
          atteints sur le premier essai et 100 % avec un report sur le
          container suivant.
        </p>
      </>
    ),
  },
  {
    category: 'Sécurité',
    q: 'Puis-je annuler ma réservation ? Sous quelles conditions ?',
    a: (
      <>
        <p>
          L’annulation reste libre jusqu’à un point précis du process —
          au-delà, votre place est garantie à l’usine, donc l’engagement
          devient ferme.
        </p>
        <ul>
          <li>
            <strong>Avant clôture du container (= avant 80 %).</strong> Vous
            retirez une ligne ou la totalité depuis votre espace pro en
            un clic. Seul le frais de réservation initial (3 %, min 150 €)
            est conservé — c’est ce qui finance la collecte et la
            sécurisation de votre place.
          </li>
          <li>
            <strong>Après passage à 80 % et appel d’acompte.</strong> Votre
            place est désormais réservée à l’usine, l’engagement devient
            ferme. Une annulation à ce stade n’est possible qu’en cas de
            défaillance Container Club, auquel cas le remboursement est
            intégral (frais de réservation + acompte + tout autre versement).
          </li>
        </ul>
        <p>
          Pour toute situation particulière (faillite, force majeure,
          changement de projet), écrivez-nous à{' '}
          <strong>adrienlaniez1@gmail.com</strong> — on étudie au cas par cas.
        </p>
      </>
    ),
  },

  // ---- Paiement --------------------------------------------------
  {
    category: 'Paiement',
    q: 'Quand suis-je débité, et combien à chaque étape ?',
    a: (
      <>
        <p>
          L’échéancier est conçu pour étaler la trésorerie et n’engager des
          fonds qu’à mesure que le projet se confirme — pas de paiement
          d’avance complet, jamais.
        </p>
        <ul>
          <li>
            <strong>Étape 1 — Réservation (3 %, min 150 €, max 500 €).</strong>{' '}
            Débit immédiat sur Stripe Checkout (CB / Visa / Mastercard / Amex,
            3D-Secure). Sécurise votre place + finance la collecte.{' '}
            <em>
              Non remboursable sauf annulation Container Club ou non-atteinte
              du seuil 80 %.
            </em>
          </li>
          <li>
            <strong>Étape 2 — Acompte (27 %) au passage 80 %.</strong> Nous
            vous prévenons par email <strong>48 h à l’avance</strong> avec un
            lien de paiement Stripe. Vous validez en 1 clic. C’est cet
            acompte qui déclenche le lancement de la production usine.
          </li>
          <li>
            <strong>Étape 3 — Solde (70 %) avant expédition.</strong>{' '}
            Déclenché après le rapport SGS validé (contrôle qualité). Vous
            recevez le rapport photo+vidéo en amont, vous validez le solde
            par Stripe puis le container quitte l’usine sous 7 jours.
          </li>
        </ul>
        <p>
          Tous les paiements passent par Stripe (PCI DSS niveau 1, aucune
          donnée carte stockée chez nous). Une facture HT française avec
          TVA 20 % autoliquidée est émise à chaque étape.
        </p>
      </>
    ),
  },
  {
    category: 'Paiement',
    q: 'Pourquoi les prix sont-ils 30 à 50 % moins chers que le marché ?',
    a: (
      <>
        <p>
          C’est la vraie raison d’être de Container Club. Trois leviers
          additionnés expliquent l’écart :
        </p>
        <ul>
          <li>
            <strong>Achat direct usine sans intermédiaire.</strong> Nous
            travaillons en direct avec 4 fabricants sélectionnés en Asie du
            Sud-Est (audit terrain, certifs BSCI/SA8000). Pas de grossiste,
            pas d’importateur revendeur, pas de marketplace — chaque
            intermédiaire ajoute en moyenne 15-20 % au prix final.
          </li>
          <li>
            <strong>Mutualisation du transport.</strong> Un container 20’ HC
            coûte ~3 200 € de transport door-to-port. Réparti sur 25-32 m³
            de mobilier (au lieu de 5-10 m³ pour un pro seul), ça divise le
            coût rendu au m³ par 3 à 5.
          </li>
          <li>
            <strong>Marge Container Club volontairement basse.</strong> Notre
            modèle économique repose sur le volume (plusieurs containers par
            mois), pas sur la marge unitaire. Nous publions un taux de marge
            cible de <strong>8-12 % brut</strong> — comparable à celui d’un
            commissionnaire, pas d’un grossiste classique.
          </li>
        </ul>
        <p>
          Le mobilier livré est strictement le même que celui que vous
          trouveriez chez un grossiste à 2× le prix : mêmes usines, mêmes
          références, mêmes certifications (CE, REACH, classement feu M1/M2).
        </p>
      </>
    ),
  },

  // ---- Douane & légalité -----------------------------------------
  {
    category: 'Légal',
    q: 'Qui s’occupe de la douane, de la TVA et de la conformité produit ?',
    a: (
      <>
        <p>
          Container Club est l’<strong>importateur officiel</strong> — c’est
          nous qui assumons tout le risque douanier et la responsabilité
          produit. Vous achetez du mobilier français HT, point.
        </p>
        <ul>
          <li>
            <strong>Pros Import EURL</strong> — RCS Paris 988 269 981, SIRET
            988 269 981 00011, TVA intracommunautaire FR08 988269981.
          </li>
          <li>
            <strong>Numéro EORI FR</strong> communiqué à la douane française
            pour chaque conteneur. Déclaration douanière déposée par notre
            commissionnaire agréé à l’arrivée au Havre ou Marseille-Fos.
          </li>
          <li>
            <strong>TVA à l’import autoliquidée</strong> — pas d’avance de
            trésorerie pour vous. La TVA 20 % apparaît sur votre facture et
            est immédiatement déductible si vous êtes assujetti.
          </li>
          <li>
            <strong>Conformité produit garantie</strong> : marquage CE,
            règlement REACH (substances chimiques), classement feu M1 ou M2
            selon le produit, certificats déclaration de conformité fournis.
            Eco-mobilier (Ecologic) inclus dans le prix.
          </li>
        </ul>
        <p>
          Vous recevez une <strong>facture française HT en bonne et due forme</strong>{' '}
          avec mentions légales obligatoires, déductible et opposable à votre
          comptable. Aucune obligation d’avoir vous-même un numéro EORI ou
          un compte douane.
        </p>
      </>
    ),
  },

  // ---- Logistique ------------------------------------------------
  {
    category: 'Logistique',
    q: 'Combien de temps entre ma réservation et la livraison ?',
    a: (
      <>
        <p>
          Le délai standard est de <strong>75 à 90 jours</strong> entre le
          passage à 80 % du container et la livraison à votre porte. Voici
          la décomposition :
        </p>
        <ul>
          <li>
            <strong>J0–J7</strong> : appel d’acompte 27 %, lancement
            production usine, ordre d’achat signé.
          </li>
          <li>
            <strong>J7–J45</strong> : production en usine. Vous recevez 2
            comptes-rendus photo du chantier de production (mi-parcours et
            fin).
          </li>
          <li>
            <strong>J45–J50</strong> : contrôle qualité SGS en sortie d’usine
            (échantillonnage AQL 2.5, photos + vidéo). Rapport partagé.
          </li>
          <li>
            <strong>J50–J55</strong> : appel du solde 70 %, chargement
            container, départ port asiatique.
          </li>
          <li>
            <strong>J55–J85</strong> : transit maritime (~30 jours selon
            route) + douane française + acheminement au port d’arrivée.
          </li>
          <li>
            <strong>J85–J90</strong> : retrait au port ou livraison
            transporteur (selon votre choix).
          </li>
        </ul>
        <p>
          Sur les 6 derniers containers livrés, <strong>5 sont arrivés à
          l’heure</strong> ou en avance, 1 a eu 7 jours de retard
          (communiqué en transparence + geste commercial sur le transport).
          Vous consultez l’avancement de votre commande en temps réel dans
          votre espace pro.
        </p>
      </>
    ),
  },
  {
    category: 'Logistique',
    q: 'Comment se passe la livraison ? Quel coût de transport ?',
    a: (
      <>
        <p>
          Vous choisissez votre mode de retrait au moment de la commande —
          trois options, du moins cher au plus simple :
        </p>
        <ul>
          <li>
            <strong>Retrait au port (gratuit)</strong>. Vous venez chercher
            votre lot au port d’arrivée (Marseille-Fos ou Le Havre) sur
            créneau planifié. Idéal si vous avez votre propre camion ou un
            transporteur sous contrat.
          </li>
          <li>
            <strong>Transporteur recommandé</strong>. Nous vous mettons en
            relation avec un de nos 4 transporteurs partenaires, qui
            facturent en direct selon votre adresse. Tarifs indicatifs :
            150-350 € par palette en France métropolitaine, devis ferme
            sous 24 h.
          </li>
          <li>
            <strong>Votre propre transporteur</strong>. Vous communiquez ses
            coordonnées, nous coordonnons le chargement avec lui au port.
          </li>
        </ul>
        <p>
          Le prix affiché sur le catalogue est <strong>« rendu port »</strong>{' '}
          — il inclut achat, transport maritime, douane, TVA autoliquidée et
          mise à disposition au port. Le post-port (port → chez vous) est
          payé directement par le client à un transporteur, ce qui évite une
          double facturation et garde le tarif transparent.
        </p>
      </>
    ),
  },

  // ---- Produit / fournisseurs ------------------------------------
  {
    category: 'Fournisseurs',
    q: 'Qui sont vos fournisseurs ? Comment les avez-vous sélectionnés ?',
    a: (
      <>
        <p>
          Nous travaillons en direct avec <strong>4 fabricants spécialisés
          dans le mobilier outdoor CHR</strong> (cafés-hôtels-restaurants) :
          3 en Chine (Foshan, Guangzhou), 1 au Vietnam (Ho Chi Minh). Chacun
          a été sélectionné après un audit terrain sur place et un cycle de
          commandes test.
        </p>
        <ul>
          <li>
            <strong>Audit social & qualité.</strong> Tous nos fournisseurs
            sont audités BSCI ou SA8000 (conditions de travail), et leurs
            usines sont certifiées ISO 9001 (qualité). Nous refusons
            systématiquement les sous-traitances non déclarées.
          </li>
          <li>
            <strong>Spécialisation outdoor.</strong> Chacun produit
            exclusivement du mobilier conçu pour usage extérieur intensif —
            résistance UV 5 ans minimum, anti-corrosion marine, normes
            CHR/ERP. Pas de fournisseur généraliste, pas de revente
            indirecte.
          </li>
          <li>
            <strong>Relation directe.</strong> Aucun trading company entre
            eux et nous. Adrien (fondateur) se déplace sur place 2 fois par
            an pour visiter les chaînes de production.
          </li>
        </ul>
        <p>
          Sur demande, nous communiquons le nom et la fiche d’audit de
          l’usine de production de chaque référence — c’est rare dans
          l’industrie, c’est notre engagement de transparence.
        </p>
      </>
    ),
  },

  // ---- Qualité ---------------------------------------------------
  {
    category: 'Qualité',
    q: 'Comment vérifiez-vous la qualité avant expédition ?',
    a: (
      <>
        <p>
          Nous mandatons <strong>SGS</strong> (Société Générale de
          Surveillance), organisme de certification indépendant mondial,
          pour un contrôle qualité en usine <em>avant chargement du
          container</em>. C’est non négociable et systématique.
        </p>
        <ul>
          <li>
            <strong>Échantillonnage AQL 2.5</strong> (norme ISO 2859-1) sur
            la totalité du lot. Sur un container de 300 articles, cela
            représente 32 pièces inspectées en détail.
          </li>
          <li>
            <strong>Critères contrôlés</strong> : dimensions, couleur,
            finition, soudure, tressage, qualité du tissu, classement feu,
            étiquetage CE. Tout est rejeté à la moindre dérive (taux de
            réjection accepté : 1 défaut majeur, 4 défauts mineurs max).
          </li>
          <li>
            <strong>Rapport SGS livré sous 48 h</strong> à tous les pros
            engagés : photos haute résolution, vidéo de l’ouverture des
            cartons, fiche de mesure. Vous décidez de débloquer le paiement
            du solde après lecture.
          </li>
          <li>
            <strong>Aucun container ne quitte l’usine sans validation SGS</strong>.
            Si la production échoue le contrôle, nous obtenons une refonte
            sans coût supplémentaire ou un remboursement intégral.
          </li>
        </ul>
        <p>
          Vous pouvez consulter les rapports SGS des containers déjà livrés
          dans la section <strong>Containers livrés</strong> du site —
          aucune intervention, juste les pièces brutes telles que SGS les
          rend.
        </p>
      </>
    ),
  },
  {
    category: 'Qualité',
    q: 'Que se passe-t-il si un produit arrive défectueux ou non conforme ?',
    a: (
      <>
        <p>
          Malgré le contrôle SGS, un défaut peut toujours survenir au
          transport ou en manipulation post-port. Le process est
          standardisé :
        </p>
        <ul>
          <li>
            <strong>Vous avez 14 jours après livraison</strong> pour
            constater et déclarer tout défaut. Photo + description envoyées
            à <strong>sav@prosimport.com</strong>, traitement sous 48 h
            ouvrées.
          </li>
          <li>
            <strong>Selon la nature du défaut</strong> : remplacement par la
            pièce de rechange (stockée à Marseille-Fos pour les principales
            références), avoir sur la prochaine commande, ou remboursement
            de la ligne concernée selon le ratio de pièces touchées.
          </li>
          <li>
            <strong>Garantie commerciale 2 ans</strong> sur structure et
            défauts d’assemblage usine, couverte par Container Club en
            France (pas de renvoi en usine, pas de barrière de langue).
          </li>
          <li>
            <strong>Pièces détachées disponibles</strong> à l’unité (pieds,
            assises, fixations) pour les principaux modèles, expédiées sous
            5 jours ouvrés.
          </li>
        </ul>
        <p>
          Tous les rapports SAV publiés sont consultables par les pros
          engagés sur les prochains containers — c’est notre engagement de
          transparence opérationnelle.
        </p>
      </>
    ),
  },

  // ---- Légitimité / éligibilité ----------------------------------
  {
    category: 'Éligibilité',
    q: 'Mon activité n’est pas dans la restauration, puis-je commander ?',
    a: (
      <>
        <p>
          Oui — Container Club s’adresse à <strong>tout professionnel ayant
          un usage outdoor du mobilier</strong>. Les profils que nous
          servons régulièrement :
        </p>
        <ul>
          <li>Cafés, restaurants, brasseries, plages privées</li>
          <li>Hôtels, campings, villages vacances, gîtes pro</li>
          <li>Espaces événementiels, séminaires, salons</li>
          <li>Mairies, collectivités (terrasses publiques, halls)</li>
          <li>Architectes & agenceurs CHR (achat groupé pour clients)</li>
          <li>Distributeurs et grossistes B2B (commande 40’ GP)</li>
        </ul>
        <p>
          Le seul prérequis :{' '}
          <strong>
            disposer d’un numéro SIRET valide et actif au moment de la
            réservation
          </strong>{' '}
          (vérifié automatiquement contre la base INSEE). Aucune restriction
          de chiffre d’affaires, d’ancienneté ou de secteur d’activité.
        </p>
      </>
    ),
  },
]

const CATEGORY_COLOR: Record<string, string> = {
  Sécurité: 'text-[color:var(--ember)]',
  Paiement: 'text-[color:var(--ember)]',
  Légal: 'text-[color:var(--ember)]',
  Logistique: 'text-[color:var(--ember)]',
  Fournisseurs: 'text-[color:var(--ember)]',
  Qualité: 'text-[color:var(--ember)]',
  Éligibilité: 'text-[color:var(--ember)]',
}

export function FaqAccordion() {
  return (
    <section
      id="faq"
      className="border-t border-[color:var(--sand-deep)] bg-[color:var(--sand-soft)]"
    >
      <div className="mx-auto max-w-3xl px-6 py-20">
        <div className="mb-10">
          <div className="label-eyebrow text-[color:var(--ember)]">
            Questions fréquentes
          </div>
          <h2 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">
            Tout ce que vous devez savoir avant de réserver.
          </h2>
          <p className="text-foreground/70 mt-4 max-w-2xl text-sm leading-relaxed">
            12 questions structurées par thème (sécurité, paiement, légal,
            logistique, fournisseurs, qualité, éligibilité). Si la vôtre
            n’est pas listée, écrivez à{' '}
            <a
              href="mailto:adrienlaniez1@gmail.com"
              className="font-medium text-foreground underline-offset-2 hover:underline"
            >
              adrienlaniez1@gmail.com
            </a>{' '}
            — réponse sous 24 h ouvrées.
          </p>
        </div>

        <div className="divide-y divide-[color:var(--sand-deep)] border-y border-[color:var(--sand-deep)]">
          {FAQ.map((item, i) => (
            <details
              key={i}
              className="group [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 py-5 text-sm transition-colors hover:text-[color:var(--ember)]">
                <div className="min-w-0">
                  <span
                    className={`label-eyebrow block ${
                      CATEGORY_COLOR[item.category] ??
                      'text-[color:var(--ember)]'
                    }`}
                  >
                    {item.category}
                  </span>
                  <span className="mt-1 block font-display text-base font-medium tracking-tight">
                    {item.q}
                  </span>
                </div>
                <span className="text-foreground/60 mt-1.5 inline-flex h-5 w-5 shrink-0 items-center justify-center text-xl font-light transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <div className="legal-prose pb-6 pr-9 text-sm leading-relaxed text-[color:var(--ink-soft)]">
                {item.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
