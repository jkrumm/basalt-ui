/**
 * Button section insets in a real browser: Mantine pads the section side by `--button-padding-x / 1.5`
 * (5.33px at compact-xs, 10.67px at sm) — off the spacing scale, and Wave 36 put it on a step that was
 * still one tighter than the text side (8/12, 12/16, 12/20), which read as unbalanced. Wave 37: the icon
 * side EQUALS the text side, so all four insets match the bare Button's `--button-padding-x`.
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

const SIZES = [
  'xs',
  'sm',
  'md',
  'lg',
  'xl',
  'ctl',
  'compact-xs',
  'compact-sm',
  'compact-md',
  'compact-lg',
  'compact-xl',
]
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
      test(`${size}/${variant}: the icon side equals the text side (all four insets match the bare Button)`, () => {
        const r = all[`btn-${size}-${variant}`]!
        expect(r.left[0]).toBe(r.bare[0])
        expect(r.right[1]).toBe(r.bare[1])
        expect(r.left[1]).toBe(r.bare[1])
        expect(r.right[0]).toBe(r.bare[0])
      })
    }
  }
})
