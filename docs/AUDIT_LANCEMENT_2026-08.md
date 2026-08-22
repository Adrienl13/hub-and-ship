# Audit pré-lancement terrassea.com — 22 août 2026

Audit multi-agents (5 axes : fuites de données, sécurité, fonctionnel,
cohérence de marque, readiness publicité) avant la mise en ligne sur
terrassea.com et le démarrage des campagnes (OpenAI Ads en premier).

Verdict global : **le code est prêt**. Il reste **une action bloquante côté
Adrien** (repo GitHub privé) et quelques actions d'infrastructure listées en
fin de document.

---

## 1. BLOQUANT avant toute publicité — actions Adrien

| # | Action | Pourquoi |
|---|--------|----------|
| 1 | **Passer `Adrienl13/hub-and-ship` en PRIVÉ** (Settings → General → Danger Zone → Change visibility) | Le repo est public : marges d'achat (0.90/0.40/0.28), plancher 0.15, valeurs de contrôle du moteur (landed 33.78 → 64.18/47.29/43.23) et références usine lisibles par n'importe qui — dont un concurrent ou un client qui remonte la marge. Aucun fork constaté, aucun secret dans l'historique : passer en privé suffit, pas besoin de réécrire l'historique. |
| 2 | **Vérifier `terrassea-project-hub`** (l'autre repo public) et le passer en privé aussi | Même exposition potentielle. |
| 3 | **Appliquer la migration 23** (`20260822120000_prelaunch_hardening.sql`, SQL Editor) | Durcissements DB décrits §3. Les migrations 20/21/22 doivent être passées avant si ce n'est pas déjà fait (voir RUNBOOK_FUSION_DEPLOY). |

## 2. Corrigé dans le code (ce commit et les précédents de la session)

### Fuites / anonymisation
- **Économie des canaux isolée** : les taux de marge (`CHANNEL_MARGIN_RATES`,
  `channelCoefficientFromMargins`) sont sortis du module client
  `pricing/channel.ts` vers `pricing/channel-economics.ts` (admin only). Le
  bundle public n'expose que les coefficients finaux — qui sont de toute façon
  déductibles des prix affichés à chaque canal.
- **Scan anti-fuite au build** : `scripts/check-bundle-budget.mjs` (exécuté
  après chaque build par le hook) échoue désormais si un chunk client contient
  les marges en dur, un nom de fournisseur ou un SKU usine `ZF####`. Vérifié :
  0 fuite sur 175 chunks.
- **Références usine neutralisées** dans le repo : test de slug et exemples du
  script d'import passent sur des références fictives ; `.env.example` n'expose
  plus le project-ref Supabase réel.
- **Migration 23** : si un produit porte encore le SKU usine `ZF2000C` en
  public (URLs, feed Merchant, JSON-LD), il est re-stampé `TSA-CHR-001` ; le
  SKU témoin du moteur de prix pointe l'id produit (opaque). ⚠️ L'ancien slug
  `…-zf2000c` cessera de résoudre — sans impact avant lancement.

### Sécurité
- **`stock_requests`** : l'INSERT public ne peut plus fixer un statut avancé ni
  écrire `internal_note` (migration 23).
- **`subscribe_container_notification`** : bornes de longueur email/source
  (migration 23).
- **Cron relances** : comparaison du `x-cron-secret` en temps constant.
- Rate limiting applicatif déjà en place sur les API publiques ; CSP en
  report-only (choix assumé, voir §4).

### Fonctionnel
- **Feed Merchant** (`/product-feed.xml`) : ne sert plus JAMAIS le catalogue
  mock — Supabase non configuré ou DB en erreur ⇒ 503 + `Retry-After`, au lieu
  d'annoncer des produits fictifs à Google/Bing/surfaces IA. Les pages SEO
  gardent leur fallback statique (mieux vaut une page rendue qu'une 500).
- **Conversion Stripe tracée côté serveur** : le webhook logge
  `reservation paid` (référence, montant, session) — seul signal fiable si les
  analytics client sont bloqués.
- **CTA « Réserver » de la home** : panier vide ⇒ redirection /catalogue au
  lieu d'ouvrir un dialogue de réservation vide (header, section CTA finale,
  barre mobile).
- **Compteur de participants** : masqué à 0 au lieu d'afficher « 0 pros
  engagés » (données honnêtes : `seriesReached 0/5`, plus de chiffres
  inventés).
- Audit fonctionnel : 35/35 parcours passés, 0 lien mort, 0 erreur console,
  pas de débordement mobile.

### Marque & textes (« Terrassea est une marque de Pros Import »)
- Footer : « Une marque de Pros Import EURL » + phrase de contractualisation.
- JSON-LD Organization : `name` Terrassea, `legalName` Pros Import EURL,
  SIRET/SIREN/TVA, `alternateName` Container Club (continuité d'entité).
- Mentions légales : « site Terrassea », emails publics unifiés sur
  adrienlaniez1@gmail.com.
- Devis PDF, feed (`g:brand`), avis produits, catalogue : Terrassea partout.
- Le domaine reste prosimport.com jusqu'au jour J — bascule par
  `scripts/flip-domaine-terrassea.sh` (voir RUNBOOK_REBRANDING_TERRASSEA,
  étape 0 : déplacer d'abord le site « terrasse hub » vers TerrasseaHUB.com).

### Readiness publicité (OpenAI Ads inclus)
- **Attribution first-touch complète** : utm_source/medium/campaign +
  partner_ref capturés (TTL 90 j) et rattachés aux réservations, demandes
  stock, candidatures partenaires **et désormais au formulaire de contact**
  (ligne « Source » dans l'email admin). Une campagne OpenAI Ads taguée
  `?utm_source=openai&utm_medium=ads&utm_campaign=…` est traçable de bout en
  bout quel que soit le point de conversion.
- robots.txt + llms.txt ouverts aux crawlers IA (OAI-SearchBot compris), feed
  Merchant compatible avec chatgpt.com/merchants.

## 3. Migration 23 — contenu exact

`supabase/migrations/20260822120000_prelaunch_hardening.sql` : policy INSERT
`stock_requests` resserrée, bornes `subscribe_container_notification`,
re-stamp conditionnel `ZF2000C → TSA-CHR-001` + SKU témoin → id produit.
No-op si le produit n'existe pas ou si le SKU cible est déjà pris.

## 4. Surveillé, volontairement non corrigé

- **CSP en report-only** : passage en enforce reporté après le lancement (le
  risque de casser Stripe/Supabase en prod dépasse le gain immédiat).
- **Fallback v5 base-price** : garde théorique sans impact actuel, documentée.
- **`g:shipping`** : se configure au niveau du compte Merchant, pas du feed.
- **utm_term / click_id** : extension possible après les premières campagnes.

## 5. Checklist infra avant les premières campagnes (côté Adrien)

1. Repo(s) GitHub → **privés** (§1 — bloquant).
2. Migration 23 dans le SQL Editor (après 20/21/22).
3. Cloudflare : **AI Crawl Control → Allow** pour les bots IA avant le
   2026-09-15 ; **WAF rate limit** sur `/api/*` (le rate limit applicatif
   existe mais une règle edge coûte moins cher en cas d'abus).
4. Merchant Center : livraison configurée au niveau du compte, soumettre
   `https://prosimport.com/product-feed.xml`.
5. `VITE_APP_NAME=Terrassea` dans les variables de déploiement.
6. Photos par design : les variantes sans photo affichent l'image principale +
   pastille « Perso » — uploader les vraies photos quand disponibles.
7. Jour J domaine : étape 0 (terrasse hub → TerrasseaHUB.com), puis
   `bash scripts/flip-domaine-terrassea.sh` + étapes infra du runbook
   rebranding (Search Console « Changement d'adresse », Stripe, Supabase Auth,
   Brevo, Instagram).
