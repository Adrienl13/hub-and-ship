# Stratégie IA 2026 — Audit complet & axes de développement

> Synthèse croisée (juillet 2026) de 5 audits : funnel de conversion du site
> (analyse code, branche fusion), GEO/AEO mesuré 2025-2026, commerce
> agentique (protocoles OpenAI/Google/Stripe), browsers agentiques, et
> comportement d'achat B2B assisté par IA. Chaque affirmation chiffrée est
> sourcée dans les rapports d'origine ; les niveaux de preuve sont marqués
> [prouvé] / [émergent] / [spéculatif].

---

## 1. Executive summary — les 5 décisions

1. **Créer des pages produit crawlables (URL propre par produit).** Tout le
   détail produit vit aujourd'hui dans un dialog invisible pour Google ET
   pour les IA. C'est LE trou n°1 : sans URL par produit, ni le SEO
   long-tail, ni les citations IA, ni les feeds agentiques ne peuvent
   fonctionner. Tout le reste s'appuie dessus.
2. **Réparer la conversion avant d'acheter du trafic.** 3 fuites majeures :
   magic-link post-paiement promis mais jamais envoyé, réservations
   impayées jamais relancées, `/contact` sans formulaire. Le trafic IA
   convertit 42 % mieux que le trafic classique [prouvé, Adobe T1 2026] —
   mais seulement si le tunnel ne fuit pas.
3. **Devenir « machine-readable » avant le 15 septembre 2026.** Cloudflare
   (notre infra) bloquera par défaut les agents IA à cette date. Il faut
   explicitement accueillir les agents (robots/WAF), exposer un feed
   produit, et préparer la brique Stripe agentique. Fenêtre courte, coût
   faible, asymétrie énorme.
