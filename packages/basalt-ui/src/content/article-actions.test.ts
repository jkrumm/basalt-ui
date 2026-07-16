import { describe, expect, test } from 'bun:test'
import { toArticleActions } from './article-actions'
import type { Article } from './article-model'

const ARTICLE: Article = {
  slug: 'reading-dashboards',
  title: 'Reading dashboards',
  description: 'Why most internal dashboards fail the five-second glance test.',
  category: 'guide',
  tags: ['dashboards', 'ux'],
}

describe('toArticleActions', () => {
  test('projects id/label/description/keywords', () => {
    const [action] = toArticleActions([ARTICLE], {
      onNavigate: () => {},
      href: () => '/content',
    })

    expect(action?.id).toBe('article:/content')
    expect(action?.label).toBe('Reading dashboards')
    expect(action?.description).toBe(ARTICLE.description)
    expect(action?.keywords).toBe(
      'Reading dashboards Why most internal dashboards fail the five-second glance test. guide dashboards ux reading-dashboards',
    )
  })

  test('lands tags and category in keywords', () => {
    const [action] = toArticleActions([ARTICLE], {
      onNavigate: () => {},
      href: () => '/content',
    })

    expect(action?.keywords).toContain('guide')
    expect(action?.keywords).toContain('dashboards')
    expect(action?.keywords).toContain('ux')
  })

  test('onClick calls onNavigate with the href fn output', () => {
    const navigated: string[] = []
    const [action] = toArticleActions([ARTICLE], {
      onNavigate: (href) => navigated.push(href),
      href: (article) => `/articles/${article.slug}`,
    })

    // onClick's declared type takes a MouseEvent, but the implementation ignores it — call
    // through a zero-arg view rather than fabricating a fake event.
    const onClick = action?.onClick as (() => void) | undefined
    onClick?.()
    expect(navigated).toEqual(['/articles/reading-dashboards'])
  })

  test('omits group/rightSection when not passed', () => {
    const [action] = toArticleActions([ARTICLE], {
      onNavigate: () => {},
      href: () => '/content',
    })

    expect(action).not.toHaveProperty('group')
    expect(action).not.toHaveProperty('rightSection')
  })

  test('sets group/rightSection when passed', () => {
    const [action] = toArticleActions([ARTICLE], {
      onNavigate: () => {},
      href: () => '/content',
      group: 'Guides',
      rightSection: 'badge',
    })

    expect(action?.group).toBe('Guides')
    expect(action?.rightSection).toBe('badge')
  })

  test('empty input returns []', () => {
    expect(toArticleActions([], { onNavigate: () => {}, href: () => '#' })).toEqual([])
  })
})
