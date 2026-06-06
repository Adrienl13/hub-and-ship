# 🐛 Container Club — Bugs connus et workarounds

> Évite à Claude Code de re-débogger les mêmes problèmes.
> Mis à jour à chaque fois qu'un bug récurrent est résolu.

## Format

```
## ISSUE-XXX — Titre court

**Statut** : Open | In progress | Resolved | Won't fix
**Sévérité** : Critical | High | Medium | Low
**Découvert** : YYYY-MM-DD
**Contexte** : Où ça se produit
**Symptôme** : Ce qu'on observe
**Cause racine** : Pourquoi ça arrive
**Workaround** : Solution temporaire si pas de fix permanent
**Fix permanent** : Solution propre quand applicable
**Liens** : Issues GitHub, PR, docs externes
```

---

## Issues actives

### ISSUE-001 — Migration partenaires non appliquée en production

**Statut** : Open
**Sévérité** : High
**Découvert** : 2026-06-06
**Contexte** : Canal partenaires `/partenaires` et endpoint `/api/partner-requests`
**Symptôme** : Le formulaire public est deployé, mais une vraie persistance centrale en DB dépend de la migration `20260606190000_partner_applications_and_deals.sql`.
**Cause racine** : La session Codex ne disposait pas de `SUPABASE_ACCESS_TOKEN`, donc `npx supabase db push --linked --dry-run` a échoué avant connexion au projet.
**Workaround** : Le formulaire sauvegarde la demande en localStorage si la persistance serveur échoue, afin de ne pas perdre le lead sur l'appareil courant.
**Fix permanent** : Exporter `SUPABASE_ACCESS_TOKEN`, lier le projet `mkfztwibolswqcggukeq`, lancer `npx supabase db push --linked --dry-run`, puis `npx supabase db push --linked`, et tester un submit depuis `/partenaires` jusqu'à `/admin?tab=partners`.
**Liens** : Voir `docs/HANDOFF_CLAUDE_CODE.md` section P0.

---

## Issues anticipées (à surveiller)

Liste des points connus pour être problématiques, à anticiper.

### ANTICIP-001 — Supabase Realtime déconnexions fréquentes

**Contexte** : Realtime WebSocket peut se déconnecter (timeout proxy, network, etc.)
**Solution préventive** :

- Configurer reconnection automatique dans le hook `useContainerRealtime`
- Heartbeat 30 secondes
- Indicateur UI discret quand déconnecté ("● Reconnexion...")
- Refresh manual button en backup
- Tests : forcer déconnexion réseau, vérifier reconnexion

### ANTICIP-002 — Stripe webhooks ordre arrivée

**Contexte** : Les webhooks Stripe peuvent arriver dans un ordre inattendu
**Solution préventive** :

- Idempotency keys obligatoires
- Vérifier le statut actuel avant d'appliquer un changement
- Logs détaillés pour debug
- Tests : envoyer webhooks dans différents ordres

### ANTICIP-003 — API INSEE quota dépassé

**Contexte** : 30 req/min limit, possible burst
**Solution préventive** :

- Cache 7 jours (table `siret_cache`) couvre 95% des cas
- Queue avec retry exponential backoff
- Fallback : accepter SIRET non vérifié + cron de re-vérification
- Monitoring : alerte si > 25 req/min sur 5 min

### ANTICIP-004 — Cloudflare Workers timeout

**Contexte** : Workers ont 50ms CPU, 30s wall time
**Solution préventive** :

- Pas de calculs lourds en Worker (déléguer Edge Functions Supabase)
- Lazy loading agressif
- Tests de perf en CI

### ANTICIP-005 — Migration Supabase production

**Contexte** : Migrations DB en prod peuvent lock long
**Solution préventive** :

- Migrations testées en staging d'abord
- Migrations CONCURRENTLY pour index
- Backup avant chaque migration
- Plan rollback documenté

### ANTICIP-006 — Bundle JS trop gros mobile

**Contexte** : React Three Fiber + dépendances peuvent gonfler
**Solution préventive** :

- Code splitting par route (natif TanStack Start)
- Lazy load 3D scene (Suspense)
- Bundle analyzer en CI
- Cible : < 200kb gzipped initial

---

## Patterns de résolution récurrents

À documenter au fur et à mesure :

### PATTERN-001 — RLS bloque une requête légitime

**Symptôme** : Query Supabase retourne 0 rows alors qu'il devrait y en avoir
**Debug** :

1. Tester la même query avec service_role (bypass RLS)
2. Vérifier la policy concernée
3. Vérifier les jointures (RLS peut bloquer sur table jointe)
4. Vérifier auth.uid() dans la session
   **Fix typique** : Ajuster la policy ou utiliser une RPC SECURITY DEFINER

### PATTERN-002 — Stripe Payment Intent statut bloqué

**Symptôme** : Payment Intent reste en `requires_action`
**Debug** :

1. Vérifier 3DS2 challenge complété
2. Vérifier next_action dans la PI
3. Vérifier webhook signature
   **Fix typique** : Forcer rafraîchissement client + nouveau confirm()

### PATTERN-003 — TypeScript types Supabase obsolètes

**Symptôme** : Types ne reflètent pas le schéma DB actuel
**Debug** : Comparer types générés vs schéma réel
**Fix** : `npx supabase gen types typescript --linked > src/types/supabase.ts`
**Prévention** : Hook pre-commit ou script `npm run gen-types`

---

## 🔗 Liens utiles debug

- Supabase status : https://status.supabase.com/
- Stripe status : https://status.stripe.com/
- Cloudflare status : https://www.cloudflarestatus.com/
- INSEE API status : https://portail-api.insee.fr/
- Resend status : https://status.resend.com/
