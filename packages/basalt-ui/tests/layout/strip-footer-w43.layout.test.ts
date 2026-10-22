/**
 * Wave 43: argo's body-composition strip — a Weight cell in its empty state with an `under` goal
 * footer. The footer slots inherit the 15px body size, outranking the cell's own 13px statement and
 * giving the strip four type sizes; both footer kinds take the strip's `sm` step.
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

const STRIP = '[data-testid="w43-strip-footer"]'
/** The most distinct font sizes a strip may hold (hero, statement, caption). */
const MAX_SIZES = 3

const spec: FixtureSpec = {
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
  w43StripFooter: true,
}

layout('Wave 43 strip footer type step', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  test.each([
    ['1440', DESKTOP_1440],
    ['390', PHONE],
  ] as const)(
    '%s: footers sit at or below the cell statement, strip holds ≤3 sizes',
    async (_, viewport) => {
      const p = await openFixture(spec, viewport)
      await p.settle()
      const m = await p.raw.evaluate((q) => {
        const root = document.querySelector(q)
        if (!root) return null
        const size = (el: Element) => Number.parseFloat(getComputedStyle(el).fontSize)
        const textOf = (el: Element) => {
          const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
          const out: Element[] = []
          for (let n = w.nextNode(); n; n = w.nextNode()) {
            if (n.textContent?.trim() && n.parentElement) out.push(n.parentElement)
          }
          return out
        }
        const sizes = new Set(textOf(root).map(size))
        const reason = root.querySelector('[data-strip-reason]')
        return {
          sizes: [...sizes],
          statement: reason ? size(reason) : 0,
          under: size(root.querySelector('[data-strip-footer-cell="goal"]')!),
          full: size(root.querySelector('[data-strip-footer-cell="note"]')!),
        }
      }, STRIP)
      expect(m).not.toBeNull()
      expect(m!.statement).toBeGreaterThan(0)
      expect(m!.under).toBeLessThanOrEqual(m!.statement)
      expect(m!.full).toBeLessThanOrEqual(m!.statement)
      expect(m!.sizes.length).toBeLessThanOrEqual(MAX_SIZES)
    },
  )
})
