/**
 * Layout invariant for the `info` bubble inside a card: it never covers its own card's header block
 * (title row, value/facts, subtitle), never rises above the card, and never leaves the viewport
 * sideways. argo's ACWR card opened a ~60-word bubble straight down from the glyph, over the
 * headline figures.
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

const VIEWPORTS: Viewport[] = [DESKTOP_1440, PHONE]

const spec: FixtureSpec = {
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
  colorScheme: 'light',
  infoHeader: true,
}

type Rect = { top: number; bottom: number; left: number; right: number }
type Measure = {
  bubble: Rect
  cardTop: number
  /** The header block: everything above the plot body, trigger included. */
  header: Rect
  /** The fixture's own facts row, when it has one. */
  facts: Rect | null
  viewW: number
}

/** Opens the bubble of `[data-testid=id]` and measures it; `park` scrolls the card's header to the viewport bottom first. */
async function measure(
  viewport: Viewport,
  id: string,
  park = false,
  /** Text of the headline leaves (value, delta) of a host with no WidgetHeader. */
  needles: readonly string[] = [],
): Promise<Measure> {
  const p = await openFixture(spec, viewport, '/', 'reduce', 'fine')
  await p.settle()
  const m = await p.raw.evaluate(
    async ({ id, park, needles }) => {
      const need = <T extends Element>(found: T | null, what: string): T => {
        if (found === null) throw new Error(`missing ${what} under ${id}`)
        return found
      }
      const root = need(document.querySelector(`[data-testid="${id}"]`), 'fixture root')
      const trigger = need(root.querySelector<HTMLElement>('[data-info-trigger]'), 'info trigger')
      if (park) {
        // Glyph 250px above the viewport bottom: the bubble needs more room than is left below the
        // facts rows, so a slide-up lands on the header unless checked against the whole block.
        const viewH = document.documentElement.clientHeight
        const scrollers = [
          document.scrollingElement,
          document.querySelector('[data-basalt-scrollport]'),
        ]
        for (const el of scrollers) {
          if (el !== null && el !== undefined)
            el.scrollTop += trigger.getBoundingClientRect().top - (viewH - 250)
        }
      } else trigger.scrollIntoView({ block: 'center' })
      const rect = (el: Element): Rect => {
        const r = el.getBoundingClientRect()
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }
      }
      trigger.focus({ preventScroll: true })
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      const bubble = need(root.querySelector<HTMLElement>('[role="tooltip"]'), 'open bubble')
      const card = trigger.closest('[data-basalt-chart-card], [data-tier="section"]') ?? root
      const headRoot = trigger.closest('[data-tier]')
      const factsEl = root.querySelector(`[data-testid="${id}-facts"]`)
      const leaves = [...root.querySelectorAll('*')].filter(
        (el) => el.children.length === 0 && needles.some((n) => el.textContent?.includes(n)),
      )
      if (needles.length > 0 && leaves.length === 0) throw new Error(`no headline leaf in ${id}`)
      const parts = [
        trigger,
        ...(headRoot === null ? [] : [headRoot]),
        ...(headRoot?.parentElement?.querySelectorAll(':scope > [data-basalt-facts]') ?? []),
        ...leaves,
      ].map(rect)
      return {
        bubble: rect(bubble),
        cardTop: rect(card).top,
        header: {
          top: Math.min(...parts.map((r) => r.top)),
          bottom: Math.max(...parts.map((r) => r.bottom)),
          left: 0,
          right: 0,
        },
        facts: factsEl === null ? null : rect(factsEl),
        viewW: document.documentElement.clientWidth,
      }
    },
    { id, park, needles },
  )
  return m
}

const clearsHeader = (m: Measure) =>
  m.bubble.top >= m.header.bottom || m.bubble.bottom <= m.header.top

layout('info bubble inside a card', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  for (const viewport of VIEWPORTS) {
    test(`at ${viewport.width}px a facts card's bubble clears the header block and stays in the viewport`, async () => {
      const m = await measure(viewport, 'info-header')
      expect(m.bubble.top).toBeGreaterThanOrEqual(m.cardTop)
      expect(m.bubble.top).toBeGreaterThanOrEqual(m.header.bottom)
      expect(m.bubble.left).toBeGreaterThanOrEqual(0)
      expect(m.bubble.right).toBeLessThanOrEqual(m.viewW)
    })

    test(`at ${viewport.width}px a card without facts still clears title, value and subtitle`, async () => {
      const m = await measure(viewport, 'info-header-nofacts')
      expect(m.bubble.top).toBeGreaterThanOrEqual(m.cardTop)
      expect(m.bubble.top).toBeGreaterThanOrEqual(m.header.bottom)
    })

    test(`at ${viewport.width}px a Section's bubble hangs from the section header, not an inner facts row`, async () => {
      const m = await measure(viewport, 'info-header-section')
      expect(m.facts).not.toBeNull()
      expect(m.bubble.top).toBeGreaterThanOrEqual(m.header.bottom)
      // Placed from the section's own header: a handful of px below it, not below the inner facts.
      expect(m.bubble.top).toBeLessThan(m.header.bottom + 24)
      expect(m.bubble.top).toBeLessThan(m.facts?.bottom ?? 0)
    })

    test(`at ${viewport.width}px a StatCard's bubble clears its value and delta`, async () => {
      const m = await measure(viewport, 'info-header-stat', false, ['12,847', '4.2'])
      expect(m.bubble.top).toBeGreaterThanOrEqual(m.header.bottom)
      expect(m.bubble.left).toBeGreaterThanOrEqual(0)
      expect(m.bubble.right).toBeLessThanOrEqual(m.viewW)
    })

    test(`at ${viewport.width}px a strip cell's bubble clears its value and delta`, async () => {
      const m = await measure(viewport, 'info-header-strip', false, ['12,847', '4.2'])
      expect(m.bubble.top).toBeGreaterThanOrEqual(m.header.bottom)
      expect(m.bubble.left).toBeGreaterThanOrEqual(0)
      expect(m.bubble.right).toBeLessThanOrEqual(m.viewW)
    })

    test(`at ${viewport.width}px a header parked at the viewport bottom never has the bubble over it`, async () => {
      const m = await measure(viewport, 'info-header-bottom', true)
      expect(clearsHeader(m)).toBe(true)
      expect(m.bubble.top).toBeGreaterThanOrEqual(0)
      expect(m.bubble.left).toBeGreaterThanOrEqual(0)
      expect(m.bubble.right).toBeLessThanOrEqual(m.viewW)
    })
  }
})
