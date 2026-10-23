/**
 * `StatCard.query` — the four-way branch handed to `QueryState` (audit B #3), and the two things
 * that must hold in every one of them.
 *
 * 1. **The CAPTION ROW survives every branch.** The title, the icon, the info glyph and the
 *    qualifier are chrome; a card that blanks them while a refetch is in flight is a card that
 *    flickers its own identity. Only the region UNDER the caption resolves.
 * 2. **The branch precedence is `QueryState`'s, not a second copy of it.** These assertions are
 *    deliberately about which of `QueryState`'s own outputs appears — a spinner, an alert carrying
 *    the REAL server message, nothing, or the breakdown — because the bug this prop exists to
 *    prevent is a hand-rolled switch that renders "no data" over a 500.
 *
 * SSR markup, the `stat-card.test.tsx` idiom: every branch here is a static render, and none of the
 * four needs live DOM behaviour. Pending is a skeleton at the card's footprint (SPEC § 6.11) — no
 * spinner inside a card.
 */
import { MantineProvider } from '@mantine/core'
import { render as renderIntoDom } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { Meter } from './meter'
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
        qualifier="30 days"
        value="—"
        breakdown={BREAKDOWN}
        subtitle="Source: events"
        query={q}
      />
    </MantineProvider>,
  )
}

/** The header is the same node in all four branches — asserted in each, never once. */
function expectHeaderIntact(markup: string): void {
  expect(markup).toContain('Active users')
  expect(markup).toContain('More information')
  expect(markup).toContain('30 days')
}

