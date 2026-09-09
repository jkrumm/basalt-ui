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
import {
  ChartFrame,
  legendEntryCap,
  resolveLegend,
  resolveLegendRollup,
  resolvePlotRect,
} from './ChartFrame'
import { resolveFrameHeight, resolveLegendMaxRows } from './chart-frame-layout'
import type { ResponsiveChartHeight } from './chart-frame-layout'
import type { LegendEntry } from './ChartLegend'
import { HoverOverlay } from './HoverOverlay'
import type { SeriesStyle } from '../series'

const series: SeriesStyle[] = [{ key: 'a', label: 'Series A', color: '#000', mark: 'line' }]

const CHART_BODY_MARKER = 'CHART_BODY_MARKER'

/** One legend entry, shared by every cap/rollup case below. */
const entry = (key: string, label: string): LegendEntry => ({ key, label, color: '#000' })

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

  test('the tier DEFAULT stays the upper bound — two defaults, the smaller wins', () => {
    const cap = legendEntryCap({
      items: many,
      containerW: 390,
      available: 240 - VX.minPlotHeight,
      defaultMaxRows: 2,
    })
    expect(cap).toBeLessThanOrEqual(2)
  })

  test('an unmeasured width falls back to the default rather than guessing', () => {
    expect(legendEntryCap({ items: many, containerW: 0, available: 120 })).toBe(undefined)
    expect(legendEntryCap({ items: many, containerW: 0, available: 120, defaultMaxRows: 3 })).toBe(
      3,
    )
  })
})

/**
 * The consumer report this fixes (meteo, 1.30.0): a 7-entry meteogram legend in a 92–150px docked
 * `fill` row rendered 2 entries at `maxRows` 3, 6 AND 99 — five series drawn in colours nothing
 * named, behind a rollup the box had no room to expand into. 1.30.0's own halves were both right;
 * `ChartFrame` ran the measured fit over the honoured cap, so this covers the COMPOSITION, which
 * is the part no pure-function test could see.
 */
describe('resolveLegendRollup — a stated maxRows outranks the tier AND the measured fit', () => {
  const seven = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((k) => entry(k, `Series ${k}`))
  /** meteo's row: 150px tall, `VX.minPlotHeight` 120, so the legend's share is 30px. */
  const meteo = { items: seven, containerW: 380, available: 150 - VX.minPlotHeight } as const

  test('the measured fit is what pinned it — the state before the fix', () => {
    expect(legendEntryCap({ ...meteo, defaultMaxRows: 99 })).toBeLessThan(seven.length)
  })

  test('every stated number now survives the same box, and the plot pays', () => {
    for (const statedMaxRows of [3, 6, 99]) {
      expect(
        resolveLegendRollup({ ...meteo, statedMaxRows, tier: 'phone', fillBand: true }),
      ).toEqual({ maxRows: statedMaxRows, legendWins: true })
    }
  })

  test('stating nothing still gets the measured fit, bounded by the tier default', () => {
    const rollup = resolveLegendRollup({ ...meteo, tier: 'phone', fillBand: true })
    expect(rollup.legendWins).toBe(false)
    expect(rollup.maxRows).toBeLessThanOrEqual(2)
  })

  test('off a fill band nothing is measured — the frame grows instead', () => {
    expect(resolveLegendRollup({ ...meteo, tier: 'phone', fillBand: false })).toEqual({
      maxRows: 2,
      legendWins: false,
    })
    expect(resolveLegendRollup({ ...meteo, tier: 'desktop', fillBand: false })).toEqual({
      maxRows: undefined,
      legendWins: false,
    })
  })

  test('a stated cap off a fill band is honoured too, and costs the plot nothing', () => {
    expect(
      resolveLegendRollup({ ...meteo, statedMaxRows: 6, tier: 'phone', fillBand: false }),
    ).toEqual({ maxRows: 6, legendWins: false })
  })
})

