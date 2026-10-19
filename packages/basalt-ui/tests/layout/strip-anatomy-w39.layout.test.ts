/**
 * Wave 39 strip anatomy in a real browser: the drawn visuals of one strip row share a top (a Meter,
 * a Sparkline, Bars, a qualifier that wraps, a footer `under`), at 1440 and per phone row at 390; a
 * multi-row cell's Sparkline readout is hosted and never covers its plotted line.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import type { LayoutPage, Viewport } from './harness'
import {
  CLOSE_BUDGET_MS,
  DESKTOP_1440,
  PHONE,
  closeLayoutSuite,
  initLayoutSuite,
  openFixture,
} from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

const SPEC: FixtureSpec = {
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
  w39Strip: true,
}

type Cell = {
  key: string
  rowTop: number
  plotTop: number
  valueTop: number
  captionTop: number
  bottom: number
  underTop: number | null
  inSlot: boolean
}

const cells = (p: LayoutPage): Promise<Cell[]> =>
  p.raw.evaluate(() => {
    const host = document.querySelector('[data-testid="w39-strip"]')
    if (!host) throw new Error('LAYOUT: no w39-strip')
    return [...host.querySelectorAll<HTMLElement>('[data-strip-cell]')].map((c) => {
      const plot = c.querySelector<HTMLElement>('[data-strip-visual]')?.firstElementChild
      const value = c.querySelector<HTMLElement>('[data-strip-value]')
      const caption = c.querySelector<HTMLElement>('[data-strip-caption]')
      if (!plot || !value || !caption) throw new Error('LAYOUT: cell without visual')
      const under = c
        .closest('[data-strip-slot]')
        ?.querySelector<HTMLElement>('[data-strip-footer-cell]')
      return {
        key: c.getAttribute('data-strip-cell') ?? '',
        rowTop: Math.round(c.getBoundingClientRect().top),
        plotTop: plot.getBoundingClientRect().top,
        valueTop: value.getBoundingClientRect().top,
        captionTop: caption.getBoundingClientRect().top,
        bottom: c.getBoundingClientRect().bottom,
        underTop: under ? under.getBoundingClientRect().top : null,
        inSlot: under ? under.getAttribute('data-under') === 'under' : false,
      }
    })
  })

const SNAP = 1

function suite(vp: Viewport) {
  const SHORT = vp.width < 480
  let p: LayoutPage
  beforeAll(async () => {
    p = await openFixture(SPEC, vp)
    await p.settle()
  }, CLOSE_BUDGET_MS)

  test('every visual top is level within its row', async () => {
    const all = await cells(p)
    for (const c of all)
      for (const o of all.filter((x) => x.rowTop === c.rowTop))
        expect(Math.abs(o.plotTop - c.plotTop)).toBeLessThanOrEqual(SNAP)
  })

  test('S4 composition: the drawn marks (plot, track) share one top, captions above the track sit above it', async () => {
    const r = await p.raw.evaluate(() => {
      const host = document.querySelector('[data-testid="w39-s4"]')!
      return [...host.querySelectorAll<HTMLElement>('[data-strip-cell]')].map((c) => {
        const mark = c.querySelector<HTMLElement>(
          '[data-strip-visual] :is([data-meter-track], [data-basalt-sparkline], [data-basalt-chart])',
        )!
        return {
          key: c.getAttribute('data-strip-cell'),
          row: Math.round(c.getBoundingClientRect().top),
          top: mark.getBoundingClientRect().top,
        }
      })
    })
    for (const c of r)
      for (const o of r.filter((x) => x.row === c.row))
        expect(Math.abs(o.top - c.top)).toBeLessThanOrEqual(SNAP)
  })

  test('a longer qualifier pushes only its own value down', async () => {
    const all = await cells(p)
    const get = (k: string) => all.find((c) => c.key === k)!
    const [meter, spark, bars] = [get('meter'), get('spark'), get('bars')]
    const offset = (c: Cell) => c.valueTop - c.captionTop
    expect(meter.rowTop).toBe(spark.rowTop)
    expect(offset(meter)).toBeGreaterThan(offset(spark) + SNAP)
    expect(Math.abs(offset(spark) - offset(bars))).toBeLessThanOrEqual(SNAP)
  })

  test('a footer under a cell stays inside that cell, hugging it (D35)', async () => {
    const under = (await cells(p)).find((c) => c.key === 'under')!
    expect(under.inSlot).toBe(true)
    expect(under.underTop!).toBeGreaterThanOrEqual(under.bottom - SNAP)
    // The entry's own inset (one stack-md step), never a sibling's void.
    expect(under.underTop! - under.bottom).toBeLessThanOrEqual(16)
  })

  test('a Sparkline row is master’s height: the row-visual padding the cell visual also gets, plus the plot', async () => {
    const r = await p.raw.evaluate(() => {
      const host = document.querySelector('[data-testid="w39-rows"]')!
      const probe = document.createElement('div')
      probe.style.height = 'var(--vx-space-stack-sm)'
      host.append(probe)
      const gap = probe.getBoundingClientRect().height
      probe.remove()
      const rows = [...host.querySelectorAll<HTMLElement>('[data-strip-row]')].map((x) =>
        x.getBoundingClientRect(),
      )
      // Master's row height: the plot plus the top padding the `.visual:has(sparkline)` rule gives the
      // slot — the same rule a CELL visual carries (read from the mixed strip, never a literal).
      const cellVisual = document.querySelector<HTMLElement>(
        '[data-testid="w39-strip"] [data-strip-cell="spark"] [data-strip-visual]',
      )!
      const plot = host.querySelector<HTMLElement>(
        '[data-strip-row="rhr"] [data-basalt-sparkline]',
      )!
      return {
        expected:
          Number.parseFloat(getComputedStyle(cellVisual).paddingTop) +
          plot.getBoundingClientRect().height,
        gap,
        heights: rows.map((b) => b.height),
        gaps: rows.slice(1).map((b, i) => b.top - rows[i]!.bottom),
      }
    })
    expect(Math.abs(r.heights[0]! - r.expected)).toBeLessThanOrEqual(SNAP)
    for (const g of r.gaps) expect(Math.abs(g - r.gap)).toBeLessThanOrEqual(SNAP)
  })

  test('a row Sparkline readout is hosted, sits above its plot and off its own value', async () => {
    const r = await p.raw.evaluate(async () => {
      const host = document.querySelector('[data-testid="w39-rows"]')
      const row = host?.querySelector<HTMLElement>('[data-strip-row="rhr"]')
      const spark = row?.querySelector<HTMLElement>('[data-basalt-sparkline]')
      if (!row || !spark) throw new Error('LAYOUT: no row sparkline')
      const before = row.getBoundingClientRect().height
      const b = spark.getBoundingClientRect()
      spark.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          clientX: b.left + b.width * 0.5,
          clientY: b.top + b.height / 2,
          pointerType: 'mouse',
        }),
      )
      await new Promise((r) => setTimeout(r, 120))
      const chip = spark.querySelector<HTMLElement>('[data-basalt-sparkline-readout]')
      return {
        hosted: spark.hasAttribute('data-basalt-hosted'),
        chip: chip ? chip.getBoundingClientRect() : null,
        plotTop: b.top,
        plotBottom: b.bottom,
        rowGrew: row.getBoundingClientRect().height - before,
        value: row.querySelector('[class*="rowValue_"]')!.getBoundingClientRect(),
      }
    })
    expect(r.hosted).toBe(true)
    expect(r.rowGrew).toBe(0)
    expect(r.chip).not.toBeNull()
    // The chip sits at or above the plot's top and never covers the row's own value.
    expect(r.chip!.bottom).toBeLessThanOrEqual(r.plotTop + 0.5)
    const [c, v] = [r.chip!, r.value]
    const covers = c.left < v.right && c.right > v.left && c.top < v.bottom && c.bottom > v.top
    expect(covers).toBe(false)
  })

  // The chip of every row Sparkline, hovered mid-plot and at the last point: one line inside its own
  // row's box column-wise, off every other row and off every plotted line, inside the cell.
  test('a row Sparkline readout never leaves its row for another row or the next plot', async () => {
    const r = await p.raw.evaluate(async () => {
      const rects = (e: Element) => e.getBoundingClientRect()
      const cell = document.querySelector<HTMLElement>(
        '[data-testid="w39-rows"] [data-strip-cell]',
      )!
      const rows = [...cell.querySelectorAll<HTMLElement>('[data-strip-row]')]
      const out: {
        row: string
        at: number
        chip: DOMRect
        short: boolean
        fits: boolean
        others: DOMRect[]
        plots: DOMRect[]
        cell: DOMRect
        own: DOMRect
      }[] = []
      for (const row of rows) {
        const spark = row.querySelector<HTMLElement>('[data-basalt-sparkline]')
        if (!spark) continue
        for (const at of [0.5, 0.99, 0.01]) {
          const b = rects(spark)
          spark.dispatchEvent(
            new PointerEvent('pointermove', {
              bubbles: true,
              clientX: b.left + b.width * at,
              clientY: b.top + b.height / 2,
              pointerType: 'mouse',
            }),
          )
          await new Promise((res) => setTimeout(res, 120))
          const chip = spark.querySelector<HTMLElement>('[data-basalt-sparkline-readout]')!
          out.push({
            row: row.getAttribute('data-strip-row') ?? '',
            at,
            chip: rects(chip),
            short: chip.hasAttribute('data-short'),
            fits: chip.scrollWidth <= chip.clientWidth,
            others: rows.filter((o) => o !== row).map(rects),
            plots: rows
              .filter((o) => o !== row)
              .flatMap((o) => [...o.querySelectorAll('[data-basalt-sparkline]')].map(rects)),
            cell: rects(cell),
            own: rects(row),
          })
          spark.dispatchEvent(new PointerEvent('pointerleave', { bubbles: true }))
        }
      }
      return out
    })
    expect(r.length).toBeGreaterThan(0)
    const hit = (a: DOMRect, b: DOMRect) =>
      a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
    for (const m of r) {
      const tag = `${m.row}@${m.at}`
      // The date drops only where the row is too narrow for it: a long date at 390, never a short one.
      expect(`${tag} ${m.fits}`).toBe(`${tag} true`)
      expect(`${tag} ${m.short}`).toBe(`${tag} ${m.row === 'long' && SHORT}`)
      // One line: the 1.125rem reserved line, never the ~30px stacked pair.
      expect(`${tag} ${m.chip.height <= 22}`).toBe(`${tag} true`)
      for (const o of m.others) expect(`${tag} ${hit(m.chip, o)}`).toBe(`${tag} false`)
      for (const o of m.plots) expect(`${tag} ${hit(m.chip, o)}`).toBe(`${tag} false`)
      expect(
        `${tag} ${m.chip.left >= m.cell.left - 0.5 && m.chip.right <= m.cell.right + 0.5}`,
      ).toBe(`${tag} true`)
      // Above its own plot, in the row's reserved line.
      expect(m.chip.bottom).toBeLessThanOrEqual(m.own.bottom)
    }
  })

  test('a cell-visual Sparkline readout stays one line inside its cell', async () => {
    const r = await p.raw.evaluate(async () => {
      const cell = document.querySelector<HTMLElement>(
        '[data-testid="w39-strip"] [data-strip-cell="spark"]',
      )!
      const spark = cell.querySelector<HTMLElement>('[data-basalt-sparkline]')!
      const b = spark.getBoundingClientRect()
      spark.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          clientX: b.left + b.width * 0.99,
          clientY: b.top + b.height / 2,
          pointerType: 'mouse',
        }),
      )
      await new Promise((res) => setTimeout(res, 120))
      const chip = spark.querySelector<HTMLElement>('[data-basalt-sparkline-readout]')!
      return { chip: chip.getBoundingClientRect(), cell: cell.getBoundingClientRect() }
    })
    expect(r.chip.height).toBeLessThanOrEqual(22)
    expect(r.chip.left).toBeGreaterThanOrEqual(r.cell.left - 0.5)
    expect(r.chip.right).toBeLessThanOrEqual(r.cell.right + 0.5)
    expect(r.chip.bottom).toBeLessThanOrEqual(r.cell.bottom)
  })
}

layout('strip anatomy (Wave 39)', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)
  for (const vp of [DESKTOP_1440, PHONE]) describe(`at ${vp.width}px`, () => suite(vp))
})