describe('StatCard.query renders each branch through QueryState at the section tier', () => {
  test('pending — a skeleton at the card footprint, no spinner, no figure, no breakdown', () => {
    const markup = render(query({ fetchStatus: 'fetching' }))
    expectHeaderIntact(markup)
    expect(markup).toContain('mantine-Skeleton-root')
    expect(markup).toContain('aria-busy="true"')
    expect(markup).not.toContain('aria-label="Loading"')
    expect(markup).not.toContain('mantine-Loader')
    expect(markup).not.toContain('Web')
    expect(markup).not.toContain('Source: events')
  })

  test('error with no cached data — the real server message and a retry, never an empty state', () => {
    const markup = render(
      query({ isError: true, error: new Error('upstream exploded'), fetchStatus: 'idle' }),
    )
    expectHeaderIntact(markup)
    expect(markup).toContain('upstream exploded')
    expect(markup).toContain('Retry')
    expect(markup).not.toContain('No data for this period')
    expect(markup).not.toContain('Web')
  })

  test('empty — one muted line replaces the figure; no breakdown, no spinner, no bare dash', () => {
    const markup = render(query({ data: [] }))
    expectHeaderIntact(markup)
    expect(markup).toContain('No data for this period')
    expect(markup).not.toContain('Web')
    expect(markup).not.toContain('>—<')
    expect(markup).not.toContain('mantine-Skeleton-root')
  })

  test('empty — emptyText says why', () => {
    const markup = renderToStaticMarkup(
      <MantineProvider>
        <StatCard
          title="Active users"
          value="—"
          emptyText="No probes ran in this window"
          query={query({ data: [] })}
        />
      </MantineProvider>,
    )
    expect(markup).toContain('No probes ran in this window')
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

describe('loading — the same skeleton, no query', () => {
  test('replaces the figure and the footer, keeps the caption, sets aria-busy', () => {
    const markup = renderToStaticMarkup(
      <MantineProvider>
        <StatCard
          title="Active users"
          qualifier="30 days"
          value="12,483"
          subtitle="Source: events"
          sparkline={() => null}
          loading
        />
      </MantineProvider>,
    )
    expect(markup).toContain('Active users')
    expect(markup).toContain('30 days')
    expect(markup).toContain('aria-busy="true"')
    expect(markup).toContain('mantine-Skeleton-root')
    expect(markup).not.toContain('12,483')
    expect(markup).not.toContain('Source: events')
  })

  test('absent, nothing is busy and no skeleton renders', () => {
    const markup = renderToStaticMarkup(
      <MantineProvider>
        <StatCard title="Active users" value="12,483" />
      </MantineProvider>,
    )
    expect(markup).not.toContain('aria-busy')
    expect(markup).not.toContain('mantine-Skeleton-root')
  })
})

// The sparkline render prop is handed the slot's measured box. happy-dom measures 0, so the box is
// stubbed to 300px wide; the contract under test is WHEN the prop is called and with what height.
describe('the sparkline render prop', () => {
  const original = Element.prototype.getBoundingClientRect
  beforeEach(() => {
    Element.prototype.getBoundingClientRect = () => ({ width: 300, height: 22 }) as DOMRect
  })
  afterEach(() => {
    Element.prototype.getBoundingClientRect = original
  })

  function heights(props: {
    placement?: 'bleed' | 'right'
    loading?: boolean
    q?: QueryStateLike<Row[]>
  }): number[] {
    const seen: number[] = []
    renderIntoDom(
      <MantineProvider>
        <StatCard
          title="Latency"
          value="42"
          {...(props.placement !== undefined && { sparklinePlacement: props.placement })}
          {...(props.loading === true && { loading: true })}
          {...(props.q !== undefined && { query: props.q })}
          sparkline={(size) => {
            seen.push(size.height)
            return <span>spark</span>
          }}
        />
      </MantineProvider>,
    )
    return seen
  }

  test.each(['bleed', 'right'] as const)(
    'is called with height 22 when ready (%s)',
    (placement) => {
      const seen = heights({ placement })
      expect(seen.length).toBeGreaterThan(0)
      expect(new Set(seen)).toEqual(new Set([22]))
    },
  )

  test.each(['bleed', 'right'] as const)(
    'is not called while pending, loading, failed or empty (%s)',
    (placement) => {
      expect(heights({ placement, loading: true })).toEqual([])
      expect(heights({ placement, q: query({ fetchStatus: 'fetching' }) })).toEqual([])
      expect(heights({ placement, q: query({ isError: true, error: new Error('x') }) })).toEqual([])
      expect(heights({ placement, q: query({ data: [] }) })).toEqual([])
    },
  )

  test('an error over cached-empty data shows the error, not "No data"', () => {
    const markup = render(query({ data: [], isError: true, error: new Error('refetch exploded') }))
    expect(markup).toContain('refetch exploded')
    expect(markup).toContain('Retry')
    expect(markup).not.toContain('Showing cached data')
    expect(markup).not.toContain('No data for this period')
  })

  test('is not invoked again after a ready → pending rerender (no stale width)', () => {
    const calls: string[] = []
    const card = (q: QueryStateLike<Row[]>) => (
      <MantineProvider>
        <StatCard
          title="Latency"
          value="42"
          query={q}
          sparkline={() => {
            calls.push('call')
            return <span>spark</span>
          }}
        />
      </MantineProvider>
    )
    const view = renderIntoDom(card(query({ data: [{ label: 'a' }] })))
    expect(calls.length).toBeGreaterThan(0)
    const before = calls.length
    view.rerender(card(query({ fetchStatus: 'fetching' })))
    view.rerender(card(query({ isError: true, error: new Error('x') })))
    view.rerender(card(query({ data: [] })))
    expect(calls.length).toBe(before)
  })

  test('the pending card says what is loading, to assistive tech', () => {
    expect(render(query({ fetchStatus: 'fetching' }))).toContain('Loading Active users')
  })
})

describe('StatCard states drop the footer that captioned the visual (Wave 37)', () => {
  const sparkline = () => <span data-testid="spark" />
  function markup(q: QueryStateLike<Row[]> | undefined) {
    return renderToStaticMarkup(
      <MantineProvider>
        <StatCard
          title="Sessions"
          value="12"
          subtitle="7-day rolling"
          sparkline={sparkline}
          {...(q !== undefined && { query: q })}
        />
      </MantineProvider>,
    )
  }

  test('error and empty draw no subtitle', () => {
    const err = markup(query({ isError: true, error: new Error('boom') }))
    expect(err).not.toContain('7-day rolling')
    const empty = markup(query({ data: [] }))
    expect(empty).not.toContain('7-day rolling')
  })

  test('a ready card keeps its subtitle', () => {
    expect(markup(query({ data: [{ label: 'a' }] }))).toContain('7-day rolling')
  })

  test('the error title is short enough for one line in a 170px card', () => {
    const err = markup(query({ isError: true, error: new Error('boom') }))
    expect(err).not.toContain('Could not load this figure')
    expect(err).toContain('Could not load sessions')
  })
})

describe('the card tone reaches a hosted Meter', () => {
  test('a toned StatCard colours the plain Meter in its sparkline slot', () => {
    const html = renderToStaticMarkup(
      <MantineProvider>
        <StatCard
          title="Load"
          value="90"
          tone="bad"
          sparkline={<Meter label="Load" value={90} />}
        />
      </MantineProvider>,
    )
    expect(html).toContain('background:var(--vx-status-bad)')
  })
})

describe('Wave 46 r1: empty tile and loading shape', () => {
  const html = (node: React.ReactElement): string =>
    renderToStaticMarkup(<MantineProvider>{node}</MantineProvider>)

  test('empty is the section tile: the first sentence is the title, the rest the muted line', () => {
    const out = html(
      <StatCard
        title="Latency"
        value="18 ms"
        query={query({ data: [] })}
        emptyText="No readings in the window. Check that the probe is reporting."
      />,
    )
    expect(out).toContain('No readings in the window')
    expect(out).toContain('Check that the probe is reporting.')
    expect(out).toContain('font-weight:500')
  })

  test('loading keeps the value bar, the delta chip and a sparkline-shaped visual row', () => {
    const out = html(
      <StatCard title="Latency" value="18 ms" delta={4} loading sparkline={() => null} />,
    )
    expect(out).toContain('data-stat-skeleton-delta')
    expect(out).toContain('data-stat-skeleton-spark')
    expect(out).toContain('<polyline')
  })

  test('loading without a delta draws no delta chip', () => {
    const out = html(<StatCard title="Latency" value="18 ms" loading />)
    expect(out).not.toContain('data-stat-skeleton-delta')
  })
})
