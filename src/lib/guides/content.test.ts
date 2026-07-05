import { describe, expect, it } from 'vitest'

import { GUIDES, GUIDE_SLUGS, getGuideBySlug } from './content'

describe('guides content', () => {
  it('has unique slugs', () => {
    expect(new Set(GUIDE_SLUGS).size).toBe(GUIDE_SLUGS.length)
  })

  it('resolves a guide by slug and returns undefined otherwise', () => {
    expect(getGuideBySlug(GUIDE_SLUGS[0]!)?.slug).toBe(GUIDE_SLUGS[0])
    expect(getGuideBySlug('does-not-exist')).toBeUndefined()
  })

  it('every guide is complete and the answer block is concise', () => {
    for (const guide of GUIDES) {
      expect(guide.title.length).toBeGreaterThan(10)
      expect(guide.metaDescription.length).toBeGreaterThan(40)
      expect(guide.sections.length).toBeGreaterThan(0)
      expect(guide.faq.length).toBeGreaterThan(0)
      expect(guide.related.length).toBeGreaterThan(0)
      const words = guide.answer.trim().split(/\s+/).length
      expect(words).toBeGreaterThanOrEqual(30)
      expect(words).toBeLessThanOrEqual(100)
    }
  })
})
