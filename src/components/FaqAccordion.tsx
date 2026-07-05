import { useState } from 'react'
import { motion } from 'framer-motion'

import { RevealItem, RevealStagger } from '@/components/motion-helpers'

export const FAQ = [
  {
    q: "Que se passe-t-il si le container n'atteint pas 80% de remplissage ?",
    a: "Le seuil de 80% garantit que le container part dans des conditions économiques optimales pour tout le monde : c'est ce qui permet d'obtenir les prix direct usine. Tant qu'il n'est pas atteint, rien n'est lancé en production et vous n'êtes débité que des frais de réservation.\n\nSi le seuil n'est pas atteint à la date de clôture estimée, nous pouvons prolonger la collecte de 2 semaines maximum pour laisser arriver les dernières réservations. Vous êtes tenu informé en temps réel depuis votre espace et par email.\n\nSi malgré tout le seuil reste non atteint, le container est purement et simplement annulé : l'intégralité des sommes versées (frais de réservation + acompte éventuel) vous est remboursée sous 5 jours ouvrés, sans aucune retenue. Vous ne prenez donc aucun risque financier sur le remplissage.",
  },
  {
    q: "Que se passe-t-il si mon design n'atteint pas le MOQ de 50 ?",
    a: "Chaque design (coloris / finition) doit réunir un minimum de 50 unités commandées, toutes réservations confondues, pour être lancé en production. C'est ce minimum qui rend le prix usine possible sur une finition donnée.\n\nSi votre design n'atteint pas ce seuil à la clôture, vous n'êtes jamais bloqué : trois options vous sont communiquées immédiatement. 1) Basculer votre commande vers un design confirmé du même produit, au même prix. 2) Reporter automatiquement votre ligne sur le container suivant, sans frais supplémentaires, le temps que le design se complète. 3) Être remboursé sur cette ligne uniquement, le reste de votre commande étant maintenu.\n\nVous gardez la main : aucune décision n'est prise à votre place, et vous disposez d'un délai clair pour choisir.",
  },
  {
    q: 'Quand suis-je débité ? Et de combien à chaque étape ?',
    a: "Le paiement est échelonné en 3 étapes, calées sur l'avancement réel du container — vous n'avancez jamais une grosse somme dans le vide.\n\nÉtape 1 — Réservation : 3% du montant (minimum 150 €, maximum 500 €). Ces frais réservent votre place et votre quantité. Ils ne sont pas remboursables, sauf si c'est Container Club qui annule (container non lancé), auquel cas vous récupérez tout.\n\nÉtape 2 — Lancement : lorsque le container atteint 80%, un acompte complémentaire de 27% est appelé. Vous êtes prévenu 48h à l'avance, donc jamais débité par surprise.\n\nÉtape 3 — Avant expédition : le solde de 70% est réglé une fois la production terminée ET le contrôle qualité SGS validé en usine. Vous payez le solde en sachant que la marchandise est conforme et prête à charger.",
  },
  {
    q: "Qui s'occupe de la douane et de la TVA à l'import ?",
    a: "Tout est pris en charge par Container Club (Pros Import EURL), votre importateur officiel français. Vous n'avez aucune démarche douanière à effectuer : nous gérons la déclaration d'importation, le dédouanement, la TVA à l'import (autoliquidée) et la conformité réglementaire des produits (marquage CE, REACH, classement au feu pour les ERP).\n\nVous recevez une facture française en bonne et due forme : prix HT + TVA 20% en sus, parfaitement déductible pour votre entreprise. Pas de facture étrangère, pas de TVA bloquée, pas de surprise au passage en douane.\n\nConcrètement, vous achetez auprès d'un fournisseur français et recevez une marchandise déjà dédouanée et conforme au marché européen.",
  },
  {
    q: 'Comment se passe la livraison ? Combien ça coûte ?',
    a: "Le prix affiché est un prix rendu port : il inclut la marchandise, l'importation, la douane et l'acheminement jusqu'au port d'arrivée (Marseille-Fos ou Le Havre selon le container).\n\nÀ partir du port, trois possibilités : vous enlevez vous-même la marchandise, vous mandatez votre propre transporteur, ou nous vous mettons en relation avec des transporteurs partenaires recommandés. Le transport entre le port et votre établissement est contractualisé et réglé directement par vos soins — ce qui vous laisse libre de choisir l'option la moins chère pour votre zone.\n\nVous savez donc à l'avance ce qui est inclus (jusqu'au port) et ce qui reste à votre main (le dernier kilomètre), sans frais cachés.",
  },
  {
    q: 'Quelle garantie sur les produits ? Et le SAV ?',
    a: "Tous les produits bénéficient d'une garantie commerciale de 2 ans sur les pièces et la structure, assurée par Container Club en France — pas besoin de contacter une usine à l'étranger.\n\nLe SAV est joignable par email, avec une réponse sous 48h ouvrées. En cas de besoin, des pièces détachées sont disponibles et nous organisons la prise en charge selon les cas (réparation, remplacement de pièce, solution adaptée).\n\nL'éco-participation Eco-mobilier est incluse dans le prix : la fin de vie et le recyclage du mobilier sont déjà couverts. Vous avez un interlocuteur français, des factures françaises et une garantie française.",
  },
  {
    category: 'Sécurité',
    q: 'Puis-je annuler ma réservation ? Sous quelles conditions ?',
    a: "Oui, tant que le container n'est pas clôturé. Avant la clôture, vous pouvez retirer une ligne de votre commande à tout moment : seuls les frais de réservation de cette ligne restent acquis (c'est ce qui sécurise les places pour le groupe).\n\nUne fois le container passé à 80% et l'acompte appelé, l'engagement devient ferme : la production est lancée en votre nom, la commande ne peut plus être annulée unilatéralement.\n\nLa seule exception est une défaillance de Container Club (container non lancé, annulation de notre fait) : dans ce cas, vous êtes intégralement remboursé. En clair, le risque ne pèse jamais sur vous tant que la production n'a pas démarré.",
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
    a: "Avant chaque chargement, nous mandatons SGS — organisme de certification indépendant et reconnu mondialement — pour un contrôle physique en usine. Ce contrôle suit un échantillonnage normé (AQL 2.5) : dimensions, finitions, solidité et conformité aux spécifications commandées.\n\nUn rapport photo et vidéo est partagé avec l'ensemble des professionnels engagés sur le container, en toute transparence. Vous voyez ce que vous allez recevoir avant que cela ne quitte l'usine.\n\nRègle simple : aucun container ne quitte l'usine sans cette validation. C'est précisément cette étape qui vous protège des mauvaises surprises courantes de l'import direct.",
  },
  {
    q: 'Qui se cache derrière Container Club ? Est-ce une entreprise française fiable ?',
    a: "Container Club est édité par Pros Import EURL, société française immatriculée au RCS de Paris (988 269 981), basée au 60 Rue François Ier, 75008 Paris. C'est notre société qui achète, importe, dédouane et vous facture, en tant qu'importateur officiel.\n\nVous traitez donc avec une entreprise française, soumise au droit français, qui émet des factures françaises et porte la garantie. Pas d'intermédiaire opaque ni de plateforme étrangère.\n\nNotre modèle est volontairement transparent : prix, étapes de paiement, seuils de départ et délais sont affichés avant même que vous ne réserviez.",
  },
  {
    q: 'Combien de temps entre ma réservation et la réception de la marchandise ?',
    a: "Le délai dépend d'abord du remplissage du container. Tant que le seuil de départ n'est pas atteint, la collecte se poursuit — c'est la phase la plus variable, et vous en suivez l'avancement en temps réel.\n\nUne fois le container lancé, comptez environ 45 jours de production en usine, puis environ 30 jours de transit maritime, auxquels s'ajoute le dédouanement. Soit, en règle générale, de l'ordre de 3 mois entre le lancement du container et sa mise à disposition au port.\n\nNous communiquons une date de clôture estimée et vous tenons informé à chaque étape : lancement, fin de production, embarquement, arrivée au port.",
  },
  {
    q: 'Et si un produit arrive abîmé ou non conforme ?',
    a: "Le contrôle SGS avant expédition réduit fortement ce risque, mais s'il subsiste un souci, vous êtes couvert. À la réception, vérifiez la marchandise et signalez tout produit endommagé ou non conforme à notre SAV, photos à l'appui.\n\nNous organisons alors la prise en charge : envoi de pièces détachées, remplacement ou solution adaptée selon le cas, dans le cadre de la garantie 2 ans.\n\nVous n'êtes jamais seul face à une usine à l'autre bout du monde : l'interlocuteur, c'est nous, en France.",
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
  const [open, setOpen] = useState<number | null>(0)

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

        <RevealStagger className="space-y-3">
          {FAQ.map((item, i) => {
            const isOpen = open === i
            const panelId = `faq-panel-${i}`
            return (
              <RevealItem key={i}>
                <div
                  className={`overflow-hidden rounded-md border bg-card transition-colors duration-300 ${
                    isOpen
                      ? 'border-[color:var(--ember)]/50 shadow-[0_8px_24px_-14px_rgba(0,0,0,0.25)]'
                      : 'border-[color:var(--sand-deep)] hover:border-[color:var(--foreground)]/30'
                  }`}
                >
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="flex w-full cursor-pointer items-start justify-between gap-4 p-5 text-left"
                  >
                    <span
                      className={`font-display text-base font-medium tracking-tight transition-colors ${
                        isOpen ? 'text-[color:var(--ember)]' : ''
                      }`}
                    >
                      {item.q}
                    </span>
                    <span
                      className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xl font-light transition-all duration-300 ${
                        isOpen
                          ? 'rotate-45 bg-[color:var(--ember)] text-white'
                          : 'text-foreground/60 bg-[color:var(--sand-soft)]'
                      }`}
                    >
                      +
                    </span>
                  </button>
                  <motion.div
                    id={panelId}
                    initial={false}
                    animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
                    transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-3 px-5 pb-5">
                      {item.a.split('\n\n').map((para, k) => (
                        <p
                          key={k}
                          className="text-sm leading-relaxed text-[color:var(--ink-soft)]"
                        >
                          {para}
                        </p>
                      ))}
                    </div>
                  </motion.div>
                </div>
              </RevealItem>
            )
          })}
        </RevealStagger>
      </div>
    </section>
  )
}
