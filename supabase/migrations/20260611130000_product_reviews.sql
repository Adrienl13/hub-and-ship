-- Verified-purchase product reviews (commercial track, 2026-06-11).
--
-- Replaces the hardcoded fake reviews (ProductReviews.tsx) with real reviews
-- that only a customer who actually ordered the product can submit. Each review
-- is moderated by an admin before publication. Published reviews are public and
-- feed Product JSON-LD aggregateRating (Google star eligibility) + the /avis
-- page. Google Business reviews stay brand-level (a separate CTA on /avis).

create table if not exists public.product_reviews (
  id uuid primary key default extensions.gen_random_uuid(),
  product_id text not null references public.products(id) on delete cascade,
  reservation_id uuid references public.reservations(id) on delete set null,
  user_id uuid,
  author_name text not null,
  company_name text,
  rating int not null check (rating between 1 and 5),
  title text,
  body text not null,
  status text not null default 'pending' check (status in ('pending', 'published', 'rejected')),
  verified_purchase boolean not null default true,
  admin_note text,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists idx_product_reviews_published
  on public.product_reviews (product_id, published_at desc)
  where status = 'published';

-- One active (non-rejected) review per product per user.
create unique index if not exists uq_product_reviews_one_per_user_product
  on public.product_reviews (product_id, user_id)
  where status <> 'rejected';

-- Stamp published_at when a review is first published.
create or replace function public.set_review_published_at()
returns trigger language plpgsql as $$
begin
  if new.status = 'published' and new.status is distinct from old.status then
    new.published_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists product_reviews_set_updated_at on public.product_reviews;
create trigger product_reviews_set_updated_at
  before update on public.product_reviews
  for each row execute function public.set_updated_at();

drop trigger if exists product_reviews_set_published_at on public.product_reviews;
create trigger product_reviews_set_published_at
  before update on public.product_reviews
  for each row execute function public.set_review_published_at();

alter table public.product_reviews enable row level security;

drop policy if exists "published reviews are public" on public.product_reviews;
create policy "published reviews are public"
  on public.product_reviews for select
  using (status = 'published');

drop policy if exists "authors read own reviews" on public.product_reviews;
create policy "authors read own reviews"
  on public.product_reviews for select
  using (user_id = auth.uid());

drop policy if exists "admins manage reviews" on public.product_reviews;
create policy "admins manage reviews"
  on public.product_reviews for all
  using (public.is_admin())
  with check (public.is_admin());

grant select on public.product_reviews to anon, authenticated;
grant update on public.product_reviews to authenticated; -- admins, gated by RLS

-- Submission: SECURITY DEFINER so it can prove the purchase across RLS and
-- insert past the (deliberately absent) INSERT policy. Verifies the caller
-- actually ordered the product before accepting a 'pending' review.
create or replace function public.submit_product_review(
  p_product_id text,
  p_rating int,
  p_title text,
  p_body text,
  p_author_name text,
  p_company_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(nullif(auth.jwt() ->> 'email', ''));
  v_reservation_id uuid;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'submit_product_review: not authenticated';
  end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'submit_product_review: rating must be between 1 and 5';
  end if;
  if coalesce(btrim(p_body), '') = '' then
    raise exception 'submit_product_review: body required';
  end if;

  -- Verified purchase: the caller must own a reservation containing the product.
  select r.id into v_reservation_id
  from public.reservation_items ri
  join public.reservations r on r.id = ri.reservation_id
  where ri.product_id = p_product_id
    and (r.user_id = v_uid
         or (v_email is not null and lower(r.contact_snapshot ->> 'email') = v_email))
  order by r.created_at desc
  limit 1;

  if v_reservation_id is null then
    raise exception 'submit_product_review: no verified purchase for this product';
  end if;

  if exists (
    select 1 from public.product_reviews
    where product_id = p_product_id and user_id = v_uid and status <> 'rejected'
  ) then
    raise exception 'submit_product_review: a review already exists for this product';
  end if;

  insert into public.product_reviews (
    product_id, reservation_id, user_id, author_name, company_name,
    rating, title, body, status, verified_purchase
  )
  values (
    p_product_id,
    v_reservation_id,
    v_uid,
    coalesce(nullif(btrim(p_author_name), ''), 'Client vérifié'),
    nullif(btrim(p_company_name), ''),
    p_rating,
    nullif(btrim(p_title), ''),
    btrim(p_body),
    'pending',
    true
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.submit_product_review(text, int, text, text, text, text)
  from public, anon;
grant execute on function public.submit_product_review(text, int, text, text, text, text)
  to authenticated;

comment on table public.product_reviews is
  'Verified-purchase, admin-moderated product reviews; published rows are public and feed Product aggregateRating.';
comment on function public.submit_product_review(text, int, text, text, text, text) is
  'Submits a pending review after verifying the caller actually ordered the product.';
