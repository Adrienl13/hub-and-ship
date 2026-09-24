-- 56. Demandes de contact en base : plus un seul lead perdu dans une boîte mail.
--
-- Audit du 23/09/2026 : tout ce qui passe par /api/contact — formulaire de
-- contact, devis rapide depuis une fiche produit, coloris personnalisé,
-- plateau sur mesure, brief Studio — n'existait qu'en email. Aucune liste,
-- aucun statut, aucune relance, aucun comptage par produit, et l'origine
-- marketing (UTM, partenaire) calculée côté client partait dans l'email puis
-- disparaissait.
--
-- Même modèle que stock_requests (migration 27) : insertion publique
-- verrouillée (statut « new », pas de note interne), lecture et suivi réservés
-- aux admins, export CSV côté admin. L'email reste envoyé en plus, comme
-- notification : la table est la source de vérité.

do $$
begin
  create type public.contact_request_status as enum (
    'new',
    'contacted',
    'quoted',
    'won',
    'lost'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.contact_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  status public.contact_request_status not null default 'new',
  -- Sujet du formulaire : devis, produit, container, reservation,
  -- partenariat, autre (src/lib/contact.ts). Texte libre côté base pour ne
  -- jamais refuser un lead à cause d'un sujet ajouté côté site.
  topic text not null,
  -- Point de capture : contact_page, catalogue_quick_quote, custom_colorway,
  -- custom_tabletop, studio_brief, lieux…
  source text not null default 'contact_page',
  name text not null,
  email text not null,
  company text,
  phone text,
  message text not null,
  -- Devis rapide / coloris / plateau : le produit concerné, en colonnes pour
  -- compter et filtrer (le message garde la version lisible).
  product_sku text,
  product_name text,
  product_design text,
  quantity integer check (quantity is null or quantity > 0),
  price_label text,
  -- Brief Studio (référence de composition + texte), quand il y en a un.
  studio_brief text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  partner_ref text,
  internal_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_contact_requests_status_created
  on public.contact_requests(status, created_at desc);

create index if not exists idx_contact_requests_email_created
  on public.contact_requests(lower(email), created_at desc);

create index if not exists idx_contact_requests_topic_created
  on public.contact_requests(topic, created_at desc);

drop trigger if exists contact_requests_set_updated_at on public.contact_requests;
create trigger contact_requests_set_updated_at
  before update on public.contact_requests
  for each row execute function public.set_updated_at();

alter table public.contact_requests enable row level security;

-- Le site (clé anon, depuis /api/contact) ne peut qu'insérer un lead neuf,
-- sans note interne : il ne relit rien, ne modifie rien.
drop policy if exists "Public creates contact requests" on public.contact_requests;
create policy "Public creates contact requests"
  on public.contact_requests for insert
  with check (status = 'new' and internal_note is null);

drop policy if exists "Admins full access contact requests" on public.contact_requests;
create policy "Admins full access contact requests"
  on public.contact_requests for all
  using (public.current_user_role() in ('admin', 'super_admin'))
  with check (public.current_user_role() in ('admin', 'super_admin'));
