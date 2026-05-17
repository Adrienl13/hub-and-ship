-- ============================================
-- EXAMPLE DE RÉFÉRENCE — Migration initiale
-- ============================================
-- À adapter pour supabase/migrations/0001_init_schema.sql
-- Cet exemple montre :
-- - Extensions à activer
-- - Conventions de nommage (snake_case)
-- - RLS systématique sur tables sensibles
-- - Index sur colonnes filtrées
-- - Triggers updated_at automatiques
-- - Commentaires SQL explicatifs
-- ============================================

-- Extensions PostgreSQL nécessaires
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================
-- TYPES ENUM
-- ============================================

create type user_role as enum ('buyer', 'admin', 'super_admin');

create type product_category as enum (
  'chair', 'armchair', 'table', 'bench', 'accessory'
);

-- ============================================
-- TABLE : countries (référentiel multi-pays)
-- ============================================

create table countries (
  code text primary key,           -- 'FR', 'ES', 'IT', 'DE'
  name text not null,
  currency text not null default 'EUR',
  vat_rate numeric(4, 2) not null default 20.00,
  locale text not null default 'fr-FR',
  is_active boolean default false, -- activé un par un
  flag_emoji text,
  created_at timestamptz default now()
);

comment on table countries is 'Référentiel pays supportés (multi-pays prêt dès V1, FR seul activé)';

-- Seed initial : France actif, autres préparés
insert into countries (code, name, currency, vat_rate, locale, is_active, flag_emoji) values
  ('FR', 'France', 'EUR', 20.00, 'fr-FR', true, '🇫🇷'),
  ('ES', 'España', 'EUR', 21.00, 'es-ES', false, '🇪🇸'),
  ('IT', 'Italia', 'EUR', 22.00, 'it-IT', false, '🇮🇹'),
  ('DE', 'Deutschland', 'EUR', 19.00, 'de-DE', false, '🇩🇪');

-- ============================================
-- TABLE : companies
-- ============================================

create table companies (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  trading_name text,
  
  -- Identifiants nationaux (V1.3)
  siret text,
  siren text,
  vat_number text,
  country_code text references countries(code) default 'FR',
  
  -- Vérification SIRET via API INSEE (V1.3)
  siret_verified boolean default false,
  siret_verified_at timestamptz,
  naf_code text,
  naf_label text,
  legal_form text,
  creation_date date,
  is_active_company boolean default true,
  
  -- Anti-fraude
  risk_flag text default 'normal' check (risk_flag in ('normal', 'review', 'blocked')),
  
  -- Contact & adresses
  billing_email text,
  billing_phone text,
  billing_address jsonb,
  
  -- Fidélité
  total_containers_completed int default 0,
  total_lifetime_value numeric(12, 2) default 0,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Contrainte unicité SIRET (1 SIRET = 1 compte actif)
create unique index idx_companies_siret_unique
  on companies(siret)
  where siret is not null and risk_flag != 'blocked';

-- Index pour recherche par pays
create index idx_companies_country on companies(country_code);

comment on table companies is 'Entreprises clientes B2B (SIRET vérifié via INSEE)';

-- ============================================
-- TRIGGER : updated_at automatique
-- ============================================

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger companies_updated_at
  before update on companies
  for each row execute function set_updated_at();

-- ============================================
-- TABLE : users_profile (lié à auth.users)
-- ============================================

create table users_profile (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid references companies(id),
  first_name text,
  last_name text,
  email text not null,
  phone text,
  role user_role default 'buyer',
  
  -- Consentements RGPD
  email_marketing_consent boolean default false,
  cgv_accepted_at timestamptz,
  cgv_version_accepted text,
  
  last_login_at timestamptz,
  preferred_locale text default 'fr-FR',
  created_at timestamptz default now()
);

create index idx_users_profile_company on users_profile(company_id);
create index idx_users_profile_email on users_profile(email);

-- ============================================
-- ROW LEVEL SECURITY (CRITIQUE)
-- ============================================

alter table companies enable row level security;
alter table users_profile enable row level security;

-- Policy : Users voient leur propre profil
create policy "users_see_own_profile" on users_profile
  for select
  using (id = auth.uid());

-- Policy : Users mettent à jour leur propre profil
create policy "users_update_own_profile" on users_profile
  for update
  using (id = auth.uid());

-- Policy : Users voient leur company
create policy "users_see_own_company" on companies
  for select
  using (
    id in (
      select company_id from users_profile where id = auth.uid()
    )
  );

-- Policy : Admins voient tout
create policy "admins_full_access_companies" on companies
  for all
  using (
    (select role from users_profile where id = auth.uid()) in ('admin', 'super_admin')
  );

create policy "admins_full_access_users" on users_profile
  for all
  using (
    (select role from users_profile where id = auth.uid()) in ('admin', 'super_admin')
  );

-- ============================================
-- FIN MIGRATION 0001
-- ============================================
-- Voir migrations suivantes pour :
-- 0002 : Products, variants, containers, MOQ
-- 0003 : Reservations, items, payments
-- 0004 : Referrals (V1.1)
-- 0005 : Reviews (V1.1)
-- 0006 : Callbacks (V1.1)
-- 0007 : Documents qualité (V1.1)
-- 0008 : Claims SAV (V1.1)
-- 0009 : Audit log
-- 0010 : Security events + SIRET cache (V1.3)
-- 0011 : Carrier partners + delivery history (V1.2)
