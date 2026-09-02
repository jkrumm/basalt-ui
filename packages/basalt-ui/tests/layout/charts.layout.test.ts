/**
 * Layout invariants for the chart layer — audit finding D7: the layout suite never measured a
 * chart. Everything here is ResizeObserver- and getBoundingClientRect-driven
 * (`docs/CHARTS-SPEC.md` §1 measured margins, §6 the one responsive path, §8 the phone tier), so
 * happy-dom (a hard-coded `DOMRect`, `offsetWidth`/`offsetHeight` pinned to `0`) cannot see any of
 * it — a green `bun test` run here would prove nothing about the geometry it claims to cover.
 *
 * `[data-testid="chart-frame"]` is the fixture's own wrapper (`fixture/fixtures.tsx`), not a
 * basalt export — it exists so every kind the fixture can mount has ONE stable selector for "the
 * chart's own box" regardless of which real kind (`MultiLine` / `Bars` / `Heatmap` / `Donut`) is
 * underneath.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import { VX } from '../../src/tokens'
import type { ChartsSpec, FixtureSpec } from './fixture/spec'
import type { LayoutPage, Viewport } from './harness'
import {
  CLOSE_BUDGET_MS,
  PHONE,
  PHONE_SMALL,
  closeLayoutSuite,
  expectFullyInside,
  expectHeightAtLeast,
  initLayoutSuite,
  openFixture,
} from './harness'

// Booted at MODULE TOP LEVEL, the same shape as every other layout file — Bun caps a hook at an
// undeclared 5000 ms that the cold boot does not reliably fit inside.
const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

const DESKTOP: Viewport = { name: 'desktop', width: 1440, height: 900 }

const FRAME = '[data-testid="chart-frame"]'
const SVG = `${FRAME} svg`
/** The `HoverOverlay` — focusable and `role="slider"` whenever the chart wires a keyboard handler,
 * which `CartesianChart` always does (`primitives/HoverOverlay.tsx`). */
const OVERLAY = `${FRAME} rect[role="slider"]`
const TICK_TEXT = `${FRAME} .visx-axis-bottom .visx-axis-tick text`
const TOOLTIP = '[role="tooltip"]'
/** A toggle entry (`ChartLegend`'s per-series button) vs. the "+N more" disclosure — two different
 * buttons, two different a11y attributes, so the selectors can't collide. */
const LEGEND_ENTRY = `${FRAME} button[aria-pressed]`
const LEGEND_MORE = `${FRAME} button[aria-expanded]`

/** One chart above the filler, in an otherwise minimal shell. */
function chartFixture(charts: ChartsSpec): FixtureSpec {
  return {
    sections: [
      { label: 'Main', items: [{ key: 'home', label: 'Home', mobile: 'tab', active: true }] },
    ],
    charts,
  }
}

/**
 * Dispatches a real `PointerEvent` at viewport coordinates `(x, y)` directly on `selector`,
 * bypassing `page.mouse.move` — the fixture context runs `hasTouch: true, isMobile: true`
 * (`harness.ts`'s `openFixture`), and a synthesized OS-level mouse move is a second layer of
 * emulation this suite does not need: `useChartCursor.onPointerMove` reads `event.currentTarget`
 * and `event.clientX/clientY` off whatever pointer event lands on the overlay rect, real or not.
 */
async function hoverAt(p: LayoutPage, selector: string, x: number, y: number): Promise<void> {
  await p.raw.evaluate(
    ([sel, cx, cy]) => {
      const el = document.querySelector(sel)
      if (!el) throw new Error(`LAYOUT: no element matched \`${sel}\``)
      el.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          clientX: cx,
          clientY: cy,
          pointerId: 1,
          pointerType: 'mouse',
        }),
      )
    },
    [selector, x, y] as [string, number, number],
  )
  await p.settle()
}

