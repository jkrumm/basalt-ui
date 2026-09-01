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
import { VX } from '../../tokens'
import { ChartFrame, legendEntryCap, resolveLegend, resolvePlotRect } from './ChartFrame'
import type { LegendEntry } from './ChartLegend'
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

describe('resolveLegend — a single-entry legend is noise, suppressed automatically', () => {
  test('one series, no explicit config: suppressed', () => {
    expect(resolveLegend(undefined, undefined, 1)).toBe(false)
  })

  test('one series, an explicit `{}` config: the opt-in wins, legend still resolves', () => {
    expect(resolveLegend({}, undefined, 1)).not.toBe(false)
  })

  test('one series, an explicit placement: the opt-in wins', () => {
    const resolved = resolveLegend({ placement: 'right' }, undefined, 1)
    expect(resolved).not.toBe(false)
    expect(resolved && resolved.placement).toBe('right')
  })

  test('two series, no explicit config: resolves normally, not suppressed', () => {
    expect(resolveLegend(undefined, undefined, 2)).not.toBe(false)
  })

  test('legend: false always wins, regardless of series count', () => {
    expect(resolveLegend(false, undefined, 1)).toBe(false)
    expect(resolveLegend(false, undefined, 2)).toBe(false)
  })

  test('no seriesCount passed (a kind composing ChartFrame directly): unaffected, resolves normally', () => {
    expect(resolveLegend(undefined)).not.toBe(false)
  })
})

describe('resolvePlotRect — the plot never collapses under its own legend', () => {
  const base = { minWidth: 200, sideLegendWidth: 0, topBottomLegendHeight: 0 }

  test('a legend measured at 200px inside a fixed 240px frame still leaves a usable plot', () => {
    // Eight entries wrapping to five rows at phone width: the plot used to go to 40px and then,
    // as the legend grew further, to <= 0 — at which point the body stopped rendering entirely.
    const plot = resolvePlotRect({
      ...base,
      containerW: 390,
      resolvedHeight: 240,
      topBottomLegendHeight: 200,
    })
    expect(plot.height).toBeGreaterThanOrEqual(VX.minPlotHeight)
  })

  test('a legend that fits is still subtracted in full — the floor is a floor, not a default', () => {
    const plot = resolvePlotRect({
      ...base,
      containerW: 390,
      resolvedHeight: 240,
      topBottomLegendHeight: 40,
    })
    expect(plot.height).toBe(200)
  })

  test('an unmeasured box (fill, before the first observation) still renders nothing', () => {
    const plot = resolvePlotRect({ ...base, containerW: 0, resolvedHeight: 0 })
    expect(plot.height).toBe(0)
  })

  test('a container narrower than minWidth is tracked exactly — no SVG wider than its own box', () => {
    const plot = resolvePlotRect({ ...base, containerW: 150, resolvedHeight: 240 })
    expect(plot.width).toBe(150)
  })

  test('minWidth still guards the unmeasured first frame', () => {
    const plot = resolvePlotRect({ ...base, containerW: 0, resolvedHeight: 240 })
    expect(plot.width).toBe(200)
  })

  test('a side legend is subtracted from the measured width', () => {
    const plot = resolvePlotRect({
      ...base,
      containerW: 400,
      resolvedHeight: 240,
      sideLegendWidth: 120,
    })
    expect(plot.width).toBe(280)
  })
})

describe('legendEntryCap — only a fill frame rolls its legend up, and only when it must', () => {
  const entry = (key: string, label: string): LegendEntry => ({ key, label, color: '#000' })
  const five = ['a', 'b', 'c', 'd', 'e'].map((k) => entry(k, k.toUpperCase()))
  const many = Array.from({ length: 24 }, (_, i) => entry(`s${i}`, `Series number ${i}`))

  test('a legend that fits the leftover height is not capped at all', () => {
    expect(
      legendEntryCap({ items: five, containerW: 900, available: 240 - VX.minPlotHeight }),
    ).toBe(undefined)
  })

  test('a legend that would eat the plot is capped to what the leftover rows hold', () => {
    const cap = legendEntryCap({ items: many, containerW: 390, available: 240 - VX.minPlotHeight })
    expect(cap).toBeDefined()
    expect(cap).toBeLessThan(many.length)
    expect(cap).toBeGreaterThanOrEqual(1)
  })

  test('an explicit caller maxRows stays the upper bound', () => {
    const cap = legendEntryCap({
      items: many,
      containerW: 390,
      available: 240 - VX.minPlotHeight,
      callerMaxRows: 2,
    })
    expect(cap).toBeLessThanOrEqual(2)
  })

  test('an unmeasured width falls back to the caller cap rather than guessing', () => {
    expect(legendEntryCap({ items: many, containerW: 0, available: 120 })).toBe(undefined)
    expect(legendEntryCap({ items: many, containerW: 0, available: 120, callerMaxRows: 3 })).toBe(3)
  })
})
