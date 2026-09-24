import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

// Migration 59 : chaque relance envoyée depuis l'admin est tracée. L'écriture
// passe par la clé service côté serveur (aucune policy d'insertion) ; la
// lecture est réservée aux admins. Ce test verrouille le SQL versionné.
const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260924150000_admin_follow_ups.sql',
  ),
  'utf8',
)

describe('admin follow-ups migration', () => {
  it('crée la table des relances avec ses cibles et ses bornes', () => {
    expect(migration).toContain(
      'create table if not exists public.admin_follow_ups',
    )
    for (const kind of [
      'contact_request',
      'reservation',
      'stock_request',
      'partner_application',
    ]) {
      expect(migration).toContain(`'${kind}'`)
    }
    expect(migration).toContain('length(subject) <= 200')
    expect(migration).toContain('length(body) <= 6000')
    expect(migration).toContain('sent_by uuid references auth.users(id)')
  })

  it('réserve la lecture aux admins et ne donne aucune insertion publique', () => {
    expect(migration).toContain(
      'alter table public.admin_follow_ups enable row level security',
    )
    expect(migration).toContain('create policy "Admins read follow ups"')
    expect(migration).toContain('for select')
    expect(migration).not.toContain('for insert')
  })

  it('indexe la cible et le destinataire', () => {
    expect(migration).toContain('idx_admin_follow_ups_target')
    expect(migration).toContain('idx_admin_follow_ups_recipient')
  })
})
