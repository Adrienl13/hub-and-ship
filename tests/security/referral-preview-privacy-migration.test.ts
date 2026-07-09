import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260615154000_referral_preview_privacy.sql',
  ),
  'utf8',
)

describe('referral preview privacy migration', () => {
  it('keeps rate limiting on the public preview RPC', () => {
    expect(migration).toContain(
      'create or replace function public.preview_referral_code',
    )
    expect(migration).toContain('assert_public_action_rate_limit')
    expect(migration).toContain("'preview_referral_code'")
  })

  it('only returns referrer_label for applicable codes', () => {
    expect(migration).toContain(
      "return jsonb_build_object('status', 'inactive');",
    )
    expect(migration).toContain(
      "return jsonb_build_object('status', 'expired');",
    )
    expect(migration).toContain(
      "return jsonb_build_object('status', 'exhausted');",
    )
    expect(migration).toContain(
      "return jsonb_build_object('status', 'self_referral');",
    )
    expect(migration).toContain("'referrer_label', rc.owner_label")
  })
})
