import { describe, expect, it } from 'vitest'

import { buildContactMessageDraft } from './contact'

const VALID = {
  name: 'Marie Martin',
  email: 'Marie@Resto-Provence.FR',
  company: '  Bistrot du Port  ',
  phone: '',
  topic: 'container',
  message: 'Bonjour, 60 chaises + 15 tables pour une terrasse à Marseille ?',
}

describe('buildContactMessageDraft', () => {
  it('accepts a valid message, lowercasing email and nulling blanks', () => {
    const result = buildContactMessageDraft(VALID)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.draft.email).toBe('marie@resto-provence.fr')
    expect(result.draft.company).toBe('Bistrot du Port')
    expect(result.draft.phone).toBeNull()
    expect(result.draft.topic).toBe('container')
  })

  it('defaults the topic to autre when omitted', () => {
    const result = buildContactMessageDraft({ ...VALID, topic: undefined })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.draft.topic).toBe('autre')
  })

  it('rejects a short message, a bad email and a non-object payload', () => {
    expect(buildContactMessageDraft({ ...VALID, message: 'court' }).ok).toBe(
      false,
    )
    expect(buildContactMessageDraft({ ...VALID, email: 'nope' }).ok).toBe(
      false,
    )
    expect(buildContactMessageDraft(null).ok).toBe(false)
    expect(buildContactMessageDraft('x').ok).toBe(false)
  })

  it('rejects an unknown topic instead of coercing it', () => {
    expect(buildContactMessageDraft({ ...VALID, topic: 'spam' }).ok).toBe(
      false,
    )
  })
})
