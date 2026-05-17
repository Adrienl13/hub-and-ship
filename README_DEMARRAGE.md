# 🚢 Container Club — Démarrage rapide

> Bienvenue ! Ce starter pack contient tout ce dont tu as besoin pour démarrer Container Club avec Claude Code.
> **Temps d'installation : 5 minutes.**

---

## 📦 Ce que contient ce dossier

```
container-club-starter/
├── README_DEMARRAGE.md              ← TU ES ICI (lis-moi en premier)
├── PROMPT_INITIAL_CLAUDE_CODE.md    ← À copier-coller dans Claude Code
│
├── docs/                            ← Documentation projet
│   ├── CONTAINER_CLUB_SPEC.md       ← Brief technique v1.3 (5100 lignes)
│   ├── PROGRESS.md                  ← État projet (vivant)
│   ├── CHANGELOG.md                 ← Historique versions spec
│   ├── DECISIONS.md                 ← Décisions techniques
│   ├── KNOWN_ISSUES.md              ← Bugs connus
│   ├── SCRIPTS.md                   ← Commandes utiles
│   └── PROMPTS.md                   ← Templates prompts
│
├── .claude/
│   └── context.md                   ← Lu auto par Claude Code
│
├── scripts/
│   └── update-progress.sh           ← Auto-update PROGRESS.md
│
├── .templates/                      ← Templates fichiers de config
│   ├── package.json.template
│   ├── tsconfig.json.template
│   ├── tailwind.config.template
│   ├── .env.example.template
│   ├── .gitignore.template
│   └── README.md.template
│
└── examples/                        ← Code de référence qualité
    ├── lib/pricing/tiers.example.ts
    ├── components/ui/Button.example.tsx
    ├── tests/security/access-control.example.test.ts
    └── migrations/0001_init.example.sql
```

---

## 🚀 Installation en 3 étapes (5 minutes)

### Étape 1 — Crée ton repo Container Club

Ouvre Terminal sur ton Mac :

```bash
# Crée le dossier du projet
mkdir -p ~/Projets/container-club
cd ~/Projets/container-club

# Initialise Git
git init
git branch -M main
```

### Étape 2 — Copie le contenu du starter dans ton repo

```bash
# Depuis le dossier où tu as décompressé le starter
# (remplace le chemin par celui où tu as décompressé)
STARTER_PATH="$HOME/Downloads/container-club-starter"

cd ~/Projets/container-club

# Copie tout le contenu (incluant fichiers cachés .claude, .templates)
cp -r "$STARTER_PATH"/* .
cp -r "$STARTER_PATH"/.claude .
cp -r "$STARTER_PATH"/.templates .

# Rends le script exécutable
chmod +x scripts/update-progress.sh

# Premier commit
git add .
git commit -m "chore: initial starter pack v1.3"
```

### Étape 3 — Démarre Claude Code

```bash
# Toujours dans ~/Projets/container-club
claude code
```

Une fois Claude Code démarré, **copie-colle** le contenu du fichier `PROMPT_INITIAL_CLAUDE_CODE.md` (à la racine du starter).

C'est tout. Claude Code va :
1. Lire automatiquement `.claude/context.md`
2. Créer la structure du projet (`src/`, `tests/`, `supabase/`, etc.)
3. Initialiser `package.json`, `tsconfig.json`, configs depuis les templates
4. Installer les dépendances npm
5. Configurer Tailwind, ESLint, Prettier, Vitest, Playwright
6. Setup pre-commit hooks (gitleaks)
7. Créer les premières migrations Supabase
8. Implémenter la logique métier de base
9. Faire des commits réguliers
10. Mettre à jour `docs/PROGRESS.md` automatiquement

**Temps total Phase 1 estimé : 4-8h de travail Claude Code (en plusieurs sessions).**

---

## ⚙️ Pré-requis sur ton Mac

Vérifie que tu as installé :

```bash
# Node.js (version 20+ recommandée)
node --version  # doit afficher v20.x ou plus

# Si pas installé : brew install node@20

# npm (vient avec Node)
npm --version

# Git
git --version

# Claude Code
claude --version

# Si pas installé : voir https://claude.com/code

# Optionnel mais utile
brew install gh        # GitHub CLI
brew install gitleaks  # Détection secrets
brew install jq        # JSON parsing dans scripts
```

---

## 💡 Comment ça marche au quotidien

### À chaque session de travail

```bash
cd ~/Projets/container-club
claude code

# Dans Claude Code, tu peux simplement dire :
> Continue depuis docs/PROGRESS.md
```

Claude Code va :
1. Lire `.claude/context.md` automatiquement (règles projet)
2. Lire `docs/PROGRESS.md` (où on en est)
3. Identifier la prochaine tâche
4. Te proposer un plan
5. Implémenter après ta validation
6. Mettre à jour `docs/PROGRESS.md`
7. Faire un commit Git propre

### À la fin de chaque session

```bash
# Génère un résumé Git → docs/PROGRESS.md
./scripts/update-progress.sh

# Relis et marque ✅ les tâches terminées
# Puis commit
git add docs/PROGRESS.md
git commit -m "docs(progress): update session log"
git push
```

### Si tu rencontres un bug

Dans Claude Code :
```
J'observe ce bug : [description]
URL : [url]
Étapes : [reproduction]
Console errors : [paste]
```

Claude Code va :
1. Vérifier `docs/KNOWN_ISSUES.md` si pattern connu
2. Analyser, hypothèses, fix
3. Si pattern récurrent, ajouter dans `docs/KNOWN_ISSUES.md`

### Si tu prends une décision technique

