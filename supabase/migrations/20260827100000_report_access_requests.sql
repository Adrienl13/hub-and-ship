-- 28 — accès aux rapports de tests sur AUTORISATION (décision Adrien
-- 27/08/2026) : les rapports SGS ne doivent pas être téléchargeables par
-- n'importe quel compte connecté. Le visiteur demande l'accès (prénom, nom,
-- email, téléphone, SIREN), l'admin approuve, et seul un compte connecté
-- dont la demande est approuvée (même user_id OU même email) obtient les
-- URLs signées.
--
-- Pas de policy INSERT publique : la création passe par /api/report-access
-- (service role) qui valide le SIREN (9 chiffres + clé de Luhn), déduplique
-- par email et notifie l'admin par email.

create table public.report_access_requests (
  id uuid primary key default gen_random_uuid(),
  first_name text not null check (char_length(first_name) between 1 and 80),
  last_name text not null check (char_length(last_name) between 1 and 80),
  email text not null check (position('@' in email) > 1 and char_length(email) <= 254),
  phone text not null check (char_length(phone) between 6 and 40),
  siren text not null check (siren ~ '^[0-9]{9}$'),
  -- Renseigné quand le demandeur était connecté au moment de la demande.
  user_id uuid references auth.users (id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  admin_note text check (char_length(admin_note) <= 500),
  decided_at timestamptz,
  decided_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Un email n'a qu'une demande « vivante » (en attente ou approuvée) à la
-- fois ; une demande rejetée n'empêche pas de redemander plus tard.
create unique index report_access_requests_live_email
  on public.report_access_requests (lower(email))
  where status in ('pending', 'approved');

create index report_access_requests_status_idx
  on public.report_access_requests (status, created_at desc);

alter table public.report_access_requests enable row level security;

create policy "Admins manage report access requests"
  on public.report_access_requests
  for all
  using (public.current_user_role() in ('admin', 'super_admin'))
  with check (public.current_user_role() in ('admin', 'super_admin'));

-- Le demandeur connecté peut consulter le statut de SA demande (rattachée
-- par compte ou par l'email de son jeton).
create policy "Users read own report access request"
  on public.report_access_requests
  for select
  using (
    auth.uid() is not null
    and (
      user_id = auth.uid()
      or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );
