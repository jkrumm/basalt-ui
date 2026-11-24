import { describe, expect, it } from 'bun:test'
import { basaltShiki } from './shiki'
import { jsonLdText, siteHeadTags } from './head'

const site = new URL('https://example.com')
const page = { site, pathname: '/guides/setup' }
const base = { title: 'Setup', description: 'Install it.' }
const metaOf = (tags: ReturnType<typeof siteHeadTags>, key: string): string | undefined =>
  tags.meta.find((m) => (m.name ?? m.property) === key)?.content

describe('siteHeadTags', () => {
  it('resolves the canonical against the site and mirrors it into og:url', () => {
    const tags = siteHeadTags(base, page)
    expect(tags.canonical).toBe('https://example.com/guides/setup')
    expect(metaOf(tags, 'og:url')).toBe('https://example.com/guides/setup')
    expect(metaOf(tags, 'og:type')).toBe('website')
    expect(tags.jsonLd).toBeNull()
  })

  it('writes no canonical and no og:url without a site, and keeps an absolute one', () => {
    const none = siteHeadTags(base, { pathname: '/x' })
    expect(none.canonical).toBeNull()
    expect(metaOf(none, 'og:url')).toBeUndefined()
    expect(siteHeadTags({ ...base, canonical: 'https://other.dev/a' }, page).canonical).toBe(
      'https://other.dev/a',
    )
  })

  it('picks the Twitter card from the image', () => {
    expect(metaOf(siteHeadTags(base, page), 'twitter:card')).toBe('summary')
    const withImage = siteHeadTags({ ...base, image: { src: '/og.png', alt: 'A page' } }, page)
    expect(metaOf(withImage, 'twitter:card')).toBe('summary_large_image')
    expect(metaOf(withImage, 'og:image')).toBe('https://example.com/og.png')
    expect(metaOf(withImage, 'og:image:alt')).toBe('A page')
  })

  it('adds the article tags and the JSON-LD for an article only', () => {
    const tags = siteHeadTags(
      {
        ...base,
        type: 'article',
        published: '2026-11-20',
        modified: new Date('2026-11-21T00:00:00Z'),
        authors: ['Ada', { name: 'Bo', url: 'https://example.com/bo' }],
        tags: ['astro', 'seo'],
      },
      page,
    )
    expect(metaOf(tags, 'article:published_time')).toBe('2026-11-20')
    expect(metaOf(tags, 'article:modified_time')).toBe('2026-11-21T00:00:00.000Z')
    expect(tags.meta.filter((m) => m.property === 'article:tag')).toHaveLength(2)
    expect(tags.jsonLd).toMatchObject({
      '@type': 'Article',
      headline: 'Setup',
      datePublished: '2026-11-20',
      author: [{ name: 'Ada' }, { name: 'Bo', url: 'https://example.com/bo' }],
      keywords: 'astro, seo',
      mainEntityOfPage: { '@id': 'https://example.com/guides/setup' },
    })
  })

  it('takes the article headline apart from a title with a site suffix', () => {
    const tags = siteHeadTags(
      { ...base, title: 'Setup | Docs', headline: 'Setup', type: 'article' },
      page,
    )
    expect(tags.jsonLd).toMatchObject({ headline: 'Setup' })
    expect(metaOf(tags, 'og:title')).toBe('Setup | Docs')
  })

  it('noindex writes the robots tag', () => {
    expect(metaOf(siteHeadTags({ ...base, noindex: true }, page), 'robots')).toBe('noindex')
  })
})

describe('jsonLdText', () => {
  it('cannot close its own script tag', () => {
    const text = jsonLdText({ headline: '</script><script>alert(1)</script>' })
    expect(text).not.toContain('<')
    expect(JSON.parse(text)).toEqual({ headline: '</script><script>alert(1)</script>' })
  })
})

describe('basaltShiki', () => {
  it('writes both themes as custom properties and no color of its own', () => {
    expect(basaltShiki.defaultColor).toBe(false)
    expect(Object.keys(basaltShiki.themes).toSorted()).toEqual(['dark', 'light'])
  })
})
