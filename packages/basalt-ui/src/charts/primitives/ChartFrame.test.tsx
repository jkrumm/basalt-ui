/**
 * `ChartFrame`'s `isPending` invariant — the one behavior here that regresses silently. A pending
 * chart that quietly fell back to rendering its legend + body would put a densified "not measured"
 * shape back on screen exactly where `ChartPending` is supposed to reserve a static, contentless
 * placeholder (see `ChartPending`'s JSDoc for the three-state "nothing to draw" rationale).
 *
 * No jsdom is configured in this repo (see `theme/use-basalt-spacing.test.tsx`'s doc) —
 * `renderToStaticMarkup` is enough here: `ChartFrame`/`ChartPending` live in `src/charts/**`, which
 * is Mantine-free, so no `MantineProvider` wrapper is needed either. `useChartSize` never measures
 * under SSR (no `ResizeObserver`), so the plot rect falls back to `minWidth` × the resolved fixed
 * height — non-zero, which is what lets `children`/`ChartPending` render at all in this harness.
 */
import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { ChartFrame } from './ChartFrame'
import type { SeriesStyle } from '../series'

const series: SeriesStyle[] = [{ key: 'a', label: 'Series A', color: '#000', mark: 'line' }]

const CHART_BODY_MARKER = 'CHART_BODY_MARKER'

function renderFrame(isPending: boolean): string {
  return renderToStaticMarkup(
    <ChartFrame series={series} legend={{}} isPending={isPending}>
      {() => <svg>{CHART_BODY_MARKER}</svg>}
    </ChartFrame>,
  )
}

describe('a pending ChartFrame renders neither the legend nor the chart body', () => {
  const markup = renderFrame(true)

  test('the legend is absent — no series label anywhere in the markup', () => {
    expect(markup).not.toContain('Series A')
  })

  test('the chart body (children) never runs', () => {
    expect(markup).not.toContain(CHART_BODY_MARKER)
  })

  test('the outer container is marked aria-busy', () => {
    expect(markup).toContain('aria-busy="true"')
  })

  test('the placeholder label renders in its place', () => {
    expect(markup).toContain('Loading…')
  })
})

describe('a non-pending ChartFrame is unaffected — the legend and body both render', () => {
  const markup = renderFrame(false)

  test('the legend renders the series label', () => {
    expect(markup).toContain('Series A')
  })

  test('the chart body renders', () => {
    expect(markup).toContain(CHART_BODY_MARKER)
  })

  test('no aria-busy attribute is present', () => {
    expect(markup).not.toContain('aria-busy')
  })
})
