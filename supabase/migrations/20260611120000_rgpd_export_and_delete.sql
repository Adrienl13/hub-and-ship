-- RGPD self-service: data export + right to erasure (audit Sprint 3, 2026-06-11).
--
-- The enums security_event_type.data_export / data_deletion existed but no code
-- implemented either right. These two SECURITY DEFINER RPCs let an authenticated
-- user (1) download all their personal data and (2) erase their account.
--
-- Erasure keeps legally-required records: issued invoices (10-year accounting
-- retention obligation in France) retain their own immutable snapshot. The
-- reservations' personal contact details are anonymised; the auth identity is
-- hard-deleted, which CASCADE-removes users_profile / professionals /
-- reservation_claims / partner_users. Admins cannot self-delete here (protects
-- the sole admin and avoids the invoices.created_by / reviewed_by FK blocks).

-- ---- Export ----------------------------------------------------------------
create or replace function public.export_my_account_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(nullif(auth.jwt() ->> 'email', ''));
  v_result jsonb;
begin
  if v_uid is null then
    raise exception 'export_my_account_data: not authenticated';
  end if;

  select jsonb_build_object(
    'generated_at', now(),
    'user_id', v_uid,
    'email', v_email,
    'profile', (select to_jsonb(p) from public.users_profile p where p.id = v_uid),
    'company', (
      select to_jsonb(c)
      from public.companies c
      join public.users_profile p on p.company_id = c.id
      where p.id = v_uid
    ),
    'reservations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'reservation', to_jsonb(r),
        'items', (
          select jsonb_agg(to_jsonb(i))
          from public.reservation_items i
          where i.reservation_id = r.id
        )
      ))
      from public.reservations r
      where r.user_id = v_uid
        or (v_email is not null and lower(r.contact_snapshot ->> 'email') = v_email)
    ), '[]'::jsonb),
    'invoices', coalesce((
      select jsonb_agg(to_jsonb(inv))
      from public.invoices inv
      where inv.reservation_id in (
        select r.id from public.reservations r
        where r.user_id = v_uid
          or (v_email is not null and lower(r.contact_snapshot ->> 'email') = v_email)
      )
    ), '[]'::jsonb)
  ) into v_result;

  insert into public.security_events (event_type, user_id, severity, metadata)
  values ('data_export', v_uid, 'info', jsonb_build_object('at', now()));

  return v_result;
end;
$$;

revoke execute on function public.export_my_account_data() from public, anon;
grant execute on function public.export_my_account_data() to authenticated;

-- ---- Erasure ---------------------------------------------------------------
create or replace function public.delete_my_account()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(nullif(auth.jwt() ->> 'email', ''));
  v_scrubbed integer := 0;
begin
  if v_uid is null then
    raise exception 'delete_my_account: not authenticated';
  end if;

  -- Admins must be off-boarded by another admin (also dodges the NO ACTION FKs
  -- invoices.created_by / partner_applications.reviewed_by).
  if public.is_admin() then
    raise exception 'delete_my_account: admin accounts cannot self-delete';
  end if;

  -- Dissociate the user's audit trail (also unlinks IP/user-agent PII) so the
  -- users_profile cascade is not blocked by security_events.user_id (NO ACTION),
  -- then record the erasure with no personal reference.
  update public.security_events set user_id = null where user_id = v_uid;
  insert into public.security_events (event_type, severity, metadata)
  values ('data_deletion', 'warning', jsonb_build_object('at', now()));

  -- Anonymise personal contact details AND unlink this user's reservations
  -- (reservations.user_id -> users_profile is NO ACTION and would otherwise
  -- block the cascade). Issued invoices keep their own legal snapshot untouched.
  update public.reservations
     set contact_snapshot = jsonb_build_object('anonymized', true),
         user_id = null
   where user_id = v_uid
      or (v_email is not null and lower(contact_snapshot ->> 'email') = v_email);
  get diagnostics v_scrubbed = row_count;

  -- Hard-delete the auth identity. CASCADE removes users_profile,
  -- professionals, reservation_claims, partner_users.
  delete from auth.users where id = v_uid;

  return jsonb_build_object('deleted', true, 'reservations_anonymized', v_scrubbed);
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

comment on function public.export_my_account_data() is
  'RGPD: returns all personal data of the signed-in user as JSON (right of access/portability).';
comment on function public.delete_my_account() is
  'RGPD: anonymises personal data and hard-deletes the signed-in user identity (right to erasure). Admins excluded. Legal invoices retained.';
