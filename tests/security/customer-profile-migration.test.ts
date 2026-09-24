import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

// Migration 57 : fiche client complète (établissement, téléphone,
// consentement, dernière connexion). Les écritures sur companies restent
// interdites aux acheteurs : set_my_company est le seul chemin, et il ne
// touche qu'à l'établissement du connecté.
const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260924091000_customer_profile_completeness.sql',
  ),
  'utf8',
)

function functionBody(name: string): string {
  const start = migration.indexOf(`create or replace function public.${name}`)
  expect(start).toBeGreaterThanOrEqual(0)
  const end = migration.indexOf('$$;', start)
  return migration.slice(start, end)
}

describe('customer profile completeness migration', () => {
  it('handle_new_user recopie téléphone, consentement et crée l’établissement', () => {
    const body = functionBody('handle_new_user')
    expect(body).toContain('security definer')
    expect(body).toContain('set search_path = public, pg_temp')
    expect(body).toContain("raw_user_meta_data ->> 'company_name'")
    expect(body).toContain("raw_user_meta_data ->> 'phone'")
    expect(body).toContain("raw_user_meta_data ->> 'email_marketing_consent'")
    expect(body).toContain(
      'insert into public.companies (legal_name, trading_name)',
    )
    expect(body).toContain(
      'email_marketing_consent, email_marketing_consent_at',
    )
    expect(body).toContain('on conflict (id) do update')
    // Un email déjà pris ne bloque jamais l'inscription.
    expect(body).toContain('exception when unique_violation then')
  })

  it('ne garde qu’un déclencheur à la création de compte', () => {
    expect(migration).toContain(
      'drop trigger if exists on_auth_user_created on auth.users',
    )
    expect(migration).not.toMatch(/create trigger on_auth_user_created\b/)
  })

  it('set_my_company : authentifié seulement, son établissement seulement', () => {
    const body = functionBody('set_my_company')
    expect(body).toContain('returns uuid')
    expect(body).toContain('security definer')
    expect(body).toContain('set search_path = public, pg_temp')
    expect(body).toContain('auth.uid()')
    expect(body).toContain("raise exception 'not_authenticated'")
    expect(body).toContain("raise exception 'company_name_required'")
    // L'établissement est lu depuis le profil du connecté, jamais passé en
    // paramètre : impossible de renommer celui d'un autre.
    expect(body).toContain('from public.users_profile')
    expect(body).toContain('where id = v_uid')
    expect(body).not.toMatch(/p_company_id/)
    // La raison sociale ne bouge plus une fois le SIRET vérifié.
    expect(body).toContain(
      'legal_name = case when siret_verified then legal_name else v_name end',
    )
  })

  it('révoque set_my_company à anon/public et l’accorde aux connectés', () => {
    expect(migration).toContain(
      'revoke execute on function public.set_my_company(text) from public, anon',
    )
    expect(migration).toContain(
      'grant execute on function public.set_my_company(text) to authenticated',
    )
  })

  it('n’ouvre aucune écriture directe sur companies aux acheteurs', () => {
    expect(migration).not.toMatch(/create policy [^;]*on public\.companies/i)
    expect(migration).not.toMatch(
      /grant (insert|update|all)[^;]*on (table )?public\.companies/i,
    )
  })

  it('last_login_at suit auth.users.last_sign_in_at', () => {
    const body = functionBody('handle_user_signed_in')
    expect(body).toContain('security definer')
    expect(body).toContain(
      'if new.last_sign_in_at is distinct from old.last_sign_in_at then',
    )
    expect(body).toContain('set last_login_at = new.last_sign_in_at')
    expect(migration).toContain(
      'drop trigger if exists on_auth_user_signed_in on auth.users',
    )
    expect(migration).toContain('after update of last_sign_in_at on auth.users')
    expect(migration).toContain(
      'execute function public.handle_user_signed_in()',
    )
  })

  it('rattrape les comptes existants sans écraser ce qui est déjà renseigné', () => {
    expect(migration).toContain(
      'and (p.last_login_at is null or p.last_login_at < u.last_sign_in_at)',
    )
    expect(migration).toContain('and p.phone is null')
    expect(migration).toContain('where p.company_id is null')
  })
})
