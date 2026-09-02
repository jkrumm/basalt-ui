/**
 * The chart layer's own three-state placeholder set. `ChartPending` shipped alone, so a chart
 * consumer wanting "measured and empty" or "the query failed" had to reach for
 * `dashboard/QueryState` — which renders Mantine and is therefore unreachable from `./charts`
 * entirely. What they wrote instead is the four-way switch `QueryState` exists to own, and the
 * failure mode is documented: a 500 rendered as "No data".
 *
 * The precedence is the product, so it is asserted directly rather than through a render.
 */
import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import type { SeriesStyle } from '../series'
import { ChartFrame } from './ChartFrame'
import { ChartEmpty, ChartError, ChartPending, resolveChartState } from './ChartPending'

describe('resolveChartState — pending wins, then error, then empty', () => {
  test('an untouched chart draws', () => {
    expect(resolveChartState({})).toBeNull()
    expect(resolveChartState({ state: {} })).toBeNull()
  })

  test('pending beats a stale error and a stale empty — a refetch is in flight, not failed', () => {
    expect(
      resolveChartState({ state: { pending: true, error: new Error('x'), empty: true } }),
    ).toBe('pending')
  })

  test('error beats empty — a failed query has no standing to claim its result was empty', () => {
    expect(resolveChartState({ state: { error: new Error('x'), empty: true } })).toBe('error')
  })

  test('empty is the last branch', () => {
    expect(resolveChartState({ state: { empty: true } })).toBe('empty')
  })

  test('a string empty label is also truthy — a caller supplying copy still resolves to empty', () => {
    expect(resolveChartState({ state: { empty: 'No sessions in this window' } })).toBe('empty')
    expect(resolveChartState({ state: { empty: '' } })).toBeNull()
  })

  test('isPending remains a working alias for state.pending', () => {
    expect(resolveChartState({ isPending: true })).toBe('pending')
    expect(resolveChartState({ isPending: false })).toBeNull()
    expect(resolveChartState({ isPending: false, state: { pending: true } })).toBe('pending')
  })

  test('a null/false error is not an error — the idiom every query result uses for "fine"', () => {
    expect(resolveChartState({ state: { error: null } })).toBeNull()
    expect(resolveChartState({ state: { error: false } })).toBeNull()
  })
})

describe('ChartError — the branch a hand-written switch gets wrong', () => {
  test('an Error states its own message', () => {
    const html = renderToStaticMarkup(
      <ChartError width={200} height={100} error={new Error('Request failed: 500')} />,
    )
    expect(html).toContain('Request failed: 500')
  })

  test('an unrecognisable throw still reads as a FAILURE, never as emptiness', () => {
    const html = renderToStaticMarkup(<ChartError width={200} height={100} error={{ code: 7 }} />)
    expect(html).toContain('Could not load chart')
    expect(html).not.toContain('No data')
  })

  test('an explicit label wins outright, and the box is announced as an alert', () => {
    const html = renderToStaticMarkup(
      <ChartError width={200} height={100} label="Backend unavailable" error={new Error('x')} />,
    )
    expect(html).toContain('Backend unavailable')
    expect(html).toContain('role="alert"')
  })

  test('the action slot renders as given — this layer owns no button', () => {
    const html = renderToStaticMarkup(
      <ChartError width={200} height={100} action={<button type="button">Retry</button>} />,
    )
    expect(html).toContain('Retry')
  })
})

describe('ChartEmpty', () => {
  test('defaults to "No data" and reserves the plot rect', () => {
    const html = renderToStaticMarkup(<ChartEmpty width={200} height={100} />)
    expect(html).toContain('No data')
    expect(html).toContain('width:200px')
    expect(html).toContain('height:100px')
  })

  test('takes an action slot', () => {
    const html = renderToStaticMarkup(
      <ChartEmpty width={200} height={100} action={<button type="button">Clear filters</button>} />,
    )
    expect(html).toContain('Clear filters')
  })
})

