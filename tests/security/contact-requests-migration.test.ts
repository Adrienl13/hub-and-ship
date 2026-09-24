import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

// Migration 56 : les demandes /api/contact vivent en base. Le site (clé anon)
// ne peut qu'insérer un lead neuf sans note interne ; lecture et suivi sont
// réservés aux admins. Ce test verrouille le SQL versionné.
const migration = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260924090000_contact_requests.sql',
  ),
  'utf8',
)

describe('contact requests migration', () => {
  it('crée le statut (new → contacted → quoted → won / lost) et la table', () => {
    expect(migration).toContain('create type public.contact_request_status')
    for (const status of ['new', 'contacted', 'quoted', 'won', 'lost']) {
      expect(migration).toContain(`'${status}'`)
    }
    expect(migration).toContain(
      'create table if not exists public.contact_requests',
    )
    expect(migration).toContain(
      "status public.contact_request_status not null default 'new'",
    )
    expect(migration).toContain('topic text not null')
    expect(migration).toContain("source text not null default 'contact_page'")
    expect(migration).toContain('name text not null')
    expect(migration).toContain('email text not null')
    expect(migration).toContain('message text not null')
  })

  it('garde le produit, le brief Studio et l’attribution en colonnes', () => {
    for (const column of [
      'product_sku text',
      'product_name text',
      'product_design text',
      'quantity integer check (quantity is null or quantity > 0)',
      'price_label text',
      'studio_brief text',
      'utm_source text',
      'utm_medium text',
      'utm_campaign text',
      'partner_ref text',
      'internal_note text',
    ]) {
      expect(migration).toContain(column)
    }
  })

  it('active la RLS : insertion publique verrouillée, gestion admin', () => {
    expect(migration).toContain(
      'alter table public.contact_requests enable row level security',
    )
    expect(migration).toContain(
      'create policy "Public creates contact requests"',
    )
    expect(migration).toContain(
      "with check (status = 'new' and internal_note is null)",
    )
    expect(migration).toContain(
      'create policy "Admins full access contact requests"',
    )
    expect(migration).toContain(
      "using (public.current_user_role() in ('admin', 'super_admin'))",
    )
    // Aucune politique de lecture publique : le site ne relit rien.
    expect(migration).not.toMatch(
      /create policy "Public (reads|selects)[^"]*" on public\.contact_requests/,
    )
  })

  it('indexe les recherches admin et date les mises à jour', () => {
    expect(migration).toContain('idx_contact_requests_status_created')
    expect(migration).toContain('idx_contact_requests_email_created')
    expect(migration).toContain('idx_contact_requests_topic_created')
    expect(migration).toContain('contact_requests_set_updated_at')
    expect(migration).toContain('execute function public.set_updated_at()')
  })

  it('reste rejouable (idempotente)', () => {
    expect(migration).toContain('when duplicate_object then null')
    expect(migration).toContain(
      'drop trigger if exists contact_requests_set_updated_at',
    )
    expect(migration).toContain(
      'drop policy if exists "Public creates contact requests"',
    )
    expect(migration).toContain(
      'drop policy if exists "Admins full access contact requests"',
    )
  })
})

// Migration 58 : durcissement après revue — bornes de taille en base (la clé
// anon peut contourner /api/contact), policy d'insertion limitée aux rôles
// anon/authenticated, renommage d'établissement réservé à un seul membre.
const hardening = readFileSync(
  join(
    process.cwd(),
    'supabase/migrations/20260924120000_contact_requests_hardening.sql',
  ),
  'utf8',
)

describe('contact requests hardening migration', () => {
  it('borne chaque colonne texte et la quantité', () => {
    expect(hardening).toContain('add constraint contact_requests_lengths check')
    expect(hardening).toContain('length(message) <= 6000')
    expect(hardening).toContain('length(email) <= 254')
    expect(hardening).toContain('quantity is null or quantity <= 100000')
  })

  it('restreint l’insertion publique aux rôles anon et authenticated', () => {
    expect(hardening).toContain(
      'create policy "Public creates contact requests"',
    )
    expect(hardening).toContain('to anon, authenticated')
    expect(hardening).toContain("status = 'new' and internal_note is null")
  })

  it('interdit à un membre de renommer un établissement partagé', () => {
    expect(hardening).toContain(
      'create or replace function public.set_my_company',
    )
    expect(hardening).toContain('if v_members > 1 then')
    expect(hardening).toContain(
      'revoke execute on function public.set_my_company(text) from public, anon',
    )
    expect(hardening).toContain(
      'grant execute on function public.set_my_company(text) to authenticated',
    )
  })
})
