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

### ISSUE-001 — Migrations partenaires non appliquées en production

**Statut** : Resolved
**Sévérité** : High
**Découvert** : 2026-06-06
**Résolu** : 2026-06-07
**Contexte** : Canal partenaires `/partenaires` et endpoint `/api/partner-requests`
**Symptôme** : Le formulaire public est deployé, mais une vraie persistance centrale en DB dépend de la migration `20260606190000_partner_applications_and_deals.sql`. L'attribution automatique des réservations aux deals partenaires dépend de `20260606210000_partner_attribution_on_reservations.sql`. L'attribution par lien co-brandé dépend aussi de `20260607090000_partner_link_attribution.sql`.
**Cause racine** : La session Codex ne disposait pas de `SUPABASE_ACCESS_TOKEN`, donc `npx supabase db push --linked --dry-run` a échoué avant connexion au projet.
**Résolution (2026-06-07, Claude Code)** : Les 3 migrations partenaires ont été appliquées sur le projet `mkfztwibolswqcggukeq` via le MCP Supabase (`apply_migration`), versions réalignées sur les noms de fichiers locaux dans `supabase_migrations.schema_migrations`. Vérifié : tables `partner_applications`/`partner_deals`, colonnes `partner_*` sur `reservations`, trigger `reservations_set_partner_attribution`, fonctions de matching et RLS admin-only. Tests d'attribution (SIRET / email pro / lien co-brandé / domaine générique exclu) validés en transaction `rollback`. Smoke tests prod OK : `POST /api/partner-requests` → `201 persisted:true`, `POST /api/stock-requests` → `201 persisted:true` (lignes de test supprimées ensuite).
**Note sécurité (voir ISSUE-002)** : le `revoke ... from public` des migrations était insuffisant sous Supabase ; une migration de durcissement `20260607140000_harden_partner_attribution_function_grants.sql` a été ajoutée.
**Liens** : Voir `docs/HANDOFF_CLAUDE_CODE.md` section P0.

---

### ISSUE-002 — Fonctions d'attribution partenaire exposées en REST à anon/authenticated

**Statut** : Resolved
**Sévérité** : High
**Découvert** : 2026-06-07
**Résolu** : 2026-06-07
**Contexte** : Fonctions `find_partner_protected_deal`, `find_partner_link_attribution`, `set_reservation_partner_attribution` créées par les migrations partenaires.
**Symptôme** : `get_advisors` (security) signalait ces `SECURITY DEFINER` comme exécutables par `anon`/`authenticated` via `/rest/v1/rpc/...`. `find_partner_protected_deal(siret, email)` et `find_partner_link_attribution(slug)` renvoient `partner_company_name` + `partner_contact_email` : un appelant public pouvait sonder un SIRET/email/slug et révéler l'identité du partenaire et ses prospects protégés — violation de la règle "données prospects partenaires = admin-only".
**Cause racine** : Les migrations faisaient `revoke execute ... from public`, mais Supabase accorde EXECUTE directement aux rôles `anon`/`authenticated`, que `from public` ne révoque pas.
**Fix permanent** : Migration `20260607140000_harden_partner_attribution_function_grants.sql` — `revoke execute ... from anon, authenticated` sur les 3 fonctions. Le trigger reste fonctionnel (fonction `SECURITY DEFINER` exécutée avec les droits du owner, indépendamment du privilège EXECUTE de l'appelant) — vérifié par insert réel en transaction `rollback`. Seul `service_role` conserve EXECUTE. Ne PAS appliquer ce revoke aux helpers RLS `is_admin()`/`current_user_role()`/`current_company_id()` qui doivent rester exécutables.
**Liens** : https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable

---

### ISSUE-003 — `/livres` rend un shell SSR vide (contenu + JSON-LD non server-rendered)

**Statut** : Open
**Sévérité** : Medium
**Découvert** : 2026-06-07
**Contexte** : Page Containers livrés (`src/routes/livres.index.tsx`, route `/livres/`).
**Symptôme** : Le HTML SSR de `/livres` ne contient **que le `<head>` (title + meta)** ; le `<body>` est un shell vide qui s'hydrate côté client. Preuves : réponse déterministe ~14 951 octets (vs ~21 778 pour `/qualite`), aucun contenu Header/body dans le HTML serveur, et le payload d'hydratation montre `lastMatchId:" livres  livres "`. Conséquence : ni le `head().scripts` (BreadcrumbList) ni le contenu de la page (containers livrés, stats, preuve sociale) n'apparaissent dans le HTML serveur → **non crawlable au premier rendu**.
**Contre-exemple** : `/qualite`, `/guides` (index) et les guides leaf sont entièrement SSR (head meta + head.scripts + body). Le Worker génère chaque réponse à neuf (pas de `cf-cache-status`), donc ce n'est ni un cache ni le code JSON-LD (le même pattern marche ailleurs).
**Cause racine (investiguée le 2026-06-07, reproduite en `wrangler dev`/workerd)** :
- Ce n'est PAS le composant : avec `LivresPage` réduit à `return <div>SSRTEST</div>`, le marqueur n'apparaît toujours pas dans le HTML, alors que les logs de rendu (`console.log` en haut ET juste avant le `return`) s'exécutent bien côté serveur (`window=undefined`, `products=6`, `stats ok`). Le composant rend complètement, sans erreur, mais sa sortie n'est pas sérialisée dans le HTML SSR.
- Ce n'est PAS le code JSON-LD, ni le prerendering (aucun `.html` généré, tout est SSR live), ni un route tree stale (régénéré sans effet).
- **Signal précis** : les routes cassées portent un `lastMatchId` **doublé** dans le payload d'hydratation TanStack (`lastMatchId:" livres  livres "`). Une route LEAF fraîche et triviale `/preuves` reproduit exactement le symptôme (`lastMatchId:" preuves preuves"`, body vide), alors que `/guides`, `/qualite` (qui marchent) n'ont pas ce doublement. Donc le bug est au niveau **génération de route / SSR interne de TanStack Start**, déclenché pour certains noms/chemins de route, indépendamment du contenu du composant.
**Workaround** : Aucun (Google rend le JS → contenu visible après hydratation ; mais le 1er rendu SSR reste vide).
**Piste de fix** : Investiguer côté TanStack Start (version, `tsr generate`) pourquoi certains ids de route sont doublés ; tester une montée de version de `@tanstack/react-start`/`react-router`, ou recréer la route `/livres` sous un autre fichier/segment. Repro minimale : une route leaf triviale dont le `lastMatchId` sort doublé.

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
