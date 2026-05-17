# 📚 Examples — Code de référence qualité

> Ces fichiers sont des **références** pour Claude Code, pas des fichiers du projet final.
> Ils illustrent le niveau de qualité attendu et les patterns à respecter.

## 🎯 Utilisation

Claude Code consulte ces fichiers quand il a besoin de comprendre :
- Le style de code attendu
- Les patterns à respecter
- Le format des tests
- La structure des migrations SQL

**Ces fichiers NE sont PAS importés dans le projet final.** Ils restent dans `examples/` comme documentation vivante.

## 📁 Contenu

### `lib/pricing/tiers.example.ts`

Illustre :
- TypeScript strict avec types `readonly`
- Séparation types / fonctions / constantes
- Fonctions pures testables
- JSDoc complète
- Gestion précision décimale (centimes)
- Documentation des algorithmes complexes

À adapter pour : `src/lib/pricing/tiers.ts`

### `lib/pricing/tiers.example.test.ts`

Illustre :
- Tests Vitest exhaustifs
- Helpers de test réutilisables
- Couverture cas nominal + edge cases + précision
- Structure `describe` / `it` lisible
- Assertions précises avec `toBeCloseTo` pour les flottants

À adapter pour : `src/lib/pricing/tiers.test.ts`

### `components/ui/Button.example.tsx`

Illustre :
- Composant React avec `forwardRef`
- Variants via `class-variance-authority`
- Classnames composables (`twMerge` + `clsx`)
- Touch targets ≥ 44px (mobile-first)
- Accessibilité WCAG AA (aria-*, focus visible)
- Documentation JSDoc + exemples

À adapter pour : `src/components/ui/Button.tsx`

### `tests/security/access-control.example.test.ts`

Illustre :
- Tests d'isolation RLS Supabase
- Helpers de setup/teardown
- Patterns d'attaques courantes
- Tests cross-company critiques

À adapter pour : `tests/security/access-control.test.ts`

### `migrations/0001_init.example.sql`

Illustre :
- Conventions de nommage SQL
- Extensions PostgreSQL nécessaires
- Tables avec RLS systématique
- Index sur colonnes filtrées
- Triggers `updated_at` automatiques
- Commentaires explicatifs

À adapter pour : `supabase/migrations/0001_init_schema.sql`

## 🔄 Quand ces examples seront obsolètes ?

Une fois le projet stabilisé en Phase 7 :
- Les composants `src/components/` deviennent eux-mêmes les références
- Les tests `tests/` deviennent les références
- Le dossier `examples/` peut être supprimé ou archivé

D'ici là, gardons-les comme **filet de sécurité qualité**.

## ⚠️ Important pour Claude Code

Quand tu implémentes un nouveau composant/fonction :

1. Cherche d'abord s'il existe une référence dans `examples/`
2. Si oui, adapte ce pattern (ne réinvente pas)
3. Si non, crée du code dans le même esprit que les examples existants
4. Si tu crées quelque chose de réutilisable, considère si ça mérite un nouvel example

## 🎨 Niveau de qualité attendu

Les examples respectent ces critères :
- ✅ TypeScript strict (jamais `any`)
- ✅ Tests exhaustifs (>90% coverage)
- ✅ Documentation JSDoc claire
- ✅ Patterns réutilisables
- ✅ Performance (pas de re-renders inutiles, mémoïsation où pertinent)
- ✅ Accessibilité WCAG AA minimum
- ✅ Mobile-first (touch targets, breakpoints)

C'est le niveau attendu pour tout le code du projet.
