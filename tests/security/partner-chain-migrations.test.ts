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

  it('backfills the accounts created since the breakage', () => {
    expect(signupRepair).toMatch(/insert into public\.users_profile \(id, email\)/)
    expect(signupRepair).toMatch(/where not exists/)
    expect(signupRepair).toMatch(/on conflict \(id\) do nothing/)
  })
})

describe('admin_create_partner_code (M13)', () => {
  it('is admin-gated and never anon-executable', () => {
    expect(partnerCode).toMatch(
      /current_user_role\(\) not in \('admin', 'super_admin'\)/,
    )
    expect(partnerCode).toMatch(
      /revoke execute on function public\.admin_create_partner_code\(uuid, text\)\s+from public, anon/,
    )
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
  })

  it('guarantees case-insensitive code uniqueness with a retry loop', () => {
    // matchPartnerCodeId compare en lowercase : DBP-13 ≡ dbp-13.
    expect(partnerCode).toContain('partner_codes_code_lower_uidx')
    expect(partnerCode).toMatch(/on public\.partner_codes \(lower\(code\)\)/)
    expect(partnerCode).toMatch(/exception when unique_violation/)
  })
})
