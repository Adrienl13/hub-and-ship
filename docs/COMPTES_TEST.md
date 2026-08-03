# Comptes de test — parcours réels par portail

> Objectif : se connecter comme un vrai client / partenaire opérationnel pour
> tester chaque portail de bout en bout (prix par canal, espace partenaire,
> admin, réservation).

## Les portails et qui y accède

| Portail | URL | Condition d'accès |
|---|---|---|
| Client direct | `/catalogue`, `/account` | N'importe quel compte connecté (canal `direct`) |
| Revendeur | `/catalogue` (prix nets revendeur) | `companies.channel = 'revendeur'` + profil rattaché |
| Distributeur | `/catalogue` (prix nets distributeur) | `companies.channel = 'distributeur'` |
| Grand compte | `/catalogue` (−10 % d'office) | `companies.channel = 'grand_compte'` |
| Espace partenaire | `/partner` | Lié dans `partner_users` (via une candidature approuvée) |
| Admin | `/admin` | `users_profile.role = 'admin'` (ou `super_admin`) |

Le **canal de vente** (revendeur/distributeur/grand compte) est une décision
admin : il n'est jamais auto-attribué. Les prix nets d'un canal ne sortent
jamais côté serveur pour un autre canal — se connecter avec le bon compte est
donc la SEULE façon de voir réellement ces prix.

## Étape 1 — Créer les utilisateurs (Dashboard Supabase)

Le mot de passe ne peut pas être posé en SQL (hachage géré par le service
Auth). Dans **Supabase → Authentication → Users → Add user**, coche
**« Auto Confirm User »** et crée ces 5 comptes :

| Persona | Email | Mot de passe suggéré |
|---|---|---|
| Admin | `admin.test@prosimport.com` | `Test-Admin-2026!` |
| Client direct | `direct.test@prosimport.com` | `Test-Direct-2026!` |
| Revendeur | `revendeur.test@prosimport.com` | `Test-Revendeur-2026!` |
| Distributeur | `distributeur.test@prosimport.com` | `Test-Distributeur-2026!` |
| Partenaire apporteur | `partenaire.test@prosimport.com` | `Test-Partenaire-2026!` |

> Ce sont des comptes de DÉMO : utilise un mot de passe fort et supprime-les
> (ou change les mots de passe) avant la mise en production réelle.

## Étape 2 — Câbler rôles, canaux et partenaire (SQL Editor)

Colle ce script **après** avoir créé les 5 comptes. Il est idempotent
(rejouable) et retrouve chaque utilisateur par son email.

```sql
-- 1. ADMIN : rôle admin sur le profil (source de vérité de is_admin()).
update public.users_profile
set role = 'admin'
where lower(email) = 'admin.test@prosimport.com';

-- 2. CLIENT DIRECT : société canal 'direct' rattachée au profil.
with u as (
  select id, email from auth.users
  where lower(email) = 'direct.test@prosimport.com'
), c as (
  insert into public.companies (legal_name, trading_name, channel, is_verified)
  values ('CHR Direct Test', 'Bistrot Direct', 'direct', true)
  on conflict do nothing
  returning id
)
update public.users_profile p
set company_id = (select id from public.companies
                  where legal_name = 'CHR Direct Test' limit 1),
    role = 'buyer'
from u
where p.id = u.id;

-- 3. REVENDEUR : société canal 'revendeur'.
insert into public.companies (legal_name, trading_name, channel, is_verified)
values ('Revendeur Test SARL', 'Mobilier Pro Sud', 'revendeur', true)
on conflict do nothing;
update public.users_profile p
set company_id = (select id from public.companies
                  where legal_name = 'Revendeur Test SARL' limit 1),
    role = 'buyer'
where lower(p.email) = 'revendeur.test@prosimport.com';

-- 4. DISTRIBUTEUR : société canal 'distributeur'.
insert into public.companies (legal_name, trading_name, channel, is_verified)
values ('Distributeur Test SAS', 'Grossiste Terrasse', 'distributeur', true)
on conflict do nothing;
update public.users_profile p
set company_id = (select id from public.companies
                  where legal_name = 'Distributeur Test SAS' limit 1),
    role = 'buyer'
where lower(p.email) = 'distributeur.test@prosimport.com';

-- 5. PARTENAIRE APPORTEUR : candidature approuvée à SON email, puis
--    rattachement direct (équivaut à claim_partner_access au 1er /partner).
insert into public.partner_applications (
  status, partner_kind, company_name, contact_name,
  contact_email, contact_phone, source
) values (
  'approved', 'referrer', 'Apporteur Test', 'Testeur Partenaire',
  'partenaire.test@prosimport.com', '0600000000', 'seed_test'
)
on conflict do nothing;

insert into public.partner_users (user_id, partner_application_id, role)
select u.id, a.id, 'owner'
from auth.users u
join public.partner_applications a
  on lower(a.contact_email) = lower(u.email)
where lower(u.email) = 'partenaire.test@prosimport.com'
on conflict do nothing;
```

## Étape 3 — Vérifier le câblage

```sql
select p.email, p.role, c.legal_name, c.channel,
       exists(select 1 from public.partner_users pu where pu.user_id = p.id) as is_partner
from public.users_profile p
left join public.companies c on c.id = p.company_id
where p.email like '%.test@prosimport.com'
order by p.email;
```

Attendu : `admin` → role admin ; `revendeur`/`distributeur` → bon `channel` ;
`partenaire` → `is_partner = true`.

## Étape 4 — Tester chaque parcours

1. **Admin** (`admin.test@…`) → `/admin` : édition produits/prix, stock,
   médias, simulateur rentabilité container, commissions.
2. **Direct** (`direct.test@…`) → `/catalogue` : prix publics, panier,
   réservation complète (SIRET valide : `12345678900012` pour la démo).
3. **Revendeur** (`revendeur.test@…`) → `/catalogue` : le badge « Tarif
   Revendeur actif » apparaît dans le header, les prix affichés sont les prix
   nets revendeur (pas de paliers volume — c'est normal, la RFA les remplace).
4. **Distributeur** (`distributeur.test@…`) → prix nets distributeur.
5. **Partenaire** (`partenaire.test@…`) → `/partner` : tableau de bord
   apporteur, lien/QR de parrainage, suivi des commissions.

## Nettoyage (avant prod)

```sql
-- Supprime le câblage de test (les auth.users se suppriment dans le Dashboard).
delete from public.partner_users pu using auth.users u
  where pu.user_id = u.id and u.email like '%.test@prosimport.com';
delete from public.partner_applications where contact_email like '%.test@prosimport.com';
update public.users_profile set company_id = null
  where email like '%.test@prosimport.com';
delete from public.companies
  where legal_name in ('CHR Direct Test','Revendeur Test SARL',
                       'Distributeur Test SAS');
```
