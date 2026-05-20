# CLAUDE.md

Guide de référence pour Claude Code (et tout autre agent IA) travaillant sur ce dépôt.

## Objectif du projet

**Container Club Terrassea** — plateforme web pour le club d'achat groupé de Terrassea. Les membres réservent des produits (terrasse, mobilier, etc.) qui sont ensuite livrés ensemble par container, ce qui réduit le coût d'expédition par commande. Le site présente les containers en cours, gère les réservations et expose un récapitulatif des containers passés.

Indices côté code : `ContainerScene`, `OrderSidebar`, `ReservationDialog`, `PastContainers`, `ProductRow`, `lib/order.ts`, `lib/quote.ts`.

## Stack

- **Framework** : TanStack Start (full-stack React, file-based routing via `@tanstack/react-router`)
- **Build** : Vite 7
- **Runtime cible** : Cloudflare Workers (`@cloudflare/vite-plugin`, config dans `wrangler.jsonc`, entrée serveur `src/server.ts`)
- **UI** : React 19 + TypeScript 5
- **Styling** : Tailwind CSS v4 (`@tailwindcss/vite`) + `tw-animate-css`
- **Composants** : shadcn/ui (style `new-york`, base `slate`, icônes `lucide-react`) — voir `components.json`
- **Data / forms** : TanStack Query, React Hook Form + Zod, `@hookform/resolvers`
- **3D / animations** : `@react-three/fiber`, `@react-three/drei`, `three`, `framer-motion`
- **Package manager** : **Bun** (présence de `bun.lock` — pas de `package-lock.json` ni `pnpm-lock.yaml`)

### Scripts

```
bun install          # installer les deps
bun run dev          # serveur de dev Vite (port 8080)
bun run build        # build de production
bun run build:dev    # build en mode development
bun run preview      # prévisualiser le build
bun run lint         # ESLint sur tout le repo
bun run format       # Prettier --write
```

## Structure

```
src/
  routes/            # routes TanStack Router (file-based)
    __root.tsx       # layout racine
    index.tsx        # /
  routeTree.gen.ts   # GÉNÉRÉ — ne jamais éditer à la main
  router.tsx         # config du router
  server.ts          # entrée Cloudflare Worker
  start.ts           # bootstrap TanStack Start
  components/
    ui/              # primitives shadcn/ui (ne pas réécrire à la main, passer par `npx shadcn add`)
    *.tsx            # composants applicatifs
  hooks/
  lib/               # logique partagée non-React (order, products, quote, utils, error-*)
  styles.css         # entrée Tailwind + variables CSS
```

### Alias d'import

Configurés dans `tsconfig.json` et `components.json` :

- `@/components` → `src/components`
- `@/components/ui` → primitives shadcn
- `@/lib` → `src/lib` (utils via `@/lib/utils`)
- `@/hooks` → `src/hooks`

**Toujours** utiliser ces alias. Pas de chemins relatifs profonds (`../../../`).

## Conventions de code

### TypeScript / React

- TypeScript **strict** — pas de `any` implicite, préférer `unknown` à `any` quand le typage est inconnu
- React 19 + composants fonctionnels uniquement, hooks en haut, pas de classes
- Server-only : ne **pas** importer `server-only` (Next.js) — soit nommer le module `*.server.ts`, soit utiliser `@tanstack/react-start/server-only` (règle ESLint qui le force)
- `react-refresh/only-export-components` est en `warn` — un fichier de composant n'exporte idéalement qu'un composant (les `const` constants exportées sont tolérées)
- Préférer les composants déclarés en `function Foo() {}` ou `const Foo = () => {}` côté UI, peu importe tant que c'est cohérent dans le fichier
- Données fetched côté client → TanStack Query. Pas d'`useEffect` + `fetch` à la main
- Formulaires → React Hook Form + schéma Zod via `zodResolver`

### Styling

- **Tailwind v4** uniquement. Pas de CSS modules, pas de styled-components
- Variables CSS exposées via `styles.css` (theming shadcn)
- Composer les classes avec `cn()` (`@/lib/utils`) qui combine `clsx` + `tailwind-merge`
- Variants de composants → `class-variance-authority` (`cva`)
- Icônes → `lucide-react` uniquement

### Formatage (Prettier)

Configuré dans `.prettierrc` :

- `printWidth: 100`
- `semi: true`
- `singleQuote: false` → **guillemets doubles**
- `trailingComma: "all"`

Lancer `bun run format` avant chaque commit.

### Lint

- ESLint + `typescript-eslint` + `eslint-plugin-react-hooks` + Prettier intégré
- `@typescript-eslint/no-unused-vars` est désactivé — utiliser un préfixe `_` reste une bonne pratique pour signaler l'intention
- Toute erreur lint doit être corrigée, pas désactivée via `eslint-disable` sauf justification écrite

