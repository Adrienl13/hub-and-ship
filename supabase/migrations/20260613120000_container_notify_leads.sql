-- Lead capture: "notify me about the next container" (commercial track).
--
-- Converts cold SEO/editorial traffic (which currently bounces with no capture)
-- into an email list to alert when a container opens. Public can subscribe via
-- a SECURITY DEFINER RPC (validated + deduped); only admins can read the list.

create table if not exists public.container_notify_leads (
  id uuid primary key default extensions.gen_random_uuid(),
  email text not null,
  source text,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_container_notify_email
  on public.container_notify_leads (lower(email));

alter table public.container_notify_leads enable row level security;

drop policy if exists "admins read notify leads" on public.container_notify_leads;
create policy "admins read notify leads"
  on public.container_notify_leads for all
  using (public.is_admin())
  with check (public.is_admin());

-- No public INSERT policy: subscriptions go through the RPC below.

create or replace function public.subscribe_container_notification(
  p_email text,
  p_source text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'subscribe_container_notification: invalid email';
  end if;

  insert into public.container_notify_leads (email, source)
  values (v_email, nullif(btrim(coalesce(p_source, '')), ''))
  on conflict (lower(email)) do nothing;

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.subscribe_container_notification(text, text)
  from public;
grant execute on function public.subscribe_container_notification(text, text)
  to anon, authenticated;

create or replace function public.admin_list_notify_leads()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'admin_list_notify_leads: admin only';
  end if;
  select coalesce(
    jsonb_agg(
      jsonb_build_object('id', id, 'email', email, 'source', source, 'created_at', created_at)
      order by created_at desc
    ),
    '[]'::jsonb
  )
  into v_result
  from public.container_notify_leads;
  return v_result;
end;
$$;

revoke execute on function public.admin_list_notify_leads() from public, anon;
grant execute on function public.admin_list_notify_leads() to authenticated;

comment on table public.container_notify_leads is
  'Email leads to notify when a new container opens (captured site-wide).';
