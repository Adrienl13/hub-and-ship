# 🚀 Prompt initial pour Claude Code

> Copie tout le contenu ci-dessous (entre les triples backticks) et colle-le dans Claude Code après avoir installé le starter.

---

## 📋 Le prompt à copier

```
Tu vas implémenter Container Club, plateforme B2B de pré-commande groupée
de mobilier outdoor par container maritime.

CONTEXTE PROJET
Importateur officiel France (Terrassea SAS). Cible 2-3 containers/mois.
Cible utilisateurs : hôtels, restaurants, paysagistes, revendeurs B2B.

LIS D'ABORD CES FICHIERS DANS L'ORDRE (obligatoire) :
1. .claude/context.md (règles projet, lu auto par toi normalement)
2. docs/PROGRESS.md (état actuel)
3. docs/CHANGELOG.md (versions spec v1.0 → v1.3)
4. docs/DECISIONS.md (12 décisions techniques actées)

CONFIRME en 5 lignes max :
- Quelle est la phase actuelle
- Quelles sont les prochaines tâches
- Si tu as identifié des questions à me poser avant de commencer

PUIS ATTAQUE LA SESSION 0 : INITIALISATION DU PROJET

OBJECTIF SESSION 0 : créer la structure de fichiers complète, initialiser
les configs, installer les dépendances, faire les premiers commits.
SANS connexion aux services externes (Supabase prod, Stripe, etc.) —
on fera ça plus tard.

PLAN D'EXÉCUTION (suis-le pas à pas, fais des commits après chaque étape) :

ÉTAPE 1 — Vérification environnement
- Vérifie node version (≥20), npm, git installés
- Vérifie qu'on est bien dans un repo Git initialisé
- Si problèmes, signale-les et arrête

ÉTAPE 2 — Création structure de dossiers
Crée toute l'arborescence selon section 4.2 du brief :
- src/routes/, src/components/, src/lib/, src/stores/, src/hooks/, etc.
- supabase/migrations/, supabase/functions/, supabase/seed.sql
- tests/unit/, tests/integration/, tests/e2e/, tests/security/
- public/, .vscode/, .github/workflows/
- Lis docs/CONTAINER_CLUB_SPEC.md section 4.2 pour la structure exacte
Commit : "chore(structure): create project folder structure"

ÉTAPE 3 — package.json depuis template
- Utilise .templates/package.json.template comme base
- Ajoute toutes les scripts npm de docs/SCRIPTS.md
- Vérifie le contenu, propose à l'utilisateur si OK
- Pose une question si tu hésites sur une version
Commit : "chore(deps): initialize package.json"

ÉTAPE 4 — Configs TypeScript / Tailwind / Vite / Vitest
- tsconfig.json depuis template (strict: true obligatoire)
- tailwind.config.ts depuis template (palette section 15.1 du brief)
- vite.config.ts pour TanStack Start
- vitest.config.ts (avec setup tests + coverage)
- playwright.config.ts
- .eslintrc.cjs strict
- .prettierrc
Commit : "chore(config): add typescript, tailwind, vite, vitest, eslint configs"

ÉTAPE 5 — Variables d'environnement
- .env.example depuis template avec TOUTES les variables (section 4.3 brief)
- .env.local vide (gitignored, juste créer le fichier)
- .gitignore depuis template (incluant .env*, node_modules, etc.)
- README mentionnant comment configurer les .env
Commit : "chore(env): add env templates and gitignore"

ÉTAPE 6 — Pre-commit hooks
- Installe husky
- Setup pre-commit : npm run check + gitleaks
- Setup commit-msg : conventional commits enforcement
Commit : "chore(hooks): setup husky pre-commit and commit-msg hooks"

ÉTAPE 7 — Installation dépendances
Installe toutes les dépendances du projet :

Frontend core :
- @tanstack/start, @tanstack/router, react, react-dom, typescript
- tailwindcss, @tailwindcss/forms, @tailwindcss/typography
- @radix-ui/* (shadcn deps)
- lucide-react, clsx, tailwind-merge
- zustand, @tanstack/react-query

Forms & validation :
- react-hook-form, @hookform/resolvers, zod

Backend & services :
- @supabase/supabase-js, @supabase/ssr
- stripe, @stripe/stripe-js, @stripe/react-stripe-js
- resend

3D & média :
- three, @react-three/fiber, @react-three/drei

Tests :
- vitest, @vitest/ui, @testing-library/react, @testing-library/jest-dom
- @playwright/test, msw
- @testing-library/user-event

Dev tools :
- @types/react, @types/node
- eslint, prettier, eslint-config-prettier, eslint-plugin-react
- husky, lint-staged
- @types/three

Lance npm install. Si erreurs de peer deps, arrête-toi et signale-moi.
Commit : "chore(deps): install all dependencies"

ÉTAPE 8 — Setup shadcn/ui
- Initialise shadcn/ui (npx shadcn@latest init)
- Installe les composants de base : button, input, label, dialog,
  sheet, toast, dropdown-menu, select, checkbox, radio-group,
  accordion, card, badge, alert, separator, tabs
Commit : "feat(ui): setup shadcn/ui with base components"

ÉTAPE 9 — Examples de référence
Examine examples/ qui contient :
- examples/lib/pricing/tiers.example.ts (style de code attendu)
- examples/components/ui/Button.example.tsx
- examples/tests/security/access-control.example.test.ts
- examples/migrations/0001_init.example.sql

Utilise-les comme références de style et qualité pour ton propre code.

ÉTAPE 10 — Premier code métier : src/lib/pricing/tiers.ts
- Implémente avec tests Vitest exhaustifs
- Suis la section 6.1 du brief
- Inspire-toi de examples/lib/pricing/tiers.example.ts
- Tests doivent couvrir : nominal, edge cases, précision décimale
Commit : "feat(pricing): add tiered pricing logic with tests"

ÉTAPE 11 — Documentation initiale
- README.md à la racine du projet (depuis template, adapté)
- docs/ARCHITECTURE.md (résumé technique du brief)
- Update docs/PROGRESS.md : marquer Session 0 comme terminée
Commit : "docs: add README and update progress"

ÉTAPE 12 — Validation finale
Lance dans l'ordre :
- npm run typecheck (doit passer)
- npm run lint (doit passer)
- npm test (doit passer)
- npm run build (doit passer)

Si quelque chose échoue, débug avant de continuer.

Commit final : "chore: complete session 0 - project initialization"

RÈGLES IMPORTANTES PENDANT TOUTE LA SESSION
1. TypeScript strict : JAMAIS de "any", JAMAIS de @ts-ignore
2. Commits atomiques avec format Conventional Commits
3. Demande confirmation AVANT toute action listée comme "demande avant"
   dans .claude/context.md
4. Si tu hésites, pose-moi la question
5. Si un fichier dépasse 300 lignes, split-le
6. Update docs/PROGRESS.md à chaque étape complétée
7. Si tu prends une décision technique non triviale, ajoute-la dans
   docs/DECISIONS.md
8. Si tu rencontres un bug récurrent, documente-le dans docs/KNOWN_ISSUES.md

À LA FIN DE LA SESSION 0
Affiche un résumé :
- Étapes réalisées
- Commits effectués (git log)
- Fichiers créés (compte)
- Tests passants
- Prochaines étapes (Session 1 = Phase 1.2 Supabase)
- Questions ouvertes ou points d'attention

NE VA PAS PLUS LOIN QUE L'INITIALISATION DANS CETTE PREMIÈRE SESSION.
On attaquera Supabase + logique métier complète dans la session 1.

C'est parti.
```

