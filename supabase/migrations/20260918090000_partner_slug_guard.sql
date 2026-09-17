-- 46. Fermer les pages co-brandées ouvertes à tout vent.
--
-- `/p/<n'importe quoi>` affiche « <Marque> vous ouvre son accès Terrassea. »
-- sans aucun contrôle : aucun loader, aucune requête. Le contexte est en plus
-- mémorisé 120 jours et ré-affiché au récapitulatif de réservation
-- (« Lien partenaire : Ikea »). Aggravation trouvée pendant l'audit du
-- 17 septembre : `/p/<slug arbitraire>?selection=<uuid>` affiche la sélection
-- publiée d'un VRAI partenaire sous un nom arbitraire, parce que
-- getPublicSelection() ne cherche que par identifiant, sans vérifier à qui
-- elle appartient. Un tiers peut donc re-marquer un devis co-brandé
-- authentique. Le noindex bloque l'indexation, pas le partage WhatsApp.
--
-- Aucune donnée partenaire n'est exposée (les prix affichés sont publics) :
-- le préjudice est réputationnel et de hameçonnage.
--
-- Deux fonctions, deux questions fermées, aucune donnée en retour au-delà
-- d'un booléen — pas d'énumération possible.

-- Un slug est « actif » exactement au sens de l'index unique posé par la
-- migration 20260607090000 : slug renseigné, candidature qualifiée ou
-- approuvée. Une seule définition, pas deux qui divergent.
create or replace function public.partner_slug_is_active(p_slug text)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select exists (
    select 1
    from public.partner_applications a
    where a.partner_referral_slug is not null
      and lower(a.partner_referral_slug)
          = public.normalize_partner_slug(p_slug)
      and a.status in (
        'qualified'::public.partner_application_status,
        'approved'::public.partner_application_status
      )
  );
$function$;

comment on function public.partner_slug_is_active(text) is
  'Le slug /p/<slug> correspond-il à un partenaire qualifié ou approuvé ? Booléen seul : aucune donnée partenaire ne sort d''ici.';

-- La sélection publiée appartient-elle bien à CE partenaire ? Répond faux
-- pour une sélection inconnue, non publiée, ou publiée par quelqu'un d'autre.
create or replace function public.published_selection_belongs_to_slug(
  p_selection uuid,
  p_slug text
)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select exists (
    select 1
    from public.partner_selections s
    join public.partner_applications a
      on a.id = s.partner_application_id
    where s.id = p_selection
      and s.status = 'published'::public.partner_selection_status
      and a.partner_referral_slug is not null
      and lower(a.partner_referral_slug)
          = public.normalize_partner_slug(p_slug)
  );
$function$;

comment on function public.published_selection_belongs_to_slug(uuid, text) is
  'La sélection publiée appartient-elle à ce partenaire ? Empêche de re-marquer le devis co-brandé d''un tiers sous un autre nom.';

revoke all on function public.partner_slug_is_active(text) from public;
revoke all on function public.published_selection_belongs_to_slug(uuid, text) from public;
grant execute on function public.partner_slug_is_active(text) to anon, authenticated;
grant execute on function public.published_selection_belongs_to_slug(uuid, text) to anon, authenticated;
