import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const llms = readFileSync(join(process.cwd(), 'public/llms.txt'), 'utf8')
const robots = readFileSync(join(process.cwd(), 'public/robots.txt'), 'utf8')

describe('AI visibility public files', () => {
  it('publishes a concise llms.txt for generative search engines', () => {
    expect(llms).toContain('Pros Import')
    expect(llms).toContain('Container Club')
    expect(llms).toContain('https://prosimport.com/catalogue')
    expect(llms).toContain('https://prosimport.com/partenaires')
    expect(llms).toContain('https://prosimport.com/qualite')
  })

  it('keeps sensitive partner and import data out of the AI summary', () => {
    expect(llms).toContain('Partner net prices')
    expect(llms).toContain('internal margins')
    expect(llms).not.toMatch(/EORI/i)
    expect(llms).not.toContain('partner_deals')
    expect(llms).not.toContain('SUPABASE_SERVICE_ROLE_KEY')
  })

  it('advertises the AI summary from robots.txt without opening private surfaces', () => {
    expect(robots).toContain('LLM-Summary: https://prosimport.com/llms.txt')
    expect(robots).toContain('Disallow: /account')
    expect(robots).toContain('Disallow: /admin')
    expect(robots).toContain('Disallow: /api')
    expect(robots).toContain('Disallow: /auth')
  })
})
