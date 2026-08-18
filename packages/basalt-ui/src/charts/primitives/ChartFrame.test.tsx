/**
 * `ChartFrame`'s `isPending` invariant — the one behavior here that regresses silently. A pending
 * chart that quietly fell back to rendering its legend + body would put a densified "not measured"
 * shape back on screen exactly where `ChartPending` is supposed to reserve a static, contentless
 * placeholder (see `ChartPending`'s JSDoc for the three-state "nothing to draw" rationale).
 *
 * A DOM harness now exists (`tests/setup/dom.ts`, preloaded via the root `bunfig.toml`; see
 * `theme/use-basalt-spacing.test.tsx`'s doc) — `renderToStaticMarkup` is used deliberately here
 * instead: `ChartFrame`/`ChartPending` live in `src/charts/**`, which is Mantine-free, so no
 * `MantineProvider` wrapper is needed either. `useChartSize` never measures under SSR (no
 * `ResizeObserver`), so the plot rect falls back to `minWidth` × the resolved fixed height —
 * non-zero, which is what lets `children`/`ChartPending` render at all in this harness. Converting
 * to the DOM harness would only be worth it if a future assertion here needed a real measured size
 * (a live `ResizeObserver` reading) rather than this SSR fallback rect.
 */
import { render } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { ChartFrame } from './ChartFrame'
import { HoverOverlay } from './HoverOverlay'
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

describe('ariaLabel: the label is announced WITHOUT swallowing the interactive slider', () => {
  // The regression this guards: `role="img"` marks every descendant presentational per the ARIA
  // spec, so a screen reader would announce the label and then never expose `HoverOverlay`'s
  // `role="slider"` at all — the keyboard-scrubbable affordance becomes unreachable with no error
  // anywhere. `role="group"` announces the same label while keeping descendants in the tree.
  test('the outer container is role="group" with the label, never role="img"', () => {
    const { container } = render(
      <ChartFrame series={series} ariaLabel="Revenue over time" legend={false}>
        {() => <svg />}
      </ChartFrame>,
    )
    const outer = container.firstElementChild as HTMLElement
    expect(outer.getAttribute('role')).toBe('group')
    expect(outer.getAttribute('aria-label')).toBe('Revenue over time')
    expect(container.querySelector('[role="img"]')).toBeNull()
  })

  test('the slider stays a reachable descendant of the labeled container', () => {
    const { container } = render(
      <ChartFrame series={series} ariaLabel="Revenue over time" legend={false}>
        {() => (
          <svg>
            <HoverOverlay
              width={100}
              height={100}
              onMove={() => {}}
              onLeave={() => {}}
              onKeyDown={() => {}}
            />
          </svg>
        )}
      </ChartFrame>,
    )
    const outer = container.firstElementChild as HTMLElement
    expect(outer.getAttribute('role')).toBe('group')
    const slider = outer.querySelector('[role="slider"]')
    expect(slider).not.toBeNull()
  })
})

const twoSeries: SeriesStyle[] = [
  { key: 'a', label: 'Series A', color: '#000', mark: 'line' },
  { key: 'b', label: 'Series B', color: '#111', mark: 'bar' },
]

describe('legend toggling', () => {
  test('a multi-series legend is interactive by default', () => {
    const markup = renderToStaticMarkup(<ChartFrame series={twoSeries}>{() => <svg />}</ChartFrame>)
    expect(markup).toContain('aria-pressed="true"')
  })

  test('a single-series legend is not — hiding the only series a chart draws is never useful', () => {
    const markup = renderToStaticMarkup(<ChartFrame series={series}>{() => <svg />}</ChartFrame>)
    expect(markup).not.toContain('aria-pressed')
  })

  test('`toggle: false` opts out even with several series', () => {
    const markup = renderToStaticMarkup(
      <ChartFrame series={twoSeries} legend={{ toggle: false }}>
        {() => <svg />}
      </ChartFrame>,
    )
    expect(markup).not.toContain('aria-pressed')
  })

  test('the child receives the (initially empty) hidden set', () => {
    const markup = renderToStaticMarkup(
      <ChartFrame series={twoSeries}>{({ hidden }) => <svg>size:{hidden.size}</svg>}</ChartFrame>,
    )
    expect(markup).toContain('size:0')
  })
})
