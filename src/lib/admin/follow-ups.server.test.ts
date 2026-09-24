import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Cœur de la fonction serveur d'envoi de relance, testé sans transport HTTP :
// session admin, Brevo et client service sont remplacés. Aucune donnée client
// réelle.

const callerAdminId = vi.fn<() => Promise<string | null>>()
const sendEmail = vi.fn()
const insertSingle = vi.fn()
const insert = vi.fn(() => ({
  select: () => ({ single: () => insertSingle() }),
}))
// Relecture de la cible (clé service) : l'adresse portée par la demande.
const lookupSingle = vi.fn()
const lookupSelect = vi.fn(() => ({
  eq: () => ({ maybeSingle: () => lookupSingle() }),
}))
const from = vi.fn(() => ({ insert, select: lookupSelect }))
const getSupabaseAdmin = vi.fn(() => ({ from }))

vi.mock('@/lib/auth/server-admin', () => ({
  callerAdminId: () => callerAdminId(),
  callerIsAdmin: async () => (await callerAdminId()) !== null,
}))

vi.mock('@/lib/email/server', () => ({
  sendEmail: (...args: unknown[]) => sendEmail(...args),
  getAdminNotificationEmail: () => 'admin@exemple.test',
}))

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => getSupabaseAdmin(),
}))

import {
  performAdminFollowUp,
  type SendAdminFollowUpInput,
} from './follow-ups.server'

