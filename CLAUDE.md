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

## Notes Cloudflare Workers

- L'entrée Worker est `src/server.ts` (champ `main` dans `wrangler.jsonc`)
- `compatibility_flags: ["nodejs_compat"]` est actif — APIs Node basiques OK, mais préférer les Web APIs (`fetch`, `crypto.subtle`, etc.)
- Pas de filesystem, pas de longs `setTimeout`, attention aux limites CPU des Workers
- Variables d'environnement / secrets : via `wrangler secret put`, jamais en clair dans le repo
- Toute logique strictement serveur va dans un module `*.server.ts` ou marqué `@tanstack/react-start/server-only`

## Ce qu'il ne faut pas faire

- Pas de `npm install` / `pnpm install` — **uniquement `bun`** (sinon désynchro du lockfile)
- Ne pas éditer `src/routeTree.gen.ts` (régénéré automatiquement)
- Ne pas réécrire à la main les composants `src/components/ui/*` — passer par la CLI shadcn ou les regénérer
- Ne pas committer `.env*`, `dist/`, `.output/`, `.vinxi/`, `node_modules/`
- Ne pas introduire de lib UI concurrente (MUI, Chakra, Ant…) — l'écosystème reste Tailwind + Radix + shadcn
- Ne pas désactiver des règles ESLint sans commentaire justifiant pourquoi
