/**
 * Layout invariant for the pointer tier: the invisible `[data-basalt-hit]::after` boxes of
 * ADJACENT controls never overlap, so the later sibling cannot steal a tap meant for the earlier
 * one (the wave-4 review blocker: 24px controls in 6px gaps each grew a 44px overlay).
 *
 * The harness context is `hasTouch` + `isMobile`, i.e. `(pointer: coarse)` — `--vx-hit` is 44px.
 * The hit box is read from the REAL `::after` computed size (centred on the host), not
 * reconstructed from `--vx-hit`, so the `--vx-hit-gap` cap is what is under test.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import {
  CLOSE_BUDGET_MS,
  LAPTOP_1024,
  PHONE,
  closeLayoutSuite,
  initLayoutSuite,
  openFixture,
} from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

const SPEC: FixtureSpec = {
  sections: [
    {
      label: 'Main',
      items: [
        { key: 'a', label: 'Overview', mobile: 'tab', active: true },
        { key: 'b', label: 'Reports', mobile: 'tab' },
      ],
    },
  ],
  bar: { pills: 4, tabs: 2, actions: 4, actionIcons: true },
  // The legend entries are `[data-basalt-hit]` buttons 22px apart — `--vx-hit-gap` caps them.
  charts: { kind: 'multiLine', legendEntries: 4 },
}

type HitBox = { id: string; left: number; top: number; right: number; bottom: number }

layout('pointer tier — hit boxes', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  test.each([PHONE, LAPTOP_1024])(
    'adjacent [data-basalt-hit] boxes never overlap at $name',
    async (viewport) => {
      const p = await openFixture(SPEC, viewport)
      await p.settle()

      const { boxes, hit } = await p.raw.evaluate(() => {
        const selector = '[data-basalt-hit], [data-basalt-hit-scope] :is(button, a)'
        const hit = parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue('--vx-hit'),
        )
        const boxes = [...document.querySelectorAll<HTMLElement>(selector)].flatMap((el, i) => {
          const r = el.getBoundingClientRect()
          if (r.width === 0 || r.height === 0) return []
          const after = getComputedStyle(el, '::after')
          const w = parseFloat(after.width)
          const h = parseFloat(after.height)
          if (Number.isNaN(w) || Number.isNaN(h)) return []
          const cx = r.x + r.width / 2
          const cy = r.y + r.height / 2
          return [
            {
              id: `${i}:${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)}`,
              left: cx - w / 2,
              top: cy - h / 2,
              right: cx + w / 2,
              bottom: cy + h / 2,
              el,
            },
          ]
        })
        // Nested adopters (one inside another) share a tap by construction — only siblings compete.
        const flat = boxes.filter(
          (a) => !boxes.some((b) => b !== a && (b.el.contains(a.el) || a.el.contains(b.el))),
        )
        return { boxes: flat.map(({ el: _el, ...rest }) => rest), hit }
      })

      expect(hit).toBe(44)
      expect(boxes.length).toBeGreaterThan(6)

      const overlaps: string[] = []
      const EPS = 0.5
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i] as HitBox
          const b = boxes[j] as HitBox
          const dx = Math.min(a.right, b.right) - Math.max(a.left, b.left)
          const dy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
          if (dx > EPS && dy > EPS)
            overlaps.push(`${a.id} x ${b.id} (${dx.toFixed(1)}x${dy.toFixed(1)})`)
        }
      }
      expect(overlaps).toEqual([])
    },
  )
})
