-- Fusion Claude x Codex — extension de la table candidatures (codex) avec les
-- champs de la page /partenaires (mockup) + attribution first-touch (LOT 2).
--
-- La table public.partner_applications (pipeline codex: new→reviewing→
-- qualified→approved/rejected/archived, partner_kind, deals) est le socle.
-- On y ajoute: le profil d'activité métier, le statut visé par le candidat,
-- le flag de vérification SIRET (INSEE déférée à l'admin), et l'attribution.

do $$ begin
  create type public.partner_target_status as enum
    ('apporteur', 'revendeur', 'grand_compte', 'distributeur', 'nsp');
exception when duplicate_object then null;
end $$;

alter table public.partner_applications
  add column if not exists activity_profile text,
  add column if not exists target_status public.partner_target_status,
  add column if not exists siret_verified boolean not null default false,
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists partner_ref text;

create index if not exists partner_applications_partner_ref_idx
  on public.partner_applications (partner_ref)
  where partner_ref is not null;

comment on column public.partner_applications.target_status is
  'Statut partenaire visé par le candidat (page /partenaires). L''attribution effective du statut/canal reste une décision admin (décision #2).';
comment on column public.partner_applications.partner_ref is
  'Code partenaire first-touch (?ref=) présent lors de la candidature (nullable).';
