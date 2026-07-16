import { describe, expect, test } from 'bun:test'
import { headingSlug, readingTime, SlugTracker } from './slug'

describe('headingSlug', () => {
  test('lowercases and hyphenates spaces', () => {
    expect(headingSlug('Reading Dashboards')).toBe('reading-dashboards')
  })

  test('strips punctuation but keeps hyphens and word characters', () => {
    expect(headingSlug('What is a "z-score"?')).toBe('what-is-a-z-score')
  })

  test('collapses repeated whitespace and trims edge hyphens', () => {
    expect(headingSlug('  Too   Many   Spaces  ')).toBe('too-many-spaces')
  })

  test('handles unicode letters', () => {
    expect(headingSlug('Café Résumé')).toBe('café-résumé')
  })
})

describe('SlugTracker', () => {
  test('returns the plain slug on first occurrence', () => {
    const tracker = new SlugTracker()
    expect(tracker.slug('Overview')).toBe('overview')
  })

  test('dedupes repeated headings with -1, -2 suffixes', () => {
    const tracker = new SlugTracker()
    expect(tracker.slug('Overview')).toBe('overview')
    expect(tracker.slug('Overview')).toBe('overview-1')
    expect(tracker.slug('Overview')).toBe('overview-2')
  })

  test('tracks slugs independently per instance', () => {
    const a = new SlugTracker()
    const b = new SlugTracker()
    expect(a.slug('Setup')).toBe('setup')
    expect(b.slug('Setup')).toBe('setup')
  })
})

describe('readingTime', () => {
  test('rounds up to the nearest whole minute', () => {
    const words = Array.from({ length: 300 }, () => 'word').join(' ')
    const result = readingTime(words)
    expect(result.words).toBe(300)
    expect(result.minutes).toBe(2)
  })

  test('returns 1 minute for short text', () => {
    const result = readingTime('a short sentence')
    expect(result.words).toBe(3)
    expect(result.minutes).toBe(1)
  })

  test('returns 0 minutes for empty text', () => {
    const result = readingTime('')
    expect(result.words).toBe(0)
    expect(result.minutes).toBe(0)
  })
})
