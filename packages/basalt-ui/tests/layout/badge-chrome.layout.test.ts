/**
 * Status-chip geometry in a real browser (SPEC § 6.10): a default `Badge` is 20 px high, carries
 * the `tight` radius (5 px at level 0) and paints the `light` tint rather than the accent fill.
 * Measured on the data-table fixture's `State` column (`table.badges`), the only fixture that
 * mounts a bare `Badge`. The leading-glyph geometry (12 px, 4 px gap, centred) needs a fixture
 * with a `leftSection` and is NOT asserted here — see the PR.
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
  table: { rows: 6, badges: true, stickyHeader: false },
}

layout('status chip geometry', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  let p: LayoutPage
  beforeAll(async () => {
    p = await openFixture(SPEC, DESKTOP_1440)
    await p.settle()
  }, CLOSE_BUDGET_MS)

  test('a default Badge is 20 px high with the tight radius and a tinted (not accent-filled) ground', async () => {
    const badge = await p.raw.evaluate(() => {
      const el = document.querySelector<HTMLElement>('table .mantine-Badge-root')
      if (!el) throw new Error('no Badge in the table fixture')
      const style = getComputedStyle(el)
      return {
        height: el.getBoundingClientRect().height,
        radius: style.borderTopLeftRadius,
        background: style.backgroundColor,
      }
    })
    expect(badge.height).toBe(20)
    expect(badge.radius).toBe('5px')
    // `light` is a 13% mix over the surface, so the ground carries alpha; `filled` is opaque.
    expect(badge.background).toMatch(/rgba\(|color\(srgb [^)]*\/ 0?\.\d+\)/)
  })
})
