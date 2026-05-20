# 💬 Container Club — Templates de prompts Claude Code

> Prompts pré-formattés pour les opérations récurrentes.
> Évite de retaper, garantit la qualité, économise des tokens.

## 🚀 Démarrage session

### Session standard

```
Lis PROGRESS.md et continue la prochaine tâche non terminée.
Avant tout code, propose-moi ton plan.
```

### Session focus phase

```
Phase X. Lis PROGRESS.md section "Phase X" et finalise toutes les
tâches restantes. Pose-moi questions seulement si bloqué.
```

### Session reprise après pause

```
Lis PROGRESS.md + CHANGELOG.md + 10 derniers commits Git.
Résume en 5 lignes où on en est et propose la suite.
```

---

## 🎯 Implémentation

### Nouvelle feature

```
Implémente [nom feature] selon section [X.Y] du brief.
Approche :
1. Crée les types TypeScript
2. Crée la logique métier dans src/lib/ avec tests Vitest
3. Crée les composants React
4. Ajoute la route si nécessaire
5. Update PROGRESS.md
```

### Composant React

```
Crée le composant [NomComposant] selon les specs du brief.
Contraintes :
- Mobile-first, touch targets ≥44px
- TypeScript strict, props typées
- Maximum 300 lignes (split sinon)
- Tests unit si logique > affichage simple
- Accessibilité WCAG AA
```

### Edge Function Supabase

```
Crée l'Edge Function [nom] avec :
- Auth obligatoire (vérification JWT)
- Rate limiting (préciser limite)
- Validation Zod des inputs
- Audit log dans security_events ou audit_log
- Gestion d'erreurs propre (jamais de stack trace exposée)
- Tests
```

---

## 🧪 Tests

### Test logique métier

```
Écris des tests Vitest exhaustifs pour src/lib/[fichier].ts.
Couvre :
- Cas nominaux
- Edge cases (zéro, négatif, vide, null)
- Erreurs et validations
- Précision décimale (arrondi 0.01)
```

### Test sécurité

```
Écris un test sécurité dans tests/security/[nom].test.ts qui vérifie
que [scénario d'attaque] est bloqué.
Pattern :
1. Setup users A et B avec données distinctes
2. Tentative d'accès non autorisé
3. Assertion : 0 row retourné ou erreur 403
```

### Test E2E

```
Écris un test Playwright pour le parcours [nom].
Utilise les data-testid existants ou ajoute-les si manquants.
Évite les selectors fragiles (CSS classes).
```

---

## 🔧 Refactoring

### Split fichier trop long

```
Le fichier [chemin] fait plus de 300 lignes. Split-le proprement :
1. Identifie les responsabilités
2. Crée des sous-fichiers par responsabilité
3. Garde le fichier principal comme façade/exports
4. Update tous les imports affectés
5. Tests doivent toujours passer
```

### Extraction logique métier

```
Extrais la logique métier du composant [X] vers src/lib/.
Le composant ne doit garder que présentation et appels aux helpers.
Ajoute des tests Vitest sur la logique extraite.
```

---

## 🐛 Debug

### Erreur TypeScript

```
J'ai cette erreur TypeScript : [paste error]
Analyse, propose le fix, applique-le, vérifie typecheck.
Si c'est un faux positif, explique pourquoi mais ne mets PAS de @ts-ignore.
```

### Test qui échoue

```
Le test [nom] échoue. Lance-le, analyse l'erreur, propose le fix.
Si le test est obsolète vs nouvelle spec, propose de l'updater
plutôt que le code.
```

### Bug en runtime

```
J'observe ce bug : [description]
URL : [url]
Étapes : [steps]
Expected : [...]
Actual : [...]
Console errors : [paste]
Analyse, hypothèses, fix.
```

---

## 📦 Database

### Nouvelle migration

```
Crée une migration Supabase pour [description].
Contraintes :
- Pas de breaking change sur tables existantes
- RLS appliquée si nouvelle table sensible
- Index sur colonnes filtrées
- Triggers updated_at si pertinent
- Test en local avant de proposer
```

### Modification schéma

