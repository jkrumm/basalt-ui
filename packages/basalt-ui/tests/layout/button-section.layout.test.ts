/**
 * Button section insets in a real browser (Wave 36): Mantine pads the section side by
 * `--button-padding-x / 1.5` (5.33px at compact-xs, 10.67px at sm) — off the spacing scale. Each
 * section-side inset is a step of the 4px stack scale; the no-section side keeps `--button-padding-x`.
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
  buttonSections: true,
}

/** The section-side inset per size at level 0 (stack steps 4/8/12/16/24; `buttonSectionX`). */
const SECTION_INSET: Record<string, number> = {
  xs: 8,
  sm: 12,
  md: 12,
  lg: 16,
  xl: 24,
  ctl: 8,
  'compact-xs': 4,
  'compact-sm': 4,
  'compact-md': 8,
  'compact-lg': 8,
  'compact-xl': 12,
}
const SIZES = Object.keys(SECTION_INSET)
const VARIANTS = ['default', 'filled']

type Insets = { bare: [number, number]; left: [number, number]; right: [number, number] }

layout('Button section insets', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  let p: LayoutPage
  let all: Record<string, Insets>
  beforeAll(async () => {
    p = await openFixture(SPEC, DESKTOP_1440)
    await p.settle()
    all = await p.raw.evaluate(() => {
      const out: Record<string, Insets> = {}
      for (const row of document.querySelectorAll<HTMLElement>('[data-testid^="btn-"]')) {
        const [bare, left, right] = [...row.querySelectorAll('button')].map((b) => {
          const s = getComputedStyle(b)
          return [parseFloat(s.paddingInlineStart), parseFloat(s.paddingInlineEnd)] as [
            number,
            number,
          ]
        })
        out[row.dataset['testid']!] = { bare: bare!, left: left!, right: right! }
      }
      return out
    })
  }, CLOSE_BUDGET_MS)

  for (const size of SIZES) {
    for (const variant of VARIANTS) {
      test(`${size}/${variant}: section side takes its mapped step, the other side is unchanged`, () => {
        const r = all[`btn-${size}-${variant}`]!
        expect(r.left[0]).toBe(SECTION_INSET[size]!)
        expect(r.right[1]).toBe(SECTION_INSET[size]!)
        expect(r.left[1]).toBe(r.bare[1])
        expect(r.right[0]).toBe(r.bare[0])
      })
    }
  }
})