```
Décision : [titre]
Contexte : [...]
Choix : [option retenue]
Raison : [...]
```

Claude Code va ajouter une entrée D-XXX dans `docs/DECISIONS.md`.

---

## 🎯 Mode de fonctionnement de Claude Code

### Mode autonome (par défaut)

Claude Code peut :
- ✅ Créer/modifier des fichiers de code
- ✅ Lancer des tests
- ✅ Faire des commits Git
- ✅ Mettre à jour la documentation

Claude Code **doit demander avant** :
- ⚠️ Modifier le schéma DB (migrations)
- ⚠️ Ajouter une dépendance npm majeure
- ⚠️ Modifier les politiques RLS Supabase
- ⚠️ Changer la logique de pricing
- ⚠️ Modifier les CGV ou clauses légales
- ⚠️ Désactiver un test
- ⚠️ Ignorer une erreur TypeScript

### Mode strict (pour éviter surprises)

Si tu préfères tout valider, dis-lui :
```
Mode strict activé. Demande-moi confirmation avant chaque modification 
de fichier. Montre-moi le diff complet avant d'appliquer.
```

---

## 🔧 Commandes utiles

Une fois le projet initialisé, tu auras accès à :

```bash
# Développement
npm run dev              # Serveur dev local
npm run build            # Build production
npm run preview          # Preview build

# Tests
npm test                 # Tous tests Vitest
npm run test:security    # Suite tests sécurité
npm run test:e2e         # Tests Playwright
npm run check            # typecheck + lint + test

# Qualité
npm run typecheck        # TypeScript strict
npm run lint             # ESLint
npm run format           # Prettier

# Supabase
npx supabase start       # DB locale
npx supabase migration up
npx supabase functions deploy NAME

# Tooling
./scripts/update-progress.sh    # Met à jour PROGRESS.md
```

Liste complète dans `docs/SCRIPTS.md`.

---

## ❓ FAQ

### Le brief technique fait 5100 lignes, Claude Code va le relire à chaque fois ?

Non. Le système est conçu pour éviter ça. Claude Code lit en priorité :
1. `.claude/context.md` (règles, 100 lignes)
2. `docs/PROGRESS.md` (état, 350 lignes)
3. `docs/CHANGELOG.md` (versions, 150 lignes)

Le brief complet n'est consulté **que sur les sections nécessaires** à la tâche en cours, via grep ciblé.

**Économie de tokens estimée : 60-80% vs lecture complète.**

### Que se passe-t-il si je veux faire évoluer le brief (v1.4) ?

1. Tu génères la nouvelle version (via cette conversation)
2. Tu remplaces `docs/CONTAINER_CLUB_SPEC.md`
3. Tu ajoutes une entrée dans `docs/CHANGELOG.md`
4. Claude Code lit le CHANGELOG et applique uniquement les diffs nécessaires

### Et si je veux travailler à plusieurs sur le projet ?

Le système est compatible. Chaque dev :
1. Pull la dernière version
2. Lit `docs/PROGRESS.md` pour voir où on en est
3. Implémente sa partie
4. Update `docs/PROGRESS.md`
5. Push

Les conventions Conventional Commits évitent les conflits dans PROGRESS.md.

### Comment je sais ce que Claude Code a fait pendant une session ?

```bash
# Voir les commits récents
git log --oneline -20

# Diff complet de la session
git diff HEAD~10..HEAD

# Statistiques
git diff --stat HEAD~10..HEAD
```

### Que faire si Claude Code se perd ou fait n'importe quoi ?

```bash
# Annule les derniers commits sans tout perdre
git reset --soft HEAD~3

# Annule complètement (DANGER, perte modifications)
git reset --hard HEAD~3

# Annule juste le dernier commit
git reset --soft HEAD~1
```

Puis redémarre une nouvelle session avec instruction claire.

---

## 📞 Support

Cette conversation Claude reste disponible pour :
- Modifier le brief technique (v1.4, v1.5...)
- Ajouter des features non prévues
- Debug des problèmes complexes
- Préparer le lancement (CGV, communication, etc.)
- Toute question stratégique

**N'attends pas d'être bloqué pour revenir poser des questions.**

---

## ✅ Prochaines étapes après installation

Une fois Claude Code lancé et le projet initialisé :

1. **Récupère tes clés API** (à mesure que tu en as besoin) :
   - Supabase : créer projet sur supabase.com (gratuit)
   - Stripe : créer compte stripe.com (mode test gratuit)
   - Resend : créer compte resend.com (gratuit jusqu'à 3000 emails/mois)
   - API INSEE Sirene : portail-api.insee.fr (gratuit)
   - Cloudflare : compte gratuit + créer Worker

2. **En parallèle du dev**, attaque les tâches business :
   - [ ] Appels 5 transporteurs (Geodis, Heppner, Mauffrey, Dachser, Upela)
   - [ ] RDV avocat pour CGV (budget 2500-4000€)
   - [ ] Devis assurance RC produit pro (budget 1500-2500€/an)
   - [ ] Adhésion Eco-mobilier
   - [ ] Brief photographe produits (budget 2000-5000€)
   - [ ] Contrat-cadre usine pour CC-2026-001

3. **Suivi hebdomadaire** :
   - Vendredi : `./scripts/update-progress.sh` + commit
   - Review du PROGRESS.md
   - Identification blockers
   - Planification semaine suivante

---

**Bon démarrage ! 🚀**

Container Club va bientôt voir le jour. Tu as tout ce qu'il faut pour réussir techniquement. Le reste, c'est du business : appels téléphoniques, RDV, photos, marketing. Tu peux le faire.

> Une question pendant l'installation ? Reviens dans cette conversation Claude.
