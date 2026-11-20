/**
 * Expression cycle 13 kit fixes, the Heatmap focus dot (`v3-expr-13-kit-fixes` 8, finding .9): a pointer
 * focus on the "6 best" cell drew the engine's focus dot at the cell's centre, on the centred text, at
 * 390 px and at 1800 px. The focused cell keeps its ring; no dot lands on an annotation. Fixture:
 * `fixture/kit-expr13-heatmap-fixture.tsx`.
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
  doc = await buildExpr12Document('heatmap', 'expr13')
})
afterAll(() => doc?.cleanup())

async function open(viewport: Viewport): Promise<LayoutPage> {
  const page = await openFixture(EMPTY_SPEC, viewport, doc!.path, 'reduce', 'fine')
  await page.raw.waitForSelector('[data-testid="x13-heatmap"] svg')
  await page.settle()
  return page
}

/** The centre of the "6 best" annotation, which sits on the best cell. */
const bestCentre = (page: LayoutPage): Promise<{ x: number; y: number }> =>
  page.raw.evaluate(() => {
    const text = [
      ...document.querySelectorAll('[data-testid="x13-heatmap"] g[data-ts-key="annotations"] text'),
    ].find((t) => t.textContent === '6 best')!
    const r = text.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  })

/** The chart's circles (the focus dots) that land on an annotation's text box, and the focus rings drawn. */
const focusMarks = (page: LayoutPage) =>
  page.raw.evaluate(() => {
    const host = document.querySelector('[data-testid="x13-heatmap"]')!
    const boxes = [...host.querySelectorAll('g[data-ts-key="annotations"] text')].map((t) =>
      t.getBoundingClientRect(),
    )
    const hits = (r: DOMRect) =>
      boxes.some(
        (b) => r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top,
      )
    const dots = [...host.querySelectorAll('circle')].map((c) => c.getBoundingClientRect())
    const rings = host.querySelectorAll('[data-ts-key="focus-ring"] rect').length
    return { dots: dots.length, onText: dots.filter(hits).length, rings }
  })

/** The annotation texts drawn and the focus ring's box, in page px. */
const ringAndLabels = (page: LayoutPage) =>
  page.raw.evaluate(() => {
    const host = document.querySelector('[data-testid="x13-heatmap"]')!
    const ring = host.querySelector('[data-ts-key="focus-ring"] rect')?.getBoundingClientRect()
    const labels = [...host.querySelectorAll('g[data-ts-key="annotations"] text')].map((t) => {
      const r = t.getBoundingClientRect()
      return { text: t.textContent ?? '', l: r.left, r: r.right, t: r.top, b: r.bottom }
    })
    return {
      ring:
        ring === undefined ? null : { l: ring.left, r: ring.right, t: ring.top, b: ring.bottom },
      labels,
    }
  })

for (const viewport of [PHONE, WIDE]) {
  layout(`the focused cell's label at ${viewport.name}`, () => {
    test('stays drawn inside the cell ring', async () => {
      const page = await open(viewport)
      const at = await bestCentre(page)
      await page.raw.mouse.move(at.x, at.y, { steps: 6 })
      await page.settle()
      const { ring, labels } = await ringAndLabels(page)
      const best = labels.find((l) => l.text === '6 best')
      expect(ring, 'the focused cell rings').not.toBeNull()
      expect(best, 'the focused cell keeps its label').toBeDefined()
      expect(best!.l).toBeGreaterThanOrEqual(ring!.l - 1)
      expect(best!.r).toBeLessThanOrEqual(ring!.r + 1)
      expect(best!.t).toBeGreaterThanOrEqual(ring!.t - 1)
      expect(best!.b).toBeLessThanOrEqual(ring!.b + 1)
    })
  })
}

for (const viewport of [PHONE, WIDE]) {
  layout(`a pointer-focused cell at ${viewport.name}`, () => {
    test('keeps its ring and draws no focus dot over the annotation text', async () => {
      const page = await open(viewport)
      const at = await bestCentre(page)
      await page.raw.mouse.move(at.x, at.y, { steps: 6 })
      await page.settle()
      const marks = await focusMarks(page)
      expect(marks.rings, 'the focused cell rings').toBe(1)
      expect(marks.onText, 'focus dots on annotation text').toBe(0)
    })
  })
}