// ── the frame resolves them ───────────────────────────────────────────────────

const series: SeriesStyle[] = [{ key: 'a', label: 'Series A', color: '#000', mark: 'line' }]
const BODY = 'CHART_BODY_MARKER'

const frame = (props: Parameters<typeof ChartFrame>[0]): string =>
  renderToStaticMarkup(<ChartFrame {...props} />)

describe('ChartFrame resolves `state` into the placeholders', () => {
  test('an error suppresses the legend and the body, and is NOT aria-busy', () => {
    const html = frame({
      series,
      legend: {},
      state: { error: new Error('boom') },
      children: () => <svg>{BODY}</svg>,
    })
    expect(html).toContain('boom')
    expect(html).not.toContain(BODY)
    expect(html).not.toContain('Series A')
    expect(html).not.toContain('aria-busy')
  })

  test('empty suppresses the legend and the body too', () => {
    const html = frame({
      series,
      legend: {},
      state: { empty: true },
      children: () => <svg>{BODY}</svg>,
    })
    expect(html).toContain('No data')
    expect(html).not.toContain(BODY)
    expect(html).not.toContain('Series A')
  })

  test('pending still wins and still marks the container busy', () => {
    const html = frame({
      series,
      legend: {},
      state: { pending: true, error: new Error('boom'), empty: true },
      children: () => <svg>{BODY}</svg>,
    })
    expect(html).toContain('aria-busy="true"')
    expect(html).not.toContain('boom')
  })

  test('no state at all draws the chart, unchanged', () => {
    const html = frame({ series, legend: {}, children: () => <svg>{BODY}</svg> })
    expect(html).toContain(BODY)
    expect(html).toContain('Series A')
  })

  test('a string empty label rides through as the ChartEmpty copy', () => {
    const html = frame({
      series,
      legend: {},
      state: { empty: 'No sessions in this window' },
      children: () => <svg>{BODY}</svg>,
    })
    expect(html).toContain('No sessions in this window')
    expect(html).not.toContain('>No data<')
  })
})

describe('ChartPending is untouched by any of it', () => {
  test('still renders its own label at the plot footprint', () => {
    const html = renderToStaticMarkup(<ChartPending width={200} height={100} />)
    expect(html).toContain('Loading…')
  })
})

/**
 * Only `ChartError` was announced, so a screen reader heard the one FAILURE and neither
 * resolution — the same asymmetry, in the assistive lane, that the hand-written four-way switch
 * had in the visual one. All three are live now; only the failure is allowed to interrupt.
 */
describe('all three states are announced, and only the failure interrupts', () => {
  test('pending and empty are polite `status`, never `alert`', () => {
    for (const html of [
      renderToStaticMarkup(<ChartPending width={200} height={100} />),
      renderToStaticMarkup(<ChartEmpty width={200} height={100} />),
    ]) {
      expect(html).toContain('role="status"')
      expect(html).not.toContain('role="alert"')
    }
  })

  test('a failure stays an `alert` — it is the one that may cut in', () => {
    const html = renderToStaticMarkup(
      <ChartError width={200} height={100} error={new Error('x')} />,
    )
    expect(html).toContain('role="alert"')
    expect(html).not.toContain('role="status"')
  })

  test('the frame carries the role through for every state it resolves', () => {
    expect(frame({ series, state: { pending: true }, children: () => <svg /> })).toContain(
      'role="status"',
    )
    expect(frame({ series, state: { empty: true }, children: () => <svg /> })).toContain(
      'role="status"',
    )
    expect(frame({ series, state: { error: 'boom' }, children: () => <svg /> })).toContain(
      'role="alert"',
    )
  })

  test('the action slot rides inside the announced box, so a retry is read with its cause', () => {
    const html = renderToStaticMarkup(
      <ChartEmpty width={200} height={100} action={<button type="button">Clear</button>} />,
    )
    expect(html.indexOf('role="status"')).toBeLessThan(html.indexOf('Clear'))
  })
})
