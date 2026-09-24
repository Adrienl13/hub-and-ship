-- 59. Relances envoyées depuis l'admin : chaque email de relance est tracé.
--
-- Jusqu'ici, relancer un prospect ou un client se faisait à la main, depuis
-- une boîte mail, sans trace dans l'admin. La table journalise chaque envoi
-- (cible, destinataire, sujet, corps, auteur, identifiant Brevo) ; l'onglet
-- concerné affiche « relancé le … » et la fiche client 360 la chronologie.
--
-- Écriture par la fonction serveur seulement (clé service, après
-- vérification is_admin() de l'appelant) : aucune policy d'insertion pour les
-- rôles anon/authenticated. Lecture réservée aux admins.

create table if not exists public.admin_follow_ups (
  id uuid primary key default extensions.gen_random_uuid(),
  -- contact_request | reservation | stock_request | partner_application
  target_kind text not null check (
    target_kind in ('contact_request', 'reservation', 'stock_request', 'partner_application')
  ),
  target_id uuid not null,
  recipient_email text not null check (length(recipient_email) <= 254),
  subject text not null check (length(subject) <= 200),
  body text not null check (length(body) <= 6000),
  -- Modèle utilisé : devis, informations, paiement, libre…
  template text not null default 'libre' check (length(template) <= 40),
  sent_by uuid references auth.users(id) on delete set null,
  sent_at timestamptz not null default now(),
  -- Identifiant de message rendu par Brevo, pour retrouver l'envoi.
  delivery_id text
);

create index if not exists idx_admin_follow_ups_target
  on public.admin_follow_ups(target_kind, target_id, sent_at desc);

create index if not exists idx_admin_follow_ups_recipient
  on public.admin_follow_ups(lower(recipient_email), sent_at desc);

alter table public.admin_follow_ups enable row level security;

drop policy if exists "Admins read follow ups" on public.admin_follow_ups;
create policy "Admins read follow ups"
  on public.admin_follow_ups for select
  using (public.current_user_role() in ('admin', 'super_admin'));
