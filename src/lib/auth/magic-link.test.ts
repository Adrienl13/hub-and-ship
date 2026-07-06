import { describe, expect, it } from 'vitest'

import {
  createAccountAccessLink,
  type MagicLinkAdminClient,
} from './magic-link'

const LINK = 'https://auth.example.com/verify?token=abc&redirect_to=/account'

function clientWith({
  firstError,
  createError,
  secondError,
}: {
  firstError?: string
  createError?: string
  secondError?: string
} = {}): { client: MagicLinkAdminClient; calls: string[] } {
  const calls: string[] = []
  let generateCount = 0
  const client: MagicLinkAdminClient = {
    auth: {
      admin: {
        generateLink: ({ email }) => {
          generateCount += 1
          calls.push(`generate:${email}`)
          const error = generateCount === 1 ? firstError : secondError
          return Promise.resolve(
            error
              ? { data: null, error: { message: error } }
              : { data: { properties: { action_link: LINK } }, error: null },
          )
        },
        createUser: ({ email, email_confirm }) => {
          calls.push(`create:${email}:${email_confirm}`)
          return Promise.resolve(
            createError ? { error: { message: createError } } : { error: null },
          )
        },
      },
    },
  }
  return { client, calls }
}

describe('createAccountAccessLink', () => {
  it('returns the action link for an existing user without creating one', async () => {
    const { client, calls } = clientWith()
    const link = await createAccountAccessLink({
      client,
      email: 'pro@resto.fr',
      redirectTo: 'https://prosimport.com/account/reservations',
    })
    expect(link).toBe(LINK)
    expect(calls).toEqual(['generate:pro@resto.fr'])
  })

  it('creates the account (email confirmed) then retries for a new guest', async () => {
    const { client, calls } = clientWith({ firstError: 'User not found' })
    const link = await createAccountAccessLink({
      client,
      email: 'guest@hotel.fr',
      redirectTo: 'https://prosimport.com/account/reservations',
    })
    expect(link).toBe(LINK)
    expect(calls).toEqual([
      'generate:guest@hotel.fr',
      'create:guest@hotel.fr:true',
      'generate:guest@hotel.fr',
    ])
  })

  it('returns null (never throws) when auth keeps failing', async () => {
    const failing = clientWith({
      firstError: 'User not found',
      createError: 'smtp down',
    })
    await expect(
      createAccountAccessLink({
        client: failing.client,
        email: 'x@y.fr',
        redirectTo: 'https://prosimport.com/account',
      }),
    ).resolves.toBeNull()

    const throwing: MagicLinkAdminClient = {
      auth: {
        admin: {
          generateLink: () => Promise.reject(new Error('network')),
          createUser: () => Promise.reject(new Error('network')),
        },
      },
    }
    await expect(
      createAccountAccessLink({
        client: throwing,
        email: 'x@y.fr',
        redirectTo: 'https://prosimport.com/account',
      }),
    ).resolves.toBeNull()
  })
})
