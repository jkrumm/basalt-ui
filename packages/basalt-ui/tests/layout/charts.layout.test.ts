/**
 * Layout invariants for the 2.0 chart layer (docs/V2-SPEC.md § 9.4–§ 9.6) — everything here is
 * measured or computed by a real browser, which happy-dom cannot do: the container class the host
 * resolves from its MEASURED width and the guide ladder it drives, y labels inside the plot at the
 * compact class, the crosshair the engine paints on every chart of a cursor group and clears on
 * `mouseleave`, `:root`'s `--ts-chart-*` reaching the portalled tooltip, and `touch-action` on a
 * coarse pointer (the harness context is `isMobile` + `hasTouch`, i.e. `(pointer: coarse)`).
 *
 * `[data-testid="chart-frame"]` is the fixture's own wrapper (`fixture/fixtures.tsx`), not a basalt
 * export; with `width` set it pins the chart's container class.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import type { ChartsSpec, FixtureSpec } from './fixture/spec'
import type { LayoutPage, Viewport } from './harness'
import { CLOSE_BUDGET_MS, PHONE, closeLayoutSuite, initLayoutSuite, openFixture } from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

const DESKTOP: Viewport = { name: 'desktop', width: 1440, height: 900 }

const FRAME = '[data-testid="chart-frame"]'
const FRAME_2 = '[data-testid="chart-frame-2"]'
const HOST = `${FRAME} .ts-chart-host`
const SVG = `${FRAME} svg.ts-chart`
const TOOLTIP = '.ts-chart-tooltip'
const RULE_X = '.ts-chart__crosshair-rule--x'

function chartFixture(charts: ChartsSpec): FixtureSpec {
  return {
    sections: [
      { label: 'Main', items: [{ key: 'home', label: 'Home', mobile: 'tab', active: true }] },
    ],
    charts,
  }
}

/** A real `PointerEvent` at a fraction of the plot, on the chart's svg (the engine listens there). */
async function hover(p: LayoutPage, frame: string, fx = 0.5, fy = 0.5): Promise<void> {
  await p.raw.evaluate(
    ([sel, x, y]) => {
      const svg = document.querySelector(`${sel} svg.ts-chart`)
      const marks = svg?.querySelector('g.ts-chart__marks')
      if (!svg || !marks) throw new Error(`LAYOUT: no chart plot under \`${sel}\``)
      const r = marks.getBoundingClientRect()
      svg.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          clientX: r.left + r.width * x,
          clientY: r.top + r.height * y,
          pointerId: 1,
          pointerType: 'mouse',
        }),
      )
    },
    [frame, fx, fy] as const,
  )
  await p.settle()
}

/** The engine clears transient focus on the container's `mouseleave` (not `pointerleave`). */
async function leave(p: LayoutPage, frame: string): Promise<void> {
  await p.raw.evaluate((sel) => {
    const svg = document.querySelector(`${sel} svg.ts-chart`)
    for (const node of new Set([svg, svg?.parentElement, svg?.closest('.ts-chart-host')]))
      node?.dispatchEvent(new MouseEvent('mouseleave'))
  }, frame)
  await p.settle()
}

/** Painted crosshair rules under `frame`: present, visible, with a box. */
async function paintedRules(p: LayoutPage, frame: string): Promise<number[]> {
  return p.raw.evaluate(
    ([sel, rule]) =>
      [...document.querySelectorAll(`${sel} ${rule}`)].flatMap((el) => {
        const r = el.getBoundingClientRect()
        const hidden = el.closest('[visibility="hidden"]') !== null
        const style = getComputedStyle(el)
        if (hidden || style.visibility === 'hidden' || style.display === 'none' || r.height === 0)
          return []
        return [Math.round(r.left - (el.closest('svg')?.getBoundingClientRect().left ?? 0))]
      }),
    [frame, RULE_X] as const,
  )
}

