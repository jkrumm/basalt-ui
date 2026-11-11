import { describe, expect, test } from 'bun:test'
import { formatArticleDate } from './article-date'

describe('formatArticleDate', () => {
  test('formats a known ISO date', () => {
    expect(formatArticleDate('2026-07-16', 'en-US')).toBe('Jul 16, 2026')
  })

  test('returns invalid input unchanged, never throws', () => {
    expect(formatArticleDate('not-a-date', 'en-US')).toBe('not-a-date')
    expect(formatArticleDate('', 'en-US')).toBe('')
  })

  test('an explicit locale override changes the output', () => {
    expect(formatArticleDate('2026-07-16', 'de-DE')).toBe('16. Juli 2026')
  })
})
