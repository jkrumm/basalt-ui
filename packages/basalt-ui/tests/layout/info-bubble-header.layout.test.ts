/**
 * Layout invariant for the `info` bubble inside a card: it never covers its own card's header block
 * (title row, facts, basis line), never rises above the card, and never leaves the viewport sideways.
 * argo's ACWR card opened a ~60-word bubble straight down from the glyph, over the headline figures.
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
import type { Viewport } from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

const ROOT = '[data-testid="info-header"]'
const TRIGGER = `${ROOT} [data-info-trigger]`
const VIEWPORTS: Viewport[] = [DESKTOP_1440, PHONE]

const spec: FixtureSpec = {
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
  colorScheme: 'light',
  infoHeader: true,
}

layout('info bubble inside a card', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  for (const viewport of VIEWPORTS) {
    test(`at ${viewport.width}px the bubble clears the header block and stays in the card and viewport`, async () => {
      const p = await openFixture(spec, viewport, '/', 'reduce', 'fine')
      await p.settle()
      await p.raw.focus(TRIGGER)
      await p.settle()

      const m = await p.raw.evaluate(
        ({ root, trigger }) => {
          const bubble = document.querySelector<HTMLElement>(`${root} [role="tooltip"]`)
          if (!bubble) throw new Error('bubble did not open')
          const rect = (el: Element) => el.getBoundingClientRect()
          const b = rect(bubble)
          const card = rect(document.querySelector(`${root} [data-basalt-chart-card]`) as Element)
          const header = [
            ...document.querySelectorAll(`${root} [data-tier], ${root} [data-basalt-facts]`),
          ].map(rect)
          const t = rect(document.querySelector(trigger) as Element)
          return {
            bubble: { top: b.top, bottom: b.bottom, left: b.left, right: b.right },
            cardTop: card.top,
            headerBottom: Math.max(t.bottom, ...header.map((r) => r.bottom)),
            viewW: document.documentElement.clientWidth,
          }
        },
        { root: ROOT, trigger: TRIGGER },
      )

      expect(m.bubble.top).toBeGreaterThanOrEqual(m.cardTop)
      expect(m.bubble.top).toBeGreaterThanOrEqual(m.headerBottom)
      expect(m.bubble.left).toBeGreaterThanOrEqual(0)
      expect(m.bubble.right).toBeLessThanOrEqual(m.viewW)
    })
  }
})
