# 🛠️ Container Club — Commandes utiles

> Toutes les commandes du projet centralisées.
> Évite à Claude Code d'explorer `package.json` à chaque fois.

## 🚀 Développement

```bash
# Démarrage dev local
npm run dev                          # Démarre serveur local (port 3000)
npm run dev:debug                    # Avec inspector Node

# Build
npm run build                        # Build production
npm run preview                      # Preview build local

# Generation
npm run gen-types                    # Génère types Supabase
npm run gen-routes                   # Génère routes TanStack
```

## 🧪 Tests

```bash
# Unit tests
npm test                             # Tous tests Vitest
npm run test:watch                   # Mode watch
npm run test:unit                    # Uniquement lib/
npm run test:coverage                # Avec couverture

# Sécurité (V1.3)
npm run test:security                # Suite tests/security/

# E2E
npm run test:e2e                     # Playwright tests
npm run test:e2e:headed              # Avec UI navigateur
npm run test:e2e:debug               # Mode debug

# Tous tests
npm run test:all                     # unit + security + e2e
```

## ✅ Qualité code

```bash
# Vérifications
npm run typecheck                    # TypeScript strict, 0 erreur attendue
npm run lint                         # ESLint
npm run lint:fix                     # Auto-fix
npm run format                       # Prettier

# Sécurité
npm run audit                        # npm audit
npm run snyk                         # Snyk scan (si configuré)
npm run gitleaks                     # Scan secrets

# Tout
npm run check                        # typecheck + lint + test
```

## 🗄️ Supabase

```bash
# Local
npx supabase start                   # Démarre Supabase local
npx supabase stop                    # Stop
npx supabase status                  # Status

# Migrations
npx supabase migration new NAME      # Nouvelle migration
npx supabase migration up            # Applique migrations
npx supabase migration list          # Liste migrations
npx supabase db reset                # Reset complet + replay migrations

# Types
npx supabase gen types typescript --linked > src/types/supabase.ts

# Edge Functions
npx supabase functions deploy NAME   # Deploy
npx supabase functions list          # Liste
npx supabase functions logs NAME     # Logs

# Production (link)
npx supabase link --project-ref XXX  # Lien projet prod
npx supabase db push                 # Push migrations en prod (DANGER)
```

## 🔐 Sécurité (V1.3)

```bash
# Scans manuels
npx semgrep --config=auto .          # SAST scan
npx snyk test                        # SCA scan
npx gitleaks detect                  # Secret scan

# DAST (à lancer sur staging)
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t https://staging.containerclub.fr

# Vérification headers
curl -I https://containerclub.fr | grep -i "content-security\|strict-transport\|x-frame"

# Test rate limiting
for i in {1..10}; do curl https://containerclub.fr/api/verify-siret; done
```

## 💳 Stripe

```bash
# CLI
stripe login                         # Auth
stripe listen --forward-to localhost:3000/api/webhooks/stripe  # Webhooks local

# Tests
stripe trigger payment_intent.succeeded
stripe trigger payment_intent.payment_failed
stripe trigger charge.refunded
```

## 📧 Resend

```bash
# Test envoi email local (script custom à créer)
npm run email:preview                # Preview React Email
npm run email:send-test              # Envoi test à dev email
```

## 📊 Tooling projet

```bash
# Mise à jour PROGRESS.md depuis Git
npm run update-progress              # Lit derniers commits, suggère update

# Statistiques projet
npm run stats                        # LOC, fichiers, tests count
```

## 🚢 Deployment

```bash
# Cloudflare Workers
wrangler deploy                      # Deploy production
wrangler deploy --env staging        # Deploy staging
wrangler tail                        # Logs temps réel
wrangler secret put NAME             # Set secret
wrangler secret list                 # Liste secrets
```

## 🔧 Git workflow

```bash
# Branches
git checkout -b feat/NAME            # Nouvelle feature
git checkout -b fix/NAME             # Bugfix
git checkout -b refactor/NAME        # Refacto

# Commits (Conventional Commits)
git commit -m "feat(siret): add INSEE verification with cache"
git commit -m "fix(checkout): handle SIRET timeout gracefully"
git commit -m "test(pricing): add edge cases for incremental tiers"
git commit -m "docs(security): document A06 mitigation strategies"
git commit -m "chore(deps): upgrade Supabase SDK to 2.45"

# Push
git push origin BRANCH               # Push branche
git push --force-with-lease          # Push force safe
```

## 📚 Templates de prompts Claude Code

Voir `PROMPTS.md` pour la liste complète.

Raccourcis fréquents :

- "Continue depuis PROGRESS.md"
- "Implémente la prochaine tâche de la phase X"
- "Lance test:all et fix les erreurs"
- "Update PROGRESS.md avec les derniers commits"

## 🆘 Debug rapide

```bash
# Logs
npm run logs:supabase                # Logs Supabase
npm run logs:cloudflare              # Logs Cloudflare Worker
npm run logs:stripe                  # Logs Stripe

# Reset complet local
npm run clean                        # Clean node_modules + cache
npm install
npx supabase db reset
npm run dev

# Inspecter DB
npx supabase db inspect              # Inspector tables
psql "$DATABASE_URL"                 # Connexion directe (DANGER prod)
```
