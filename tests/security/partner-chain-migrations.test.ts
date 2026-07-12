import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const signupRepair = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260711170000_users_profile_signup_repair.sql',
  ),
  'utf8',
)
const partnerCode = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260711180000_admin_create_partner_code.sql',
  ),
  'utf8',
)

describe('users_profile signup repair (M14)', () => {
  it('adds a SECOND trigger without touching the professionals one', () => {
    expect(signupRepair).toContain('on_auth_user_created_profile')
    expect(signupRepair).toMatch(
      /after insert on auth\.users\s+for each row execute function public\.handle_new_user\(\)/,
    )
    // Ne remplace PAS le trigger existant du rattrapage.
    expect(signupRepair).not.toContain(
      'drop trigger if exists on_auth_user_created on',
    )
  })

  it('never lets the trigger break a signup (lower(email) unique index)', () => {
    // Une violation d'unicité sur lower(email) annulerait l'insert auth.users
    // entier → signup en 500. Le trigger doit l'avaler.
    expect(signupRepair).toMatch(/exception when unique_violation/)
    // Et conserve le corps d'origine (prénom/nom + refresh email).
    expect(signupRepair).toMatch(/first_name, last_name/)
    expect(signupRepair).toMatch(/on conflict \(id\) do update/)
  })

  it('backfills the accounts created since the breakage, dedup-safe', () => {
    expect(signupRepair).toMatch(/insert into public\.users_profile \(id, email\)/)
    expect(signupRepair).toMatch(/where not exists/)
    expect(signupRepair).toMatch(/on conflict \(id\) do nothing/)
    // Deux comptes au même email (ou un email déjà pris par un vieux profil)
    // ne doivent pas faire avorter la migration.
    expect(signupRepair).toMatch(/distinct on \(lower\(coalesce\(u\.email, ''\)\)\)/)
    expect(signupRepair).toMatch(/lower\(p2\.email\) = lower\(coalesce\(u\.email, ''\)\)/)
  })
})

describe('admin_create_partner_code (M13)', () => {
  it('is admin-gated (NULL-safe) and never anon-executable', () => {
    // is_admin() coalesce à false quand le caller n'a pas de users_profile —
    // `current_user_role() not in (...)` serait fail-open dans ce cas.
    expect(partnerCode).toMatch(/if not public\.is_admin\(\) then/)
    expect(partnerCode).not.toMatch(/current_user_role\(\) not in/)
    expect(partnerCode).toMatch(
      /revoke execute on function public\.admin_create_partner_code\(uuid, text\)\s+from public, anon/,
    )
  })

  it('refuses non-approved applications server-side', () => {
    expect(partnerCode).toMatch(/v_status is distinct from 'approved'/)
  })

  it('is idempotent and provisions/links the partner company (M14 coupling)', () => {
    // Re-clic → renvoie le code actif existant au lieu d'en créer un 2e.
    expect(partnerCode).toMatch(/where company_id = v_company_id and active/)
    expect(partnerCode).toMatch(/'created', false/)
    // Provisionne la société et relie le compte du partenaire.
    expect(partnerCode).toMatch(/insert into public\.companies \(legal_name, siret\)/)
    expect(partnerCode).toMatch(
      /update public\.users_profile\s+set company_id = v_company_id/,
    )
    // Deux admins simultanés ne créent pas deux codes actifs.
    expect(partnerCode).toMatch(/pg_advisory_xact_lock/)
  })

  it('resolves an existing company by SIRET before creating one', () => {
    // idx_companies_siret_unique : recréer une société au même SIRET ferait
    // échouer le RPC — on retrouve la société existante à la place.
    expect(partnerCode).toMatch(/where siret = v_siret/)
    expect(partnerCode).toMatch(/exception when unique_violation/)
  })

  it('guarantees case-insensitive code uniqueness with a retry loop', () => {
    // matchPartnerCodeId compare en lowercase : DBP-13 ≡ dbp-13.
    expect(partnerCode).toContain('partner_codes_code_lower_uidx')
    expect(partnerCode).toMatch(/on public\.partner_codes \(lower\(code\)\)/)
  })

  it('closes the "code generated before the account" loop (claim v2)', () => {
    // La candidature mémorise sa société…
    expect(partnerCode).toMatch(
      /alter table public\.partner_applications\s+add column if not exists company_id/,
    )
    // …et claim_partner_access rattache le compte au premier login (email ou
    // société), pour que l'apporteur voie son code sans re-clic admin.
    expect(partnerCode).toMatch(
      /create or replace function public\.claim_partner_access\(\)/,
    )
    expect(partnerCode).toMatch(/up\.id = v_uid and up\.company_id is null/)
    expect(partnerCode).toMatch(/a\.company_id = up\.company_id/)
  })
})
