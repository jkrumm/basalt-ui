import { describe, expect, test } from 'bun:test'
import { filterArticles, formatArticleDate, sortArticles } from './article-model'
import type { Article } from './article-model'

function article(overrides: Partial<Article>): Article {
  return { slug: 'x', title: 'Untitled', ...overrides }
}

describe('sortArticles', () => {
  test('date-desc orders newest first (the default)', () => {
    const articles = [
      article({ slug: 'a', date: '2026-01-01' }),
      article({ slug: 'b', date: '2026-06-01' }),
      article({ slug: 'c', date: '2026-03-01' }),
    ]
    expect(sortArticles(articles).map((a) => a.slug)).toEqual(['b', 'c', 'a'])
  })

  test('date-asc orders oldest first', () => {
    const articles = [
      article({ slug: 'a', date: '2026-01-01' }),
      article({ slug: 'b', date: '2026-06-01' }),
      article({ slug: 'c', date: '2026-03-01' }),
    ]
    expect(sortArticles(articles, 'date-asc').map((a) => a.slug)).toEqual(['a', 'c', 'b'])
  })

  test('title sorts locale-aware, pinned to en-US regardless of runtime default', () => {
    const articles = [
      article({ slug: 'a', title: 'Zebra' }),
      article({ slug: 'b', title: 'apple' }),
      article({ slug: 'c', title: 'Mango' }),
    ]
    expect(sortArticles(articles, 'title').map((a) => a.slug)).toEqual(['b', 'c', 'a'])
  })

  test('is stable on equal dates — input order preserved', () => {
    const articles = [
      article({ slug: 'a', date: '2026-01-01' }),
      article({ slug: 'b', date: '2026-01-01' }),
      article({ slug: 'c', date: '2026-01-01' }),
    ]
    expect(sortArticles(articles, 'date-desc').map((a) => a.slug)).toEqual(['a', 'b', 'c'])
    expect(sortArticles(articles, 'date-asc').map((a) => a.slug)).toEqual(['a', 'b', 'c'])
  })

  test('articles without a date sort last, in both date orders', () => {
    const articles = [
      article({ slug: 'no-date' }),
      article({ slug: 'newer', date: '2026-06-01' }),
      article({ slug: 'older', date: '2026-01-01' }),
    ]
    expect(sortArticles(articles, 'date-desc').map((a) => a.slug)).toEqual([
      'newer',
      'older',
      'no-date',
    ])
    expect(sortArticles(articles, 'date-asc').map((a) => a.slug)).toEqual([
      'older',
      'newer',
      'no-date',
    ])
  })

  test('does not mutate the input array', () => {
    const articles = [
      article({ slug: 'b', date: '2026-06-01' }),
      article({ slug: 'a', date: '2026-01-01' }),
    ]
    const snapshot = [...articles]
    sortArticles(articles, 'date-asc')
    expect(articles).toEqual(snapshot)
  })
})

describe('filterArticles', () => {
  const articles = [
    article({ slug: 'a', category: 'guide', tags: ['api', 'design'] }),
    article({ slug: 'b', category: 'reference', tags: ['api'] }),
    article({ slug: 'c', category: 'guide', tags: ['ux'] }),
  ]

  test('category is an exact match', () => {
    expect(filterArticles(articles, { category: 'guide' }).map((a) => a.slug)).toEqual(['a', 'c'])
  })

  test('tags are ANY-OF (OR)', () => {
    expect(filterArticles(articles, { tags: ['design', 'ux'] }).map((a) => a.slug)).toEqual([
      'a',
      'c',
    ])
  })

  test('category AND tags — AND between axes, OR within tags', () => {
    expect(
      filterArticles(articles, { category: 'guide', tags: ['ux'] }).map((a) => a.slug),
    ).toEqual(['c'])
  })

  test('an empty query returns the input unchanged', () => {
    expect(filterArticles(articles, {})).toBe(articles)
    expect(filterArticles(articles, { category: '', tags: [] })).toBe(articles)
  })
})

describe('formatArticleDate', () => {
  test('formats a known ISO date', () => {
    expect(formatArticleDate('2026-07-16')).toBe('Jul 16, 2026')
  })

  test('returns invalid input unchanged, never throws', () => {
    expect(formatArticleDate('not-a-date')).toBe('not-a-date')
    expect(formatArticleDate('')).toBe('')
  })

  test('an explicit locale override changes the output', () => {
    expect(formatArticleDate('2026-07-16', 'de-DE')).toBe('16. Juli 2026')
  })
})
