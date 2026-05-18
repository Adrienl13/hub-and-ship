import { describe, expect, it, vi } from 'vitest'

import {
  verifySiretWithEdgeFunction,
  type SiretVerificationClient,
} from './siret-verification'

describe('verifySiretWithEdgeFunction', () => {
  it('rejects invalid SIRET before calling the Edge Function', async () => {
    const invoke = vi.fn()

    await expect(
      verifySiretWithEdgeFunction({
        siret: '123',
        client: { functions: { invoke } },
      }),
    ).resolves.toMatchObject({
      status: 'invalid_format',
      reason: 'Le SIRET doit contenir exactement 14 chiffres',
    })

    expect(invoke).not.toHaveBeenCalled()
  })

  it('returns a non-blocking fallback when Supabase is not configured', async () => {
    await expect(
      verifySiretWithEdgeFunction({
        siret: '55208131701750',
        client: null,
      }),
    ).resolves.toMatchObject({
      status: 'verification_unavailable',
      data: { format_ok: true },
    })
  })

  it('invokes the verify-siret Edge Function with the cleaned SIRET', async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: {
        status: 'verified',
        data: {
          siret: '55208131701750',
          siren: '552081317',
          legal_name: 'HOTEL TEST',
          is_active: true,
        },
      },
      error: null,
    })
    const client = { functions: { invoke } } satisfies SiretVerificationClient

    await expect(
      verifySiretWithEdgeFunction({
        siret: '552 081 317 01750',
        client,
      }),
    ).resolves.toMatchObject({
      status: 'verified',
      data: { legal_name: 'HOTEL TEST' },
    })

    expect(invoke).toHaveBeenCalledWith('verify-siret', {
      body: { siret: '55208131701750' },
    })
  })

  it('falls back gracefully on Edge Function errors', async () => {
    const client = {
      functions: {
        invoke: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Function unavailable' },
        }),
      },
    } satisfies SiretVerificationClient

    await expect(
      verifySiretWithEdgeFunction({
        siret: '55208131701750',
        client,
      }),
    ).resolves.toMatchObject({
      status: 'verification_unavailable',
      reason: 'Function unavailable',
      data: { format_ok: true },
    })
  })
})
