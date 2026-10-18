/**
 * Wave 38: `Bars` in a StatCard visual slot draws no axes, ticks or gutters and fills the slot like
 * a `Sparkline` beside it (argo's Reading pace tile).
 */
import { afterAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import {
  CLOSE_BUDGET_MS,
  DESKTOP_1440,
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
  w38BarsSlot: true,
}

layout('Bars in a StatCard visual slot', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  test('no axis, tick or grid DOM; the plot spans the slot width of the sparkline beside it; the height is the sparkline slot height', async () => {
    const p = await openFixture(spec, DESKTOP_1440)
    await p.settle()
    const measured = await p.raw.evaluate(() => {
      const rect = (el: Element | null) => {
        if (!el) throw new Error('LAYOUT: missing element')
        const r = el.getBoundingClientRect()
        return { left: r.left, width: r.width, height: r.height }
      }
      const bars = document.querySelector('[data-testid="w38-bars-card"] svg')
      const spark = document.querySelector('[data-testid="w38-spark-card"] svg')
      return {
        bars: rect(bars),
        spark: rect(spark),
        texts: bars?.querySelectorAll('text').length ?? -1,
        ticks: document.querySelectorAll(
          '[data-testid="w38-bars-card"] [data-axis], [data-testid="w38-bars-card"] [class*="tick"]',
        ).length,
        legend: document.querySelectorAll(
          '[data-testid="w38-bars-card"] [data-basalt-chart-legend]',
        ).length,
        rects: bars?.querySelectorAll('rect, path').length ?? 0,
      }
    })
    expect(measured.texts).toBe(0)
    expect(measured.ticks).toBe(0)
    expect(measured.legend).toBe(0)
    expect(measured.rects).toBeGreaterThan(0)
    expect(Math.abs(measured.bars.width - measured.spark.width)).toBeLessThanOrEqual(1)
    expect(Math.abs(measured.bars.height - measured.spark.height)).toBeLessThanOrEqual(1)
  })

  // A slotted Bars sits like a Sparkline: same card height, the footer line on the same y.
  test.each(['card', 'strip'])(
    '%s: the Bars and Sparkline hosts have the same height and footer position',
    async (kind) => {
      const p = await openFixture(spec, DESKTOP_1440)
      await p.settle()
      const probe = await p.raw.evaluate((k) => {
        const read = (v: string) => {
          const host = document.querySelector(`[data-testid="w38-${v}-${k}"]`)
          if (!host) throw new Error(`LAYOUT: no w38-${v}-${k}`)
          const foot = [...host.querySelectorAll('*')].find(
            (el) => el.children.length === 0 && el.textContent?.includes('fastest 71'),
          )
          if (!foot) throw new Error('LAYOUT: no footer')
          const top = host.getBoundingClientRect().top
          return {
            height: host.getBoundingClientRect().height,
            foot: foot.getBoundingClientRect().top - top,
          }
        }
        return { bars: read('bars'), spark: read('spark') }
      }, kind)
      expect(Math.abs(probe.bars.height - probe.spark.height)).toBeLessThanOrEqual(1)
      expect(Math.abs(probe.bars.foot - probe.spark.foot)).toBeLessThanOrEqual(1)
    },
  )
})
