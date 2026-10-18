/**
 * Wave 38: a chart with two or more named entries or zones shows a one-row compact key at 390 (argo's
 * ACWR, recovery and stress shapes), an explicit `legend: false` still shows none, and a strip cell's Sparkline
 * readout never loses its date to an ellipsis at ~150px.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import { CLOSE_BUDGET_MS, PHONE, closeLayoutSuite, initLayoutSuite, openFixture } from './harness'

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

  // One row: a wrapped compact key is the noise argo dropped it for.
  const ONE_ROW = 24
  test.each([
    ['w38-acwr', 4],
    ['w38-recovery', 3],
    ['w38-stress', 3],
  ])('%s: the default key is one row at 340px and leads with the zones', async (id, zonesNamed) => {
    const p = await openFixture(spec, PHONE)
    await p.settle()
    const card = await p.box('card', `[data-testid="${id}"]`)
    const legend = await p.box('legend', legendOf(id))
    expect(legend.box.height).toBeLessThanOrEqual(ONE_ROW)
    const shown = await p.raw.evaluate((sel) => {
      const row = document.querySelector(sel)
      if (!row) throw new Error('LAYOUT: no legend')
      const items = [...row.querySelectorAll<HTMLElement>('[data-legend-key]')]
      const visible = items.filter((i) => getComputedStyle(i).display !== 'none')
      const more = row.querySelector<HTMLElement>('[data-legend-more]')
      return {
        zones: visible.filter((i) => i.dataset['legendRole'] === 'reference').length,
        more: more !== null && !more.hidden ? getComputedStyle(more, '::after').content : null,
        overflow: row.scrollWidth - row.clientWidth,
      }
    }, legendOf(id))
    expect(shown.overflow).toBeLessThanOrEqual(1)
    expect(shown.zones).toBeGreaterThan(0)
    expect(shown.zones).toBeLessThanOrEqual(zonesNamed)
    // Every entry that does not fit is folded into a +N, never dropped silently.
    const entries = await p.raw.evaluate(
      (sel) => document.querySelectorAll(`${sel} [data-legend-key]`).length,
      legendOf(id),
    )
    if (shown.zones < entries - (id === 'w38-stress' ? 2 : 1)) expect(shown.more).toContain('+')
    expect(legend.box.right).toBeLessThanOrEqual(card.box.right + 0.5)
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
