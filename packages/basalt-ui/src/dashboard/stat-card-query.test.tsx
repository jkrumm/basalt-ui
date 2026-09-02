/**
 * `StatCard.query` — the four-way branch handed to `QueryState` (audit B #3), and the two things
 * that must hold in every one of them.
 *
 * 1. **The HEADER survives every branch.** The title, the icon and the info glyph are chrome; a
 *    card that blanks them while a refetch is in flight is a card that flickers its own identity.
 *    Only the region UNDER the header resolves.
 * 2. **The branch precedence is `QueryState`'s, not a second copy of it.** These assertions are
 *    deliberately about which of `QueryState`'s own outputs appears — a spinner, an alert carrying
 *    the REAL server message, nothing, or the breakdown — because the bug this prop exists to
 *    prevent is a hand-rolled switch that renders "no data" over a 500.
 *
 * SSR markup, the `stat-card.test.tsx` idiom: every branch here is a static render, and none of the
 * four needs live DOM behaviour.
 */
import { MantineProvider } from '@mantine/core'
import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { StatCard } from './stat-card'
import type { QueryStateLike } from './query-state'

type Row = { label: string }

const BREAKDOWN = [
  { label: 'Web', value: '61%' },
  { label: 'Email', value: '39%' },
] as const

function query(over: Partial<QueryStateLike<Row[]>>): QueryStateLike<Row[]> {
  return {
    data: undefined,
    isError: false,
    error: null,
    fetchStatus: 'idle',
    refetch: () => undefined,
    ...over,
  }
}

function render(q: QueryStateLike<Row[]>): string {
  return renderToStaticMarkup(
    <MantineProvider>
      <StatCard
        title="Active users"
        info="How this is computed."
        value="—"
        breakdown={BREAKDOWN}
        query={q}
      />
    </MantineProvider>,
  )
}

/** The header is the same node in all four branches — asserted in each, never once. */
function expectHeaderIntact(markup: string): void {
  expect(markup).toContain('Active users')
  expect(markup).toContain('More information')
}

describe('StatCard.query renders each branch through QueryState at the section tier', () => {
  test('pending — a bare section spinner, not the 64px page block', () => {
    const markup = render(query({ fetchStatus: 'fetching' }))
    expectHeaderIntact(markup)
    expect(markup).toContain('aria-label="Loading"')
    expect(markup).not.toContain('Web')
  })

  test('error with no cached data — the real server message, never an empty state', () => {
    const markup = render(
      query({ isError: true, error: new Error('upstream exploded'), fetchStatus: 'idle' }),
    )
    expectHeaderIntact(markup)
    expect(markup).toContain('upstream exploded')
    expect(markup).not.toContain('Web')
  })

  test('empty — the breakdown is withheld, and nothing is invented in its place', () => {
    const markup = render(query({ data: [] }))
    expectHeaderIntact(markup)
    expect(markup).not.toContain('Web')
    expect(markup).not.toContain('aria-label="Loading"')
  })

  test('data — the breakdown renders exactly as it does with no query at all', () => {
    const markup = render(query({ data: [{ label: 'Web' }] }))
    expectHeaderIntact(markup)
    expect(markup).toContain('Web')
    expect(markup).toContain('61%')
  })
})

describe('an omitted query changes nothing', () => {
  test('the breakdown renders unwrapped', () => {
    const markup = renderToStaticMarkup(
      <MantineProvider>
        <StatCard title="Active users" value="12,483" breakdown={BREAKDOWN} />
      </MantineProvider>,
    )
    expect(markup).toContain('Web')
    expect(markup).toContain('Email')
  })
})
