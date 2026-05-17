# Architecture — Container Club

## Vue d'ensemble

Container Club est initialise comme une application TanStack React Start avec Vite, React 19, TypeScript strict et Tailwind CSS. La logique metier vit dans `src/lib/`, les routes dans `src/routes/`, et les integrations backend seront ajoutees progressivement via Supabase, Stripe, Resend et Cloudflare.

## Frontend

- `src/routes/` contient les routes TanStack Router file-based.
- `src/components/` contient les composants React, separes par domaine produit.
- `src/styles/globals.css` expose la palette CSS de la spec v1.3.
- `src/components/ui/` porte l'infrastructure shadcn-style minimale de Session 0.

## Backend et donnees

- `supabase/migrations/` recevra les migrations SQL de Phase 1.2.
- `supabase/functions/` recevra les Edge Functions, dont `verify-siret`.
- `src/lib/` contient les fonctions pures testees cote serveur et client.

## Qualite

- TypeScript strict est active dans `tsconfig.json`.
- Vitest couvre la logique metier et les tests securite locaux.
- Playwright est configure pour les parcours E2E.
- ESLint 9 flat config et Prettier encadrent le style de code.
- Husky lance les checks avant commit et gitleaks quand l'outil est disponible.
