/**
 * Wave 43: argo's body-weight Lines (Weight + 7 d mean ending 0.1 kg apart) at 390 and 1440 — the
 * end labels must not intersect each other, and each must stay inside the chart.
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

const ROOT = '[data-testid="w43-lines"]'
const LABELS = '[data-ts-key$="-end-label"] text'
/** Sub-pixel slack on a measured edge, px. */
const EDGE_EPS = 0.5
/** Air between the two label boxes, px: one label line is the pitch, so the boxes never touch. */
const LABEL_AIR = 2

const spec: FixtureSpec = {
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
  w43Lines: true,
}

layout('Wave 43 end labels on two close lines', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  test.each([
    ['1440', DESKTOP_1440],
    ['390', PHONE],
  ] as const)(
    '%s: the end labels do not intersect and stay inside the chart',
    async (_, viewport) => {
      const p = await openFixture(spec, viewport)
      await p.settle()
      const m = await p.raw.evaluate(
        ({ root, labels }) => {
          const svg = document.querySelector(`${root} svg`)
          if (!svg) throw new Error('LAYOUT: no chart svg')
          const frame = svg.getBoundingClientRect()
          const boxes = [...svg.querySelectorAll(labels)].map((el) => {
            const r = el.getBoundingClientRect()
            return {
              text: el.textContent,
              left: r.left,
              right: r.right,
              top: r.top,
              bottom: r.bottom,
            }
          })
          // The end point of each drawn line, in page px: the stretch a label must not sit on.
          const tails = [...svg.querySelectorAll('path')].flatMap((path) => {
            const d = path.getAttribute('d') ?? ''
            const pts = [...d.matchAll(/(-?[\d.]+)[ ,](-?[\d.]+)/g)].map((m) => [
              Number(m[1]),
              Number(m[2]),
            ])
            if (pts.length < 20) return []
            const ctm = path.getScreenCTM()
            if (!ctm) return []
            return pts
              .slice(-1)
              .map(([x, y]) => ({ x: ctm.a * (x ?? 0) + ctm.e, y: ctm.d * (y ?? 0) + ctm.f }))
          })
          return { frame: { left: frame.left, right: frame.right }, boxes, tails }
        },
        { root: ROOT, labels: LABELS },
      )
      expect(m.boxes).toHaveLength(2)
      const [first, second] = m.boxes
      if (!first || !second) throw new Error('LAYOUT: missing end labels')
      const intersect =
        first.left < second.right &&
        second.left < first.right &&
        first.top < second.bottom &&
        second.top < first.bottom
      expect(intersect).toBe(false)
      const air = Math.max(first.top - second.bottom, second.top - first.bottom)
      expect(air).toBeGreaterThanOrEqual(LABEL_AIR)
      // No label covers either line's end point (a noisy line's earlier vertices can still pass under a flipped label: the room to the right of the plot is a separate fix).
      expect(m.tails.length).toBeGreaterThan(0)
      for (const t of m.tails)
        for (const b of m.boxes)
          expect(t.x >= b.left && t.x <= b.right && t.y >= b.top && t.y <= b.bottom).toBe(false)
      for (const b of m.boxes) {
        expect(b.left).toBeGreaterThanOrEqual(m.frame.left - EDGE_EPS)
        expect(b.right).toBeLessThanOrEqual(m.frame.right + EDGE_EPS)
      }
    },
  )
})
