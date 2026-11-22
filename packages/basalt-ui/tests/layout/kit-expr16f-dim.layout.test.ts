/**
 * Expression cycle 16, the dim on an ink-step bar series (`v3-expr-16-kit-fixes` 6, n75 and n76): while
 * one bar holds the chart's focus the other bars of a grey ink step draw under their resting opacity
 * (the lead's SWEEP counter reads them as faded) and in a visibly lighter paint; the focused bar rises.
 * Fixture: `fixture/kit-expr16f-dim-fixture.tsx`.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import { buildExpr12Document } from './expr12-support'
import type { Expr12Document } from './expr12-support'
import { CLOSE_BUDGET_MS, closeLayoutSuite, initLayoutSuite, openFixture } from './harness'
import type { LayoutPage, Viewport } from './harness'

const WIDE: Viewport = { name: 'wide 1800', width: 1800, height: 1200 }

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const EMPTY_SPEC = { sections: [] } as FixtureSpec

let doc: Expr12Document | undefined
beforeAll(async () => {
  doc = await buildExpr12Document('dim', 'expr16f')
})
afterAll(() => doc?.cleanup())

async function open(): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, WIDE, doc!.path, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="k16f-ink"] svg rect', { state: 'attached' })
  await page.settle()
  return page
}

type Bar = { fill: string; opacity: number }

/** The bars of a probe: their computed fill and the opacity they draw at (fill-opacity times every ancestor's). */
const bars = (page: LayoutPage, id: string): Promise<Bar[]> =>
  page.raw.evaluate((testid) => {
    const svg = document.querySelector(`[data-testid="${testid}"] svg.ts-chart`)!
    const plot = svg.getBoundingClientRect()
    return [...svg.querySelectorAll('rect')]
      .filter((el) => {
        const r = el.getBoundingClientRect()
        return r.width > 8 && r.height > 4 && r.width < plot.width * 0.5 && r.height < plot.height
      })
      .map((el) => {
        let opacity = Number(getComputedStyle(el).fillOpacity || 1)
        for (let n: Element | null = el; n && n !== document.body; n = n.parentElement)
          opacity *= Number(getComputedStyle(n).opacity)
        return { fill: getComputedStyle(el).fill, opacity }
      })
  }, id)

async function focusStep(page: LayoutPage, id: string, presses: number): Promise<void> {
  await page.raw.evaluate((testid) => {
    document.querySelector<HTMLElement>(`[data-testid="${testid}"] [data-chart-focus]`)!.focus()
  }, id)
  for (let i = 0; i < presses; i++) await page.raw.keyboard.press('ArrowRight')
  await page.raw.waitForTimeout(400)
  await page.settle()
}

layout('an ink-step bar series dims the bars the focus is not on', () => {
  test('the other bars draw faded and lighter, the focused bar does not', async () => {
    const page = await open()
    const rest = await bars(page, 'k16f-ink')
    expect(rest.length).toBe(5)
    expect(rest.every((b) => b.opacity === 1)).toBe(true)
    await focusStep(page, 'k16f-ink', 2)
    const after = await bars(page, 'k16f-ink')
    const index = await page.raw.evaluate(() =>
      document.querySelector('[data-testid="k16f-ink"]')!.getAttribute('data-focus-index'),
    )
    expect(index).toBe('1')
    // The dim is in the bar's own paint (an external focus never re-runs the engine's states): the same grey at
    // a lower alpha is a lighter bar on the card, and the focused bar is the strong ink.
    const alpha = (fill: string): number => Number(/\/\s*([\d.]+)\)/.exec(fill)?.[1] ?? 1)
    const grey = (fill: string): string => fill.split('/')[0]!.trim()
    const faded = after.filter((b, i) => i !== 1 && alpha(b.fill) < alpha(rest[i]!.fill))
    expect(faded.length, 'the four bars the focus is not on').toBe(4)
    for (const b of faded) expect(grey(b.fill)).toBe(grey(rest[0]!.fill))
    expect(after[1]!.fill).not.toBe(rest[1]!.fill)
  })

  test('a chromatic series keeps the dim it has through its paint', async () => {
    const page = await open()
    await focusStep(page, 'k16f-hue', 2)
    const after = await bars(page, 'k16f-hue')
    expect(after[0]!.fill).not.toBe(after[1]!.fill)
    expect(after.every((b) => b.opacity === 1)).toBe(true)
  })
})
