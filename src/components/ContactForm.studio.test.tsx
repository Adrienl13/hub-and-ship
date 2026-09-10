import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { it, expect, vi, afterEach } from 'vitest'
import { ContactForm } from './ContactForm'
import { buildContactMessageDraft } from '@/lib/contact'
import { customizationBrief } from '@/lib/studio/customization-brief'
import {
  STUDIO_BRIEF_LIMIT,
  STUDIO_BRIEF_SERVER_LIMIT,
  STUDIO_BRIEF_TRUNCATION,
} from '@/lib/studio/studio-brief-limit'
import { EMPTY_CAPABILITIES } from '@/lib/studio/customization'
import { item, seat } from '@/lib/studio/fixtures.test-helpers'
vi.mock('@/lib/analytics', () => ({
  AnalyticsEvent: { ContactSubmit: 'contact_submit' },
  track: vi.fn(),
}))
vi.mock('@/lib/analytics/attribution', () => ({
  getAttributionFields: () => ({}),
}))
afterEach(() => vi.unstubAllGlobals())
it('projet surdimensionné borné avant ContactForm et lead envoyé avec brief tronqué', async () => {
  const product = seat('p', { name: 'Nom catalogue '.repeat(30000) })
  const brief = customizationBrief(
    [item('p', 60)],
    [],
    new Map([['p', product]]),
    {},
    EMPTY_CAPABILITIES,
  )
  expect(brief.length).toBeLessThanOrEqual(STUDIO_BRIEF_LIMIT)
  expect(brief).toContain(STUDIO_BRIEF_TRUNCATION)
  expect(brief).not.toMatch(/Validé|€|supplément/)
  const fetcher = vi.fn<typeof fetch>(
    async () =>
      new Response('{"ok":true}', {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
  )
  vi.stubGlobal('fetch', fetcher)
  // Defensive form bounding also covers a caller passing an unbounded string.
  render(
    <ContactForm
      initialMessage="Mon message principal intact."
      studioBrief={brief + '\n' + 'x'.repeat(300000)}
    />,
  )
  fireEvent.change(screen.getByLabelText('Votre nom *'), {
    target: { value: 'Client Test' },
  })
  fireEvent.change(screen.getByLabelText('Email professionnel *'), {
    target: { value: 'client@example.test' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Envoyer le message' }))
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1))
  const payload = JSON.parse(fetcher.mock.calls[0]![1]!.body as string)
  expect(payload.studioBrief.length).toBeLessThanOrEqual(
    STUDIO_BRIEF_SERVER_LIMIT,
  )
  expect(payload.studioBrief).toContain(STUDIO_BRIEF_TRUNCATION)
  expect(payload.name).toBe('Client Test')
  expect(payload.email).toBe('client@example.test')
  expect(payload.message).toBe('Mon message principal intact.')
  expect(buildContactMessageDraft(payload).ok).toBe(true)
})
it('serveur refuse toujours un brief brut au-delà de sa limite', () => {
  expect(
    buildContactMessageDraft({
      name: 'Client Test',
      email: 'client@example.test',
      message: 'Message principal',
      studioBrief: 'x'.repeat(STUDIO_BRIEF_SERVER_LIMIT + 1),
    }).ok,
  ).toBe(false)
})
