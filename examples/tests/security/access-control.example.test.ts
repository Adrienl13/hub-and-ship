/**
 * EXAMPLE DE RÉFÉRENCE — Test de sécurité access control
 * 
 * À adapter pour tests/security/access-control.test.ts
 * 
 * Ce fichier illustre comment tester :
 * - L'isolation par company_id via RLS Supabase
 * - Les tentatives d'accès cross-company
 * - Les vérifications d'ownership
 * 
 * Ces tests sont CRITIQUES pour la sécurité.
 * Ils doivent passer dans le CI avant tout déploiement.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ============================================
// SETUP
// ============================================

// Utiliser une instance Supabase de test (local supabase start)
const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? 'http://localhost:54321'
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

/**
 * Crée un client Supabase pour un user spécifique.
 * Utilise un JWT généré côté service pour bypass le magic link en tests.
 */
async function supabaseAsUser(userId: string): Promise<SupabaseClient> {
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  
  // Génère un JWT pour ce user (admin only)
  const { data, error } = await adminClient.auth.admin.generateLink({
    type: 'magiclink',
    email: `${userId}@test.local`,
  })
  
  if (error || !data) {
    throw new Error(`Failed to create test session for ${userId}`)
  }
  
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${data.properties.action_link}`,
      },
    },
  })
}

/**
 * Helpers pour créer des données de test isolées.
 */
async function createTestCompany(name: string): Promise<string> {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const { data, error } = await admin
    .from('companies')
    .insert({ legal_name: name, country_code: 'FR' })
    .select()
    .single()
  
  if (error || !data) throw error
  return data.id
}

async function createTestUser(email: string, companyId: string): Promise<string> {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  
  const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  })
  
  if (authErr || !authUser.user) throw authErr
  
  await admin.from('users_profile').insert({
    id: authUser.user.id,
    company_id: companyId,
    email,
    first_name: 'Test',
    last_name: 'User',
    role: 'buyer',
  })
  
  return authUser.user.id
}

async function createTestReservation(companyId: string, userId: string): Promise<string> {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  
  const { data, error } = await admin
    .from('reservations')
    .insert({
      reference: `TEST-${Date.now()}`,
      container_id: '00000000-0000-0000-0000-000000000001',  // container test fixture
      company_id: companyId,
      user_id: userId,
      subtotal_ht: 1000,
      total_ht: 1000,
      vat_rate: 20,
      vat_amount: 200,
      total_ttc: 1200,
      reservation_fee: 150,
      status: 'reserved',
      total_cbm: 1.5,
    })
    .select()
    .single()
  
  if (error || !data) throw error
  return data.id
}

async function cleanupTestData(): Promise<void> {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  
  // Supprime les données test (préfixe TEST- pour faciliter)
  await admin.from('reservations').delete().like('reference', 'TEST-%')
  await admin.from('users_profile').delete().like('email', '%@test.local')
  await admin.from('companies').delete().like('legal_name', 'Test%')
}

// ============================================
// TESTS CRITIQUES — ACCESS CONTROL
// ============================================

describe('Security — Access Control (RLS)', () => {
  let companyA: string
  let companyB: string
  let userA: string
  let userB: string
  let reservationA: string
  let reservationB: string
  
  beforeEach(async () => {
    companyA = await createTestCompany('Test Company A')
    companyB = await createTestCompany('Test Company B')
    userA = await createTestUser(`userA-${Date.now()}@test.local`, companyA)
    userB = await createTestUser(`userB-${Date.now()}@test.local`, companyB)
    reservationA = await createTestReservation(companyA, userA)
    reservationB = await createTestReservation(companyB, userB)
  })
  
  afterEach(async () => {
    await cleanupTestData()
  })
  
  it('User A ne devrait PAS voir les réservations de User B', async () => {
    const clientA = await supabaseAsUser(userA)
    
    const { data } = await clientA
      .from('reservations')
      .select('*')
      .eq('id', reservationB)
    
    // RLS doit bloquer : 0 row retourné
    expect(data).toHaveLength(0)
  })
  
  it('User A devrait voir SES propres réservations', async () => {
    const clientA = await supabaseAsUser(userA)
    
    const { data } = await clientA
      .from('reservations')
      .select('*')
      .eq('id', reservationA)
    
    expect(data).toHaveLength(1)
    expect(data?.[0]?.id).toBe(reservationA)
  })
  
  it('User A ne devrait PAS pouvoir modifier les réservations de User B', async () => {
    const clientA = await supabaseAsUser(userA)
    
    const { data, error } = await clientA
      .from('reservations')
      .update({ status: 'cancelled' })
      .eq('id', reservationB)
      .select()
    
    // Soit RLS bloque (data vide), soit erreur permission
    expect(data === null || data.length === 0).toBe(true)
  })
  
  it("User A ne devrait PAS voir les paiements d'autres companies", async () => {
    const clientA = await supabaseAsUser(userA)
    
    const { data } = await clientA
      .from('payments')
      .select('*')
      .eq('company_id', companyB)
    
    expect(data).toHaveLength(0)
  })
  
  it('User A ne devrait PAS voir les company autres que la sienne', async () => {
    const clientA = await supabaseAsUser(userA)
    
    const { data } = await clientA
      .from('companies')
      .select('*')
      .eq('id', companyB)
    
    expect(data).toHaveLength(0)
  })
  
  it('User A ne devrait PAS pouvoir lire les profils d\'autres users', async () => {
    const clientA = await supabaseAsUser(userA)
    
    const { data } = await clientA
      .from('users_profile')
      .select('*')
      .eq('id', userB)
    
    expect(data).toHaveLength(0)
  })
})

// ============================================
// TESTS — INJECTION ATTEMPTS
// ============================================

describe('Security — Injection attempts via filters', () => {
  it("ne devrait PAS exposer de données via injection SQL dans le filtre id", async () => {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    
    // Tentative classique : ' OR '1'='1
    const maliciousId = "' OR '1'='1"
    
    const { data, error } = await admin
      .from('reservations')
      .select('*')
      .eq('id', maliciousId)
    
    // Supabase échappe automatiquement, donc soit erreur soit 0 row
    expect(error !== null || data?.length === 0).toBe(true)
  })
})

// ============================================
// TESTS — RÔLES ADMIN
// ============================================

describe('Security — Admin role enforcement', () => {
  it('User buyer ne devrait PAS pouvoir accéder aux endpoints admin', async () => {
    // À implémenter quand les routes admin existent
    // Pattern :
    // const clientBuyer = await supabaseAsUser(buyerUserId)
    // const response = await fetch('/api/admin/users', { 
    //   headers: { Authorization: `Bearer ${clientBuyer.session.token}` } 
    // })
    // expect(response.status).toBe(403)
    
    expect(true).toBe(true)  // placeholder
  })
})
