/**
 * Zoned Meter label row in a real browser: each zone name centred under its own span, the end ticks
 * inline in the same row, and at most one caption line under the track. Layout outcomes happy-dom
 * cannot observe.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import type { LayoutPage } from './harness'
import {
  CLOSE_BUDGET_MS,
  DESKTOP_1440,
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
  dash: true,
}

const SUBPIXEL = 0.5
const SNAP = 1

layout('zoned Meter label row', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  let p: LayoutPage
  beforeAll(async () => {
    p = await openFixture(SPEC, DESKTOP_1440)
    await p.settle()
  }, CLOSE_BUDGET_MS)

  test.each(['dash-zl-170', 'dash-zl-220', 'dash-zl-342', 'dash-zl-card'])(
    'zone names sit in their spans, ticks share their row, one caption line (%s)',
    async (id) => {
      const m = await p.raw.evaluate((root) => {
        const host = document.querySelector<HTMLElement>(`[data-testid="${root}"]`)
        if (!host) throw new Error(`LAYOUT: no ${root}`)
        const box = (el: Element) => el.getBoundingClientRect()
        const shown = (el: Element) => !el.hasAttribute('data-hidden')
        const zones = [...host.querySelectorAll<HTMLElement>('[data-meter-zone]')].map((z) => ({
          name: z.getAttribute('data-meter-zone'),
          left: box(z).left,
          right: box(z).right,
        }))
        const labels = [...host.querySelectorAll<HTMLElement>('[data-meter-zone-label]')]
          .filter(shown)
          .map((l) => ({ name: l.getAttribute('data-meter-zone-label'), ...rect(box(l)) }))
        const ticks = [...host.querySelectorAll<HTMLElement>('[data-meter-tick-label]')]
          .filter(shown)
          .map((l) => ({ name: l.textContent, ...rect(box(l)) }))
        function rect(r: DOMRect) {
          return { left: r.left, right: r.right, top: r.top }
        }
        const caps = [...host.querySelectorAll<HTMLElement>('[data-meter-captions] > span')]
        return {
          zones,
          labels,
          ticks,
          captionTops: [...new Set(caps.map((c) => Math.round(box(c).top)))],
          strayLists: host.querySelectorAll('[data-meter-zone-list], [data-meter-tick-list]')
            .length,
          overflow: host.scrollWidth > host.clientWidth,
        }
      }, id)
      expect(m.strayLists).toBe(0)
      expect(m.overflow).toBe(false)
      expect(m.ticks.map((t) => t.name)).toEqual(['0', '2.0'])
      expect(m.labels.length).toBeGreaterThan(0)
      for (const l of m.labels) {
        const z = m.zones.find((zone) => zone.name === l.name)
        if (!z) throw new Error(`LAYOUT: no zone ${l.name}`)
        const centre = (l.left + l.right) / 2
        expect(centre).toBeGreaterThanOrEqual(z.left - SUBPIXEL)
        expect(centre).toBeLessThanOrEqual(z.right + SUBPIXEL)
      }
      const all = [...m.labels, ...m.ticks]
      for (const [i, a] of all.entries()) {
        for (const b of all.slice(i + 1)) {
          expect(a.right <= b.left + SUBPIXEL || b.right <= a.left + SUBPIXEL).toBe(true)
        }
      }
      for (const t of m.ticks) expect(Math.abs(t.top - all[0]!.top)).toBeLessThanOrEqual(SNAP)
      for (const l of m.labels) expect(Math.abs(l.top - m.ticks[0]!.top)).toBeLessThanOrEqual(SNAP)
      expect(m.captionTops.length).toBeLessThanOrEqual(1)
    },
  )
})
