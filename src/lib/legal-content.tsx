import { LegalSection } from '@/components/LegalLayout'
import type { LegalSlug } from '@/components/LegalLayout'
import { LI, P, Strong, UL } from '@/components/legal-prose'

export type LegalDoc = {
  slug: LegalSlug
  title: string
  updatedAt: string
  metaDescription: string
  content: React.ReactNode
}

export const LEGAL_DOCS: Record<LegalSlug, LegalDoc> = {
  // ============================================================
  'mentions-legales': {
    slug: 'mentions-legales',
    title: 'Mentions légales',
    updatedAt: '19 mai 2026',
    metaDescription:
      'Mentions légales du site Container Club, édité par Pros Import EURL — éditeur, hébergeur, propriété intellectuelle.',
    content: (
      <>
        <LegalSection id="editeur" title="1. Éditeur du site">
          <P>
            Le présent site, accessible à l'adresse{' '}
            <Strong>https://hub.terrassea.fr</Strong> (ci-après le « Site »),
            est édité par :
          </P>
          <UL>
            <LI>
              <Strong>Raison sociale :</Strong> Pros Import EURL
            </LI>
            <LI>
              <Strong>Forme juridique :</Strong> Entreprise unipersonnelle à
              responsabilité limitée
            </LI>
            <LI>
              <Strong>Capital social :</Strong> 500 € entièrement libéré
            </LI>
            <LI>
              <Strong>Siège social :</Strong> 60 Rue François Ier, 75008 Paris,
              France
            </LI>
            <LI>
              <Strong>RCS :</Strong> Paris 988 269 981
            </LI>
            <LI>
              <Strong>SIRET :</Strong> 98826998100011
            </LI>
            <LI>
              <Strong>TVA intracommunautaire :</Strong> FR08988269981
            </LI>
            <LI>
              <Strong>EORI :</Strong> FR98826998100011
            </LI>
            <LI>
              <Strong>Téléphone :</Strong> +33 (0)4 91 00 00 00
            </LI>
            <LI>
              <Strong>Email :</Strong> adrienlaniez1@gmail.com
            </LI>
          </UL>
        </LegalSection>

        <LegalSection id="directeur" title="2. Directeur de la publication">
          <P>
            Adrien Laniez, en qualité de Gérant de Pros Import EURL, est le
            directeur de la publication du Site.
          </P>
        </LegalSection>

        <LegalSection id="hebergeur" title="3. Hébergement">
          <P>
            Le Site est hébergé sur l'infrastructure{' '}
            <Strong>Cloudflare Workers</Strong> :
          </P>
          <UL>
            <LI>Cloudflare, Inc.</LI>
            <LI>101 Townsend Street, San Francisco, CA 94107, États-Unis</LI>
            <LI>
              Site :{' '}
              <a href="https://www.cloudflare.com" className="underline">
                www.cloudflare.com
              </a>
            </LI>
          </UL>
          <P>
            Le transfert de données vers les États-Unis est encadré par les
            Clauses Contractuelles Types adoptées par la Commission européenne
            et par les Data Processing Addenda standards de Cloudflare. Cf.
            politique de confidentialité.
          </P>
        </LegalSection>

        <LegalSection id="pi" title="4. Propriété intellectuelle">
          <P>
            L'ensemble des éléments du Site (textes, photographies,
            illustrations, logos, graphismes, mise en page, code source,
            structure de base de données, marque « Container Club » et «
            Terrassea ») est protégé par le Code de la propriété intellectuelle
            et appartient à Pros Import EURL ou à ses partenaires concédants.
          </P>
          <P>
            Toute reproduction, représentation, modification, publication,
            transmission ou adaptation totale ou partielle, par quelque procédé
            que ce soit, est interdite sans autorisation écrite préalable de
            Pros Import EURL, à l'exception du droit de copie privée et de
            courte citation prévu par la loi.
          </P>
        </LegalSection>

        <LegalSection id="liens" title="5. Liens hypertextes">
          <P>
            La mise en place de liens vers le Site est libre, sous réserve d'un
            usage loyal et non préjudiciable à l'image de Pros Import EURL. Les
            liens sortants depuis le Site vers des sites tiers n'engagent pas la
            responsabilité de Pros Import EURL quant à leur contenu.
          </P>
        </LegalSection>

        <LegalSection id="credits" title="6. Crédits photographiques">
          <P>
            Les photographies illustrant les containers livrés et le mobilier
            sont issues de prises de vue réalisées en usine ou chez nos clients,
            ainsi que de licences libres (Unsplash) pour les visuels
            d'illustration. Photographies clients publiées avec leur accord
            écrit.
          </P>
        </LegalSection>

        <LegalSection id="droit" title="7. Droit applicable et juridiction">
          <P>
            Le présent site et ses conditions d'utilisation sont soumis au droit
            français. Tout litige relatif à leur interprétation ou à leur
            exécution relève de la compétence exclusive des tribunaux du ressort
            de la Cour d'appel d'Aix-en-Provence, sauf disposition impérative
            contraire.
          </P>
        </LegalSection>
      </>
    ),
  },

  // ============================================================
  cgv: {
    slug: 'cgv',
    title: 'Conditions générales de vente',
    updatedAt: '19 mai 2026',
    metaDescription:
      'Conditions générales de vente B2B de Container Club : pré-commande groupée, MOQ, échéancier de paiement, livraison, garanties.',
    content: (
      <>
        <LegalSection id="preambule" title="1. Préambule">
          <P>
            Les présentes Conditions Générales de Vente (« CGV ») régissent les
            ventes conclues entre Pros Import EURL, exploitant la marque{' '}
            <Strong>Container Club</Strong>, et tout professionnel (personne
            morale ou personne physique agissant dans le cadre de son activité
            commerciale) souhaitant participer à une opération d'achat groupé
            via le Site (l'« Acheteur »).
          </P>
          <P>
            <Strong>
              Ces CGV sont réservées aux professionnels au sens de l'article
              liminaire du Code de la consommation.
            </Strong>{' '}
            Toute commande passée par un consommateur est réputée nulle et sera
            remboursée intégralement.
          </P>
        </LegalSection>

        <LegalSection id="objet" title="2. Objet">
          <P>
            Container Club organise des campagnes de pré-commande groupée de
            mobilier outdoor professionnel. Chaque container réunit plusieurs
            Acheteurs autour d'un objectif de remplissage de 80 % minimum
            permettant de déclencher la production usine et l'expédition vers la
            France.
          </P>
        </LegalSection>

        <LegalSection id="acceptation" title="3. Acceptation des CGV">
          <P>
            La validation d'une réservation sur le Site vaut acceptation pleine
            et sans réserve des présentes CGV par l'Acheteur. Les CGV
            applicables sont celles en vigueur à la date de la réservation.
          </P>
        </LegalSection>

        <LegalSection id="prix" title="4. Prix">
          <P>
            Les prix sont exprimés en <Strong>euros hors taxes (HT)</Strong>. La
            TVA française à 20 % est appliquée à la facturation finale et figure
            distinctement sur la facture. Les prix incluent : importation
            officielle, dédouanement, contrôle qualité SGS, garantie commerciale
            2 ans, éco-participation. Ils excluent : les frais de livraison
            (forfaitaires par zone, indiqués à la commande) et toute prestation
            d'installation.
          </P>
          <P>
            Pros Import EURL se réserve le droit de modifier ses prix à tout
            moment pour les campagnes à venir. Une fois la réservation validée,
            le prix est garanti pour l'Acheteur jusqu'à la livraison.
          </P>
        </LegalSection>

        <LegalSection id="achat-groupe" title="5. Mécanisme d'achat groupé">
          <P>
            Chaque container est défini par : (i) une référence unique, (ii) une
            capacité en m³, (iii) un seuil de déclenchement (80 % de
            remplissage), (iv) un MOQ usine par modèle et par couleur (50 unités
            pour les assises, 20 pour les tables), (v) une date de clôture
            estimée.
          </P>
          <P>
            <Strong>Si le seuil de 80 % n'est pas atteint</Strong> à la date de
            clôture, Pros Import EURL peut, à sa seule discrétion : (i)
            prolonger la collecte de 2 semaines maximum, ou (ii) annuler le
            container. En cas d'annulation, l'intégralité des sommes versées
            (frais de réservation + acompte) est remboursée à l'Acheteur sous 5
            jours ouvrés sur le moyen de paiement original.
          </P>
          <P>
            <Strong>Si une couleur n'atteint pas son MOQ</Strong>, l'Acheteur
            dispose de 5 jours ouvrés à compter de la notification pour : (i)
            migrer vers une couleur confirmée du même produit, (ii) reporter sa
            commande sur le container suivant, ou (iii) être remboursé sur la
            ligne concernée.
          </P>
        </LegalSection>

        <LegalSection id="paiement" title="6. Modalités de paiement">
          <P>L'échéancier de paiement est le suivant :</P>
          <UL>
            <LI>
              <Strong>Étape 1 — Réservation :</Strong> 3 % du sous-total HT
              (minimum 150 €, maximum 500 €) prélevés immédiatement par carte
              bancaire via Stripe.
              <Strong>
                {' '}
                Ces frais ne sont pas remboursables, sauf annulation du
                container par Pros Import EURL.
              </Strong>
            </LI>
            <LI>
              <Strong>Étape 2 — Acompte 27 % :</Strong> Appelé lorsque le
              container atteint 80 % de remplissage. L'Acheteur est prévenu 48 h
              à l'avance par email et SMS. Prélèvement automatique sur le moyen
              de paiement enregistré ou virement SEPA.
            </LI>
            <LI>
              <Strong>Étape 3 — Solde 70 % :</Strong> Exigible avant expédition
              usine, après validation du rapport de contrôle qualité SGS.
            </LI>
          </UL>
          <P>
            En cas de défaut de paiement à l'une des étapes, après mise en
            demeure restée infructueuse pendant 7 jours, Pros Import EURL peut
            résilier la commande de plein droit et conserver les sommes déjà
            versées au titre de l'indemnisation forfaitaire (clause pénale).
          </P>
          <P>
            Conformément à l'article L441-10 du Code de commerce, tout retard de
            paiement entraîne de plein droit l'application de pénalités au taux
            de la BCE majoré de 10 points, ainsi qu'une indemnité forfaitaire de
            40 € pour frais de recouvrement.
          </P>
        </LegalSection>

        <LegalSection id="livraison" title="7. Livraison">
          <P>
            La livraison s'effectue par voie maritime depuis l'Asie via
            Marseille-Fos ou Le Havre, puis par transport routier vers le lieu
            indiqué par l'Acheteur. Délai indicatif : <Strong>75 jours</Strong>{' '}
            à compter de la clôture du container.
          </P>
          <P>
            Les délais annoncés sont donnés à titre indicatif. Un retard ne peut
            donner lieu à résiliation ou indemnités tant qu'il reste raisonnable
            (≤ 30 jours) et qu'il a été communiqué dans les meilleurs délais. Un
            geste commercial est appliqué en cas de retard supérieur à 7 jours
            dû à Pros Import EURL.
          </P>
          <P>
            Le transfert des risques s'opère à la remise des marchandises à
            l'Acheteur (Incoterm DAP — Delivered at Place).
          </P>
          <P>
            L'Acheteur dispose de <Strong>7 jours</Strong> après réception pour
            signaler tout défaut visible. Passé ce délai, les marchandises sont
            réputées conformes sous réserve de l'application des garanties
            légales et commerciales.
          </P>
        </LegalSection>

        <LegalSection id="garanties" title="8. Garanties">
          <P>Les produits bénéficient cumulativement :</P>
          <UL>
            <LI>
              de la <Strong>garantie légale de conformité</Strong> applicable
              aux relations B2B dans la mesure des dispositions impératives du
              droit français ;
            </LI>
            <LI>
              de la <Strong>garantie légale des vices cachés</Strong> prévue aux
              articles 1641 et suivants du Code civil ;
            </LI>
            <LI>
              d'une <Strong>garantie commerciale de 2 ans</Strong> consentie par
              Pros Import EURL, couvrant les défauts de pièces et de structure
              dans le cadre d'un usage normal et professionnel.
            </LI>
          </UL>
          <P>
            La garantie commerciale ne couvre pas l'usure normale, les dommages
            résultant d'un usage inapproprié, d'une modification non autorisée
            ou d'un défaut d'entretien.
          </P>
        </LegalSection>

        <LegalSection id="responsabilite" title="9. Responsabilité">
          <P>
            La responsabilité de Pros Import EURL est limitée, pour les
            Acheteurs professionnels, au montant total HT effectivement payé par
            l'Acheteur au titre de la commande concernée. Pros Import EURL ne
            saurait être tenue responsable des dommages indirects, pertes
            d'exploitation, pertes de chiffre d'affaires, atteinte à l'image ou
            perte de clientèle.
          </P>
        </LegalSection>

        <LegalSection id="force-majeure" title="10. Force majeure">
          <P>
            Pros Import EURL n'est pas responsable des manquements dus à un
            événement de force majeure au sens de l'article 1218 du Code civil,
            ni à un fait imprévisible et indépendant de sa volonté (notamment :
            grève portuaire, fermeture douanière, conflit armé, épidémie,
            événements climatiques exceptionnels). En cas de force majeure
            persistant plus de 60 jours, chaque partie peut résilier la
            commande, l'Acheteur étant remboursé intégralement.
          </P>
        </LegalSection>

        <LegalSection
          id="donnees"
          title="11. Protection des données personnelles"
        >
          <P>
            Le traitement des données personnelles est régi par notre{' '}
            <a href="/legal/confidentialite" className="underline">
              Politique de confidentialité
            </a>
            , conforme au RGPD et à la loi Informatique et Libertés.
          </P>
        </LegalSection>

        <LegalSection id="mediation" title="12. Médiation et litiges">
          <P>
            Conformément à l'article L612-1 du Code de la consommation, bien que
            les présentes CGV soient réservées aux professionnels, Pros Import
            SAS propose, en cas de litige, de recourir préalablement à une
            médiation amiable, notamment via la{' '}
            <Strong>
              FEVAD — Fédération du e-commerce et de la vente à distance
            </Strong>{' '}
            ou tout autre médiateur sectoriel compétent.
          </P>
          <P>
            À défaut d'accord amiable, tout litige relatif à la formation,
            l'interprétation, l'exécution ou la rupture des présentes sera de la{' '}
            <Strong>
              compétence exclusive du Tribunal de commerce de Paris
            </Strong>
            , nonobstant pluralité de défendeurs ou appel en garantie.
          </P>
        </LegalSection>

        <LegalSection id="droit-applicable" title="13. Droit applicable">
          <P>
            Les présentes CGV sont soumises au droit français à l'exclusion de
            la Convention de Vienne sur la vente internationale de marchandises
            (CVIM).
          </P>
        </LegalSection>
      </>
    ),
  },

  // ============================================================
  cgu: {
    slug: 'cgu',
    title: 'Conditions générales d’utilisation',
    updatedAt: '19 mai 2026',
    metaDescription:
      'Conditions générales d’utilisation du site Container Club — accès, compte, comportements interdits, responsabilité éditeur.',
    content: (
      <>
        <LegalSection id="objet" title="1. Objet">
          <P>
            Les présentes Conditions Générales d'Utilisation (« CGU ») régissent
            l'accès et l'usage du site Container Club, édité par Pros Import
            SAS. Elles complètent les{' '}
            <a href="/legal/cgv" className="underline">
              Conditions Générales de Vente
            </a>{' '}
            applicables aux réservations.
          </P>
        </LegalSection>

        <LegalSection id="acces" title="2. Accès au Site">
          <P>
            Le Site est accessible gratuitement à toute personne disposant d'un
            accès à Internet. Tous les frais nécessaires à l'accès aux services
            (matériel informatique, connexion Internet, etc.) sont à la charge
            de l'utilisateur. Container Club met en œuvre les moyens
            raisonnables pour assurer une disponibilité du Site satisfaisante,
            sans garantie d'absence d'interruption.
          </P>
        </LegalSection>

        <LegalSection id="compte" title="3. Compte utilisateur">
          <P>
            La réservation requiert la création d'un compte avec email
            professionnel et l'acceptation des CGV. L'utilisateur est
            responsable de la confidentialité de ses identifiants et de
            l'ensemble des opérations effectuées depuis son compte. Toute
            utilisation frauduleuse ou suspecte doit être signalée sans délai à{' '}
            <a href="mailto:security@terrassea.fr" className="underline">
              security@terrassea.fr
            </a>
            .
          </P>
        </LegalSection>

        <LegalSection id="comportement" title="4. Comportements interdits">
          <P>L'utilisateur s'engage à ne pas :</P>
          <UL>
            <LI>
              utiliser le Site à des fins illicites, frauduleuses ou contraires
              aux bonnes mœurs ;
            </LI>
            <LI>
              tenter d'accéder de manière non autorisée à toute partie du Site,
              aux comptes d'autres utilisateurs ou aux systèmes connectés ;
            </LI>
            <LI>
              extraire massivement ou réutiliser des données du Site (scraping,
              spidering) sans autorisation écrite préalable ;
            </LI>
            <LI>
              perturber le fonctionnement du Site (attaques par déni de service,
              injection de code malveillant) ;
            </LI>
            <LI>
              usurper l'identité d'un tiers ou fournir des informations
              inexactes lors de la réservation.
            </LI>
          </UL>
        </LegalSection>

        <LegalSection id="pi" title="5. Propriété intellectuelle">
          <P>
            L'ensemble du Site est protégé par les dispositions des{' '}
            <a href="/legal/mentions-legales" className="underline">
              mentions légales
            </a>
            . Toute utilisation non autorisée engage la responsabilité civile et
            pénale de l'auteur.
          </P>
        </LegalSection>

        <LegalSection id="responsabilite" title="6. Responsabilité">
          <P>
            Container Club ne saurait être tenu responsable des dommages
            résultant d'une mauvaise utilisation du Site, d'une indisponibilité
            temporaire, ou de la présence de virus en dépit des précautions
            prises. L'utilisateur reconnaît disposer de la compétence et des
            moyens nécessaires pour accéder au Site dans des conditions
            sécurisées.
          </P>
        </LegalSection>

        <LegalSection id="modification" title="7. Modification des CGU">
          <P>
            Container Club peut modifier les présentes CGU à tout moment. La
            version applicable est celle en vigueur lors de l'utilisation du
            Site. Les modifications substantielles sont notifiées par email aux
            titulaires de comptes actifs.
          </P>
        </LegalSection>

        <LegalSection id="droit" title="8. Droit applicable et litiges">
          <P>
            Les présentes CGU sont soumises au droit français. Tout litige
            relatif à leur interprétation ou à leur exécution relève de la
            compétence exclusive du Tribunal de commerce de Paris.
          </P>
        </LegalSection>
      </>
    ),
  },

  // ============================================================
  confidentialite: {
    slug: 'confidentialite',
    title: 'Politique de confidentialité',
    updatedAt: '19 mai 2026',
    metaDescription:
      'Politique de confidentialité Container Club — RGPD, données collectées, durée, sous-traitants, vos droits.',
    content: (
      <>
        <LegalSection id="responsable" title="1. Responsable du traitement">
          <P>
            Le responsable du traitement des données personnelles est{' '}
            <Strong>Pros Import EURL</Strong>, immatriculée au RCS de Paris sous
            le numéro 988 269 981, dont le siège social est situé 60 Rue
            François Ier, 75008 Paris, France.
          </P>
          <P>
            Pour toute question relative à la protection de vos données :{' '}
            <a href="mailto:privacy@terrassea.fr" className="underline">
              privacy@terrassea.fr
            </a>
            .
          </P>
        </LegalSection>

        <LegalSection id="donnees" title="2. Données collectées">
          <P>Container Club collecte les catégories de données suivantes :</P>
          <UL>
            <LI>
              <Strong>Identification :</Strong> nom complet, fonction, raison
              sociale.
            </LI>
            <LI>
              <Strong>Contact :</Strong> email professionnel, téléphone, code
              postal, adresse de livraison.
            </LI>
            <LI>
              <Strong>Données entreprise :</Strong> SIRET (au plus tard à
              l'appel d'acompte), numéro de TVA intracommunautaire.
            </LI>
            <LI>
              <Strong>Données de commande :</Strong> historique des
              réservations, montants, dates.
            </LI>
            <LI>
              <Strong>Données de paiement :</Strong> traitées exclusivement par
              Stripe (cf. sous-traitants). Container Club ne stocke jamais le
              numéro de carte bancaire (PAN).
            </LI>
            <LI>
              <Strong>Données techniques :</Strong> adresse IP, journaux
              serveur, type de navigateur — conservés à des fins de sécurité et
              d'amélioration du service.
            </LI>
          </UL>
        </LegalSection>

        <LegalSection id="finalites" title="3. Finalités et bases légales">
          <UL>
            <LI>
              <Strong>Exécution du contrat (art. 6.1.b RGPD)</Strong> —
              traitement des réservations, paiements, livraisons, SAV.
            </LI>
            <LI>
              <Strong>Obligations légales (art. 6.1.c RGPD)</Strong> —
              comptabilité, facturation, obligations fiscales et douanières.
            </LI>
            <LI>
              <Strong>Intérêt légitime (art. 6.1.f RGPD)</Strong> — prévention
              de la fraude, sécurité du site, amélioration du service,
              prospection sur clients existants (offres similaires).
            </LI>
            <LI>
              <Strong>Consentement (art. 6.1.a RGPD)</Strong> — cookies non
              essentiels, newsletters externes, communications marketing à des
              prospects.
            </LI>
          </UL>
        </LegalSection>

        <LegalSection
          id="sous-traitants"
          title="4. Sous-traitants et destinataires"
        >
          <P>
            Les données peuvent être communiquées aux sous-traitants suivants :
          </P>
          <UL>
            <LI>
              <Strong>Stripe Payments Europe Ltd.</Strong> — paiements (Irlande,
              conforme RGPD).
            </LI>
            <LI>
              <Strong>Cloudflare, Inc.</Strong> — hébergement, sécurité réseau
              (États-Unis, transferts encadrés par Clauses Contractuelles
              Types).
            </LI>
            <LI>
              <Strong>Supabase, Inc.</Strong> — base de données et
              authentification (UE, eu-west-1).
            </LI>
            <LI>
              <Strong>SGS</Strong> — contrôle qualité (données limitées au
              container, pas de transmission de données personnelles
              d'Acheteurs).
            </LI>
            <LI>
              <Strong>Transporteurs partenaires</Strong> — nom et adresse de
              livraison uniquement.
            </LI>
            <LI>
              <Strong>Cabinet comptable et conseil juridique</Strong> — pour les
              obligations légales et la défense des intérêts de Pros Import
              EURL.
            </LI>
          </UL>
          <P>
            Aucune donnée n'est revendue à des tiers à des fins commerciales.
          </P>
        </LegalSection>

        <LegalSection id="duree" title="5. Durée de conservation">
          <UL>
            <LI>
              Données de prospection commerciale : <Strong>3 ans</Strong> à
              compter du dernier contact.
            </LI>
            <LI>
              Données client actives :{' '}
              <Strong>durée de la relation commerciale + 3 ans</Strong>.
            </LI>
            <LI>
              Données comptables, factures : <Strong>10 ans</Strong> (obligation
              légale, article L123-22 du Code de commerce).
            </LI>
            <LI>
              Données de paiement : <Strong>13 mois maximum</Strong> côté
              Container Club ; durée conforme aux règles propres de Stripe pour
              les tokens.
            </LI>
            <LI>
              Journaux de connexion : <Strong>1 an</Strong> conformément à la
              LCEN.
            </LI>
          </UL>
        </LegalSection>

        <LegalSection id="droits" title="6. Vos droits">
          <P>
            Conformément au RGPD et à la loi Informatique et Libertés, vous
            disposez des droits suivants :
          </P>
          <UL>
            <LI>droit d'accès à vos données ;</LI>
            <LI>droit de rectification ;</LI>
            <LI>
              droit à l'effacement (« droit à l'oubli »), sous réserve des
              obligations légales de conservation ;
            </LI>
            <LI>droit à la limitation du traitement ;</LI>
            <LI>droit à la portabilité de vos données ;</LI>
            <LI>droit d'opposition au traitement ;</LI>
            <LI>
              droit de définir des directives relatives au sort de vos données
              après votre décès ;
            </LI>
            <LI>
              droit de retirer votre consentement à tout moment lorsque le
              traitement repose sur celui-ci.
            </LI>
          </UL>
          <P>
            Pour exercer ces droits, écrivez à{' '}
            <a href="mailto:privacy@terrassea.fr" className="underline">
              privacy@terrassea.fr
            </a>{' '}
            en joignant une copie d'une pièce d'identité. Nous répondons sous 30
            jours.
          </P>
          <P>
            Vous avez également le droit d'introduire une réclamation auprès de
            la CNIL — 3, place de Fontenoy, 75007 Paris,{' '}
            <a href="https://www.cnil.fr" className="underline">
              www.cnil.fr
            </a>
            .
          </P>
        </LegalSection>

        <LegalSection id="securite" title="7. Sécurité">
          <P>
            Pros Import EURL met en œuvre des mesures techniques et
            organisationnelles appropriées pour assurer la sécurité de vos
            données : chiffrement TLS, contrôle d'accès strict, hébergement sur
            infrastructures certifiées (Cloudflare, Supabase), revue régulière
            des permissions, formation des équipes. En cas de violation de
            données susceptible de présenter un risque pour vos droits, vous
            serez notifié(e) dans les délais prévus par le RGPD.
          </P>
        </LegalSection>

        <LegalSection
          id="transferts"
          title="8. Transferts hors Union européenne"
        >
          <P>
            Certains sous-traitants (Cloudflare, Stripe) peuvent traiter les
            données depuis des pays hors UE, notamment les États-Unis. Ces
            transferts sont encadrés par les{' '}
            <Strong>Clauses Contractuelles Types</Strong> adoptées par la
            Commission européenne et, le cas échéant, par les mesures
            supplémentaires recommandées par le CEPD.
          </P>
        </LegalSection>

        <LegalSection id="modification" title="9. Modification de la politique">
          <P>
            La présente politique peut être mise à jour pour refléter des
            évolutions légales ou techniques. La date de dernière mise à jour
            figure en tête du document. Les modifications substantielles vous
            seront notifiées par email.
          </P>
        </LegalSection>
      </>
    ),
  },

  // ============================================================
  cookies: {
    slug: 'cookies',
    title: 'Politique cookies',
    updatedAt: '19 mai 2026',
    metaDescription:
      'Politique cookies de Container Club — types de traceurs, consentement, comment paramétrer ou refuser.',
    content: (
      <>
        <LegalSection id="definition" title="1. Qu'est-ce qu'un cookie ?">
          <P>
            Un cookie est un fichier texte de petite taille déposé sur votre
            terminal lors de la visite d'un site web. Il permet au site de
            reconnaître votre terminal, de mémoriser vos préférences, ou de
            collecter des informations statistiques sur l'usage du site.
          </P>
        </LegalSection>

        <LegalSection
          id="categories"
          title="2. Catégories utilisées sur le Site"
        >
          <UL>
            <LI>
              <Strong>Cookies strictement nécessaires</Strong> — indispensables
              au fonctionnement du site (gestion de la session de réservation,
              panier, équilibrage de charge Cloudflare). Ils ne nécessitent pas
              de consentement.
            </LI>
            <LI>
              <Strong>Cookies fonctionnels</Strong> — mémorisent vos préférences
              (langue, affichage, choix de filtres catalogue). Soumis à
              consentement.
            </LI>
            <LI>
              <Strong>Cookies de mesure d'audience anonymisée</Strong> —
              analytics sans identification individuelle. Soumis à consentement
              si non strictement anonymisés.
            </LI>
            <LI>
              <Strong>Cookies tiers (paiement)</Strong> — Stripe utilise ses
              propres cookies sur la page de paiement, soumis à sa propre
              politique.
            </LI>
          </UL>
          <P>
            <Strong>
              Container Club n'utilise actuellement aucun cookie publicitaire ni
              aucun traceur de réseau social.
            </Strong>
          </P>
        </LegalSection>

        <LegalSection id="liste" title="3. Liste détaillée des cookies déposés">
          <P>
            La liste détaillée des cookies déposés (nom, finalité, durée,
            émetteur) est mise à jour à chaque évolution technique du Site et
            accessible depuis le bandeau de consentement.
          </P>
          <P>Exemples de cookies actuellement déposés :</P>
          <UL>
            <LI>
              <Strong>__cf_bm</Strong> (Cloudflare, 30 min) — protection
              anti-bots, strictement nécessaire.
            </LI>
            <LI>
              <Strong>cc_consent</Strong> (Container Club, 6 mois) — mémorise
              vos choix de consentement cookies.
            </LI>
            <LI>
              <Strong>__stripe_mid</Strong> (Stripe, 1 an) — détection de fraude
              sur la page de paiement.
            </LI>
          </UL>
        </LegalSection>

        <LegalSection id="consentement" title="4. Gestion du consentement">
          <P>
            Lors de votre première visite, un bandeau vous permet d'accepter, de
            refuser ou de paramétrer les cookies non essentiels. Vous pouvez
            modifier vos choix à tout moment via le lien « Gérer mes cookies »
            présent en bas de chaque page (en cours de mise en place).
          </P>
        </LegalSection>

        <LegalSection
          id="refuser"
          title="5. Comment refuser ou supprimer les cookies ?"
        >
          <P>
            Vous pouvez également configurer votre navigateur pour bloquer les
            cookies ou être averti(e) avant leur dépôt. La désactivation des
            cookies strictement nécessaires peut toutefois empêcher le bon
            fonctionnement du Site (notamment la réservation).
          </P>
        </LegalSection>
      </>
    ),
  },

  // ============================================================
  remboursement: {
    slug: 'remboursement',
    title: 'Politique de remboursement',
    updatedAt: '19 mai 2026',
    metaDescription:
      'Politique de remboursement Container Club — cas, conditions, délais, modalités.',
    content: (
      <>
        <LegalSection id="principe" title="1. Principe général">
          <P>
            Container Club applique une politique de remboursement transparente
            et alignée sur ses CGV. Les remboursements sont effectués sur le
            moyen de paiement original utilisé pour la réservation initiale.
          </P>
        </LegalSection>

        <LegalSection
          id="cas"
          title="2. Cas donnant lieu à remboursement intégral"
        >
          <UL>
            <LI>
              <Strong>Annulation du container par Container Club</Strong> (seuil
              80 % non atteint, force majeure, défaillance partenaire usine) —
              remboursement de l'intégralité des sommes versées, y compris les
              frais de réservation.
            </LI>
            <LI>
              <Strong>Échec MOQ sur votre ligne uniquement</Strong> et choix de
              remboursement partiel — remboursement au prorata de la ligne
              concernée.
            </LI>
            <LI>
              <Strong>Refus du SIRET au stade de l'acompte 27 %</Strong> —
              Container Club n'autorisant que les Acheteurs professionnels.
            </LI>
            <LI>
              <Strong>Défaut majeur non corrigeable</Strong> détecté avant
              expédition.
            </LI>
          </UL>
        </LegalSection>

        <LegalSection
          id="frais-reservation"
          title="3. Sort des frais de réservation (3 %)"
        >
          <P>
            Les frais de réservation (3 % min 150 € / max 500 €) couvrent la
            sécurisation de votre place, la mobilisation logistique amont, et
            les frais de transaction Stripe.
          </P>
          <UL>
            <LI>
              <Strong>Remboursés intégralement</Strong> si Container Club annule
              le container ou ne tient pas ses engagements contractuels.
            </LI>
            <LI>
              <Strong>Non remboursés</Strong> en cas de désistement volontaire
              de l'Acheteur, sauf si ce désistement intervient sous 7 jours
              suivant la réservation initiale ET avant que le container atteigne
              50 % de remplissage.
            </LI>
          </UL>
        </LegalSection>

        <LegalSection id="delais" title="4. Délais de remboursement">
          <P>
            Les remboursements sont effectués sous{' '}
            <Strong>5 jours ouvrés</Strong> à compter de la confirmation du
            motif. Le délai d'apparition sur votre compte bancaire dépend de
            votre établissement (généralement 3 à 10 jours supplémentaires pour
            la carte bancaire ; 1 à 2 jours pour le virement SEPA).
          </P>
        </LegalSection>

        <LegalSection id="retard" title="5. Geste commercial en cas de retard">
          <P>
            En cas de retard de livraison supérieur à 7 jours par rapport à la
            date annoncée et imputable à Container Club, un avoir commercial
            automatique de <Strong>2 % du sous-total HT</Strong> est appliqué
            sur la prochaine commande. Au-delà de 30 jours de retard, l'Acheteur
            peut résilier la commande et bénéficier d'un remboursement intégral.
          </P>
        </LegalSection>

        <LegalSection
          id="defaut-livre"
          title="6. Défaut détecté après livraison"
        >
          <P>
            L'Acheteur dispose de 7 jours après livraison pour signaler tout
            défaut visible (photos par email à{' '}
            <a href="mailto:sav@terrassea.fr" className="underline">
              sav@terrassea.fr
            </a>
            ). En cas de défaut confirmé : remplacement à l'identique sur le
            container suivant, à défaut avoir commercial à valoir sous 12 mois,
            ou remboursement de la ligne concernée au choix de l'Acheteur.
          </P>
        </LegalSection>

        <LegalSection id="retractation" title="7. Sur le droit de rétractation">
          <P>
            <Strong>
              Les commandes B2B ne bénéficient pas du droit de rétractation
            </Strong>{' '}
            de 14 jours prévu par les articles L221-18 et suivants du Code de la
            consommation — celui-ci est réservé aux consommateurs particuliers.
            Container Club étant strictement réservé aux professionnels (cf.
            CGV), ce droit ne s'applique pas.
          </P>
        </LegalSection>

        <LegalSection id="reclamation" title="8. Réclamations">
          <P>
            Toute demande de remboursement doit être adressée par écrit à{' '}
            <a href="mailto:sav@terrassea.fr" className="underline">
              sav@terrassea.fr
            </a>{' '}
            en précisant la référence du container, le numéro de commande et le
            motif. Une réponse argumentée est apportée sous 5 jours ouvrés.
          </P>
        </LegalSection>
      </>
    ),
  },
}

export function getLegalDoc(slug: string): LegalDoc | undefined {
  return (LEGAL_DOCS as Record<string, LegalDoc>)[slug]
}
