/**
 * Wave 38: a card's facts show only at rest. In a real browser a pending chart card and a pending
 * `content` list card draw the facts skeleton (no figure) at the rest row's height (±2px), and the
 * rest card shows the figure with no skeleton.
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

const SPEC: FixtureSpec = {
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
  w38Loading: true,
}

const SLACK = 2

layout('card facts gate (Wave 38)', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  for (const body of ['chart', 'list'] as const) {
    test(`${body}: facts only at rest, skeleton only while pending, same row height`, async () => {
      const p = await openFixture(SPEC, DESKTOP_1440)
      await p.settle()
      const probe = await p.raw.evaluate((body) => {
        const card = (mode: string) =>
          document.querySelector(`[data-testid="w38-load-${body}-${mode}"]`)
        const rowHeight = (el: Element | null | undefined): number =>
          el?.getBoundingClientRect().height ?? -1
        const rest = card('rest')
        const loading = card('loading')
        return {
          restFact: rest?.querySelector('[data-basalt-fact-value]') !== null,
          restSkeleton: rest?.querySelector('[data-basalt-facts-skeleton]') !== null,
          loadingFact: loading?.querySelector('[data-basalt-fact-value]') !== null,
          loadingSkeleton: loading?.querySelector('[data-basalt-facts-skeleton]') !== null,
          restRow: rowHeight(rest?.querySelector('[data-basalt-facts]')),
          loadingRow: rowHeight(loading?.querySelector('[data-basalt-facts-skeleton]')),
        }
      }, body)
      expect(probe.restFact).toBe(true)
      expect(probe.restSkeleton).toBe(false)
      expect(probe.loadingFact).toBe(false)
      expect(probe.loadingSkeleton).toBe(true)
      expect(Math.abs(probe.loadingRow - probe.restRow)).toBeLessThanOrEqual(SLACK)
    })
  }
})
