# Runbook — Accueillir les crawlers & agents IA (Cloudflare)

> Pourquoi : le trafic référé par l'IA convertit **+42 % mieux** que le
> trafic classique (Adobe, T1 2026) et la découverte produit se déplace vers
> ChatGPT/Perplexity/Gemini. Or **Cloudflare bloque par défaut les crawlers
> IA « training » et « agent » à partir du 15 septembre 2026** sur les
> nouvelles zones et pousse ce réglage partout. Être lisible par les agents
> devient un choix d'infrastructure explicite — c'est le nôtre.

## Décision

Container Club **accueille** : les crawlers de recherche IA (citations =
acquisition) et les agents d'achat (browsers agentiques, shopping agents).
Le crawl « training » est aussi autorisé (être dans les données d'entraînement
= la marque existe dans la connaissance des modèles). Les pages privées
restent protégées par l'auth + `robots.txt` (`/account`, `/admin`, `/api`,
`/auth`, `/partner`, `/partenaire`).

## Checklist Cloudflare (dashboard — à faire une fois, AVANT le 15/09/2026)

1. **AI Crawl Control** (dashboard zone prosimport.com → AI Crawl Control /
   « AI Audit ») : vérifier que les catégories **Search** et **Agent** sont
   sur *Allow*. Mettre **Training** sur *Allow* (décision ci-dessus).
2. **Pay-per-crawl** : laisser désactivé (on veut être crawlé, pas le
   monétiser).
3. **Bot Fight Mode / Super Bot Fight Mode** : vérifier qu'il ne challenge
   pas les bots vérifiés — les crawlers IA vérifiés (GPTBot, OAI-SearchBot,
   ClaudeBot, PerplexityBot, Google-Extended, Bingbot) doivent passer sans
   challenge JS (un challenge = page vide pour un crawler).
4. **WAF custom rules** : aucune règle ne doit matcher les User-Agents
   ci-dessous en « block/challenge ».
5. **managed robots.txt** : si Cloudflare propose d'injecter des directives
   AI dans robots.txt, refuser — le nôtre (dans `public/`) fait foi.

## User-Agents à laisser passer

| Acteur | Crawlers |
|--------|----------|
| OpenAI | `GPTBot` (training), `OAI-SearchBot` (ChatGPT Search), `ChatGPT-User` (actions utilisateur / Atlas) |
| Anthropic | `ClaudeBot`, `Claude-User`, `Claude-SearchBot` |
| Perplexity | `PerplexityBot`, `Perplexity-User` (Comet) |
| Google | `Googlebot`, `Google-Extended` (Gemini), `Google-CloudVertexBot` |
| Microsoft | `Bingbot` (alimente ChatGPT Search) |

## Vérification (après config, puis 1×/trimestre)

```bash
# Le site doit répondre 200 avec le HTML complet (pas un challenge) :
curl -sI -A "GPTBot" https://prosimport.com/prix | head -3
curl -sI -A "PerplexityBot" https://prosimport.com/catalogue | head -3
curl -sI -A "ClaudeBot" https://prosimport.com/ | head -3
```

Dans le dashboard Cloudflare → Analytics/Radar : suivre le volume de crawl
par bot IA. Dans Plausible : suivre les referrers `chatgpt.com`,
`perplexity.ai`, `gemini.google.com` et leur conversion (événements funnel).

## À re-décider plus tard

- Si le crawl « training » explose sans retour mesurable → repasser Training
  sur Block, garder Search/Agent sur Allow.
- Quand Stripe Shared Payment Tokens / feed marchand ChatGPT seront activés,
  revalider que les endpoints concernés ne sont pas derrière un challenge.

## Apparaître dans Google « Mode IA » (constat 08/2026)

Constat : sur « je cherche des chaises bistrot parisienne pour mon
restaurant » et « donne-moi différents fournisseurs en France », le Mode IA
cite des concurrents (pages STYLE dédiées + fiches Merchant avec prix/stock)
mais pas prosimport.com.

