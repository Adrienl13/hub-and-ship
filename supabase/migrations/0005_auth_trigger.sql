-- ============================================================
-- Auto-création du profil pro à la création d'un auth.users.
-- Les champs viennent de raw_user_meta_data renseigné par le client
-- via supabase.auth.signUp({ ..., options: { data: { ... } } }).
-- Si les champs minimum ne sont pas fournis (création admin par ex),
-- on ignore silencieusement.
-- ============================================================

create or replace function public.handle_new_professional()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.raw_user_meta_data ->> 'company_name' is not null
     and new.raw_user_meta_data ->> 'siret' is not null
     and new.raw_user_meta_data ->> 'contact_name' is not null
     and new.raw_user_meta_data ->> 'phone' is not null then
    insert into public.professionals (
      id, company_name, contact_name, email, phone, siret, delivery_zip
    ) values (
      new.id,
      new.raw_user_meta_data ->> 'company_name',
      new.raw_user_meta_data ->> 'contact_name',
      new.email,
      new.raw_user_meta_data ->> 'phone',
      new.raw_user_meta_data ->> 'siret',
      new.raw_user_meta_data ->> 'delivery_zip'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_professional();