const INPUT: SendAdminFollowUpInput = {
  targetKind: 'contact_request',
  targetId: '3f6a4d2e-8f1b-4c8e-9a1d-2b7c6e5f4a3b',
  recipientEmail: 'camille@exemple.test',
  recipientName: 'Camille Test',
  subject: 'Votre devis Terrassea',
  body: 'Nous revenons vers vous au sujet de votre demande de devis.',
  template: 'devis',
  reference: 'TR-2026-0001',
  ctaUrl: '/account',
  ctaLabel: 'Voir mon espace',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  callerAdminId.mockResolvedValue('admin-uuid')
  getSupabaseAdmin.mockImplementation(() => ({ from }))
  sendEmail.mockResolvedValue({ ok: true, id: 'brevo-42' })
  insertSingle.mockResolvedValue({ data: { id: 'fu-1' }, error: null })
  lookupSingle.mockResolvedValue({
    data: { email: 'Camille@exemple.test' },
    error: null,
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('performAdminFollowUp', () => {
  it('refuses a non-admin caller before any side effect', async () => {
    callerAdminId.mockResolvedValue(null)

    await expect(performAdminFollowUp(INPUT)).resolves.toEqual({
      ok: false,
      reason: 'forbidden',
    })
    expect(sendEmail).not.toHaveBeenCalled()
    expect(getSupabaseAdmin).not.toHaveBeenCalled()
  })

  it('sends the branded email with the admin reply-to, then traces the send', async () => {
    const result = await performAdminFollowUp(INPUT)

    expect(result).toEqual({
      ok: true,
      traced: true,
      followUpId: 'fu-1',
      deliveryId: 'brevo-42',
    })
    expect(sendEmail).toHaveBeenCalledTimes(1)
    const sent = sendEmail.mock.calls[0]![0] as {
      to: string
      subject: string
      html: string
      text: string
      replyTo: string
    }
    expect(sent.to).toBe('camille@exemple.test')
    expect(sent.subject).toBe('Votre devis Terrassea')
    expect(sent.replyTo).toBe('admin@exemple.test')
    expect(sent.html).toContain('Bonjour Camille Test,')
    expect(sent.html).toContain('href="https://terrassea.com/account"')
    expect(sent.text).toContain(
      'Voir mon espace : https://terrassea.com/account',
    )

    expect(from).toHaveBeenCalledWith('admin_follow_ups')
    expect(insert).toHaveBeenCalledWith({
      target_kind: 'contact_request',
      target_id: INPUT.targetId,
      recipient_email: 'camille@exemple.test',
      subject: 'Votre devis Terrassea',
      body: INPUT.body,
      template: 'devis',
      sent_by: 'admin-uuid',
      delivery_id: 'brevo-42',
    })
  })

  it('refuses a target that no longer exists, before any email', async () => {
    lookupSingle.mockResolvedValue({ data: null, error: null })

    await expect(performAdminFollowUp(INPUT)).resolves.toEqual({
      ok: false,
      reason: 'target_not_found',
    })
    expect(from).toHaveBeenCalledWith('contact_requests')
    expect(sendEmail).not.toHaveBeenCalled()
    expect(insert).not.toHaveBeenCalled()
  })

  it('refuses a recipient that differs from the target address', async () => {
    lookupSingle.mockResolvedValue({
      data: { email: 'autre@exemple.test' },
      error: null,
    })

    await expect(performAdminFollowUp(INPUT)).resolves.toEqual({
      ok: false,
      reason: 'recipient_mismatch',
    })
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('reads the reservation address inside contact_snapshot', async () => {
    lookupSingle.mockResolvedValue({
      data: { contact_snapshot: { email: 'camille@exemple.test' } },
      error: null,
    })

    const result = await performAdminFollowUp({
      ...INPUT,
      targetKind: 'reservation',
    })
    expect(result.ok).toBe(true)
    expect(from).toHaveBeenCalledWith('reservations')
    expect(lookupSelect).toHaveBeenCalledWith('contact_snapshot')
  })

  it('greets without a name when the target has none', async () => {
    const withoutName: SendAdminFollowUpInput = {
      ...INPUT,
      recipientName: undefined,
    }
    await performAdminFollowUp(withoutName)
    const sent = sendEmail.mock.calls[0]![0] as { html: string; text: string }
    expect(sent.html).toContain('Bonjour,')
    expect(sent.html).not.toContain('Bonjour Bonjour')
    expect(sent.text).toContain('Bonjour,\n')
  })

  it('does not trace when Brevo refuses the email', async () => {
    sendEmail.mockResolvedValue({
      ok: false,
      skipped: false,
      reason: 'brevo_401: unauthorized',
    })

    await expect(performAdminFollowUp(INPUT)).resolves.toEqual({
      ok: false,
      reason: 'email_failed',
    })
    expect(insert).not.toHaveBeenCalled()
    // Le log ne contient jamais le corps ni le sujet de l'email.
    const logged = JSON.stringify(
      (console.error as unknown as { mock: { calls: unknown[] } }).mock.calls,
    )
    expect(logged).not.toContain(INPUT.body)
    expect(logged).not.toContain(INPUT.subject)
  })

  it('reports a missing email configuration distinctly', async () => {
    sendEmail.mockResolvedValue({
      ok: false,
      skipped: true,
      reason: 'not_configured',
    })

    await expect(performAdminFollowUp(INPUT)).resolves.toEqual({
      ok: false,
      reason: 'not_configured',
    })
    expect(insert).not.toHaveBeenCalled()
  })

  it('reports ok but untraced when the insert fails after a successful send', async () => {
    insertSingle.mockResolvedValue({
      data: null,
      error: { message: 'permission denied' },
    })

    await expect(performAdminFollowUp(INPUT)).resolves.toEqual({
      ok: true,
      traced: false,
      deliveryId: 'brevo-42',
    })
    const logged = JSON.stringify(
      (console.error as unknown as { mock: { calls: unknown[] } }).mock.calls,
    )
    expect(logged).toContain('permission denied')
    expect(logged).not.toContain(INPUT.body)
  })

  it('refuses to send when the service client is misconfigured', async () => {
    getSupabaseAdmin.mockImplementation(() => {
      throw new Error('Supabase admin client misconfigured')
    })

    // Sans relecture possible de la cible, pas d'envoi : la fonction ne doit
    // jamais servir de relais vers une adresse non vérifiée.
    await expect(performAdminFollowUp(INPUT)).resolves.toEqual({
      ok: false,
      reason: 'target_not_found',
    })
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('omits the button when no link is given', async () => {
    const withoutCta: SendAdminFollowUpInput = {
      ...INPUT,
      ctaUrl: undefined,
      ctaLabel: undefined,
    }
    await performAdminFollowUp(withoutCta)
    const sent = sendEmail.mock.calls[0]![0] as { html: string }
    expect(sent.html).not.toContain('https://terrassea.com/account"')
  })
})