Côté code (fait) :
- Landing style `/catalogue/chaises-bistrot-parisiennes` : reprend le cadre
  de décision que l'IA utilise déjà (rotin synthétique terrasse vs rotin
  naturel intérieur), prix d'entrée, MOQ, personnalisation coloris, FAQ
  JSON-LD + ItemList.
- Landing positionnement `/fournisseur-mobilier-chr` : phrase de définition
  citable (« importateur-fournisseur français de mobilier CHR… »), taxonomie
  fabricants/distributeurs/importateurs, Organization + FAQ JSON-LD.
- Sitemap + llms.txt à jour.

Côté Adrien (les VRAIS leviers, dans l'ordre) :
1. **Google Merchant Center** — le carrousel « In stock · 129 € » du Mode IA
   vient des fiches Merchant, pas du SEO. Créer le compte, brancher le flux
   `https://prosimport.com/product-feed.xml`, activer les fiches gratuites.
   C'est LE levier qui fait apparaître les produits avec prix.
2. **Cloudflare AI Crawl Control** — vérifier que Googlebot, Google-Extended
   et les bots IA (GPTBot, PerplexityBot, ClaudeBot) sont sur Allow (cf.
   sections précédentes de ce runbook) : un bot bloqué = zéro citation.
3. **Search Console** — soumettre les 2 sitemaps, demander l'indexation des
   2 nouvelles landings + `/prix` + `/guides/*`, corriger les éventuelles
   exclusions de couverture.
4. **Google Business Profile** — fiche établissement Pros Import (Paris)
   reliée au site : renforce l'entité citée par l'IA.
5. **Patience mesurée** — le Mode IA recompose ses sources sur plusieurs
   semaines ; suivre dans Plausible les referrers google.com/search (AI) et
   re-tester les requêtes de référence chaque semaine.

## IndexNow — signaler les changements à Bing (posé le 19/09/2026)

Bing réindexe en heures au lieu de semaines quand on lui signale l'URL.
Google n'utilise pas IndexNow, mais Bing alimente Copilot et une partie des
IA qui citent des sources : c'est un gain net de ce côté-là.

- **Clé** : `public/dad4d7620f7ce9f465ba22a0f9a13421.txt`, servie à la racine.
  Elle n'est **pas** un secret — le protocole EXIGE qu'elle soit publique
  pour prouver qu'on contrôle le domaine. Ne pas la supprimer : sans elle,
  Bing rejette toutes les soumissions. Un test vérifie que le fichier existe
  et contient exactement la clé.
- **Endpoint** : `POST /api/cron/indexnow`, protégé par `CRON_SECRET`
  (en-tête `x-cron-secret`), comme `/api/cron/payment-reminders`. C'est ce
  garde qui compte : sans lui, n'importe qui ferait soumettre 10 000 URLs en
  boucle et nous ferait limiter par Bing.

Deux usages :

```bash
# Passage complet : pages clés + toutes les fiches publiques.
curl -X POST https://prosimport.com/api/cron/indexnow \
  -H "x-cron-secret: $CRON_SECRET"

# Après avoir corrigé UNE fiche — réindexée dans l'heure.
curl -X POST https://prosimport.com/api/cron/indexnow \
  -H "x-cron-secret: $CRON_SECRET" -H "content-type: application/json" \
  -d '{"urls":["/catalogue/p/chaise-de-bistrot-vavin-sku-414"]}'
```

À brancher sur le même scheduler que les relances (`RUNBOOK_RELANCES.md`),
une fois par jour suffit pour le passage complet.

Réponses : `{ok:true, submitted:N, status:200|202}` — 202 signifie « clé en
cours de validation », c'est un succès. `503` = catalogue indisponible, on
ne soumet rien plutôt que de laisser croire que le passage a eu lieu.

**Non fait** : la vérification Bing Webmaster Tools (balise `msvalidate.01`).
Créer la propriété sur bing.com/webmasters, puis me donner le code.
