/**
 * Wave 38: a chart with two or more named entries or zones shows a compact key at 390 that keeps every entry named (argo's
 * ACWR, recovery and stress shapes), an explicit `legend: false` still shows none, and a strip cell's Sparkline
 * readout never loses its date to an ellipsis at ~150px.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
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

const spec: FixtureSpec = {
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
  w38Legend: true,
}

const legendOf = (id: string): string => `[data-testid="${id}"] [data-basalt-chart-legend]`

layout('Wave 38 legends and readouts at 390', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  // Wave 39: the compact key names every entry at every width; nothing folds.
  const ONE_ROW = 24
  type Shown = {
    series: string[]
    references: number
    wrapped: boolean
    entryWraps: string[]
    overflow: number
    seriesFirst: boolean
    lines: number
  }
  const inspect = (p: Awaited<ReturnType<typeof openFixture>>, id: string): Promise<Shown> =>
    p.raw.evaluate((sel) => {
      const row = document.querySelector(sel)
      if (!row) throw new Error('LAYOUT: no legend')
      const items = [...row.querySelectorAll<HTMLElement>('[data-legend-key]')]
      const visible = items.filter((i) => getComputedStyle(i).display !== 'none')
      const tops = new Set(visible.map((i) => Math.round(i.getBoundingClientRect().top)))
      const roles = items.map((i) => i.dataset['legendRole'])
      return {
        series: visible
          .filter((i) => i.dataset['legendRole'] !== 'reference')
          .map((i) => i.textContent ?? ''),
        references: visible.filter((i) => i.dataset['legendRole'] === 'reference').length,
        wrapped: tops.size > 1,
        lines: tops.size,
        // An entry taller than one text line wrapped inside itself.
        entryWraps: visible
          .filter((i) => i.getBoundingClientRect().height > 22)
          .map((i) => i.textContent ?? ''),
        overflow: row.scrollWidth - row.clientWidth,
        seriesFirst:
          roles.indexOf('reference') === -1 ||
          roles.lastIndexOf('series') < roles.indexOf('reference'),
      }
    }, legendOf(id))

  // argo-shaped: [id, series names, total references]
  const SHAPES: [string, string[], number][] = [
    ['w38-five-refs', ['Squat', 'Bench', 'Deadlift', 'Press', 'Row'], 2],
    ['w38-seven', ['Squat', 'Bench', 'Deadlift', 'Press', 'Row', 'Pull-up', 'Carry'], 0],
    ['w38-two-zones', ['ACWR', 'Overnight'], 4],
  ]
  test.each(SHAPES)(
    '%s at 340px: every entry named, no entry wraps mid-label',
    async (id, names, refs) => {
      const p = await openFixture(spec, PHONE)
      await p.settle()
      const card = await p.box('card', `[data-testid="${id}"]`)
      const legend = await p.box('legend', legendOf(id))
      const shown = await inspect(p, id)
      expect(shown.series).toEqual(names)
      expect(shown.references).toBe(refs)
      expect(shown.entryWraps).toEqual([])
      expect(shown.overflow).toBeLessThanOrEqual(1)
      expect(shown.seriesFirst).toBe(true)
      expect(legend.box.right).toBeLessThanOrEqual(card.box.right + 0.5)
      if (!shown.wrapped) expect(legend.box.height).toBeLessThanOrEqual(ONE_ROW)
    },
  )

  test.each(SHAPES)(
    '%s at 1440: every entry shown, series first, no entry wraps',
    async (id, names, refs) => {
      const p = await openFixture(spec, DESKTOP_1440)
      await p.settle()
      const shown = await inspect(p, `${id}-wide`)
      expect(shown.series).toEqual(names)
      expect(shown.references).toBe(refs)
      expect(shown.entryWraps).toEqual([])
      expect(shown.seriesFirst).toBe(true)
    },
  )

  test('seven series + two references at 340px: the references wrap onto lines, none fold', async () => {
    const p = await openFixture(spec, PHONE)
    await p.settle()
    const plain = await inspect(p, 'w38-seven')
    const withRefs = await inspect(p, 'w38-seven-refs')
    expect(withRefs.series).toEqual(plain.series)
    expect(withRefs.references).toBe(2)
    expect(withRefs.entryWraps).toEqual([])
    expect(withRefs.overflow).toBeLessThanOrEqual(1)
  })

  // argo's INOL / astro shape: 3 series + 3 legend-only zone keys + 2 reference lines.
  test('3 series + 3 zone keys + 2 references at 390 name all 8, none wrapping mid-label', async () => {
    const p = await openFixture(spec, PHONE)
    await p.settle()
    const names = await p.raw.evaluate((sel) => {
      const row = document.querySelector(sel)
      if (!row) throw new Error('LAYOUT: no legend')
      return [...row.querySelectorAll<HTMLElement>('[data-legend-key]')].map((i) => ({
        text: i.textContent ?? '',
        visible: getComputedStyle(i).display !== 'none' && i.getBoundingClientRect().width > 0,
        wraps: i.getBoundingClientRect().height > 22,
      }))
    }, legendOf('w39-argo'))
    expect(names.map((n) => n.text).toSorted()).toEqual(
      [
        'ACWR',
        'Overnight',
        'Sun altitude',
        'Optimal',
        'Low',
        'Very far above the target',
        'Target',
        'Floor (< 0.9)',
      ].toSorted(),
    )
    expect(names).toHaveLength(8)
    expect(names.every((n) => n.visible && !n.wraps)).toBe(true)
    const row = await inspect(p, 'w39-argo')
    expect(row.overflow).toBeLessThanOrEqual(1)
  })

  test('one entry wider than the card ellipsizes inside it and keeps its name', async () => {
    const p = await openFixture(spec, PHONE)
    await p.settle()
    const card = await p.box('card', '[data-testid="w38-long"]')
    const legend = await p.box('legend', legendOf('w38-long'))
    expect(legend.box.right).toBeLessThanOrEqual(card.box.right + 0.5)
    const label = await p.raw.evaluate((sel) => {
      const el = document.querySelector<HTMLElement>(`${sel} [data-legend-key="long"] span[title]`)
      if (!el) throw new Error('LAYOUT: no long label')
      return { title: el.title, clipped: el.scrollWidth > el.clientWidth }
    }, legendOf('w38-long'))
    expect(label.clipped).toBe(true)
    expect(label.title).toContain('much longer')
  })

  // argo's usage health card: a Bars key (placement bottom) of three verdict labels in a half column.
  test.each([
    ['w38-verdict-340', PHONE],
    ['w38-verdict-500', PHONE],
    ['w38-verdict-1000', DESKTOP_1440],
  ] as const)('%s: each verdict label reads on one line', async (id, viewport) => {
    const p = await openFixture(spec, viewport)
    await p.settle()
    const shown = await inspect(p, id)
    expect(shown.series).toEqual(['Under 1 % of calls', '1–3 % of calls', 'Over 3 % of calls'])
    expect(shown.entryWraps).toEqual([])
    if (id !== 'w38-verdict-340') expect(shown.wrapped).toBe(false)
  })

  test.each(['w38-single', 'w38-unnamed-zones', 'w38-false'])(
    '%s has no key (one entry, or an explicit legend: false)',
    async (id) => {
      const p = await openFixture(spec, PHONE)
      await p.settle()
      const present = await p.raw.evaluate(
        (sel) => document.querySelector(sel) !== null,
        legendOf(id),
      )
      expect(present).toBe(false)
    },
  )

  test('a strip-cell Sparkline readout at ~150px keeps its date, never ellipsized', async () => {
    const p = await openFixture(spec, PHONE)
    await p.settle()
    const cell = await p.raw.evaluate(() => {
      const r = document.querySelector('[data-testid="w38-strip"] [data-basalt-sparkline]')
      r?.scrollIntoView({ block: 'center' })
      const b = r?.getBoundingClientRect()
      if (!b) throw new Error('LAYOUT: no sparkline')
      return { x: b.x, y: b.y, w: b.width, h: b.height }
    })
    await p.raw.mouse.move(cell.x + cell.w * 0.5, cell.y + cell.h / 2)
    await p.raw.mouse.move(cell.x + cell.w * 0.9, cell.y + cell.h / 2)
    const m = await p.raw.evaluate(() => {
      const o = document.querySelector('[data-testid="w38-strip"] [data-basalt-sparkline-readout]')
      if (!o) throw new Error('LAYOUT: no readout')
      return {
        text: o.textContent,
        clipped: o.scrollWidth > o.clientWidth + 0.5,
        ellipsis: getComputedStyle(o).textOverflow === 'ellipsis' && o.scrollWidth > o.clientWidth,
      }
    })
    expect(m.text).toContain('Sun 5 Oct 2026')
    expect(m.clipped).toBe(false)
    expect(m.ellipsis).toBe(false)
  })

  // A hosted readout never covers the figure's delta or qualifier above its plot.
  const overlap = async (
    id: string,
    delta: string,
  ): Promise<{ readout: boolean; hit: boolean }> => {
    const p = await openFixture(spec, PHONE)
    await p.settle()
    const cell = await p.raw.evaluate((sel) => {
      const r = document.querySelector(`${sel} [data-basalt-sparkline]`)
      r?.scrollIntoView({ block: 'center' })
      const b = r?.getBoundingClientRect()
      if (!b) throw new Error('LAYOUT: no sparkline')
      return { x: b.x, y: b.y, w: b.width, h: b.height }
    }, `[data-testid="${id}"]`)
    await p.raw.mouse.move(cell.x + cell.w * 0.3, cell.y + cell.h / 2)
    await p.raw.mouse.move(cell.x + cell.w * 0.7, cell.y + cell.h / 2)
    return p.raw.evaluate(
      ([root, dsel]) => {
        const ro = document.querySelector(`${root} [data-basalt-sparkline-readout]`)
        const d = [...document.querySelectorAll(`${root} ${dsel}`)].find((e) =>
          /\d/.test(e.textContent ?? ''),
        )
        if (!ro || !d) throw new Error('LAYOUT: no readout or delta')
        const a = ro.getBoundingClientRect()
        const b = d.getBoundingClientRect()
        return {
          readout: ro.hasAttribute('data-stacked'),
          hit: a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top,
        }
      },
      [`[data-testid="${id}"]`, delta] as const,
    )
  }
  const DELTA = '[data-delta]'

  test('a strip cell readout (150px, long date) clears the delta', async () => {
    const m = await overlap('w38-strip-delta', DELTA)
    expect(m.hit).toBe(false)
  })
  test('a StatCard bleed readout, stacked (inside the plot band), clears the delta', async () => {
    expect((await overlap('w38-card-stacked', DELTA)).hit).toBe(false)
  })
  // The one-line chip lifts into the reserved line; `.sparklineBleed` reserves it (stat-card.module.css).
  test('a StatCard bleed readout, one line, clears the delta', async () => {
    expect((await overlap('w38-card-one', DELTA)).hit).toBe(false)
  })
})
