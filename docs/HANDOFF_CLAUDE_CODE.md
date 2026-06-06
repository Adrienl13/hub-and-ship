# Passage de relais Claude Code — chantiers prioritaires

> Derniere mise a jour : 2026-06-07
> Branche active : `codex/seo-geo-foundation`
> Dernier commit fonctionnel : voir `git log --oneline -5`
> Prod verifiee : `https://prosimport.com/partenaires?deploy=b46e252`
> Dernier deploy Cloudflare : `d2010af1-46b3-4e3c-94ce-7f0353fde8be`

Ce document sert de point d'entree court pour reprendre le chantier avec Claude Code ou une autre IA. Lire aussi `docs/PLATFORM_STRATEGY.md`, `docs/PROGRESS.md`, `docs/DECISIONS.md` et `docs/KNOWN_ISSUES.md`.

## Objectif produit

Pros Import / Container Club doit devenir une centrale d'import digitale pour mobilier CHR : utile aux restaurateurs/hotels en direct, mais surtout suffisamment sure pour que les revendeurs partagent la plateforme sans craindre de perdre leurs clients.

Regles non negociables :

- Ne jamais exposer les prix nets partenaires publiquement.
- Ne jamais exposer les marges internes.
- Ne pas imposer de prix minimum de revente aux revendeurs.
- Le site public peut vendre en direct, mais tout prospect apporte par un partenaire doit etre protege.
- Les donnees prospects partenaires doivent rester admin-only.
- Ne pas remettre de numero EORI public dans le site.

## Etat reel au 2026-06-07

Fait et pousse sur GitHub :

- Page publique `/partenaires` avec positionnement revendeur protege, FAQ conflit canal, formulaire demande partenaire et mode "proteger une opportunite".
- Page publique `/p/{slug}` co-brandee pour qu'un revendeur puisse partager une entree Pros Import sans exposer ses prix nets.
- Tracker global de lien partenaire : capture `/p/{slug}` et les query params `partner`, `partner_slug`, `revendeur` dans `localStorage` pendant 120 jours.
- Reservation enrichie : le contexte partenaire est copie dans `contact_snapshot.partner_context` pour conserver la preuve d'origine.
- API `/api/partner-requests` same-origin, validation Zod, refus origin externe, persistance service role quand Supabase est pret.
- Migration creee : `supabase/migrations/20260606190000_partner_applications_and_deals.sql`.
- Migration creee : `supabase/migrations/20260606210000_partner_attribution_on_reservations.sql`.
- Migration creee : `supabase/migrations/20260607090000_partner_link_attribution.sql`.
- Tables cible : `partner_applications`, `partner_deals`.
- Reservations enrichies : `partner_deal_id`, `partner_application_id`, `partner_attribution_reason`, `partner_attribution_snapshot`.
- RLS cible : admin-only pour lecture/ecriture directe ; le public passe par l'endpoint serveur.
- Onglet admin `Partenaires` pour lire, filtrer et changer les statuts.
- Onglet admin `Reservations` enrichi avec badge interne "Deal partenaire reconnu", "Partenaire reconnu" ou "Lien partenaire capte".
- Fallback local : si l'API/persistance echoue, le lead est sauvegarde dans `localStorage`.
- Tests ajoutes : builder partenaire, matching attribution, API, migrations securite, E2E partenaires/API.
- Deploy Cloudflare effectue : version `fe56b3be-8185-43a4-88ef-d7b648c73ffd`.
- Deploy Cloudflare attribution effectue : version `d2010af1-46b3-4e3c-94ce-7f0353fde8be`.

Validation passee :

```bash
npm run check
npm run build
npx playwright test tests/e2e/site-audit.spec.ts --grep "partner|partenaire|API"
```

Point bloque important :

- Les migrations Supabase partenaires n'ont pas ete appliquees au projet distant, car la session Codex n'avait pas de `SUPABASE_ACCESS_TOKEN`.
- Tant que les migrations partenaires ne sont pas appliquees, le formulaire prod tombera en mode degrade local au lieu de centraliser le lead en DB, l'attribution automatique SIRET/email ne pourra pas s'executer, et l'attribution par lien `/p/{slug}` restera seulement visible dans le snapshot local/client.

## Priorite P0 — Debloquer la prod data

### P0.1 Appliquer les migrations Supabase partenaires

Pourquoi : sans ces migrations, les leads partenaires ne remontent pas dans l'admin et les reservations ne sont pas attribuees automatiquement aux deals proteges.

Commandes conseillees :

```bash
export SUPABASE_ACCESS_TOKEN=...
npx supabase link --project-ref mkfztwibolswqcggukeq
npx supabase db push --linked --dry-run
npx supabase db push --linked
```

Verification :

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('partner_applications', 'partner_deals');

select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'reservations'
  and column_name in (
    'partner_deal_id',
    'partner_attribution_reason',
    'partner_attribution_snapshot',
    'partner_application_id'
  );
