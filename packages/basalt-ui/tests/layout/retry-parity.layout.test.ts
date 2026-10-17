/**
 * The shared `RetryButton` (a plain element, so `./charts` stays Mantine-free) must paint like the
 * Mantine `Button size="xs" variant="default"` it replaced: same box, padding, radius, border, font,
 * fill, ink and shadow, in both schemes. Markup equality cannot prove it; computed CSS can.
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

type Scheme = 'light' | 'dark'
const SCHEMES: Scheme[] = ['light', 'dark']

const specFor = (colorScheme: Scheme): FixtureSpec => ({
  sections: [
    { label: 'Main', items: [{ key: 'a', label: 'Overview', mobile: 'tab', active: true }] },
  ],
  colorScheme,
  retryParity: true,
})

const PROPS = [
  'height',
  'width',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'borderTopWidth',
  'borderTopStyle',
  'borderTopColor',
  'borderTopLeftRadius',
  'fontSize',
  'fontWeight',
  'fontFamily',
  'lineHeight',
  'color',
  'backgroundColor',
  'boxShadow',
] as const

layout('shared Retry vs Mantine xs default Button', () => {
  afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

  for (const scheme of SCHEMES) {
    test(`in ${scheme}, the computed paint is identical`, async () => {
      const p = await openFixture(specFor(scheme), DESKTOP_1440)
      await p.settle()
      const read = await p.raw.evaluate((props) => {
        const pick = (id: string) => {
          const el = document.querySelector<HTMLElement>(`[data-testid="${id}"] button`)
          if (!el) throw new Error(`no button under ${id}`)
          const cs = getComputedStyle(el)
          return Object.fromEntries(props.map((k) => [k, cs[k]]))
        }
        return { mantine: pick('retry-mantine'), shared: pick('retry-shared') }
      }, PROPS)
      expect(read.shared).toEqual(read.mantine)
    })
  }
})
