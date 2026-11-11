/**
 * `PageSummary`: a headline sentence that carries a live number, an optional facts line, an
 * optional aside and a loading skeleton of the same shape. The geometry (a wrapped line never opens
 * with the dot) is `tests/layout/page-kit.layout.test.ts`'s; here the markup and the class rules.
 */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { PageSummary } from './page-summary'

afterEach(cleanup)

const slots = (name: string): string[] =>
  [...document.querySelectorAll(`[data-slot="${name}"]`)].map((el) => el.textContent ?? '')

describe('PageSummary', () => {
  test('renders the sentence as an h2 headline', () => {
    render(<PageSummary sentence="12 open, 3 need you" />)
    expect(screen.getByRole('heading', { level: 2, name: '12 open, 3 need you' })).toBeDefined()
  })

  test('renders facts in order and drops null, false, undefined and empty ones', () => {
    render(
      <PageSummary
        sentence="12 open"
        facts={['3 need you', null, false, undefined, '', 'oldest 2 d']}
      />,
    )
    expect(slots('page-summary-fact')).toEqual(['3 need you', 'oldest 2 d'])
  })

  test('no facts line at all when every fact drops', () => {
    render(<PageSummary sentence="12 open" facts={[null, false]} />)
    expect(document.querySelector('[data-slot="page-summary-facts"]')).toBeNull()
  })

  test('no facts line when none are passed', () => {
    render(<PageSummary sentence="12 open" />)
    expect(document.querySelector('[data-slot="page-summary-facts"]')).toBeNull()
  })

  test('the aside renders beside the headline', () => {
    render(<PageSummary sentence="12 open" aside="Today" />)
    expect(slots('page-summary-aside')).toEqual(['Today'])
  })

  test('loading renders a busy skeleton of the same shape and no content', () => {
    render(<PageSummary loading />)
    const root = document.querySelector('[data-slot="page-summary"]')
    expect(root?.getAttribute('aria-busy')).toBe('true')
    expect(screen.queryByRole('heading')).toBeNull()
    expect(document.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(1)
  })

  test('loading keeps a facts-line skeleton when facts are expected', () => {
    render(<PageSummary loading facts={['x']} />)
    expect(document.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(2)
  })

  test('server markup carries the slots', () => {
    const html = renderToString(<PageSummary sentence="1 open" facts={['a', 'b']} />)
    expect(html).toContain('data-slot="page-summary-facts"')
    expect(html.match(/data-slot="page-summary-fact"/g)).toHaveLength(2)
  })
})

describe('PageSummary classes (the separator law)', () => {
  const classOf = (slot: string): string =>
    document.querySelector(`[data-slot="${slot}"]`)?.getAttribute('class') ?? ''

  test('the facts are sans xs muted, never mono or tabular', () => {
    render(<PageSummary sentence="1 open" facts={['a']} />)
    const c = classOf('page-summary-facts')
    expect(c).toContain('text-xs')
    expect(c).toContain('text-muted-foreground')
    expect(c).not.toMatch(/mono|tabular/)
  })

  test('the sentence is the head face, never mono', () => {
    render(<PageSummary sentence="1 open" />)
    const c = document.querySelector('h2')?.getAttribute('class') ?? ''
    expect(c).toContain('font-head')
    expect(c).not.toContain('mono')
  })

  test('the separator is a pseudo-element of every fact, never a text node', () => {
    render(<PageSummary sentence="1 open" facts={['a', 'b']} />)
    expect(classOf('page-summary-fact')).toContain("before:content-['·']")
    expect(slots('page-summary-fact')).toEqual(['a', 'b'])
  })

  test('the dot sits in the gap before its fact and the list clips inline overflow', () => {
    render(<PageSummary sentence="1 open" facts={['a']} />)
    expect(classOf('page-summary-fact')).toContain('before:inset-s-[calc(-1*var(--facts-gap))]')
    expect(classOf('page-summary-fact')).toContain('before:w-(--facts-gap)')
    expect(classOf('page-summary-facts')).toContain('overflow-x-clip')
    expect(classOf('page-summary-facts')).toContain('flex-wrap')
  })

  test('the dot is placed logically: no physical offset that flips wrong under rtl', () => {
    render(<PageSummary sentence="1 open" facts={['a']} />)
    expect(classOf('page-summary-fact')).not.toMatch(/before:(left|right|-?translate)/)
  })

  test('a focus ring inside a fact is drawn inside the clip', () => {
    render(<PageSummary sentence="1 open" facts={['a']} />)
    expect(classOf('page-summary-fact')).toContain('focus-visible:outline-offset-[-2px]')
  })
})
