/**
 * Expression cycle 18 (`v3-expr-18-kit-fixes` 7; n89 .19, n88): the x labels of a band chart under focus.
 * Fixture: `fixture/kit-expr18-focus-fixture.tsx`.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import { buildExpr12Document } from './expr12-support'
import type { Expr12Document } from './expr12-support'
import { CLOSE_BUDGET_MS, PHONE, closeLayoutSuite, initLayoutSuite, openFixture } from './harness'
import type { LayoutPage, Viewport } from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const EMPTY_SPEC = { sections: [] } as FixtureSpec
const WIDE: Viewport = { name: 'wide 1800', width: 1800, height: 1200 }

let doc: Expr12Document | undefined
beforeAll(async () => {
  doc = await buildExpr12Document('focus', 'expr18')
})
afterAll(() => doc?.cleanup())

async function open(viewport: Viewport): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, doc!.path, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="k18-focus"] svg.ts-chart')
  await page.settle()
  return page
}

/** The x tick labels drawn (not blanked) now, and the y tick labels. */
const shown = (page: LayoutPage): Promise<{ x: string[]; y: string[] }> =>
  page.raw.evaluate(() => {
    const drawn = (prefix: string): string[] =>
      [...document.querySelectorAll('[data-testid="k18-focus"] svg.ts-chart text')]
        .filter((t) => (t.getAttribute('data-ts-key') ?? '').startsWith(prefix))
        .filter((t) => Number(getComputedStyle(t).opacity) > 0.01)
        .map((t) => t.textContent ?? '')
    return { x: drawn('x-tick-label'), y: drawn('y-tick-label') }
  })

async function pointAtBar(page: LayoutPage, index: number): Promise<void> {
  const box = await page.raw.evaluate((i: number) => {
    const svg = document.querySelector('[data-testid="k18-focus"] svg.ts-chart')!
    const clip = svg.querySelector('clipPath rect')!
    const o = svg.getBoundingClientRect()
    const x = Number(clip.getAttribute('x'))
    const width = Number(clip.getAttribute('width'))
    const y = Number(clip.getAttribute('y'))
    const height = Number(clip.getAttribute('height'))
    return { x: o.left + x + (width * (i + 0.5)) / 4, y: o.top + y + height * 0.7 }
  }, index)
  await page.raw.mouse.move(box.x, box.y)
  await page.raw.waitForTimeout(400)
  await page.settle()
}

layout('a band chart keeps its x labels whichever bar is focused', () => {
  for (const viewport of [WIDE, PHONE]) {
    test(`${viewport.name}: only the focused label is replaced, every neighbour stays (n89)`, async () => {
      const page = await open(viewport)
      const names = (await shown(page)).x
      expect(names).toHaveLength(4)
      for (const i of [0, 1, 2, 3]) {
        await pointAtBar(page, i)
        const now = (await shown(page)).x
        expect(now, `focus on bar ${i}`).toEqual(names.filter((_, at) => at !== i))
      }
    })
  }
})
