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
