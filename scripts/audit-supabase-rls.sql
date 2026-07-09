\pset pager off
\pset null '(null)'

\echo '== Supabase RLS/Table Grants =='
select
  n.nspname as schema,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced,
  coalesce(
    string_agg(
      distinct concat(tg.grantee, ':', tg.privilege_type),
      ', ' order by concat(tg.grantee, ':', tg.privilege_type)
    ),
    ''
  ) as grants
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join information_schema.role_table_grants tg
  on tg.table_schema = n.nspname
 and tg.table_name = c.relname
 and tg.grantee in ('anon', 'authenticated', 'public')
where n.nspname in ('public', 'storage')
  and c.relkind in ('r', 'p')
group by n.nspname, c.relname, c.relrowsecurity, c.relforcerowsecurity
order by n.nspname, c.relname;

\echo ''
\echo '== Policies =='
select
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;

\echo ''
\echo '== Public/Auth Callable Functions =='
with function_acl as (
  select
    n.nspname as schema,
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as args,
    p.prosecdef as security_definer,
    coalesce(
      array_to_string(p.proconfig, ', '),
      ''
    ) as config,
    has_function_privilege('anon', p.oid, 'execute') as anon_execute,
    has_function_privilege('authenticated', p.oid, 'execute') as authenticated_execute,
    has_function_privilege('public', p.oid, 'execute') as public_execute
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
)
select *
from function_acl
where anon_execute or authenticated_execute or public_execute or security_definer
order by function_name, args;

\echo ''
\echo '== Storage Buckets =='
select
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
from storage.buckets
order by id;

\echo ''
\echo '== High-Signal Warnings =='
with public_tables_without_rls as (
  select format('table_without_rls: %I.%I', n.nspname, c.relname) as warning
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and not c.relrowsecurity
),
security_definer_without_search_path as (
  select format(
    'security_definer_without_search_path: %I.%I(%s)',
    n.nspname,
    p.proname,
    pg_get_function_identity_arguments(p.oid)
  ) as warning
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and not exists (
      select 1
      from unnest(coalesce(p.proconfig, array[]::text[])) cfg
      where cfg like 'search_path=%'
    )
),
anon_writes as (
  select format(
    'anon_table_write_grant: %I.%I %s',
    table_schema,
    table_name,
    privilege_type
  ) as warning
  from information_schema.role_table_grants
  where table_schema = 'public'
    and grantee = 'anon'
    and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
)
select warning from public_tables_without_rls
union all
select warning from security_definer_without_search_path
union all
select warning from anon_writes
order by warning;