layout('Charts — real layout', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  /**
   * INVARIANT 1 — the plot floor (`docs/CHARTS-SPEC.md` §6). An 8-entry legend at a FIXED
   * `height={240}` used to eat the plot toward zero as the legend wrapped; the plot now stops at
   * `VX.minPlotHeight` and the frame's own box grows instead. The SVG must also never spill past
   * its own container — the width half of the same "chart never collapses/overflows" promise.
   */
  for (const viewport of [PHONE, PHONE_SMALL]) {
    test(`8-entry legend at height=240 holds the plot floor and never overflows (${viewport.name})`, async () => {
      const p = await openFixture(
        chartFixture({ kind: 'multiLine', legendEntries: 8, height: 240 }),
        viewport,
      )
      const svg = await p.box('svg', SVG)
      expectHeightAtLeast(
        svg,
        VX.minPlotHeight,
        'a wrapping 8-entry legend must not eat the plot toward zero — it is floored at ' +
          'VX.minPlotHeight and the frame grows instead',
      )
      const frame = await p.box('chart frame', FRAME)
      expect(svg.box.right).toBeLessThanOrEqual(frame.box.right + 0.5)
    })
  }

  /**
   * INVARIANT 2 — tick labels never overlap or clip (`docs/CHARTS-SPEC.md` §1). A wide `formatX`
   * (`'Mar 08 14:00'`-shaped) is exactly the case `smartTicks`' measured-not-assumed pitch and
   * `autoXLabelRotate`'s fit check exist for. `xLabelRotate={45}` pins the historical regression
   * verbatim: a rotated label used to run 3.2–5.7px past the SVG's own left edge because the
   * measured gutter and the painted (nudged + rotated) glyph box disagreed.
   */
  for (const viewport of [PHONE, PHONE_SMALL]) {
    test(`wide x labels never overlap or clip the SVG edges (${viewport.name})`, async () => {
      const p = await openFixture(chartFixture({ kind: 'bars', formatX: 'wide' }), viewport)
      const svg = await p.box('svg', SVG)
      const labels = await p.boxes(TICK_TEXT)
      expect(labels.length).toBeGreaterThan(0)

      const sorted = labels.toSorted((a, b) => a.left - b.left)
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1] as (typeof sorted)[number]
        const cur = sorted[i] as (typeof sorted)[number]
        expect(cur.left).toBeGreaterThanOrEqual(prev.right - 0.5)
      }
      for (const box of sorted) {
        expect(box.left).toBeGreaterThanOrEqual(svg.box.left - 0.5)
        expect(box.right).toBeLessThanOrEqual(svg.box.right + 0.5)
      }
    })

    test(`wide x labels rotated 45° stay anchored inside the SVG (${viewport.name})`, async () => {
      const p = await openFixture(
        chartFixture({ kind: 'bars', formatX: 'wide', xLabelRotate: 45 }),
        viewport,
      )
      const svg = await p.box('svg', SVG)
      const labels = await p.boxes(TICK_TEXT)
      expect(labels.length).toBeGreaterThan(0)
      const first = labels.toSorted((a, b) => a.left - b.left)[0] as (typeof labels)[number]
      expect(first.left).toBeGreaterThanOrEqual(svg.box.left - 0.5)
      expect(first.bottom).toBeLessThanOrEqual(svg.box.bottom + 0.5)
    })
  }

  /**
   * INVARIANT 3 — the phone tier is measured, never a media query (`docs/CHARTS-SPEC.md` §8). The
   * axis tick font is one type step down (`TEXT.micro` → `TEXT.nano`) below `VX.phoneChartWidth`
   * (480) regardless of the VIEWPORT — both fixtures here sit in the same minimal shell, so a
   * failure here would mean the tier stopped reading its measured container width.
   */
  test('axis tick font is smaller at PHONE than at a 1440 desktop viewport', async () => {
    const spec = chartFixture({ kind: 'bars', legendEntries: 2 })
    const phone = await openFixture(spec, PHONE)
    const phoneFont = parseFloat(await phone.computed(TICK_TEXT, 'font-size'))

    const desktop = await openFixture(spec, DESKTOP)
    const desktopFont = parseFloat(await desktop.computed(TICK_TEXT, 'font-size'))

    expect(phoneFont).toBeLessThan(desktopFont)
  })

  /**
   * INVARIANT 4 — the three sizing modes resolve to real geometry (`docs/CHARTS-SPEC.md` §6).
   * `Heatmap` is the one kind exposing all three (`height` / `aspectRatio` / `fill`) — a `fill`
   * frame fills its parent's MEASURED height (no legend band on a heatmap, so the whole box goes
   * to the plot) and `aspectRatio` derives height from the measured width.
   */
  test('fill sizes the plot to a fixed-height 260px container', async () => {
    const p = await openFixture(
      chartFixture({ kind: 'heatmap', fill: true, containerHeight: 260 }),
      PHONE,
    )
    const svg = await p.box('svg', SVG)
    expect(svg.box.height).toBeGreaterThanOrEqual(258)
    expect(svg.box.height).toBeLessThanOrEqual(262)
  })

  test('aspectRatio=2 yields a plot whose width is ~2x its height', async () => {
    const p = await openFixture(chartFixture({ kind: 'heatmap', aspectRatio: 2 }), PHONE)
    const svg = await p.box('svg', SVG)
    expect(svg.box.width / svg.box.height).toBeCloseTo(2, 1)
  })

  /**
   * INVARIANT 5 — the floating tooltip clamps to the viewport (`docs/CHARTS-SPEC.md` §4). Hovering
   * 4px off the plot's own right edge is exactly the case `ChartTooltipFloat`'s flip-and-clamp
   * exists for: an anchor that close to the viewport edge would place an unclamped tooltip
   * partially off-screen.
   */
  test('tooltip stays inside the viewport when hovering the plot near its right edge', async () => {
    const p = await openFixture(chartFixture({ kind: 'multiLine' }), PHONE)
    const overlay = await p.box('overlay', OVERLAY)

    await hoverAt(p, OVERLAY, overlay.box.right - 4, overlay.box.top + overlay.box.height / 2)
    await p.waitFor(TOOLTIP)

    const tooltip = await p.box('tooltip', TOOLTIP)
    expectFullyInside(
      tooltip,
      p.bounds(),
      'the floating tooltip must clamp to the viewport, not run off-screen, when the hovered ' +
        'point sits near the plot edge',
      PHONE,
    )
  })

  /**
   * INVARIANT 6 — the phone legend's "+N more" is a disclosure, not a caption
   * (`docs/CHARTS-SPEC.md` §8). A cap of two (`PHONE_LEGEND_MAX_ROWS`) leaves six of eight plotted
   * colours unnamed; the chip must be a REAL `aria-expanded` toggle, and expanding it must not cost
   * the plot its floor.
   */
  test('the phone legend rollup discloses every entry on tap and the plot keeps its floor', async () => {
    const p = await openFixture(
      chartFixture({ kind: 'multiLine', legendEntries: 8, height: 240 }),
      PHONE,
    )

    expect(await p.count(LEGEND_MORE)).toBe(1)
    expect(await p.count(`${LEGEND_MORE}[aria-expanded="false"]`)).toBe(1)
    expect(await p.count(LEGEND_ENTRY)).toBe(2)

    await p.tap(LEGEND_MORE)

    expect(await p.count(`${LEGEND_MORE}[aria-expanded="true"]`)).toBe(1)
    expect(await p.count(LEGEND_ENTRY)).toBe(8)

    const svg = await p.box('svg', SVG)
    expectHeightAtLeast(
      svg,
      VX.minPlotHeight,
      'expanding the phone legend rollup must not shrink the plot below its floor',
    )
  })
})