```

Puis tester en prod :

1. Aller sur `https://prosimport.com/partenaires#demande-partenaire`.
2. Soumettre une demande partenaire test.
3. Se connecter admin.
4. Aller sur `/admin?tab=partners`.
5. Verifier que la candidature apparait.

Rollback minimal :

- Ne pas supprimer les tables si des leads existent.
- En cas d'erreur UI, deployer un correctif front ; les tables peuvent rester.

### P0.2 Verifier les secrets Cloudflare

Pourquoi : l'endpoint serveur depend de la service role.

Verifier :

```bash
wrangler secret list
```

Secrets attendus :

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- plus tard `RESEND_API_KEY`

### P0.3 Smoke test endpoint partenaire

Apres migration :

```bash
curl -i -X POST "https://prosimport.com/api/partner-requests" \
  -H "content-type: application/json" \
  --data '{
    "mode":"application",
    "partnerKind":"reseller",
    "companyName":"Audit CHR",
    "contactName":"Test Admin",
    "contactEmail":"test+partner@prosimport.com",
    "contactPhone":"+33 6 00 00 00 00",
    "territory":"France",
    "expectedMonthlyVolume":"1 container / trimestre"
  }'
```

Attendu : `201` avec `persisted: true`.

## Priorite P1 — Rendre le modele partenaire vraiment protecteur

### P1.1 Attribution automatique SIRET/email

Statut : implementation code + migration prete, push Supabase distant encore bloque par `SUPABASE_ACCESS_TOKEN`.

Pourquoi : c'est le coeur de la confiance revendeur.

But :

- Quand un client final arrive avec un SIRET/email deja protege, le systeme doit reconnaitre le deal.
- L'UI publique ne doit pas afficher le partenaire sans controle, mais l'admin doit voir l'attribution.

Ce qui est implemente :

- Migration `20260606210000_partner_attribution_on_reservations.sql`.
- Matching priorise : SIRET exact, email exact, domaine email professionnel.
- Exclusion des domaines generiques pour le matching par domaine (`gmail.com`, `orange.fr`, `outlook.com`, etc.).
- Trigger `reservations_set_partner_attribution` avant insert/update SIRET/contact.
- Snapshot admin-only dans `reservations.partner_attribution_snapshot`.
- Module pur `src/lib/partners/attribution.ts` + tests.
- Admin reservations affiche "Deal partenaire reconnu".

Reste a faire apres application Supabase :

- Creer un deal test en statut `protected` avec `protected_until` futur.
- Creer une reservation test avec le meme SIRET/email.
- Verifier `/admin?tab=reservations` : badge deal partenaire.
- Verifier que le public ne voit jamais le nom du partenaire dans le checkout.

Fichiers de depart :

- `src/lib/partners/attribution.ts`
- `src/lib/partners/attribution.test.ts`
- `src/lib/partners/repository.ts`
- `src/lib/partners/submission.ts`
- `supabase/migrations/20260606190000_partner_applications_and_deals.sql`
- `supabase/migrations/20260606210000_partner_attribution_on_reservations.sql`

### P1.2 Espace partenaire authentifie

Pourquoi : les prix nets ne doivent jamais etre publics.

But :

- Route future : `/partner` ou `/partenaire/dashboard`.
- Acces reserve aux comptes valides.
- Voir ses deals, statuts, protections, selections, documents.

Pre-requis :

- RLS par partenaire/organisation.
- Modele `users_profile.role` ou nouvelle relation `partner_users`.
- Admin peut approuver un partenaire et lier un user.

### P1.3 Selections co-brandées

Pourquoi : c'est ce qui donnera envie au revendeur de partager le site.

Statut : MVP lien public implemente, selections persistantes encore a faire.

Ce qui est implemente :

- Route `/p/{slug}` avec hero co-brande, produits vitrines, CTA catalogue et reservation.
- Capture 120 jours du contexte partenaire via `src/components/PartnerLinkTracker.tsx`.
- Module pur `src/lib/partners/link.ts` + tests.
- Snapshot reservation `contact_snapshot.partner_context`.
- Migration `20260607090000_partner_link_attribution.sql` pour matcher un `partner_referral_slug` vers un deal ou une candidature partenaire.
- Admin reservations affiche le signal lien/partenaire sans l'exposer au client.

But :

- Le revendeur cree une selection produit.
- URL partageable : `/p/{slug}/selection/{id}`.
- Page avec identité partenaire, produits, quantites, conditions.
- CTA qui renvoie vers le partenaire ou protege le client.

Ne pas faire :

- Ne pas montrer le prix net partenaire au client final.
- Ne pas forcer un prix de revente.

Prochaines etapes :