---

## 🎯 Conseils d'utilisation du prompt

### Première fois

Colle le prompt entier dans Claude Code. Laisse-le travailler. Il va probablement te poser 2-3 questions au début, puis enchaîner les étapes.

**Durée estimée Session 0** : 30-60 minutes selon ton réseau (npm install peut prendre 5-10 min).

### Si Claude Code va trop vite

Dis-lui :

```
Stop. Avant d'aller plus loin, montre-moi le diff complet et attends ma validation.
```

### Si Claude Code se trompe

Pour annuler les derniers commits :

```bash
# Voir les commits
git log --oneline -10

# Annuler les 3 derniers commits SANS perdre les modifs
git reset --soft HEAD~3

# Ou réinitialiser complètement (DANGER, perte modifs)
git reset --hard HEAD~3
```

### Pour les sessions suivantes

Après Session 0, tu n'as plus besoin de ce gros prompt. Démarre simplement avec :

```
Continue depuis docs/PROGRESS.md. Phase 1 — étape suivante.
```

Claude Code lira PROGRESS.md et saura quoi faire.

---

## ⚠️ Points d'attention

### Pour les commandes shadcn

Si Claude Code essaie d'installer shadcn et ça échoue, c'est probablement à cause de la commande exacte. La commande correcte en 2026 est :

```bash
npx shadcn@latest init
npx shadcn@latest add button input label dialog sheet
```

Pas `shadcn-ui` (ancienne version). Si Claude Code se trompe, corrige-le.

### Pour TanStack Start

C'est un framework récent. Si Claude Code n'est pas à jour, il pourrait utiliser des patterns Next.js. Surveille la création des routes :

- Route file-based dans `src/routes/`
- Format `src/routes/__root.tsx`, `src/routes/index.tsx`, `src/routes/products/$id.tsx`

Documentation : https://tanstack.com/start/latest

### Pour Tailwind v4

Tailwind v4 utilise une nouvelle config (`@import "tailwindcss"` dans CSS au lieu de `tailwind.config.js` legacy). Vérifie que Claude Code utilise la bonne syntaxe.

---

## 💡 Tips pour économiser des tokens

### Bonne pratique

```
Continue depuis docs/PROGRESS.md
```

→ ~8k tokens

### Moins bien

```
Voici tout le contexte de mon projet [colle 5100 lignes du brief]...
```

→ ~50k tokens (gaspillage)

### Idéal pour une question ciblée

```
Question sur section 6.8 du brief (validation SIRET) :
comment gérer le cas où l'API INSEE est down pendant le checkout ?
```

→ Claude Code va lire UNIQUEMENT cette section. ~3k tokens.

---

## 📊 Économie totale attendue

Sur l'ensemble du projet (Phase 1 à 8, ~10 semaines) :

| Sans tooling     | Avec tooling     | Économie  |
| ---------------- | ---------------- | --------- |
| ~500$ API Claude | ~150$ API Claude | **~350$** |

Plus rapide à exécuter, moins cher, code de meilleure qualité grâce aux examples de référence.

---

**Bon courage pour Container Club ! 🚢**
