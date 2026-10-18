/**
 * Wave 38: a chart with two or more named entries or zones keeps its key at 390 (argo's ACWR,
 * recovery and stress charts pass `legend: false` when compact), and a strip cell's Sparkline
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

  test.each([
    ['w38-zones-one', 4],
    ['w38-zones-two', 5],
  ])('%s keeps a visible key naming every entry', async (id, entries) => {
    const p = await openFixture(spec, PHONE)
    await p.settle()
    const boxes = await p.boxes(`${legendOf(id)} [data-legend-key]`)
    expect(boxes).toHaveLength(entries)
    const card = await p.box('card', `[data-testid="${id}"]`)
    for (const b of boxes) {
      expect(b.width).toBeGreaterThan(0)
      expect(b.left).toBeGreaterThanOrEqual(card.box.left - 0.5)
      expect(b.right).toBeLessThanOrEqual(card.box.right + 0.5)
    }
  })

  test.each(['w38-single', 'w38-unnamed-zones', 'w38-wide-optout'])(
    '%s has no key to keep (one entry, or end labels name the lines)',
    async (id) => {
      const p = await openFixture(spec, PHONE)
      await p.settle()
      const visible = await p.raw.evaluate((sel) => {
        const el = document.querySelector(sel)
        return el !== null && getComputedStyle(el).display !== 'none'
      }, legendOf(id))
      expect(visible).toBe(false)
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
})