```
Modifie la table [nom] pour [changement].
Génère :
1. La migration UP (apply)
2. La migration DOWN (rollback)
3. Update types TypeScript
4. Update RLS si nécessaire
5. Update code affecté
```

---

## 🚢 Deployment

### Pre-deploy check

```
Avant deploy, vérifie :
1. npm run check passe (typecheck + lint + test)
2. Migrations Supabase OK
3. Secrets Cloudflare à jour
4. Variables env documentées
5. PROGRESS.md à jour
Liste tout problème détecté.
```

### Post-deploy validation

```
Après deploy, valide :
1. Lighthouse mobile/desktop sur 5 pages clés
2. Sentry sans nouvelle erreur sur 15 min
3. Endpoints critiques répondent (smoke test)
4. Stripe webhook reachable
Génère un rapport synthétique.
```

---

## 📝 Documentation

### Update PROGRESS.md

```
Update PROGRESS.md selon les changements depuis le dernier commit.
- Marque les tâches terminées ✅
- Note les fichiers créés
- Ajoute une entrée dans le journal des sessions
- N'ajoute pas de nouvelles tâches sans demander
```

### Ajout décision

```
Une décision technique vient d'être prise : [titre]
Ajoute une entrée D-XXX dans DECISIONS.md avec :
- Contexte
- Décision retenue
- Alternatives considérées
- Raison du choix
- Conséquences attendues
```

### Document bug pattern

```
On vient de résoudre [bug]. C'est probablement récurrent.
Ajoute-le dans KNOWN_ISSUES.md comme PATTERN-XXX avec :
- Symptôme observable
- Debug steps
- Fix typique
- Prévention si applicable
```

---

## 🎨 Design/UX

### Implémentation design

```
Implémente le design de [section] selon les specs visuelles du brief
section [X.Y].
Utilise les CSS variables existantes (palette section 15.1).
Mobile-first impératif.
Test sur viewport 375px (iPhone SE) et 1280px (desktop standard).
```

### Optimisation Lighthouse

```
Améliore le score Lighthouse mobile de la page [X].
Objectif : > 85.
Priorité : LCP, INP, CLS.
Mesures : analyse rapport, propose 3-5 actions concrètes, applique.
```

---

## 💰 Pricing & Business logic

### Modification pricing

```
⚠️ Modification logique pricing — demande confirmation avant.
Modification souhaitée : [description]
Impact attendu : [calcul]
Tests à ajouter : [scenarios]
```

### Nouvelle règle métier

```
Ajoute la règle métier : [description]
Contraintes :
- Validation côté SERVEUR systématique
- Tests exhaustifs (edge cases)
- Audit log si action sensible
- Update DECISIONS.md
```

---

## 🔐 Sécurité

### Audit sécurité ad hoc

```
Audite la sécurité de [feature/endpoint] :
- Authentication
- Authorization (RLS, ownership)
- Input validation (Zod)
- Rate limiting
- Audit log
- Erreurs (pas de fuite info)
Propose améliorations.
```

### Patch CVE

```
CVE détectée : [ID]
Package : [nom]
Sévérité : [HIGH/CRITICAL]
Vérifie l'impact sur notre stack, propose le fix, applique-le,
update KNOWN_ISSUES.md.
```

---

## 🤖 Workflows automatiques

### Mode autonome (à utiliser avec prudence)

```
Mode autonome : implémente toutes les tâches de la phase X
en autonomie complète.
Tu peux :
- Créer/modifier fichiers
- Lancer tests
- Faire des commits

Tu DOIS demander avant de :
- Modifier le schéma DB
- Ajouter une dépendance npm majeure
- Modifier RLS, CGV, pricing
- Désactiver un test

Update PROGRESS.md à chaque tâche terminée.
Stop si tests échouent et propose le fix.
```

### Audit complet

```
Mode audit complet du projet :
1. Tests : lance npm run test:all, liste échecs
2. TypeScript : lance typecheck, liste erreurs
3. Lint : lance lint, liste warnings
4. Sécurité : npm audit + gitleaks
5. PROGRESS.md vs réalité : checke cohérence
6. KNOWN_ISSUES.md : encore valides ?

Génère rapport synthétique avec priorités.
```
