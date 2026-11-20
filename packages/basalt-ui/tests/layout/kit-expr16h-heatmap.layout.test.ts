/**
 * Expression cycle 16 kit fixes, the Heatmap (`v3-expr-16-kit-fixes` 2 and 10): the x ticks beside
 * `tickCols` step evenly (n77's 14 named days at 390 drew Nov 7, 9, 11, 14, 17, 20; n78's weekly names
 * drew two more ticks between them), and a keyboard-focused cell keeps its label inside its ring
 * (n57; the scenario's own hold-back of that label is not the kit's). Fixture:
 * `fixture/kit-expr16h-heatmap-fixture.tsx`.
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

let ticksDoc: Expr12Document | undefined
let focusDoc: Expr12Document | undefined
beforeAll(async () => {
  ticksDoc = await buildExpr12Document('heatmap', 'expr16h')
  focusDoc = await buildExpr12Document('heatmap', 'expr13')
})
afterAll(() => {
  ticksDoc?.cleanup()
  focusDoc?.cleanup()
})

async function open(doc: Expr12Document, viewport: Viewport, testId: string): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, doc.path, 'reduce', 'fine')
  await page.raw.waitForSelector(`[data-testid="${testId}"] svg`)
  await page.settle()
  return page
}

/** The day numbers of the x tick labels drawn ("Nov 7" is 7), in reading order. */
const tickDays = (page: LayoutPage, testId: string): Promise<number[]> =>
  page.raw.evaluate((id) => {
    const host = document.querySelector(`[data-testid="${id}"]`)!
    return [...host.querySelectorAll('svg text')]
      .map((t) => /^(?:Nov|Oct) (\d+)$/.exec(t.textContent ?? ''))
      .flatMap((m) => (m === null ? [] : [Number(m[1])]))
  }, testId)

const gapsOf = (days: readonly number[]): number[] =>
  days.slice(1).map((d, i) => d - (days[i] as number))

layout('the x ticks beside tickCols at 390', () => {
  test('n77: 14 named days step evenly', async () => {
    const page = await open(ticksDoc!, PHONE, 'x16-days14')
    const days = await tickDays(page, 'x16-days14')
    expect(days.length, `ticks ${days.join(', ')}`).toBeGreaterThanOrEqual(4)
    expect(new Set(gapsOf(days)).size, `ticks ${days.join(', ')}`).toBe(1)
  })
})

layout('the x ticks beside tickCols at 1800', () => {
  test('n78: weekly names are the only ticks, one step apart', async () => {
    const page = await open(ticksDoc!, WIDE, 'x16-days30')
    const days = await tickDays(page, 'x16-days30')
    expect(days, `ticks ${days.join(', ')}`).toEqual([1, 8, 15, 22, 29])
  })
})

for (const viewport of [PHONE, WIDE]) {
  layout(`a keyboard-focused cell at ${viewport.name}`, () => {
    test('keeps its label inside the cell ring', async () => {
      const page = await open(focusDoc!, viewport, 'x13-heatmap')
      await page.raw.keyboard.press('Tab')
      await page.raw.keyboard.press('ArrowRight')
      await page.raw.keyboard.press('ArrowDown')
      await page.settle()
      const { ring, labels } = await page.raw.evaluate(() => {
        const host = document.querySelector('[data-testid="x13-heatmap"]')!
        const ring = host.querySelector('[data-ts-key="focus-ring"] rect')?.getBoundingClientRect()
        const labels = [...host.querySelectorAll('g[data-ts-key="annotations"] text')].map((t) => {
          const r = t.getBoundingClientRect()
          return { l: r.left, r: r.right, t: r.top, b: r.bottom }
        })
        return {
          ring:
            ring === undefined
              ? null
              : { l: ring.left, r: ring.right, t: ring.top, b: ring.bottom },
          labels,
        }
      })
      expect(ring, 'the focused cell rings').not.toBeNull()
      const inside = labels.filter(
        (l) => l.l >= ring!.l - 1 && l.r <= ring!.r + 1 && l.t >= ring!.t - 1 && l.b <= ring!.b + 1,
      )
      expect(inside.length, 'the focused cell keeps its label').toBe(1)
    })
  })
}