### Nommage

- Composants : `PascalCase.tsx` (`OrderSidebar.tsx`)
- Hooks : `useCamelCase.ts`
- Modules `lib/` : `kebab-case.ts` (`error-capture.ts`)
- Routes : nom du fichier = segment d'URL (convention TanStack Router file-based)

## Workflow Git

### Branches

- `main` — production, déployée sur Cloudflare. **Jamais de push direct.**
- `feat/<slug>` — nouvelle fonctionnalité (ex : `feat/order-summary`)
- `fix/<slug>` — correction de bug
- `chore/<slug>` — outillage, deps, config
- `refactor/<slug>` — refonte sans changement fonctionnel
- `docs/<slug>` — documentation

### Commits (Conventional Commits)

Format : `<type>(<scope>): <description>` à l'impératif, ≤ 72 caractères.

Types : `feat`, `fix`, `chore`, `refactor`, `docs`, `style`, `test`, `perf`, `build`, `ci`.

Exemples :

```
feat(order): add reservation dialog with Zod validation
fix(hero): correct CTA alignment on mobile
chore(deps): bump @tanstack/react-router to 1.168
```

Garder un commit = un changement logique. Pas de "wip", pas de "fix typo" après le merge — squash avant.

### Pull Requests

- Une PR = une intention. Si le diff dépasse ~400 lignes, envisager un découpage
- Titre = même format qu'un commit
- Description : **Quoi**, **Pourquoi**, **Comment tester** (3 sections courtes)
- Avant d'ouvrir : `bun run lint && bun run format && bun run build` doivent passer
- Self-review du diff avant de demander une review humaine

### Avant de pusher

1. `bun run lint`
2. `bun run format`
3. Tester localement (`bun run dev`)
4. Vérifier `wrangler.jsonc` si la modif touche le runtime serveur

## Supabase — projet autorisé

**⚠️ INTERDICTION ABSOLUE** d'utiliser le projet Supabase **TerrasseaHUB** (`gwgcfgeouropcighpztj`). Aucune lecture, écriture, migration ou listing autorisée sur ce projet.

Le **seul** projet Supabase autorisé pour hub-and-ship est :

- **Project ref : `mkfztwibolswqcggukeq`**

Le serveur MCP scopé à ce projet est configuré dans le repo via :

```
claude mcp add --scope project --transport http supabase "https://mcp.supabase.com/mcp?project_ref=mkfztwibolswqcggukeq"
```