describe('resolvePlotRect — legendWins moves the cost onto the plot, never past the cell', () => {
  const box = { containerW: 380, resolvedHeight: 150, minWidth: 200, sideLegendWidth: 0 }

  test('without it the plot holds its floor and the frame overflows its own fill cell', () => {
    const plot = resolvePlotRect({ ...box, topBottomLegendHeight: 94 })
    expect(plot.height).toBe(VX.minPlotHeight)
    expect(plot.height + 94).toBeGreaterThan(box.resolvedHeight)
  })

  test('with it the plot takes the remainder — 150 in, 150 out', () => {
    const plot = resolvePlotRect({ ...box, topBottomLegendHeight: 94, legendWins: true })
    expect(plot.height).toBe(150 - 94)
  })

  test('a legend that fits is unaffected — this only ever bites past the floor', () => {
    const fits = { ...box, resolvedHeight: 240, topBottomLegendHeight: 30 }
    expect(resolvePlotRect(fits).height).toBe(resolvePlotRect({ ...fits, legendWins: true }).height)
  })

  test('spend the whole box and the plot is 0 — the callers own arithmetic, not a silent rollup', () => {
    expect(resolvePlotRect({ ...box, topBottomLegendHeight: 200, legendWins: true }).height).toBe(0)
  })

  test('an unmeasured fill frame still renders nothing, legendWins or not', () => {
    expect(
      resolvePlotRect({ ...box, resolvedHeight: 0, topBottomLegendHeight: 0, legendWins: true })
        .height,
    ).toBe(0)
  })
})

/**
 * The consumer report this fixes (meteo, 1.29.2): "the phone chart tier has an opt-out for margin
 * and xLabelRotate but NOT for the legend, and it moves rendering on the desktop." The tier keys on
 * the MEASURED box — correctly; that is not the bug — so a 380px inspector panel on a 1440px
 * desktop resolves to `phone`, and `Math.min(legend.maxRows, tierMaxRows)` meant a six-series
 * legend rolled up to two rows with no way to say no, while MIGRATING promised the opposite.
 */
describe('resolveLegendMaxRows — the tier cap is a DEFAULT, not a ceiling', () => {
  test('an explicit caller cap beats the phone tier outright, in BOTH directions', () => {
    expect(resolveLegendMaxRows({ callerMaxRows: 3, tier: 'phone' })).toBe(3)
    expect(resolveLegendMaxRows({ callerMaxRows: 1, tier: 'phone' })).toBe(1)
  })

  test('saying nothing still gets the tier default', () => {
    expect(resolveLegendMaxRows({ callerMaxRows: undefined, tier: 'phone' })).toBe(2)
    expect(resolveLegendMaxRows({ callerMaxRows: undefined, tier: 'desktop' })).toBe(undefined)
  })

  test('the desktop tier never invents a cap over an explicit one', () => {
    expect(resolveLegendMaxRows({ callerMaxRows: 5, tier: 'desktop' })).toBe(5)
  })
})

/**
 * `height` was a bare `number` on every shipped kind, so the only way to make a chart shorter on a
 * phone was a JS breakpoint — which `basalt/responsive-twin` forbids. The steps are compared
 * against the frame's own MEASURED width for the same reason the tier is: a chart squeezed to
 * 380px by a `PageAside` on a 1440px desktop is as narrow as one on a phone.
 */
describe('resolveFrameHeight — a height per size step, resolved off the measured box', () => {
  const responsive: ResponsiveChartHeight = { base: 180, md: 260 }

  test('a plain number passes through untouched — this is a widening, not a rename', () => {
    expect(resolveFrameHeight(240, 900)).toBe(240)
    expect(resolveFrameHeight(240, 0)).toBe(240)
  })

  test('a step applies from its own width up', () => {
    expect(resolveFrameHeight(responsive, 992)).toBe(260)
    expect(resolveFrameHeight(responsive, 1400)).toBe(260)
  })

  test('below every named step it is `base` — including at a desktop VIEWPORT', () => {
    // The whole point: 380px is the measured width of a `PageAside` panel, not of a phone.
    expect(resolveFrameHeight(responsive, 380)).toBe(180)
    expect(resolveFrameHeight(responsive, 991)).toBe(180)
  })

  test('the widest STATED step wins, not the widest possible one', () => {
    expect(resolveFrameHeight({ base: 180, sm: 220, lg: 300 }, 1000)).toBe(220)
    expect(resolveFrameHeight({ base: 180, sm: 220, lg: 300 }, 1200)).toBe(300)
  })

  test('an unmeasured box takes the LARGEST stated step, never `base`', () => {
    // `resolveChartTier`'s first-frame rule, applied to height: a chart that painted short and then
    // grew one frame later is the jump this avoids. SSR and the pre-observer frame both land here.
    expect(resolveFrameHeight(responsive, 0)).toBe(260)
    expect(resolveFrameHeight({ base: 180 }, 0)).toBe(180)
  })
})
