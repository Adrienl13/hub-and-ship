# Container Club — Contexte projet (lecture auto Claude Code)

> Ce fichier est lu AUTOMATIQUEMENT par Claude Code à chaque session.
> Placé dans `.claude/context.md` à la racine du repo.
> N'écris JAMAIS dans ce fichier directement, il est statique.

## 🎯 Identité du projet

**Container Club** est une plateforme B2B française de pré-commande groupée de mobilier outdoor par container maritime. Importateur officiel (Terrassea SAS), mutualise un container 20' HC entre 6-12 pros (hôtels, restaurants, paysagistes, revendeurs). Production usine déclenchée à 80% remplissage + 3 séries MOQ confirmées.

## 📁 Fichiers de référence (ordre de lecture obligatoire)

À chaque session, lis dans cet ordre :

1. **`docs/PROGRESS.md`** — État actuel du projet, où on en est
2. **`docs/CHANGELOG.md`** — Évolutions récentes de la spec
3. **`docs/DECISIONS.md`** — Décisions techniques déjà actées (ne pas redécider)
4. **`docs/KNOWN_ISSUES.md`** — Bugs connus et leurs workarounds
5. **`docs/CONTAINER_CLUB_SPEC.md`** — **UNIQUEMENT les sections nécessaires à la tâche en cours**, jamais en entier

⚠️ **Critique** : ne lis JAMAIS `docs/CONTAINER_CLUB_SPEC.md` en entier. Utilise grep/recherche pour cibler la section pertinente. Le fichier fait 5000+ lignes.

## 📚 Examples de référence (code qualité)

Pour comprendre le style de code attendu, consulte `examples/` :

- `examples/lib/pricing/tiers.example.ts` — Style logique métier
- `examples/lib/pricing/tiers.example.test.ts` — Style tests Vitest
- `examples/components/ui/Button.example.tsx` — Style composant React
- `examples/tests/security/access-control.example.test.ts` — Style tests sécurité
- `examples/migrations/0001_init.example.sql` — Style migration SQL

Lis `examples/README.md` pour plus d'infos.

## 🎯 Templates de fichiers

Pour initialiser des fichiers de config, utilise `.templates/` :

- `package.json.template`
- `tsconfig.json.template`
- `tailwind.config.template`
- `.env.example.template`
- `.gitignore.template`
- `README.md.template`

## 🛠️ Commandes essentielles

Voir `docs/SCRIPTS.md` pour la liste complète. Les plus utilisées :

- `npm run dev` — Dev local
- `npm test` — Tests Vitest
- `npm run test:security` — Tests sécurité
- `npm run typecheck` — Vérification TypeScript
- `npm run lint` — ESLint
- `./scripts/update-progress.sh` — Maj PROGRESS.md depuis Git log
- `npx supabase migration up` — Applique migrations DB
- `npx supabase functions deploy NAME` — Deploy Edge Function

## ⚡ Workflow obligatoire après chaque tâche

1. Tests passent ? (`npm test`)
2. TypeScript clean ? (`npm run typecheck`)
3. **Mettre à jour `docs/PROGRESS.md`** : marquer la tâche faite, lister fichiers créés
4. **Si décision technique non triviale** : ajouter entrée dans `docs/DECISIONS.md`
5. **Si bug rencontré** : ajouter dans `docs/KNOWN_ISSUES.md` avec workaround
6. Commit avec format Conventional Commits :
   - `feat: ` nouvelle feature
   - `fix: ` bugfix
   - `refactor: ` refacto sans changement fonctionnel
   - `test: ` ajout/modification tests
   - `docs: ` documentation
   - `chore: ` outillage, deps
   - Exemple : `feat(siret): add INSEE API verification with cache`

## 🔒 Règles non négociables

- TypeScript strict, jamais `any`, jamais `@ts-ignore`
- Pricing recalculé serveur, JAMAIS confiance client
- RLS sur toutes tables sensibles
- Validation Zod sur tous inputs API
- Pas de `dangerouslySetInnerHTML`
- Pas de secrets en clair (gitleaks pre-commit)
- Composants ≤ 300 lignes (sinon split)
- Tests Vitest sur toute logique métier (`src/lib/`)
- Mobile-first, touch targets ≥ 44px
- Accessibilité WCAG AA

## 🎨 Stack

Frontend : TanStack Start v1 + React 19 + TypeScript strict + Tailwind v4 + shadcn/ui + R3F + Zustand + TanStack Query + React Hook Form + Zod

Backend : Supabase (PostgreSQL + Auth + Realtime + Storage + Edge Functions) + Stripe + Resend

Hosting : Cloudflare Workers

DevOps : Vitest + Playwright + Plausible + Sentry + Dependabot + Snyk Free + gitleaks

## 📋 Phases de livraison (état détaillé dans PROGRESS.md)

1. Foundations + Sécurité (semaines 1-2)
2. Catalogue & Réservation (3-4)
3. Temps réel & Visibilité (5)
4. Espace client (6)
5. Admin (7)
6. Automatisations (8)
7. Pages secondaires & polish (9)
8. Beta privée & launch (10+)

## 🚨 Quand demander confirmation à l'utilisateur

Toujours demander avant :

- Modifier le schéma DB (migrations)
- Ajouter une dépendance npm majeure
- Modifier les politiques RLS
- Changer la logique de pricing
- Modifier les CGV ou clauses légales
- Désactiver un test
- Ignorer une erreur TypeScript

Jamais besoin de demander pour :

- Implémenter un composant selon spec
- Ajouter des tests
- Corriger un typage
- Refactorer un fichier interne

## 📞 En cas d'ambiguïté

Si la spec est ambigüe sur un point :

1. Cherche dans `docs/DECISIONS.md` si la question a déjà été tranchée
2. Cherche dans `examples/` si un pattern existe
3. Sinon, pose la question à l'utilisateur AVANT d'écrire du code
4. Une fois la décision prise, écris-la dans `docs/DECISIONS.md`

## 💰 Optimisation tokens

- Ne lis jamais le brief complet (`docs/CONTAINER_CLUB_SPEC.md`)
- Utilise grep ciblé pour trouver une section précise
- Référence-toi à `docs/PROGRESS.md` pour comprendre l'état actuel
- Économise les répétitions en utilisant `docs/DECISIONS.md` comme source
- Lis `examples/` quand c'est pertinent, pas systématiquement