- Ajouter generation/edition de `partner_referral_slug` dans l'onglet admin `Partenaires`.
- Creer une table future `partner_selections` quand les migrations distant sont debloquees.
- Ajouter devis PDF co-brande : logo/nom partenaire public, prix public ou prix client, jamais prix net partenaire.
- Ajouter un statut de protection visible dans le futur espace partenaire.

## Priorite P2 — Fiabiliser conversion et operationnel

### P2.1 Emails transactionnels Resend

Pourquoi : aujourd'hui les confirmations et relances ne sont pas suffisamment fiables.

Priorite emails :

1. Demande partenaire recue.
2. Opportunite partenaire soumise.
3. Reservation recue.
4. Paiement en attente/webhook confirme.
5. Demande stock 24h recue.

Fichiers de depart :

- `src/lib/email/templates.ts`
- `src/lib/resend` si existant, sinon creer module service.
- Endpoints `/api/partner-requests`, `/api/stock-requests`, reservation flow.

### P2.2 Admin Command Center

Pourquoi : Adrien doit voir les urgences sans fouiller les onglets.

Ajouter dans `/admin` :

- Deals partenaires en attente.
- Demandes stock non traitees.
- Reservations paiement en attente.
- Containers proches de 80%.
- Documents qualite manquants.

Fichiers :

- `src/routes/admin.tsx`
- `src/lib/admin/dashboard.ts`

### P2.3 Production readiness paiement

Pourquoi : le site ne doit pas encaisser en mode fragile.

A faire :

- Stripe live.
- Webhook prod confirme.
- Cas echecs/expiration retestes.
- Retour paiement verifie.
- Mentions CGV valides.

## Priorite P3 — Differenciation et acquisition

### P3.1 Guides SEO/AEO/GEO

Pages prioritaires :

- `/guides/prix-net-revendeur-mobilier-chr`
- `/guides/moq-chaises-restaurant`
- `/guides/container-20-pieds-vs-40-pieds-mobilier`
- `/import-mobilier-terrasse-container`

Regles :

- Pages utiles, pas generiques.
- Tableaux, FAQ schema, exemples chiffres, limites claires.
- Lien vers catalogue, partenaires, stock 24h.

### P3.2 Trust Ledger qualite

Pourquoi : prix bas + import = besoin de preuve.

A faire :

- Uploader vrais PDF.
- Relier rapports aux produits/categories.
- Ajouter photos controle, dates, fournisseurs masques si necessaire.
- Eviter tout etat vide anxiogene.

### P3.3 Catalogue scalable

Objectif :

- Supporter 100-150 chaises/fauteuils et 20 tables.

A faire :

- Mode comparaison dense desktop.
- Filtres dimensions/matiere/empilable/MOQ/stock 24h.
- Tests mobile sur longues listes.
- Garder les cartes portrait plein cadre comme rendu principal public.

## Audit rapide avant chaque commit

Toujours lancer :

```bash
npm run check
npm run build
```

Pour les pages publiques/admin :

```bash
npx playwright test tests/e2e/site-audit.spec.ts --grep "partner|partenaire|API"
```

Avant deploy :

```bash
git status --short --branch
npm run check
npm run build
```

Apres deploy :

```bash
curl -I "https://prosimport.com/partenaires?deploy=<sha>"
curl -i "https://prosimport.com/api/partner-requests?deploy=<sha>"
```

## Prompts conseilles pour Claude Code

### Reprise P0

```text
Lis docs/HANDOFF_CLAUDE_CODE.md, docs/PROGRESS.md et docs/KNOWN_ISSUES.md.
Priorite absolue : appliquer ou verifier la migration Supabase partenaires, puis tester un submit reel depuis /partenaires jusqu'a /admin?tab=partners.
Ne change pas le modele commercial. Ne rends pas publics les prix nets partenaires.
```

### Reprise P1

```text
Lis docs/HANDOFF_CLAUDE_CODE.md et docs/PLATFORM_STRATEGY.md.
Implemente l'attribution automatique partenaire par SIRET/email en gardant les donnees prospects admin-only.
Ajoute migration, types, logique metier, tests securite, tests unitaires et mise a jour docs.
```

### Reprise P1 selections co-brandees

```text
Lis docs/HANDOFF_CLAUDE_CODE.md et docs/PLATFORM_STRATEGY.md sections C04/C05.
Reprends le MVP lien partenaire deja implemente via /p/{slug}, puis implemente la premiere version persistante des selections co-brandees revendeur.
Le client final ne doit jamais voir le prix net partenaire.
```

## Definition de "fini" pour le prochain gros jalon

Le prochain jalon est fini quand :

- Une demande partenaire prod est enregistree en DB.
- Une opportunite partenaire prod peut etre protegee depuis l'admin.
- Le systeme reconnait au moins le SIRET client protege.
- Un partenaire valide peut acceder a un espace minimal sans voir les autres partenaires.
- Aucun prix net partenaire n'est visible publiquement.
- `npm run check`, `npm run build` et E2E cibles passent.
