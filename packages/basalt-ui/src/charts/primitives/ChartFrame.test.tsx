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
import { render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { SizeClassHintContext } from '../../shell/use-size-class'
import { VX } from '../../tokens'
import {
  ChartFrame,
  legendEntryCap,
  resolveLegend,
  resolveLegendRollup,
  resolvePlotRect,
} from './ChartFrame'
import {
  DOTS_HIT_GAP,
  LEGEND_DOT_SIZE,
  entriesWithinChipRows,
  entriesWithinDotRows,
  entriesWithinRows,
  orderEntries,
  resolveFrameHeight,
} from './chart-frame-layout'
import type { ResponsiveChartHeight } from './chart-frame-layout'
import type { LegendEntry } from './ChartLegend'
import { useChartContainerClass } from './chart-tier'
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

  test('the width fit stays the upper bound — two defaults, the smaller wins', () => {
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
describe('resolveLegendRollup — a stated maxRows outranks the width fit AND the height fit', () => {
  const seven = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((k) => entry(k, `Series ${k}`))
  /** meteo's row: 150px tall, `VX.minPlotHeight` 120, so the legend's share is 30px. */
  const meteo = { items: seven, containerW: 380, available: 150 - VX.minPlotHeight } as const

  test('the measured fit is what pinned it — the state before the fix', () => {
    expect(legendEntryCap({ ...meteo, defaultMaxRows: 99 })).toBeLessThan(seven.length)
  })

  test('every stated number now survives the same box, and the plot pays', () => {
    for (const statedMaxRows of [3, 6, 99]) {
      expect(
        resolveLegendRollup({ ...meteo, statedMaxRows, fittedMaxRows: 2, fillBand: true }),
      ).toEqual({ maxRows: statedMaxRows, legendWins: true })
    }
  })

  test('stating nothing still gets the height fit, bounded by the width fit', () => {
    const rollup = resolveLegendRollup({ ...meteo, fittedMaxRows: 2, fillBand: true })
    expect(rollup.legendWins).toBe(false)
    expect(rollup.maxRows).toBeLessThanOrEqual(2)
  })

  test('off a fill band nothing is measured — the frame grows instead', () => {
    expect(resolveLegendRollup({ ...meteo, fittedMaxRows: 2, fillBand: false })).toEqual({
      maxRows: 2,
      legendWins: false,
    })
    expect(resolveLegendRollup({ ...meteo, fittedMaxRows: undefined, fillBand: false })).toEqual({
      maxRows: undefined,
      legendWins: false,
    })
  })

  test('a stated cap off a fill band is honoured too, and costs the plot nothing', () => {
    expect(
      resolveLegendRollup({ ...meteo, statedMaxRows: 6, fittedMaxRows: 2, fillBand: false }),
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

  /**
   * The 1.30.1 collapse. A `fill` frame measures its OWN node, so in a parent that states no height
   * its `height: 100%` is `auto` and the box is whatever it rendered — and once the plot is 0 that
   * box IS the legend band. `legendWins` there is a fixpoint at zero (plot 0 → box = band → plot 0)
   * and the chart never appears; MEASURED as a 29.375px frame with no plot svg at all
   * (`tests/layout/charts.layout.test.ts` INVARIANT 7).
   */
  test('a box measuring exactly its own legend band keeps the floor — the zero fixpoint', () => {
    const collapsed = { ...box, resolvedHeight: 94, topBottomLegendHeight: 94, legendWins: true }
    expect(resolvePlotRect(collapsed).height).toBe(VX.minPlotHeight)
  })

  test('and one frame later, with room, legendWins applies again — a stable 120', () => {
    const grown = {
      ...box,
      resolvedHeight: VX.minPlotHeight + 94,
      topBottomLegendHeight: 94,
      legendWins: true,
    }
    expect(resolvePlotRect(grown).height).toBe(VX.minPlotHeight)
  })
})

/**
 * `height` was a bare `number` on every shipped kind, so the only way to make a chart shorter on a
 * phone was a JS breakpoint — which `basalt/responsive-twin` forbids. The steps key on the frame's
 * own container class (`CONTAINER_CLASSES`, MEASURED width) for the same reason the tier does: a
 * chart squeezed to 380px by a `PageAside` on a 1440px desktop is as narrow as one on a phone.
 */
describe('resolveFrameHeight — a height per container step', () => {
  const responsive: ResponsiveChartHeight = { base: 180, wide: 260 }

  test('a plain number passes through untouched — this is a widening, not a rename', () => {
    expect(resolveFrameHeight(240, 'wide')).toBe(240)
    expect(resolveFrameHeight(240, 'micro')).toBe(240)
  })

  test('a step applies from its own class up', () => {
    expect(resolveFrameHeight(responsive, 'wide')).toBe(260)
    expect(resolveFrameHeight({ base: 180, regular: 220 }, 'wide')).toBe(220)
    expect(resolveFrameHeight({ base: 180, regular: 220 }, 'regular')).toBe(220)
  })

  test('below every named step it is `base` — micro, compact, and a narrow desktop cell', () => {
    expect(resolveFrameHeight(responsive, 'micro')).toBe(180)
    expect(resolveFrameHeight(responsive, 'compact')).toBe(180)
    expect(resolveFrameHeight(responsive, 'regular')).toBe(180)
  })

  test('the widest STATED step wins, not the widest possible one', () => {
    expect(resolveFrameHeight({ base: 180, regular: 220, wide: 300 }, 'regular')).toBe(220)
    expect(resolveFrameHeight({ base: 180, regular: 220, wide: 300 }, 'wide')).toBe(300)
  })
})

describe('orderEntries — series → overlay → reference, dividers at the group boundaries', () => {
  const entry = (key: string, role?: LegendEntry['role']): LegendEntry => ({
    key,
    label: key,
    color: '#000',
    ...(role !== undefined && { role }),
  })

  test('groups=false is a no-op: input order, no dividers', () => {
    const items = [entry('a', 'reference'), entry('b'), entry('c', 'overlay')]
    expect(orderEntries(items, false)).toEqual({ entries: items, dividerAfter: new Set() })
  })

  test('groups=true sorts series → overlay → reference and marks each boundary', () => {
    const a = entry('a', 'reference')
    const b = entry('b')
    const c = entry('c', 'overlay')
    const { entries, dividerAfter } = orderEntries([a, b, c], true)
    expect(entries.map((e) => e.key)).toEqual(['b', 'c', 'a'])
    // A divider after 'b' (series → overlay) and after 'c' (overlay → reference), never after the
    // last group.
    expect(dividerAfter).toEqual(new Set([0, 1]))
  })

  test('an absent group contributes no divider', () => {
    const items = [entry('a'), entry('b', 'reference')]
    const { dividerAfter } = orderEntries(items, true)
    expect(dividerAfter).toEqual(new Set([0]))
  })
})

describe('entriesWithinDotRows — R2C-9: dots fit by pitch, not chip width', () => {
  const entry = (key: string): LegendEntry => ({ key, label: `Series ${key}`, color: '#000' })
  const entries = (n: number): LegendEntry[] =>
    Array.from({ length: n }, (_, i) => entry(String(i)))

  test('4 short entries at 274px fit in one row (the pre-fix bug: chip-width fit wrapped `All 4`)', () => {
    expect(entriesWithinDotRows(entries(4), 274, 1)).toBe(4)
  })

  test('a row sized to EXACTLY N dots fits all N — the double-counted-width regression', () => {
    // `DOT_PITCH` (internal) is already one dot's full footprint (its own size plus the gap to a
    // neighbour); a row of N dots needs one dot plus (N-1) pitches. Adding `LEGEND_DOT_SIZE` a
    // second time per dot (the bug) overstated every dot after the first, wrapping a row one dot
    // early — 3 dots fit here only once the double-count is gone.
    const dotPitch = LEGEND_DOT_SIZE + DOTS_HIT_GAP
    const exactWidthForThree = LEGEND_DOT_SIZE + dotPitch * 2
    expect(entriesWithinDotRows(entries(3), exactWidthForThree, 1)).toBe(3)
  })

  test('8 grouped entries at 337px: a group divider costs its own gap, so fewer fit than ungrouped', () => {
    const items = entries(8)
    const { dividerAfter } = orderEntries(items, false)
    const grouped = new Set([2, 5])
    const ungroupedFit = entriesWithinDotRows(items, 337, 1, dividerAfter)
    const groupedFit = entriesWithinDotRows(items, 337, 1, grouped)
    expect(groupedFit).toBeLessThanOrEqual(ungroupedFit)
  })

  test('once the overflow chip is needed, its width is reserved so it never wraps to its own row', () => {
    const items = entries(8)
    // 320px fits 7 of 8 dots by pitch alone (330px exactly fits all 8, post-fix) — tight enough to
    // still need the `All 8` chip's reserved width, which the pre-fix double-count made true at
    // any width up to and including 337.
    const fit = entriesWithinDotRows(items, 320, 1)
    expect(fit).toBeGreaterThan(0)
    expect(fit).toBeLessThan(items.length)
  })

  test('an empty item list fits nothing (nothing to wrap)', () => {
    expect(entriesWithinDotRows([], 200, 1)).toBe(0)
  })

  test('zero width fits nothing once the reserved (overflow) pass runs — round 3: the "always place the first item" rule no longer survives a reserve that leaves no room at all', () => {
    expect(entriesWithinDotRows(entries(3), 0, 1)).toBe(0)
  })
})

describe('entriesWithinChipRows — round 3: chips reserve the All-N chip width, like dots', () => {
  const entry = (key: string, label = key): LegendEntry => ({ key, label, color: '#000' })
  const entries = (n: number, label = 'A longish series label'): LegendEntry[] =>
    Array.from({ length: n }, (_, i) => entry(`k${i}`, `${label} ${i}`))

  test('when everything fits with no chip needed, the reserve pass never runs', () => {
    const items = entries(3)
    expect(entriesWithinChipRows(items, 2000, 1)).toBe(entriesWithinRows(items, 2000, 1))
  })

  test('once overflow is real, the count leaves room for the All-N chip beside it', () => {
    const items = entries(6)
    const unreserved = entriesWithinRows(items, 260, 1)
    const reserved = entriesWithinChipRows(items, 260, 1)
    expect(unreserved).toBeGreaterThan(0)
    expect(reserved).toBeLessThanOrEqual(unreserved)
  })

  test('a width too narrow for even the first chip once the All-N chip is reserved returns 0 — the row draws the disclosure alone', () => {
    expect(entriesWithinChipRows(entries(3), 0, 1)).toBe(0)
  })

  test('an empty item list fits nothing', () => {
    expect(entriesWithinChipRows([], 200, 1)).toBe(0)
  })
})

describe('ChartFrame height warnings (dev, once)', () => {
  function captureErrors(run: () => void): string[] {
    const original = console.error
    const messages: string[] = []
    console.error = (...args: unknown[]) => {
      messages.push(args.map(String).join(' '))
    }
    try {
      run()
    } finally {
      console.error = original
    }
    return messages
  }

  const mount = (height: number | ResponsiveChartHeight): string[] =>
    captureErrors(() => {
      render(
        <ChartFrame series={series} legend={false} height={height}>
          {() => null}
        </ChartFrame>,
      )
    })

  test('a numeric height under the plot floor warns', () => {
    const under = VX.minPlotHeight - 10
    expect(mount(under).some((m) => m.includes(`prop "height" (${under})`))).toBe(true)
  })

  test('a numeric height above the floor is silent', () => {
    expect(mount(VX.minPlotHeight + 50).filter((m) => m.includes('plot floor'))).toEqual([])
  })

  // F4: `legend.maxRows` changed UNIT (rows → entries) in its deprecation release — a consumer who
  // meant rows silently got an entry cap, so the warning has to name the unit change itself.
  test('a stated legend.maxRows warns that the value is now read as an entry cap, not rows', () => {
    const many: SeriesStyle[] = Array.from({ length: 5 }, (_, i) => ({
      key: `m${i}`,
      label: `M${i}`,
      color: '#000',
      mark: 'line',
    }))
    const messages = captureErrors(() => {
      render(
        <ChartFrame series={many} legend={{ maxRows: 2 }} height={240}>
          {() => null}
        </ChartFrame>,
      )
    })
    const warning = messages.find((m) => m.includes('legend.maxRows'))
    expect(warning).toContain('from rows to entries')
    expect(warning).toContain('cap of 2 legend ENTRIES (not rows)')
  })
})

describe('an unmeasured ChartFrame without a BasaltProvider is not phone chrome', () => {
  function Probe() {
    return <text>{useChartContainerClass()}</text>
  }
  const frame = (): ReturnType<typeof ChartFrame> => (
    <ChartFrame series={series} legend={false}>
      {() => (
        <svg>
          <Probe />
        </svg>
      )}
    </ChartFrame>
  )

  test('no provider: regular class (the desktop default)', () => {
    expect(renderToStaticMarkup(frame())).toContain('regular')
  })

  test('a provider hint still decides the unmeasured class', () => {
    const markup = renderToStaticMarkup(
      <SizeClassHintContext.Provider value="compact">{frame()}</SizeClassHintContext.Provider>,
    )
    expect(markup).toContain('compact')
  })
})

describe('a micro frame draws no legend, whatever the placement', () => {
  const original = window.ResizeObserver
  const two: SeriesStyle[] = [
    { key: 'a', label: 'Series A', color: '#000', mark: 'line' },
    { key: 'b', label: 'Series B', color: '#000', mark: 'line' },
  ]

  function installObserver(width: number): void {
    class FixedBoxResizeObserver {
      constructor(private readonly callback: ResizeObserverCallback) {}
      observe(): void {
        this.callback(
          [{ contentRect: { width, height: 240, top: 0, left: 0 } }] as never,
          this as never,
        )
      }
      unobserve(): void {}
      disconnect(): void {}
    }
    window.ResizeObserver = FixedBoxResizeObserver as unknown as typeof ResizeObserver
  }

  afterEach(() => {
    window.ResizeObserver = original
  })

  const mount = (width: number, placement: 'right' | 'bottom'): HTMLElement => {
    installObserver(width)
    return render(
      <ChartFrame series={two} legend={{ placement }}>
        {() => <svg />}
      </ChartFrame>,
    ).container
  }
  const legendCount = (container: HTMLElement): number =>
    container.querySelectorAll('[data-legend-key]').length

  test('sanity: a wide frame keeps the side legend', async () => {
    const container = mount(480, 'right')
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(legendCount(container)).toBe(2)
  })

  test('a 200px frame draws none — side placement included', async () => {
    const side = mount(200, 'right')
    const bottom = mount(200, 'bottom')
    await waitFor(() => expect(legendCount(side)).toBe(0))
    await waitFor(() => expect(legendCount(bottom)).toBe(0))
  })
})

/**
 * Regression (test gap): `legendKey` — the `useMemo` dependency behind `layout`, and so behind the
 * legend's own measured fit — used to be built from each entry's `key`+`label` alone. A `role` or
 * `note` appearing on an entry with the SAME key+label changed nothing that memo watched, so
 * `ChartFrame` kept serving the layout computed BEFORE that entry changed, until something else
 * (a resize, a series added/removed) invalidated it first. `legendKey` now folds in `role`/`note`
 * too (see its own comment in `ChartFrame.tsx`) — this pins that the RENDERED legend actually
 * reacts, not just that the string changed.
 *
 * A `note` is used here (rather than `role`) because it is the more DIRECTLY measurable lever:
 * `legendEntryWidth` folds a note straight into the text it measures, so a note appearing widens
 * an entry enough to push a legend that fit whole into an `All N` rollup — an outcome asserted
 * against the SAME pure resolver (`orderEntries` + `entriesWithinChipRows`) `ChartFrame` calls
 * internally, rather than a hand-calibrated pixel count.
 */
describe('the legend layout memo recomputes on a role/note change, same key+label', () => {
  const original = window.ResizeObserver
  function installObserver(width: number): void {
    class FixedBoxResizeObserver {
      constructor(private readonly callback: ResizeObserverCallback) {}
      observe(): void {
        this.callback(
          [{ contentRect: { width, height: 240, top: 0, left: 0 } }] as never,
          this as never,
        )
      }
      unobserve(): void {}
      disconnect(): void {}
    }
    window.ResizeObserver = FixedBoxResizeObserver as unknown as typeof ResizeObserver
  }
  afterEach(() => {
    window.ResizeObserver = original
  })

  // >= `CONTAINER_CLASSES.compact` (240px) — below it `resolveLegend` short-circuits the whole
  // legend to `mode: 'none'` at the `micro` container class, before any entry width is even read.
  const FRAME_W = 300
  const NOTE = 'x'.repeat(15)
  const shortSeries = (key: string): SeriesStyle => ({
    key,
    label: key.toUpperCase(),
    color: '#000',
    mark: 'line',
  })
  const base: SeriesStyle[] = ['a', 'b', 'c', 'd', 'e', 'f'].map(shortSeries)
  // Same key+label as `base` throughout — the only difference is a `note` on the last four.
  const withNotes: SeriesStyle[] = base.map((s, i) => (i >= 2 ? { ...s, note: NOTE } : s))

  const legendItemsOf = (list: SeriesStyle[]): LegendEntry[] =>
    list.map((s) => ({
      key: s.key,
      label: s.label,
      color: s.color,
      ...(s.note !== undefined && { note: s.note }),
    }))

  /** The expected visible-entry count, derived from the SAME pure resolver `ChartFrame` calls
   * internally (`chart-layout.ts`'s `resolveLegend`, un-exported — mirrored here over the two
   * pieces that ARE exported) — not a hand-calibrated pixel count. */
  function expectedVisible(list: SeriesStyle[]): number {
    const items = legendItemsOf(list)
    const { entries } = orderEntries(items, false)
    const fitted = entriesWithinChipRows(entries, FRAME_W, 2)
    return items.length - fitted < 2 ? items.length : fitted
  }

  test('sanity: the notes alone push the resolver into an overflow it did not have before', () => {
    expect(expectedVisible(base)).toBe(6)
    expect(expectedVisible(withNotes)).toBeLessThan(6)
  })

  test('adding notes to entries (same key+label) recomputes the rendered legend fit', async () => {
    installObserver(FRAME_W)
    const { container, rerender } = render(
      <ChartFrame series={base} legend={{}}>
        {() => <svg />}
      </ChartFrame>,
    )
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(container.querySelectorAll('[data-legend-key]').length).toBe(expectedVisible(base))
    expect(container.textContent).not.toContain('All 6')

    rerender(
      <ChartFrame series={withNotes} legend={{}}>
        {() => <svg />}
      </ChartFrame>,
    )
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(container.querySelectorAll('[data-legend-key]').length).toBe(expectedVisible(withNotes))
    expect(container.textContent).toContain('All 6')
  })
})
