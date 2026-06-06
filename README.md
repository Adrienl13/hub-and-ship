# 🚢 Container Club

> Plateforme B2B française de pré-commande groupée de mobilier outdoor par container maritime.

[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)]()
[![License](https://img.shields.io/badge/license-Proprietary-red.svg)]()
[![Status](https://img.shields.io/badge/status-development-yellow.svg)]()

## 🎯 Vue d'ensemble

Container Club est une plateforme B2B qui mutualise un container maritime 20' High Cube entre 6-12 professionnels (hôtels, restaurants, paysagistes, revendeurs). Production usine déclenchée à 80% remplissage et 3 séries MOQ confirmées.

**Importateur officiel** : Terrassea SAS (France).

## 🛠️ Stack technique

**Frontend** : TanStack Start v1 + React 19 + TypeScript strict + Tailwind v4 + shadcn/ui + R3F + Zustand + TanStack Query + React Hook Form + Zod

**Backend** : Supabase (PostgreSQL + Auth + Realtime + Storage + Edge Functions) + Stripe + Resend

**Hosting** : Cloudflare Workers

**DevOps** : Vitest + Playwright + Plausible + Sentry + Dependabot + Snyk Free + gitleaks

## 🚀 Démarrage rapide

### Prérequis

- Node.js ≥ 20
- npm ≥ 10
- Git
- Compte Supabase, Stripe, Resend (gratuits au démarrage)

### Installation

```bash
# Clone et installation
git clone <repo-url>
cd container-club
npm install

# Configuration
cp .env.example .env.local
# Remplis .env.local avec tes clés API

# Setup Supabase local
npx supabase start
npx supabase migration up

# Démarrage
npm run dev
```

L'app est accessible sur http://localhost:3000

## 📁 Structure du projet

```
container-club/
├── docs/                    # Documentation projet
│   ├── CONTAINER_CLUB_SPEC.md   # Brief technique complet
│   ├── PROGRESS.md              # État du projet
│   ├── CHANGELOG.md             # Historique versions
│   ├── DECISIONS.md             # Décisions techniques
│   ├── PLATFORM_STRATEGY.md     # Brief stratégique IA, canal revendeur/direct
│   ├── KNOWN_ISSUES.md          # Bugs connus
│   ├── SCRIPTS.md               # Commandes utiles
│   └── PROMPTS.md               # Templates Claude Code
├── src/
│   ├── routes/              # File-based routing TanStack
│   ├── components/          # Composants React
│   ├── lib/                 # Logique métier
│   ├── stores/              # Zustand stores
│   ├── hooks/               # React hooks
│   └── types/               # Types TypeScript
├── supabase/
│   ├── migrations/          # Migrations SQL versionnées
│   ├── functions/           # Edge Functions Deno
│   └── seed.sql             # Données initiales
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── security/            # Tests sécurité OWASP
├── scripts/                 # Scripts utilitaires
├── public/                  # Assets statiques
└── .claude/
    └── context.md           # Contexte Claude Code (auto)
```

## 📋 Phases de développement

1. **Foundations + Sécurité** (semaines 1-2)
2. **Catalogue & Réservation** (3-4)
3. **Temps réel & Visibilité** (5)
4. **Espace client** (6)
5. **Admin** (7)
6. **Automatisations** (8)
7. **Pages secondaires & polish** (9)
8. **Beta privée & launch** (10+)

État détaillé : voir `docs/PROGRESS.md`

## 🧪 Tests

```bash
# Tous les tests
npm run test:all

# Tests unitaires uniquement
npm test

# Tests sécurité (suite tests/security/)
npm run test:security

# Tests E2E (Playwright)
npm run test:e2e

# Avec coverage
npm run test:coverage
```

## 🔒 Sécurité

Container Club applique **OWASP Top 10 2025** strictement :

- RLS Supabase sur toutes tables sensibles
- Validation Zod côté serveur systématique
- Magic link only (pas de password)
- 2FA TOTP pour admins
- Rate limiting Cloudflare WAF
- Headers HTTP stricts (CSP, HSTS, X-Frame, etc.)
- Stripe Radar + 3DS2 systématique
- Audit log + security_events
- Pre-commit gitleaks

Détails : voir `docs/CONTAINER_CLUB_SPEC.md` section 18.bis

## ⚖️ Aspect légal

- B2B uniquement (SIRET obligatoire, vérifié via API INSEE Sirene)
- CGV blindées (10 articles, à valider par avocat)
- RGPD compliant (suppression, export, anonymisation)
- Importateur officiel (Terrassea SAS) avec assurance RC produit pro

## 📞 Contact

Pour toute question technique : voir `docs/CONTAINER_CLUB_SPEC.md`

---

**Version** : 0.1.0 — Spec v1.3
**Dernière mise à jour** : voir `docs/CHANGELOG.md`
