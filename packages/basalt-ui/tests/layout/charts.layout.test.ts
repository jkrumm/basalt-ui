/**
 * Layout invariants for the 2.0 chart layer (docs/V2-SPEC.md § 9.4–§ 9.6) — everything here is
 * measured or computed by a real browser, which happy-dom cannot do: the container class the host
 * resolves from its MEASURED width and the guide ladder it drives, y labels in a gutter beside the
 * plot, the crosshair the engine paints on every chart of a cursor group and clears on
 * `mouseleave`, `:root`'s `--ts-chart-*` reaching the portalled tooltip, and `touch-action` on a
 * coarse pointer (the harness context is `isMobile` + `hasTouch`, i.e. `(pointer: coarse)`).
 *
 * `[data-testid="chart-frame"]` is the fixture's own wrapper (`fixture/fixtures.tsx`), not a basalt
 * export; with `width` set it pins the chart's container class.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import { RAIL_PX } from './fixture/spec'
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
    readonly yLabels: 'none' | 'outside'
    readonly legend: 'none' | 'dots' | 'chips'
  }
  const CLASSES: readonly ClassCase[] = [
    // The height law: width × class ratio, clamped 160–420 (≤ 45vh = 405 at 900 tall).
    { cls: 'micro', width: 200, height: 160, yLabels: 'none', legend: 'none' },
    { cls: 'compact', width: 360, height: 223, yLabels: 'outside', legend: 'dots' },
    { cls: 'regular', width: 640, height: 320, yLabels: 'outside', legend: 'chips' },
    // `naming: 'auto'`: from the wide class the end labels name the lines and the legend goes.
    { cls: 'wide', width: 960, height: 384, yLabels: 'outside', legend: 'none' },
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
        expect(label.right).toBeLessThanOrEqual(geometry.plotLeft + 0.5)
      }

      const legend = await p.raw.evaluate(
        // The mode is CSS now (`chart-legend.module.css`): read what the container made visible.
        (sel) => {
          const row = document.querySelector(`${sel} [data-basalt-chart-legend]`)
          if (!row || getComputedStyle(row).display === 'none') return 'none'
          const dot = row.querySelector('[data-legend-key] > [aria-hidden]')
          return dot && getComputedStyle(dot).display !== 'none' ? 'dots' : 'chips'
        },
        FRAME,
      )
      expect(legend).toBe(c.legend)
    })
  }

  // Argo friction 38: a compact-width card with a stated regular height (280) is a normal card.
  const DESKTOP_1280: Viewport = { name: 'desktop 1280', width: 1280, height: 800 }
  const yLabelSides = (p: LayoutPage): Promise<'inside' | 'outside' | 'none'> =>
    p.raw.evaluate((sel) => {
      const svgEl = document.querySelector(sel)
      const plotLeft = svgEl
        ?.querySelector('[data-ts-key^="y-grid:"]')
        ?.getBoundingClientRect().left
      const labels = [...(svgEl?.querySelectorAll('[data-ts-key^="y-tick-label:"]') ?? [])]
      if (labels.length === 0 || plotLeft === undefined) return 'none'
      return labels.every((l) => l.getBoundingClientRect().right <= plotLeft + 0.5)
        ? 'outside'
        : 'inside'
    }, SVG)

  // Wave 37: a y label never sits inside the plot, however short the chart (a line ran through it).
  const cases: readonly {
    readonly name: string
    readonly vp: Viewport
    readonly spec: ChartsSpec
    readonly sides: 'outside'
  }[] = [
    {
      name: '1280 compact-width, 280 tall',
      vp: DESKTOP_1280,
      spec: { kind: 'lines', width: 360, height: 280 },
      sides: 'outside',
    },
    {
      name: '1280 compact-width, law height (223)',
      vp: DESKTOP_1280,
      spec: { kind: 'lines', width: 360 },
      sides: 'outside',
    },
    {
      name: '1280 compact-width, 179 tall',
      vp: DESKTOP_1280,
      spec: { kind: 'lines', width: 360, height: 179 },
      sides: 'outside',
    },
    {
      name: '1280 compact-width, 180 tall',
      vp: DESKTOP_1280,
      spec: { kind: 'lines', width: 360, height: 180 },
      sides: 'outside',
    },
    {
      name: '390 phone, 280 tall',
      vp: PHONE,
      spec: { kind: 'lines', height: 280 },
      sides: 'outside',
    },
    {
      name: '390 phone, 160 tall',
      vp: PHONE,
      spec: { kind: 'lines', height: 160 },
      sides: 'outside',
    },
    {
      name: '1280 dual panel, compact-width, 280 tall',
      vp: DESKTOP_1280,
      spec: { kind: 'dual', width: 360, height: 280 },
      sides: 'outside',
    },
    {
      name: '390 dual panel, 280 tall',
      vp: PHONE,
      spec: { kind: 'dual', height: 280 },
      sides: 'outside',
    },
    {
      name: '390 dual panel, 160 tall',
      vp: PHONE,
      spec: { kind: 'dual', height: 160 },
      sides: 'outside',
    },
  ]
  for (const c of cases) {
    test(`y labels ${c.sides}: ${c.name}`, async () => {
      const p = await openFixture(chartFixture(c.spec), c.vp)
      await p.settle()
      expect(await yLabelSides(p)).toBe(c.sides)
    })
  }

  test('compact width above the threshold keeps the gutter margin and a centered first x label', async () => {
    const p = await openFixture(
      chartFixture({ kind: 'lines', width: 360, height: 280 }),
      DESKTOP_1280,
    )
    await p.settle()
    const { svgLeft, plotLeft, anchor } = await p.raw.evaluate((sel) => {
      const svgEl = document.querySelector(sel)
      const label = svgEl?.querySelector('[data-ts-key^="x-tick-label:"]')
      return {
        svgLeft: svgEl?.getBoundingClientRect().left ?? 0,
        plotLeft:
          svgEl?.querySelector('[data-ts-key^="y-grid:"]')?.getBoundingClientRect().left ?? 0,
        anchor: label ? getComputedStyle(label).textAnchor : null,
      }
    }, SVG)
    expect(plotLeft - svgLeft).toBeGreaterThan(8) // a gutter, not the locked-zero margin
    expect(anchor).toBe('middle') // the first label is not start-anchored
  })

  test('compact and short: the first x label is not clipped by the locked-zero left margin', async () => {
    const p = await openFixture(chartFixture({ kind: 'lines', width: 360, height: 160 }), DESKTOP)
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

  // ── an explicit x domain puts the same instant on the same pixel column (ledger row 99) ─────
  test('two charts with different data extents and the same xDomain put one instant on one column', async () => {
    const p = await openFixture(
      chartFixture({ kind: 'lines', width: 640, pair: true, xDomain: true }),
      DESKTOP,
    )
    await p.settle()
    const centre = (frame: string): Promise<number> =>
      p.raw.evaluate((sel) => {
        const label = document.querySelector(`${sel} svg.ts-chart [data-ts-key^="x-tick-label"]`)
        if (!label) throw new Error(`LAYOUT: no x tick label under \`${sel}\``)
        const r = label.getBoundingClientRect()
        return r.left + r.width / 2
      }, frame)
    const [main, follower] = [await centre(FRAME), await centre(FRAME_2)]
    expect(Math.abs(main - follower)).toBeLessThanOrEqual(1)

    // The shared cursor: one instant, one rule column on both.
    await hover(p, FRAME, 0.5)
    const [a, b] = [await paintedRules(p, FRAME), await paintedRules(p, FRAME_2)]
    expect(a).toHaveLength(1)
    expect(b).toHaveLength(1)
    expect(Math.abs((a[0] ?? 0) - (b[0] ?? 0))).toBeLessThanOrEqual(1)
  })

  // ── a long sparkline pools itself to its cell (ledger row 100) ────────────────────────────
  test('a 3,000-row sparkline in a 120 px cell draws about one point per px and ends at the right edge', async () => {
    const p = await openFixture(chartFixture({ kind: 'spark', width: 120 }), DESKTOP)
    await p.settle()
    const probe = await p.raw.evaluate((frame) => {
      const root = document.querySelector(frame)
      const path = root?.querySelector('path[data-ts-key*=":segment:"]')
      const dot = root?.querySelector('circle')
      const svg = root?.querySelector('svg.ts-chart')
      if (!path || !dot || !svg) throw new Error('LAYOUT: no sparkline line, dot or svg')
      const box = svg.getBoundingClientRect()
      const d = dot.getBoundingClientRect()
      return {
        points: (path.getAttribute('d') ?? '').split('C').length,
        gap: box.right - (d.left + d.width / 2),
        width: box.width,
      }
    }, FRAME)
    expect(probe.points).toBeLessThanOrEqual(122)
    expect(probe.points).toBeGreaterThan(20)
    // The emphasis dot keeps its half-dot of air and sits at the right edge, not mid-cell.
    expect(probe.gap).toBeGreaterThanOrEqual(0)
    expect(probe.gap).toBeLessThanOrEqual(probe.width * 0.1)
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

  // Ledger row 94: `plot.height` is the FRAME; a mark pinned in px reads `plot.plotHeight`.
  for (const [name, spec] of [
    ['regular, law height', { kind: 'rail', width: 640 }],
    ['compact, law height', { kind: 'rail', width: 360 }],
    ['wide, 300 tall', { kind: 'rail', width: 960, height: 300 }],
    ['composed top pane, regular', { kind: 'panel-rail', width: 640 }],
    ['composed top pane, compact', { kind: 'panel-rail', width: 360 }],
  ] as const satisfies readonly (readonly [string, ChartsSpec])[]) {
    test(`a ${RAIL_PX} px rail drawn from plot.plotHeight measures ${RAIL_PX} px (${name})`, async () => {
      const p = await openFixture(chartFixture(spec), DESKTOP)
      await p.settle()
      const rail = await p.raw.evaluate((sel) => {
        const el = document.querySelector(
          `${sel} svg.ts-chart g[data-ts-key="rail"], ${sel} svg.ts-chart g[data-ts-key$=":rail"]`,
        )
        return el ? el.getBoundingClientRect().height : Number.NaN
      }, FRAME)
      expect(rail).toBeCloseTo(RAIL_PX, 1)
    })
  }

  // ── axis polish (ledger rows 108–110) ──────────────────────────────────────────────────────
  type Rect = { left: number; right: number; top: number; bottom: number }
  const rectsOf = (p: LayoutPage, selector: string): Promise<Rect[]> =>
    p.raw.evaluate(
      ([sel, q]) =>
        [...(document.querySelector(sel)?.querySelectorAll(q) ?? [])].map((el) => {
          const r = el.getBoundingClientRect()
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }
        }),
      [SVG, selector] as const,
    )
  const overlap = (a: Rect, b: Rect): boolean =>
    a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom

  // Row 108: an end label sits right of the last point; it must never be cut by the svg edge.
  test('wide end labels stay inside the chart when the last point sits on the plot edge', async () => {
    const p = await openFixture(chartFixture({ kind: 'lines', width: 960 }), DESKTOP)
    await p.settle()
    const svg = await p.box('chart svg', SVG)
    const labels = await rectsOf(p, '[data-ts-key$="-end-label"] text, [data-ts-key$="-end-label"]')
    expect(labels.length).toBeGreaterThan(0)
    for (const l of labels) expect(l.right).toBeLessThanOrEqual(svg.box.right + 0.5)
  })

  const endLabelAnchors = (p: LayoutPage): Promise<string[]> =>
    p.raw.evaluate(
      (sel) =>
        [...document.querySelectorAll(`${sel} [data-ts-key$="-end-label"] text`)].map(
          (t) => t.getAttribute('text-anchor') ?? '',
        ),
      SVG,
    )

  test('at least one wide end label flips inside when its point is on the edge', async () => {
    const p = await openFixture(chartFixture({ kind: 'lines', width: 960 }), DESKTOP)
    await p.settle()
    expect(await endLabelAnchors(p)).toContain('end')
  })

  test('a wide-glyph end label (WWWWWWWW) stays inside the chart', async () => {
    const p = await openFixture(
      chartFixture({ kind: 'lines', width: 960, legendEntries: 1, endLabel: 'WWWWWWWW' }),
      DESKTOP,
    )
    await p.settle()
    const svg = await p.box('chart svg', SVG)
    const labels = await rectsOf(p, '[data-ts-key$="-end-label"] text')
    expect(labels.length).toBe(1)
    for (const l of labels) {
      expect(l.right).toBeLessThanOrEqual(svg.box.right + 0.5)
      expect(l.left).toBeGreaterThanOrEqual(svg.box.left)
    }
  })

  // Row 109: a bucketed (band) Date axis labels even, readable intervals — strip and mirrored alike,
  // at a one-hour range and at the 7 d / 1440 px linewatch saw touching.
  const HOUR_MS = 3_600_000
  for (const kind of ['strip', 'mirrored'] as const) {
    for (const [name, vp, spec] of [
      ['60 minute buckets, 640 px', DESKTOP, { width: 640 }],
      ['168 hourly buckets, 1440 px', DESKTOP, { stripBuckets: 168, bucketMs: HOUR_MS }],
    ] as const) {
      test(`${kind}: x ticks are evenly spaced with room between them (${name})`, async () => {
        const p = await openFixture(chartFixture({ kind, ...spec }), vp)
        await p.settle()
        const ticks = (await rectsOf(p, '[data-ts-key*="x-tick-label:"]')).toSorted(
          (a, b) => a.left - b.left,
        )
        expect(ticks.length).toBeGreaterThan(1)
        const steps = ticks.slice(1).map((t, i) => t.left - (ticks[i] as Rect).left)
        for (const s of steps) expect(Math.abs(s - (steps[0] as number))).toBeLessThanOrEqual(1.5)
        ticks
          .slice(1)
          .forEach((t, i) => expect(t.left - (ticks[i] as Rect).right).toBeGreaterThan(8))
      })
    }
  }

  // Row 110: the first x tick label must not sit on a y tick label at the plot origin.
  for (const [name, spec, vp] of [
    ['compact, law height', { kind: 'lines', width: 360, origin: true }, DESKTOP],
    ['compact, short', { kind: 'lines', width: 360, height: 160, origin: true }, DESKTOP],
    ['390 px phone', { kind: 'lines', origin: true }, PHONE],
    ['390 px phone, short', { kind: 'lines', height: 160, origin: true }, PHONE],
  ] as const satisfies readonly (readonly [string, ChartsSpec, Viewport])[]) {
    test(`no x tick label overlaps a y tick label (${name})`, async () => {
      const p = await openFixture(chartFixture(spec), vp)
      await p.settle()
      const xs = await rectsOf(p, '[data-ts-key^="x-tick-label:"]')
      const ys = await rectsOf(p, '[data-ts-key^="y-tick-label:"]')
      expect(xs.length).toBeGreaterThan(0)
      for (const x of xs) for (const y of ys) expect(overlap(x, y)).toBe(false)
    })
  }

  // Ledger row 137 / W32 r3: the default date labels are distinct and clear of each other where the
  // tick count drops (compact class, 390 phone).
  for (const [name, spec, vp] of [
    ['compact 360', { kind: 'lines', width: 360 }, DESKTOP],
    ['390 px phone', { kind: 'lines' }, PHONE],
  ] as const satisfies readonly (readonly [string, ChartsSpec, Viewport])[]) {
    test(`default date tick labels are distinct and do not collide (${name})`, async () => {
      const p = await openFixture(chartFixture(spec), vp)
      await p.settle()
      const texts = await p.raw.evaluate(
        (sel) =>
          [...document.querySelectorAll(`${sel} [data-ts-key^="x-tick-label:"]`)].map(
            (el) => el.textContent ?? '',
          ),
        SVG,
      )
      expect(texts.length).toBeGreaterThan(1)
      expect(new Set(texts).size).toBe(texts.length)
      const ticks = (await rectsOf(p, '[data-ts-key^="x-tick-label:"]')).toSorted(
        (a, b) => a.left - b.left,
      )
      ticks.slice(1).forEach((t, i) => expect(overlap(t, ticks[i] as Rect)).toBe(false))
    })
  }

  // W32 r2: the hover readout is never cut by the viewport's top edge — it flips below the anchor.
  test('the tooltip stays inside the viewport when the chart sits at its top edge', async () => {
    const p = await openFixture(chartFixture({ kind: 'lines' }), DESKTOP)
    await p.settle()
    await p.raw.evaluate(
      (sel) => document.querySelector(sel)?.scrollIntoView({ block: 'start' }),
      FRAME,
    )
    await p.settle()
    await hover(p, FRAME, 0.5, 0.02)
    const box = await p.box('tooltip', `${TOOLTIP}:not([hidden])`)
    expect(box.box.top).toBeGreaterThanOrEqual(0)
    expect(box.box.bottom).toBeLessThanOrEqual(DESKTOP.height)
    expect(
      await p.raw.evaluate((sel) => document.querySelector(sel)?.getAttribute('role'), TOOLTIP),
    ).toBe('tooltip')
  })

  // Row 112: the last band/bar ends on the plot's right edge, not a bucket-padding short of it.
  const DAY_MS = 86_400_000
  const edgeCases = [
    ['390 px, 30 daily buckets', PHONE, 30, DAY_MS],
    ['1440 px, 7 d of hourly buckets', DESKTOP, 168, 3_600_000],
  ] as const
  for (const kind of ['strip', 'mirrored'] as const) {
    for (const [name, vp, buckets, bucketMs] of edgeCases) {
      test(`${kind}: the last band reaches the plot's right edge (${name})`, async () => {
        const p = await openFixture(chartFixture({ kind, stripBuckets: buckets, bucketMs }), vp)
        await p.settle()
        const edges = await p.raw.evaluate(
          ([sel, k]) => {
            const svg = document.querySelector(sel)
            const right = (q: string): number[] =>
              [...(svg?.querySelectorAll(q) ?? [])].map((e) => e.getBoundingClientRect().right)
            const plot =
              k === 'strip'
                ? right('[data-ts-key^="xzone-0"]')
                : right('[data-ts-key$=":baseline"]')
            const drawn =
              k === 'strip'
                ? right('[data-ts-key^="band-"] rect')
                : right('[data-ts-key$="up-bars"] rect')
            return { plot: Math.max(...plot), last: Math.max(...drawn) }
          },
          [SVG, kind] as const,
        )
        expect(edges.plot).toBeGreaterThan(0)
        expect(edges.plot - edges.last).toBeLessThanOrEqual(1)
      })
    }
  }

  describe('a Sparkline readout stays inside its box and never covers the hovered point', () => {
    test.each([
      ['the line end point', { kind: 'spark', sparkRows: 12, height: 22, width: 240 }, 0.98],
      ['a line mid point', { kind: 'spark', sparkRows: 12, height: 22, width: 240 }, 0.5],
      ['a bar', { kind: 'spark', sparkBars: true, height: 22, width: 240 }, 0.05],
    ] as const)('%s', async (_name, spec, fx) => {
      const p = await openFixture(chartFixture(spec), DESKTOP)
      await p.settle()
      const box = await p.raw.evaluate(() => {
        const r = document.querySelector('[data-basalt-sparkline]')?.getBoundingClientRect()
        if (!r) throw new Error('LAYOUT: no sparkline')
        return { x: r.x, y: r.y, w: r.width, h: r.height }
      })
      await p.raw.mouse.move(box.x + box.w * 0.5, box.y + box.h / 2)
      await p.raw.mouse.move(box.x + box.w * fx, box.y + box.h / 2)
      const m = await p.raw.evaluate(() => {
        const readout = document.querySelector('[data-basalt-sparkline-readout]')
        const root = document.querySelector('[data-basalt-sparkline]')
        if (!readout || !root) throw new Error('LAYOUT: no readout')
        const a = readout.getBoundingClientRect()
        const r = root.getBoundingClientRect()
        const dot = document.querySelector('[data-basalt-sparkline-dot]')?.getBoundingClientRect()
        return {
          text: readout.textContent,
          inside:
            a.left >= r.left - 0.5 &&
            a.right <= r.right + 0.5 &&
            a.top >= r.top - 0.5 &&
            a.bottom <= r.bottom + 0.5,
          coversDot:
            dot !== undefined &&
            a.left < dot.right &&
            a.right > dot.left &&
            a.top < dot.bottom &&
            a.bottom > dot.top,
        }
      })
      expect(m.text).not.toBe('')
      expect(m.inside).toBe(true)
      expect(m.coversDot).toBe(false)
    })
  })

  test('hovering a Bars mark draws no point marker; a Lines hover does', async () => {
    const markers = (p: LayoutPage): Promise<number> =>
      p.raw.evaluate(
        (sel) =>
          document.querySelectorAll(`${sel} svg.ts-chart .ts-chart__focus-layer circle`).length,
        FRAME,
      )
    const lines = await openFixture(chartFixture({ kind: 'lines', width: 640 }), DESKTOP)
    await lines.settle()
    await hover(lines, FRAME, 0.5)
    expect(await markers(lines)).toBeGreaterThan(0)
    const bars = await openFixture(chartFixture({ kind: 'bars', width: 640 }), DESKTOP)
    await bars.settle()
    await hover(bars, FRAME, 0.5)
    expect(await markers(bars)).toBe(0)
  })

  test('a Bars reference caption never lands on a bar', async () => {
    const p = await openFixture(
      chartFixture({ kind: 'ref-bars', width: 640, height: 300 }),
      DESKTOP,
    )
    await p.settle()
    const m = await p.raw.evaluate(() => {
      const label = document
        .querySelector('g[data-ts-key="ref-0-label"] text')
        ?.getBoundingClientRect()
      if (!label) throw new Error('LAYOUT: no reference caption')
      const hits = [...document.querySelectorAll('g[data-ts-key="bars"] rect')].filter((el) => {
        const b = el.getBoundingClientRect()
        return (
          label.left < b.right &&
          label.right > b.left &&
          label.top < b.bottom &&
          label.bottom > b.top
        )
      })
      return { hits: hits.length, width: label.width }
    })
    expect(m.width).toBeGreaterThan(0)
    expect(m.hits).toBe(0)
  })

  test('an errored ChartCard starts its anatomy at the top of the body, keeping the chart height', async () => {
    const p = await openFixture(chartFixture({ kind: 'error-card', width: 600 }), DESKTOP)
    await p.settle()
    const m = await p.raw.evaluate(() => {
      const alert = document.querySelector<HTMLElement>('[role="alert"]')
      const retry = alert?.querySelector('button')
      const head = alert?.firstElementChild
      if (!alert || !retry || !head) throw new Error('LAYOUT: no error state')
      const a = alert.getBoundingClientRect()
      return {
        above: head.getBoundingClientRect().top - a.top,
        below: a.bottom - retry.getBoundingClientRect().bottom,
      }
    })
    expect(m.above).toBeLessThanOrEqual(2)
    // The content ends well above the body's floor (a centred block would leave `above` ≈ `below`).
    expect(m.below).toBeGreaterThan(m.above)
  })

  test('a keyboard-focused Sparkline starts on the last point and its end marker sits inside the focus outline', async () => {
    const p = await openFixture(
      chartFixture({ kind: 'spark', sparkRows: 12, height: 22, width: 240 }),
      DESKTOP,
    )
    await p.settle()
    let focused = false
    for (let i = 0; i < 60 && !focused; i++) {
      await p.raw.keyboard.press('Tab')
      focused = await p.raw.evaluate(
        () =>
          document.querySelector('[data-basalt-sparkline]')?.contains(document.activeElement) ===
          true,
      )
    }
    expect(focused).toBe(true)
    await p.settle()
    const m = await p.raw.evaluate(() => {
      const active = document.activeElement
      const dot = document.querySelector('[data-basalt-sparkline] svg circle')
      if (!active || !dot) throw new Error('LAYOUT: no focused element or end marker')
      const style = getComputedStyle(active)
      const outline = Number.parseFloat(style.outlineWidth) || 0
      const offset = Number.parseFloat(style.outlineOffset) || 0
      const box = active.getBoundingClientRect()
      const d = dot.getBoundingClientRect()
      // The outline's INNER edge: the border box grown by its offset (negative offsets shrink it).
      const inner = {
        left: box.left - offset,
        right: box.right + offset,
        top: box.top - offset,
        bottom: box.bottom + offset,
      }
      return {
        outline,
        readout: document.querySelector('[data-basalt-sparkline-readout]')?.textContent ?? '',
        slack: Math.min(
          d.left - inner.left,
          inner.right - d.right,
          d.top - inner.top,
          inner.bottom - d.bottom,
        ),
      }
    })
    // Focus lands on the LAST point: the readout is the fixture's final value (row 11).
    const last = 20 + 12 * Math.sin(11 / 9) + (11 % 13)
    expect(Number.parseFloat(m.readout.replace(',', '.'))).toBeCloseTo(last, 1)
    expect(m.outline).toBeGreaterThan(0)
    expect(m.slack).toBeGreaterThanOrEqual(0)
  })

  test('a Heatmap tooltip never covers the caption row above the grid', async () => {
    const p = await openFixture(chartFixture({ kind: 'heatmap', width: 640 }), DESKTOP)
    await p.settle()
    // The top row, mid-grid: the placement that used to put the tooltip over the caption.
    await hover(p, FRAME, 0.4, 0.1)
    const m = await p.raw.evaluate((tip) => {
      const caption = document
        .querySelector('[data-testid="heatmap-caption"]')
        ?.getBoundingClientRect()
      const tooltip = document
        .querySelector<HTMLElement>(`${tip}:not([hidden])`)
        ?.getBoundingClientRect()
      if (!caption || !tooltip) throw new Error('LAYOUT: no caption or open tooltip')
      return {
        covers:
          tooltip.left < caption.right &&
          tooltip.right > caption.left &&
          tooltip.top < caption.bottom &&
          tooltip.bottom > caption.top,
        below: tooltip.top >= caption.bottom,
      }
    }, TOOLTIP)
    expect(m.covers).toBe(false)
    expect(m.below).toBe(true)
  })

  describe('a Sparkline in a StatCard slot or a strip cell answers hover with a readout inside the cell', () => {
    test.each(['card', 'right', 'strip'] as const)('%s', async (sparkIn) => {
      const p = await openFixture(chartFixture({ kind: 'spark', sparkIn }), DESKTOP)
      await p.settle()
      const box = await p.raw.evaluate(() => {
        const r = document.querySelector('[data-basalt-sparkline]')?.getBoundingClientRect()
        if (!r) throw new Error('LAYOUT: no sparkline')
        return { x: r.x, y: r.y, w: r.width, h: r.height }
      })
      await p.raw.mouse.move(box.x + box.w * 0.3, box.y + box.h / 2)
      await p.raw.mouse.move(box.x + box.w * 0.7, box.y + box.h / 2)
      const m = await p.raw.evaluate(() => {
        const readout = document.querySelector('[data-basalt-sparkline-readout]')
        const cell = document
          .querySelector('[data-basalt-sparkline]')
          ?.closest('.mantine-Card-root, [data-strip-cell]')
        if (!readout || !cell) throw new Error('LAYOUT: no readout or cell')
        const r = readout.getBoundingClientRect()
        const c = cell.getBoundingClientRect()
        // The hero value's row (value, unit, delta): what a chip above the plot could land on.
        const spark = document.querySelector('[data-basalt-sparkline]')?.getBoundingClientRect()
        const hero = cell
          .querySelector(':is([class^="valueRow_"],[class*=" valueRow_"])')
          ?.getBoundingClientRect()
        if (!hero || !spark) throw new Error('LAYOUT: no hero value row')
        // Fully visible: no ancestor that clips its overflow cuts any side of the readout
        // (`pointer-events: none` rules out `elementFromPoint`).
        let painted = true
        for (let el = readout.parentElement; el; el = el.parentElement) {
          const o = getComputedStyle(el)
          if ([o.overflowX, o.overflowY].every((v) => v === 'visible')) continue
          const a = el.getBoundingClientRect()
          if (
            r.left < a.left - 0.5 ||
            r.right > a.right + 0.5 ||
            r.top < a.top - 0.5 ||
            r.bottom > a.bottom + 0.5
          )
            painted = false
        }
        return {
          text: readout.textContent,
          visible: r.width > 0 && r.height > 0,
          painted,
          // Inside the sparkline's own box: nothing the host draws round it can sit under the chip.
          inSpark:
            r.left >= spark.left - 0.5 &&
            r.right <= spark.right + 0.5 &&
            r.top >= spark.top - 0.5 &&
            r.bottom <= spark.bottom + 0.5,
          overHero:
            r.left < hero.right &&
            r.right > hero.left &&
            r.top < hero.bottom &&
            r.bottom > hero.top,
          inside:
            r.left >= c.left - 0.5 &&
            r.right <= c.right + 0.5 &&
            r.top >= c.top - 0.5 &&
            r.bottom <= c.bottom + 0.5,
        }
      })
      expect(m.text).not.toBe('')
      // `{ at, value }` data: the readout ends with one of the fixture's days, spelled by this
      // browser's own Intl (the order of day and month is the locale's, not a contract).
      const days = await p.raw.evaluate(() =>
        [10, 11, 12, 13, 14, 15, 16].map((d) =>
          new Intl.DateTimeFormat(undefined, {
            day: 'numeric',
            month: 'short',
            timeZone: 'UTC',
          }).format(Date.UTC(2026, 9, d)),
        ),
      )
      expect(days.some((day) => m.text?.trim().endsWith(` · ${day}`))).toBe(true)
      expect(m).toMatchObject({
        visible: true,
        inside: true,
        inSpark: true,
        painted: true,
        overHero: false,
      })
    })
  })
  // ── Wave 37 chart chrome ───────────────────────────────────────────────────────────────────
  describe('the tooltip name column', () => {
    // argo strength ACWR: four per-lift series at a phone's width, names of 12–20 characters.
    const NAMES = ['Barbell squat', 'Romanian deadlift', 'Overhead press', 'Bench press (close)']

    test('keeps one line per name at a 390-wide plot, values right-aligned', async () => {
      const p = await openFixture(
        chartFixture({ kind: 'lines', legendEntries: 4, names: NAMES }),
        PHONE,
      )
      await p.settle()
      await hover(p, FRAME, 0.97)
      const rows = await p.raw.evaluate((tip) => {
        const lineHeight = (el: Element): number =>
          Number.parseFloat(getComputedStyle(el).lineHeight)
        return [...document.querySelectorAll(`${tip}:not([hidden]) .ts-chart-tooltip__row`)].map(
          (row) => {
            const [, name, value] = [...row.children] as HTMLElement[]
            const n = name?.getBoundingClientRect()
            const v = value?.getBoundingClientRect()
            return {
              text: name?.textContent ?? '',
              nameHeight: n?.height ?? 0,
              nameWidth: n?.width ?? 0,
              line: name ? lineHeight(name) : 0,
              valueRight: v?.right ?? 0,
              clipped: name ? name.scrollWidth > name.clientWidth : false,
              whiteSpace: name ? getComputedStyle(name).whiteSpace : '',
              overflow: name ? getComputedStyle(name).textOverflow : '',
            }
          },
        )
      }, TOOLTIP)
      expect(rows).toHaveLength(NAMES.length)
      for (const r of rows) {
        expect(r.nameHeight).toBeLessThanOrEqual(r.line + 1) // one line, never one glyph per line
        expect(r.nameWidth).toBeGreaterThanOrEqual(96) // the 6rem floor
        expect(r.clipped).toBe(false) // 12–20 characters fit before the ellipsis
        expect(r.whiteSpace).toBe('nowrap') // the name never wraps
        expect(r.overflow).toBe('ellipsis') // a longer one is cut, not wrapped
      }
      const rights = rows.map((r) => r.valueRight)
      expect(Math.max(...rights) - Math.min(...rights)).toBeLessThanOrEqual(0.5)
    })

    test('a name past the max ends in an ellipsis on one line', async () => {
      const long = 'A series name far longer than any tooltip column should ever be asked to hold'
      const p = await openFixture(
        chartFixture({ kind: 'lines', legendEntries: 2, names: [long, 'Short'] }),
        PHONE,
      )
      await p.settle()
      await hover(p, FRAME, 0.5)
      const first = await p.raw.evaluate((tip) => {
        const name = document.querySelector<HTMLElement>(
          `${tip}:not([hidden]) .ts-chart-tooltip__row > span:nth-child(2)`,
        )
        const r = name?.getBoundingClientRect()
        return {
          height: r?.height ?? 0,
          width: r?.width ?? 0,
          clipped: name ? name.scrollWidth > name.clientWidth : false,
          line: name ? Number.parseFloat(getComputedStyle(name).lineHeight) : 0,
        }
      }, TOOLTIP)
      expect(first.clipped).toBe(true)
      expect(first.height).toBeLessThanOrEqual(first.line + 1)
      expect(first.width).toBeLessThanOrEqual(14 * 16 + 1)
    })
  })

  describe('the y tick gutter', () => {
    // argo usage latency: a line ran through a tick label drawn inside the plot.
    for (const [name, spec, vp] of [
      ['phone, short', { kind: 'lines', height: 160 }, PHONE],
      ['compact, 179 tall', { kind: 'lines', width: 360, height: 179 }, DESKTOP],
      ['regular', { kind: 'lines', width: 640 }, DESKTOP],
      ['wide', { kind: 'lines', width: 960 }, DESKTOP],
    ] as const satisfies readonly (readonly [string, ChartsSpec, Viewport])[]) {
      test(`no y tick label box intersects the plot rect, and each sits against it (${name})`, async () => {
        const p = await openFixture(chartFixture(spec), vp)
        await p.settle()
        const plot = (await rectsOf(p, 'g.ts-chart__marks'))[0]
        const labels = await rectsOf(p, '[data-ts-key^="y-tick-label:"]')
        expect(plot).toBeDefined()
        expect(labels.length).toBeGreaterThan(1)
        for (const l of labels) {
          expect(overlap(l, plot as Rect)).toBe(false)
          expect((plot as Rect).left - l.right).toBeLessThanOrEqual(12) // right-aligned against the plot
        }
        // Right-aligned: every label ends on the same edge.
        const rights = labels.map((l) => l.right)
        expect(Math.max(...rights) - Math.min(...rights)).toBeLessThanOrEqual(0.5)
      })
    }
  })

  describe('one type step', () => {
    for (const [name, vp, width] of [
      ['phone', PHONE, undefined],
      ['desktop', DESKTOP, 960],
    ] as const) {
      test(`ticks and legend share one font size (${name})`, async () => {
        const p = await openFixture(
          chartFixture({ kind: 'lines', ...(width !== undefined && { width }), legendEntries: 5 }),
          vp,
        )
        await p.settle()
        const sizes = await p.raw.evaluate((frame) => {
          const px = (el: Element | null): number =>
            el ? Number.parseFloat(getComputedStyle(el).fontSize) : Number.NaN
          const root = document.querySelector(frame)
          return {
            ticks: [...(root?.querySelectorAll('[data-ts-key*="tick-label:"]') ?? [])].map(px),
            legend: px(root?.querySelector('[data-basalt-chart-legend]') ?? null),
          }
        }, FRAME)
        expect(sizes.ticks.length).toBeGreaterThan(0)
        for (const t of sizes.ticks) expect(t).toBe(sizes.legend)
      })
    }
  })

  describe('Lines naming', () => {
    const legendShown = (p: LayoutPage): Promise<boolean> =>
      p.raw.evaluate((frame) => {
        const row = document.querySelector(`${frame} [data-basalt-chart-legend]`)
        return row !== null && getComputedStyle(row).display !== 'none'
      }, FRAME)

    test('auto: wide names the lines with end labels and hides the legend', async () => {
      const p = await openFixture(chartFixture({ kind: 'lines', width: 960 }), DESKTOP)
      await p.settle()
      expect((await endLabelAnchors(p)).length).toBeGreaterThan(0)
      expect(await legendShown(p)).toBe(false)
    })

    test('auto: below wide the legend names the lines and no end label draws', async () => {
      const p = await openFixture(chartFixture({ kind: 'lines', width: 640 }), DESKTOP)
      await p.settle()
      expect(await endLabelAnchors(p)).toHaveLength(0)
      expect(await legendShown(p)).toBe(true)
    })
  })

  describe('y ticks cover the data', () => {
    test('the top tick label sits at or above the highest point of every line (390)', async () => {
      const p = await openFixture(chartFixture({ kind: 'lines', legendEntries: 1 }), PHONE)
      await p.settle()
      const ticks = (await rectsOf(p, '[data-ts-key^="y-tick-label:"]')).toSorted(
        (a, b) => a.top - b.top,
      )
      const line = (await rectsOf(p, 'g.ts-chart__line'))[0]
      expect(ticks.length).toBeGreaterThan(1)
      expect(line).toBeDefined()
      const topTickMid = ((ticks[0] as Rect).top + (ticks[0] as Rect).bottom) / 2
      expect((line as Rect).top).toBeGreaterThanOrEqual(topTickMid - 1)
    })
  })

  describe('Bars hover', () => {
    test('the hovered bar is highlighted; no crosshair rule paints', async () => {
      const p = await openFixture(chartFixture({ kind: 'bars', width: 640 }), DESKTOP)
      await p.settle()
      const fills = (): Promise<string[]> =>
        p.raw.evaluate(
          (frame) =>
            [
              ...document.querySelectorAll(
                `${frame} g[data-ts-key="bars"] rect, ${frame} g[data-ts-key^="bars:"] rect`,
              ),
            ].map((r) => r.getAttribute('fill') ?? getComputedStyle(r).fill),
          FRAME,
        )
      const before = await fills()
      await hover(p, FRAME, 0.5)
      const after = await fills()
      expect(after.some((f, i) => f !== before[i])).toBe(true)
      expect(await paintedRules(p, FRAME)).toHaveLength(0)
    })

    test('a bar legend swatch is a rounded square at 1440 and at 390', async () => {
      for (const vp of [DESKTOP, PHONE]) {
        const p = await openFixture(chartFixture({ kind: 'bars' }), vp)
        await p.settle()
        const radii = await p.raw.evaluate(
          (frame) =>
            [...document.querySelectorAll(`${frame} [data-legend-key] > [aria-hidden]`)]
              .filter((el) => getComputedStyle(el).display !== 'none')
              .map((el) => getComputedStyle(el).borderRadius),
          FRAME,
        )
        expect(radii.length).toBeGreaterThan(0)
        for (const r of radii) expect(r).toBe('2px')
      }
    })
  })

  describe('BandStrip tooltip placement', () => {
    test('opens below the strip, inside the viewport, at 390', async () => {
      const p = await openFixture(chartFixture({ kind: 'strip' }), PHONE)
      await p.settle()
      for (const at of [0.05, 0.5, 0.95]) {
        await hover(p, FRAME, at)
        const strip = (await rectsOf(p, 'g.ts-chart__marks'))[0] as Rect
        const tip = await p.box('tooltip', `${TOOLTIP}:not([hidden])`)
        // Below the plot: nothing above it (the hero value) is covered.
        expect(tip.box.top).toBeGreaterThanOrEqual(strip.bottom - 0.5)
        expect(tip.box.left).toBeGreaterThanOrEqual(0)
        expect(tip.box.right).toBeLessThanOrEqual(PHONE.width)
        await leave(p, FRAME)
      }
    })
  })
})
