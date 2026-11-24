/**
 * Expression cycle 13 kit fixes, the IntervalTrack legend (`v3-expr-13-kit-fixes` 9, finding .37): in both
 * schemes a series' legend swatch paints the color its spans are painted with (the tint of a solid span,
 * the stroke of an outline), read from the computed styles of the rendered span and swatch. Fixture:
 * `fixture/kit-expr13-interval-legend-fixture.tsx`.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { buildExpr12Document } from './expr12-support'
import type { Expr12Document } from './expr12-support'
import { CLOSE_BUDGET_MS, PHONE, closeLayoutSuite, initLayoutSuite, openFixture } from './harness'
import type { LayoutPage, Viewport } from './harness'
import type { FixtureSpec } from './fixture/spec'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const EMPTY_SPEC = { sections: [] } as FixtureSpec
const WIDE: Viewport = { name: 'wide 1800', width: 1800, height: 1200 }

let doc: Expr12Document | undefined
beforeAll(async () => {
  doc = await buildExpr12Document('interval-legend', 'expr13')
})
afterAll(() => doc?.cleanup())

async function open(viewport: Viewport, scheme: 'light' | 'dark'): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, doc!.path, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="x13-legend"] svg')
  await page.raw.evaluate((s) => document.documentElement.setAttribute('data-theme', s), scheme)
  await page.settle()
  return page
}

/** The paint a span and its legend swatch show, as computed: the stroke of an outline, else the fill and the swatch's background. */
const paints = (page: LayoutPage) =>
  page.raw.evaluate((hollow: string) => {
    const host = document.querySelector('[data-testid="x13-legend"]')!
    return ['work', 'event', 'hold'].map((key) => {
      const rect = host.querySelector(`[data-ts-key="span:${key}"] rect`)!
      const swatch = host.querySelector(`[data-legend-key="${key}"] span[aria-hidden]`)!
      const span = getComputedStyle(rect)
      const chip = getComputedStyle(swatch)
      const outline = key === hollow
      return {
        key,
        span: outline ? span.stroke : span.fill,
        swatch: outline ? chip.borderTopColor : chip.backgroundColor,
      }
    })
  }, 'hold')

for (const [scheme, viewport] of [
  ['light', PHONE],
  ['dark', PHONE],
  ['light', WIDE],
  ['dark', WIDE],
] as const) {
  layout(`the legend swatch matches its span at ${viewport.name}, ${scheme}`, () => {
    test("each series' swatch paints the color its spans paint", async () => {
      const page = await open(viewport, scheme)
      for (const { key, span, swatch } of await paints(page)) {
        expect(swatch, `the ${key} swatch`).toBe(span)
      }
    })
  })
}