4. **Rediriger l'effort GEO vers ce qui marche mesurablement** : médias
   gagnés (~84 % des citations IA), avis tiers (3x), données primaires,
   YouTube/Reddit — et arrêter d'attendre quoi que ce soit du llms.txt
   (97 % des fichiers jamais lus par les crawlers [prouvé, Ahrefs mai
   2026] ; on le garde, coût nul, mais ce n'est pas une stratégie).
5. **Jouer la fenêtre France.** Les acheteurs pros français sont en retard
   (7-29 % d'usage IA selon Fevad vs 89 % au global Forrester), mais le
   grand public bascule vite (48 % des Français ont utilisé une IA
   générative en 2025, 28 M d'utilisateurs mensuels d'assistants) et
   Google AI Mode arrive en France entre fin juin et le 23 sept. 2026.
   La France va vivre en 6 mois ce que les US ont vécu en 18. Celui qui
   est « la source » au moment du déploiement rafle la catégorie — le
   favori identifié AVANT contact gagne ~80 % des deals B2B [prouvé,
   6sense].

---

## 2. Où va l'IA — ce qui est prouvé vs ce qui est du bruit

### Prouvé (agir dessus)
- **La recherche d'achat passe par l'IA** : 89 % des acheteurs B2B utilisent
  la GenAI ; c'est devenu le canal n°1 de recherche d'achat (Forrester
  2026). 94 % ont classé leurs fournisseurs préférés AVANT tout contact,
  et ce favori gagne ~77-80 % des deals (6sense). → Être présent dans la
  réponse IA = être présélectionné.
- **Le trafic IA est petit mais précieux** : ~1 % du trafic des sites B2B,
  MAIS +393 % YoY (T1 2026) et conversion +42 % vs trafic classique,
  revenu/visite +37 % (Adobe). Le CTR Google s'effondre en parallèle
  (zero-click 69 %, −58 à −61 % de clics quand un AI Overview s'affiche).
- **Ce qui fait citer une marque par les IA** : autorité de domaine
  (backlinks 3,5x), présence sur des plateformes d'avis tiers (3x),
  médias gagnés (~84 % des citations), Reddit/YouTube/LinkedIn en top
  sources. Le contenu « on-site » seul ne suffit pas.
- **Le checkout in-chat a échoué (pour l'instant)** : OpenAI a retiré
  Instant Checkout en mars 2026 — les acheteurs préfèrent finaliser chez
  le marchand. Ce qui survit : la DÉCOUVERTE dans l'IA (feed produit +
  pages lisibles) et le paiement délégué Stripe. → Priorité au feed, pas
  aux endpoints de checkout.
- **Les agents-navigateurs deviennent mainstream par distribution** :
  Chrome auto browse (janv. 2026, base ~3 Md d'utilisateurs), Comet
  gratuit + PayPal, Claude for Chrome en beta. Un site doit être
  opérable par un agent (formulaires simples, HTML sémantique, pas de
  murs anti-bot).

### Émergent (préparer, ne pas parier)
- Standards agentiques : UCP (Google/Shopify) vs ACP (OpenAI/Stripe) vs
  AP2 (autorisation) — pas de vainqueur ; les marchands multi-protocoles
  captent plus de trafic. Notre position : schema.org + feed + Stripe =
  compatible avec tous sans refonte.
- Le JSON-LD n'a PAS d'effet causal prouvé sur les citations (test Ahrefs
  1 885 pages), mais aide l'indexation/compréhension et reste requis pour
  les rich snippets Google et les feeds marchands. On le garde pour ces
  raisons-là.
- Chatbots de vente : lifts réels mais chiffres vendeurs biaisés ; leçon
  Klarna = l'IA support fait des économies mais le remplacement total
  dégrade la qualité. Pour nous : un assistant d'achat SOURCÉ sur le
  catalogue (pas un chatbot générique), avec escalade humaine.

### Spéculatif (surveiller seulement)
- « 90 % des achats B2B intermédiés par agents d'ici 2028 » (Gartner),
  négociation agent-à-agent grand public, UCP hors Shopify.

---

## 3. Audit du site — les fuites (résumé du rapport funnel)

Top des trous par impact conversion (détail file:ligne dans le rapport) :

| # | Trou | Gravité |
|---|------|---------|
| 1 | Aucune page produit crawlable (détail 100 % en dialog, `Offer.url` → /catalogue) | Acquisition |
| 2 | Réservations `pending_reservation_fee` jamais relancées, zéro tracking abandon | Conversion |
| 3 | Magic-link post-paiement promis à l'écran, jamais envoyé (invité = dead-end) | Confiance |
| 4 | `/contact` sans formulaire (mailto uniquement) | Leads |
| 5 | Liste `notify_leads` = cul-de-sac (pas d'accusé, pas de synchro Brevo, pas de campagne) | Leads |
| 6 | Funnel checkout non instrumenté par étape ; 2 wrappers analytics divergents | Mesure |
| 7 | SIRET obligatoire en étape 1 du checkout (friction en haut de tunnel) | Conversion |
| 8 | Capture email absente des pages SEO (/prix, /faq, guides…) — footer only | Leads |
| 9 | Acompte 27 % / solde 70 % affichés mais non encaissables en ligne | Ops |
| 10 | Landings catégorie limitées à chaises/tables ; nav mobile catégorielle absente | Acquisition |
| 11 | Sender Brevo fallback `@terrassea.com` ≠ prosimport.com (délivrabilité) | Email |
| 12 | Webhooks Stripe partiels (pas de refund/dispute) | Ops |

---

## 4. Les axes — approfondis et nouveaux, par angle

### A. VISIBILITÉ (être trouvé — par Google, par les IA, par les agents)

**A1. Pages produit SSR** *(nouveau, prérequis de tout)* — Route
`/catalogue/p/$slug` par produit : HTML complet serveur, prix direct,
schema Product/Offer avec `url` propre, galerie, avis produit, CTA
réserver. Sitemap + maillage interne. C'est ce qui débloque : SEO
long-tail (« chaise terrasse rotin pro »), citations IA (les moteurs
lisent le HTML visible), et le feed agentique (chaque item doit avoir une
URL). *Effort M, impact très élevé.*

**A2. Médias gagnés & avis tiers** *(nouveau — c'est LE levier de citation
mesuré)* — Profil Google Business + Trustpilot actifs ; 2-3 communiqués/
dossiers de presse pro par an (ouverture de container, baromètre) vers la
presse CHR (L'Hôtellerie Restauration, France Snacking…) ; présence
YouTube (visite container, contrôle SGS filmé — 60 % des acheteurs B2B
utilisent YouTube en recherche fournisseur) ; réponses utiles sur les
espaces où les IA puisent (Reddit r/restaurateur, forums CHR) sans spam.
*Effort M récurrent, impact élevé — 84 % des citations IA viennent de là.*

**A3. Baromètre données primaires** *(approfondi)* — « Baromètre du
mobilier CHR importé » trimestriel : prix moyens constatés, coût fret
40HC, délais, taux de remplissage. Publié en HTML (pas seulement PDF),
avec chiffres citables en premier paragraphe. Les IA citent celui qui
possède les données originales ; c'est aussi le carburant des dossiers de
presse (A2). *Effort M, impact élevé, moat durable.*

**A4. Landings intentions + définitions** *(approfondi)* — Étendre les
landings catégorie (fauteuils, bancs, lounge…), pages définitions courtes
(MOQ, FOB, CBM, 40HC : réponse dans le 1er paragraphe), et 3-4 guides
« comparaison » (rotin vs textilène, achat groupé vs grossiste). Cibler
les questions telles qu'on les pose à une IA. *Effort S/page, impact
moyen cumulatif.*

**A5. Mesure de visibilité IA** *(approfondi)* — Suivi mensuel : 15
requêtes types sur ChatGPT/Perplexity/Gemini (+ AI Mode dès son arrivée
France), qui est cité, avec quelle source. C'est le nouveau « ranking ».
Timing critique : AI Mode France = été 2026. *Effort S récurrent.*

### B. INTÉGRATION (être achetable — par les humains ET par les agents)

**B1. Readiness agentique avant le 15/09/2026** *(nouveau, deadline
réelle)* — (a) Configurer Cloudflare pour ACCUEILLIR les agents
(catégories Search/Agent autorisées, blocage training au choix) ;
(b) vérifier explicitement que `OAI-SearchBot`, `PerplexityBot`,
`GPTBot`, `ClaudeBot`, `Google-Extended` ne sont pas bloqués (AI Crawl
Control + robots.txt) — c'est le risque silencieux n°1 ; (c) HTML
sémantique et formulaires opérables par agent (déjà bon) ; (d) vérifier
que le WAF ne bloque pas Claude for Chrome/Comet/auto browse. *Effort S,
assurance sur un canal qui convertit +42 %.*

**B2. Feed produit machine-readable** *(nouveau)* — Générer un feed
produits (JSON/CSV : prix direct, stock, MOQ, dimensions, URL produit,
images) exposé en endpoint + prêt à soumettre à chatgpt.com/merchants et
Google Merchant Center. Réutilise A1. La découverte in-chat survit au
pivot OpenAI ; Adobe identifie « sites non machine-readable » comme le
déficit n°1 des retailers. *Effort S-M, impact moyen aujourd'hui, élevé
à 12 mois.*

**B3. Stripe agentique** *(nouveau, opportuniste)* — Nous sommes déjà sur
Stripe : suivre l'Agentic Commerce Suite / Shared Payment Tokens et
activer quand disponible pour notre intégration (annoncé « une ligne de
code »). Pas de refonte. *Effort XS, optionnel.*

**B4. MCP serveur marchand** *(nouveau, différenciant B2B)* — Exposer un
serveur MCP public read-only : catalogue, prix direct, stock 24h,
containers ouverts, simulation de devis. N'importe quel acheteur équipé
de Claude/ChatGPT (ou son agent) peut interroger notre stock en direct —
aucun concurrent CHR ne le fait. À faire APRÈS A1/B2 (mêmes données).
*Effort M, impact spéculatif mais coût d'option faible et halo « référence
IA » fort.*

**B5. Compléter Stripe classique** *(hygiène)* — Webhooks refund/dispute,
et encaissement en ligne de l'acompte 27 % + solde 70 % (Payment Links ou
sessions dédiées) : moins de manuel, plus de confiance. *Effort M.*

### C. FACILITÉ (faculté d'achat — réduire l'effort client)

**C1. Réparer le post-achat invité** *(bug, priorité absolue)* —
Envoyer réellement le magic-link après paiement (webhook
`checkout.session.completed`) pour que l'invité retrouve sa réservation.
La promesse est déjà à l'écran. *Effort S.*

**C2. Alléger le haut de tunnel** — Déplacer le SIRET après l'étape
contact (ou le rendre non-bloquant à la saisie, vérification en
arrière-plan) ; formulaire simple sur /contact ; nav mobile catégorielle ;
dédoublonner les liens partenaires du header. *Effort S-M, gain direct
d'abandon.*

**C3. Calculateur « prix rendu container »** *(approfondi)* — Simulateur
public : quantités → prix/pièce, palier volume atteint, CBM occupé, frais
de réservation. Réutilise le moteur `pricing_parameters`. Outil citable
(backlinks), partageable, et qualificateur de leads. *Effort M, impact
élevé (visibilité + conversion à la fois).*

**C4. Assistant d'achat IA sourcé catalogue** *(nouveau, phase 2)* —
Chat ancré sur NOS données (produits, stock, délais, FAQ, prix publics
direct) avec escalade email/humain. Leçon Klarna : assistant ≠
remplacement. À faire après A1/B2 (mêmes données structurées) et après
trafic suffisant. *Effort L, impact moyen aujourd'hui.*

### D. CONVERSION (transformer — trafic → commande → réachat)

**D1. Relances automatisées** *(nouveau, ROI le plus rapide)* —
(a) Réservation impayée : J+1 et J+3 (lien de paiement inclus) ;
(b) accusé + bienvenue sur inscription notify_leads ; (c) synchro
`notify_leads` → liste Brevo ; (d) campagne « container ouvert /
clôture J-7 » vers la liste ; (e) avis vérifié à J+7 post-livraison
(alimente /avis, l'actif GEO le plus dur à copier). Implémentation :
Cloudflare Workers Cron + Brevo. *Effort M, impact très élevé — tout est
déjà collecté, rien n'est exploité.*

**D2. Instrumentation funnel** *(hygiène de pilotage)* — Unifier les 2
wrappers analytics ; tracker ouverture dialog, chaque étape, SIRET
refusé, checkout annulé, `partner_request_submit` ; vérifier Plausible
actif en prod. Segmenter le trafic référé IA (referrers chatgpt.com,
perplexity.ai, gemini/google AI) avec sa conversion propre — c'est le
KPI qui pilotera toute la stratégie visibilité. Sans ça, on pilote à
l'aveugle. *Effort S.*

**D3. Capture sur pages froides** — Bloc « alerte ouverture container /
baromètre par email » dans le corps de /prix, /faq, guides, landings
(pas seulement footer). *Effort S.*

**D4. Mécanique « drop » container** *(approfondi)* — Chaque container =
événement : page live remplissage, compte à rebours réel (la fausse date
statique a été retirée), alertes email liste D1, récap « container parti »
publiable (contenu A2/A3). Transforme la contrainte logistique en urgence
honnête. *Effort M.*

---

## 5. Roadmap séquencée

**NOW (avant fin juillet) — colmater + réserver sa place**
1. C1 magic-link post-paiement (bug) · 2. D2 instrumentation funnel ·
3. C2 contact + SIRET · 4. D1a relance impayés · 5. B1 config Cloudflare
agents (avant le 15/09) · 6. D3 capture emails pages froides.

**NEXT (août-septembre) — la fondation acquisition**
7. A1 pages produit SSR (prérequis de tout) · 8. B2 feed produit +
Merchant Center · 9. D1b-e Brevo automatisations complètes · 10. C3
calculateur container · 11. A5 mesure visibilité IA (baseline avant AI
Mode France).

**LATER (T4 2026) — la référence**
12. A3 baromètre #1 + dossier presse (A2) · 13. A4 landings/définitions ·
14. D4 drop containers · 15. B4 serveur MCP marchand · 16. B5 paiements
échelonnés · 17. C4 assistant d'achat (si trafic).

**Ce qu'on arrête / n'attend plus** : espérer des citations via llms.txt
(on le garde, coût nul) ; ajouter du JSON-LD « pour les IA » au-delà du
nécessaire Google/feeds ; les endpoints de checkout in-chat (pivot OpenAI
mars 2026) — on y reviendra si un standard gagne.

---

*Rapports sources : audit funnel (analyse code complète, file:ligne),
recherche GEO/AEO (24 affirmations sourcées), commerce agentique (24
affirmations sourcées), browsers agentiques (20 affirmations sourcées),
achat B2B & IA (20 affirmations sourcées) — session Claude Code du
05/07/2026. Les URLs des sources figurent dans les rapports d'agents de la
session ; re-vérifier avant toute citation publique.*