Authentification : `claude /mcp` dans un terminal régulier (pas l'extension IDE).

**Règle d'usage côté agent :**

- Avant tout appel `mcp__claude_ai_Supabase__*`, vérifier que `project_id` vaut bien `mkfztwibolswqcggukeq`. Sinon, **annuler** et alerter l'utilisateur.
- Ne jamais se rabattre sur un MCP Supabase non scopé qui pourrait pointer vers TerrasseaHUB.
- Si l'auth n'est pas encore faite, **mettre en pause** toute opération Supabase et demander à l'utilisateur de lancer `claude /mcp`.

## Notes Cloudflare Workers

- L'entrée Worker est `src/server.ts` (champ `main` dans `wrangler.jsonc`)
- `compatibility_flags: ["nodejs_compat"]` est actif — APIs Node basiques OK, mais préférer les Web APIs (`fetch`, `crypto.subtle`, etc.)
- Pas de filesystem, pas de longs `setTimeout`, attention aux limites CPU des Workers
- Variables d'environnement / secrets : via `wrangler secret put`, jamais en clair dans le repo
- Toute logique strictement serveur va dans un module `*.server.ts` ou marqué `@tanstack/react-start/server-only`

## Mode autonome — contrat agent

Sur ce projet, l'agent (Claude Code ou équivalent) opère en **mode autonome** : il agit d'abord, rend compte ensuite. Pas de demande de permission pour les actions routinières et réversibles. La rigueur vient des phases de travail et des garde-fous explicites ci-dessous, pas du nombre de questions posées à l'utilisateur.

### Actions autorisées sans confirmation

- Lecture / écriture / édition de fichiers du repo
- `bun install`, `bun run lint`, `bun run format`, `bun run build`, `bun run dev`
- Création de branches locales, commits (Conventional Commits)
- Refactors, ajout/suppression de composants, migrations de schémas Zod
- Tests locaux, lancement de scripts npm/bun
- Spawn d'agents (Explore, Plan, general-purpose, etc.) en parallèle quand pertinent
- Recherche documentaire (WebFetch, context7) et exploration de code

### Actions qui nécessitent **toujours** une confirmation

- `git push` vers `main` ou toute branche distante partagée
- Création / merge / fermeture de Pull Request
- Déploiement Cloudflare Workers (`wrangler deploy`)
- Gestion de secrets (`wrangler secret put`, fichiers `.env*`)
- Opérations destructives : `rm -rf`, `git reset --hard`, `git push --force`, suppression de branche, `git clean -fd`
- Modification de `wrangler.jsonc`, `package.json` (deps majeures), ou de la config CI
- Tout appel à un système externe non-idempotent (envoi d'email, paiement, API tierce en écriture)

### Workflow standard — phases obligatoires

Pour toute tâche de développement non triviale (>15 min ou >2 fichiers touchés), l'agent enchaîne ces phases dans l'ordre :

1. **Comprendre** — lire le code existant pertinent, relire la demande, identifier le parcours client impacté. Spawn d'`Explore` si la zone est inconnue.
2. **Planifier** — sortir un plan court (3-7 étapes) avec les fichiers à toucher et les risques. Spawn de `Plan` pour les changements à fort impact architectural.
3. **Implémenter** — coder par petits incréments. Préférer plusieurs commits atomiques à un gros commit fourre-tout.
4. **Auditer** _(étape sécurité)_ — relire son propre diff avec les questions :
   - Y a-t-il une fuite de secret, un input non validé, une injection possible ?
   - Le code respecte-t-il TS strict ? Pas d'`any`, pas de `as unknown as` douteux ?
   - Les hooks React sont-ils stables (deps array correctes, pas de re-render inutile) ?
   - Le code tourne-t-il dans le runtime Workers (pas de `fs`, pas de `process.cwd`, etc.) ?
   - Les composants UI restent-ils accessibles (labels, aria, focus management) ?
5. **Tester** _(étape essai)_ — `bun run lint && bun run build` doivent passer. Lancer `bun run dev` et vérifier manuellement le parcours impacté (ou demander à l'utilisateur de valider visuellement si l'UI a changé).
6. **Repérer les opportunités** _(étape ouverture)_ — noter en fin de rapport :
   - Code dupliqué détecté en chemin
   - Composant UI réutilisable extractible
   - Régression ou anti-pattern repéré ailleurs dans le repo
   - Optimisation de performance évidente (bundle, requêtes, re-renders)
   - Amélioration UX ou de parcours client identifiable
     Ces opportunités ne sont **pas** implémentées dans la même tâche (cf. "Don't add features beyond what the task requires") — elles sont **listées** pour décision séparée.
7. **Comprendre le chemin client** _(étape parcours)_ — pour toute modif touchant l'UI ou la logique de réservation/commande, rappeler explicitement le parcours impacté :
   - Découverte → Sélection produit → Réservation → Paiement → Confirmation → Suivi → Livraison
     Et signaler si la modif crée un point de friction, casse une étape, ou ouvre une opportunité de simplification.
8. **Rendre compte** — résumé final structuré : **Fait** / **Vérifié** / **Opportunités détectées** / **Demandes de confirmation restantes**.

### Usage des sous-agents

- **Explore** — toute recherche multi-fichiers de plus de 3 requêtes
- **Plan** — pour les chantiers structurels (nouvelle route, refactor majeur, intégration tierce)
- **general-purpose / claude** — implémentation en parallèle quand les tâches sont indépendantes
- **Lancer plusieurs agents en parallèle** dans un seul message si les travaux n'ont pas de dépendance entre eux
- Ne jamais sous-traiter la **synthèse** ou la **décision** à un agent : l'agent principal lit les rapports et tranche

### Garde-fous d'audit (rappel rapide)

Avant chaque commit, l'agent vérifie mentalement :

- [ ] Aucune clé / token / mot de passe en clair dans le diff
- [ ] Aucun `console.log` de debug oublié
- [ ] Pas de `TODO` sans ticket
- [ ] Lint et build passent
- [ ] Le diff fait **une seule chose** logique
- [ ] Le message de commit suit Conventional Commits

## Ce qu'il ne faut pas faire

- Pas de `npm install` / `pnpm install` — **uniquement `bun`** (sinon désynchro du lockfile)
- Ne pas éditer `src/routeTree.gen.ts` (régénéré automatiquement)
- Ne pas réécrire à la main les composants `src/components/ui/*` — passer par la CLI shadcn ou les regénérer
- Ne pas committer `.env*`, `dist/`, `.output/`, `.vinxi/`, `node_modules/`
- Ne pas introduire de lib UI concurrente (MUI, Chakra, Ant…) — l'écosystème reste Tailwind + Radix + shadcn
- Ne pas désactiver des règles ESLint sans commentaire justifiant pourquoi