layout('Charts — 2.0 layout', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  // ── one case per container class (§ 9.6) ───────────────────────────────────────────────────
  type ClassCase = {
    readonly cls: string
    readonly width: number
    readonly height: number
    readonly yLabels: 'none' | 'inside' | 'outside'
    readonly legend: 'none' | 'dots' | 'chips'
  }
  const CLASSES: readonly ClassCase[] = [
    // The height law: width × class ratio, clamped 160–420 (≤ 45vh = 405 at 900 tall).
    { cls: 'micro', width: 200, height: 160, yLabels: 'none', legend: 'none' },
    { cls: 'compact', width: 360, height: 223, yLabels: 'inside', legend: 'dots' },
    { cls: 'regular', width: 640, height: 320, yLabels: 'outside', legend: 'chips' },
    { cls: 'wide', width: 960, height: 384, yLabels: 'outside', legend: 'chips' },
  ]

  for (const c of CLASSES) {
    test(`${c.cls} (${c.width}px): height law, y labels ${c.yLabels}, legend ${c.legend}`, async () => {
      const p = await openFixture(chartFixture({ kind: 'lines', width: c.width }), DESKTOP)
      await p.settle()
      const svg = await p.box('chart svg', SVG)
      expect(Math.round(svg.box.width)).toBe(c.width)
      expect(Math.round(svg.box.height)).toBe(c.height)

      const geometry = await p.raw.evaluate((sel) => {
        const svgEl = document.querySelector(sel)
        const grid = svgEl?.querySelector('[data-ts-key^="y-grid:"]')
        const labels = [...(svgEl?.querySelectorAll('[data-ts-key^="y-tick-label:"]') ?? [])]
        const plotLeft = grid?.getBoundingClientRect().left ?? Number.NaN
        return {
          plotLeft,
          labels: labels.map((l) => {
            const r = l.getBoundingClientRect()
            return { left: r.left, right: r.right }
          }),
        }
      }, SVG)
      if (c.yLabels === 'none') expect(geometry.labels).toHaveLength(0)
      else expect(geometry.labels.length).toBeGreaterThan(1)
      for (const label of geometry.labels) {
        if (c.yLabels === 'inside') expect(label.left).toBeGreaterThanOrEqual(geometry.plotLeft)
        else expect(label.right).toBeLessThanOrEqual(geometry.plotLeft + 0.5)
      }

      const legend = await p.raw.evaluate(
        (sel) =>
          document
            .querySelector(`${sel} [data-basalt-chart-legend]`)
            ?.getAttribute('data-basalt-chart-legend') ?? 'none',
        FRAME,
      )
      expect(legend).toBe(c.legend)
    })
  }

  test('compact: the first x label is not clipped by the locked-zero left margin', async () => {
    const p = await openFixture(chartFixture({ kind: 'lines', width: 360 }), DESKTOP)
    await p.settle()
    const { svgLeft, firstLabel } = await p.raw.evaluate((sel) => {
      const svgEl = document.querySelector(sel)
      const first = svgEl?.querySelector('[data-ts-key^="x-tick-label:"]')
      return {
        svgLeft: svgEl?.getBoundingClientRect().left ?? 0,
        firstLabel: first?.getBoundingClientRect().left ?? Number.NaN,
      }
    }, SVG)
    expect(firstLabel).toBeGreaterThanOrEqual(svgLeft - 0.5)
  })

  // ── crosshair across a cursor group, cleared on mouseleave (§ 9.4) ─────────────────────────
  test('a hover paints the crosshair on both charts of the group and mouseleave clears it', async () => {
    const p = await openFixture(chartFixture({ kind: 'lines', width: 640, pair: true }), DESKTOP)
    await p.settle()
    await hover(p, FRAME, 0.4)
    const source = await paintedRules(p, FRAME)
    const follower = await paintedRules(p, FRAME_2)
    expect(source).toHaveLength(1)
    expect(follower).toHaveLength(1)
    // Same data, same width, same x: the follower's rule sits where the source's does.
    expect(Math.abs((follower[0] ?? 0) - (source[0] ?? 0))).toBeLessThanOrEqual(1)
    // Source-only: one tooltip, the source's.
    expect(await p.count(`${TOOLTIP}:not([hidden])`)).toBe(1)

    await leave(p, FRAME)
    expect(await paintedRules(p, FRAME)).toHaveLength(0)
    expect(await paintedRules(p, FRAME_2)).toHaveLength(0)
  })

  // ── the theme bridge reaches the portalled tooltip from :root (§ 9.5) ───────────────────────
  test('the tooltip inherits --ts-chart-* from :root and paints the --vx-* tooltip tokens', async () => {
    const p = await openFixture(chartFixture({ kind: 'lines', width: 640 }), DESKTOP)
    await p.settle()
    await hover(p, FRAME, 0.5)
    const read = await p.raw.evaluate((tip) => {
      const el = document.querySelector<HTMLElement>(`${tip}:not([hidden])`)
      if (!el) return null
      // What the tokens resolve to, measured through a probe that paints them directly.
      const probe = document.createElement('div')
      probe.style.background = 'var(--vx-tooltip-bg)'
      probe.style.color = 'var(--vx-tooltip-text)'
      document.body.append(probe)
      const want = getComputedStyle(probe)
      const expected = { bg: want.backgroundColor, color: want.color }
      probe.remove()
      const got = getComputedStyle(el)
      return {
        rootVar: getComputedStyle(document.documentElement)
          .getPropertyValue('--ts-chart-tooltip-background')
          .trim(),
        tipVar: got.getPropertyValue('--ts-chart-tooltip-background').trim(),
        bg: got.backgroundColor,
        color: got.color,
        expected,
      }
    }, TOOLTIP)
    if (!read) throw new Error('LAYOUT: no visible tooltip after hovering the plot')
    expect(read.rootVar).not.toBe('')
    expect(read.tipVar).toBe(read.rootVar)
    expect(read.bg).toBe(read.expected.bg)
    expect(read.color).toBe(read.expected.color)
  })

  test('the tooltip stays inside the viewport when hovering near the right edge (phone)', async () => {
    const p = await openFixture(chartFixture({ kind: 'lines' }), PHONE)
    await p.settle()
    await hover(p, FRAME, 0.98)
    const box = await p.box('tooltip', `${TOOLTIP}:not([hidden])`)
    expect(box.box.left).toBeGreaterThanOrEqual(0)
    expect(box.box.right).toBeLessThanOrEqual(PHONE.width)
  })

  // ── touch (§ 9.6) ───────────────────────────────────────────────────────────────────────────
  test('a coarse pointer gets touch-action: pan-y on the host, so a swipe still scrolls', async () => {
    const p = await openFixture(chartFixture({ kind: 'lines' }), PHONE)
    await p.settle()
    expect(await p.computed(HOST, 'touch-action')).toBe('pan-y')
  })

  test('a tap pins the cursor past the lift, and a second tap unpins it', async () => {
    const p = await openFixture(chartFixture({ kind: 'lines' }), PHONE)
    await p.settle()
    await p.raw.evaluate(
      (sel) => document.querySelector(sel)?.scrollIntoView({ block: 'center' }),
      FRAME,
    )
    await p.settle()
    const svg = await p.box('chart svg', SVG)
    const cx = svg.box.left + svg.box.width / 2
    const cy = svg.box.top + svg.box.height / 2
    // Nothing sits over the plot: a legend entry's hit overlay once anchored to the chart root.
    const top = await p.raw.evaluate(
      ([x, y]) => document.elementFromPoint(x, y)?.closest('svg.ts-chart') !== null,
      [cx, cy] as const,
    )
    expect(top).toBe(true)
    await p.raw.touchscreen.tap(cx, cy)
    await p.settle()
    await new Promise((r) => setTimeout(r, 300))
    expect(await paintedRules(p, FRAME)).toHaveLength(1)
    // Unpin with a tap on the plot clear of the pinned tooltip: the engine ignores a tap ON the
    // tooltip (it is the pinned surface), and does not dismiss a pinned CURSOR from outside the chart.
    await p.raw.touchscreen.tap(
      svg.box.left + svg.box.width * 0.1,
      svg.box.top + svg.box.height * 0.85,
    )
    await p.settle()
    await new Promise((r) => setTimeout(r, 300))
    expect(await paintedRules(p, FRAME)).toHaveLength(0)
  })

  test('keyboard: Tab focuses the chart, ←/→ walk the points, Escape clears', async () => {
    const p = await openFixture(chartFixture({ kind: 'lines', width: 640 }), DESKTOP)
    await p.settle()
    // Tab until the chart's own svg holds focus (the shell's controls come first).
    let focused = false
    for (let i = 0; i < 60 && !focused; i++) {
      await p.raw.keyboard.press('Tab')
      focused = await p.raw.evaluate(
        (sel) => document.activeElement === document.querySelector(sel),
        SVG,
      )
    }
    expect(focused).toBe(true)
    await p.settle()
    const first = await paintedRules(p, FRAME)
    expect(first).toHaveLength(1)
    await p.raw.keyboard.press('ArrowRight')
    await p.raw.keyboard.press('ArrowRight')
    await p.settle()
    const moved = await paintedRules(p, FRAME)
    expect(moved[0] ?? 0).toBeGreaterThan(first[0] ?? 0)
    await p.raw.keyboard.press('ArrowLeft')
    await p.settle()
    const back = await paintedRules(p, FRAME)
    expect(back[0] ?? 0).toBeLessThan(moved[0] ?? 0)
    await p.raw.keyboard.press('Escape')
    await p.settle()
    expect(await paintedRules(p, FRAME)).toHaveLength(0)
  })

  // ── legend ──────────────────────────────────────────────────────────────────────────────────
  test('an 8-entry legend wraps inside the chart box on a phone', async () => {
    const p = await openFixture(chartFixture({ kind: 'bars', legendEntries: 8 }), PHONE)
    await p.settle()
    const frame = await p.box('frame', FRAME)
    const entries = await p.boxes(`${FRAME} [data-legend-key]`)
    expect(entries).toHaveLength(8)
    for (const e of entries) {
      expect(e.left).toBeGreaterThanOrEqual(frame.box.left - 0.5)
      expect(e.right).toBeLessThanOrEqual(frame.box.right + 0.5)
    }
  })
})
