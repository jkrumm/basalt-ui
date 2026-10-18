/**
 * craft-1/nested-radius-step in real CSS: a nested painted surface sits at least 3 px under the
 * radius of the surface that holds it. An inline `Code` in an `Alert`, and the `ViewTabs` indicator
 * inside its track in a `ChartCard` header.
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
  w37: { alertCode: true, cardTabs: true, radiusTabs: true },
}

const MIN_STEP = 3

layout('nested radius step', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  let p: LayoutPage
  beforeAll(async () => {
    p = await openFixture(SPEC, DESKTOP_1440)
    await p.settle()
  }, CLOSE_BUDGET_MS)

  const radii = (outer: string, inner: string) =>
    p.raw.evaluate(
      ([o, i]) => {
        const read = (sel: string) => {
          const el = document.querySelector<HTMLElement>(sel)
          if (!el) throw new Error(`LAYOUT: no ${sel}`)
          return Number.parseFloat(getComputedStyle(el).borderTopLeftRadius)
        }
        return { outer: read(o as string), inner: read(i as string) }
      },
      [outer, inner],
    )

  test('an inline Code in an Alert is at least 3 px under the Alert radius', async () => {
    const r = await radii(
      '[data-testid="w37-alert-code"] .mantine-Alert-root',
      '[data-testid="w37-alert-code"] .mantine-Code-root',
    )
    expect(r.outer - r.inner).toBeGreaterThanOrEqual(MIN_STEP)
  })

  test('the ViewTabs indicator in a ChartCard header is at least 3 px under its track', async () => {
    const r = await radii(
      '[data-testid="w37-card-tabs"] .mantine-SegmentedControl-root',
      '[data-testid="w37-card-tabs"] .mantine-SegmentedControl-indicator',
    )
    expect(r.outer - r.inner).toBeGreaterThanOrEqual(MIN_STEP)
  })

  test('a SegmentedControl with a custom radius still nests its indicator 3 px under the track', async () => {
    const r = await radii(
      '[data-testid="w37-radius-tabs"] .mantine-SegmentedControl-root',
      '[data-testid="w37-radius-tabs"] .mantine-SegmentedControl-indicator',
    )
    expect(r.outer).toBeGreaterThan(20)
    expect(r.outer - r.inner).toBeGreaterThanOrEqual(MIN_STEP)
  })
})
