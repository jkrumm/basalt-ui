/**
 * Expression cycle 13 kit fixes, the caret group (`v3-expr-13-kit-fixes` 5): every value past a
 * bounded axis writes its true value once, beside its caret, at both widths, and no two written
 * values overprint. Fixture: `fixture/kit-expr13-carets-fixture.tsx` (one spike past a 40 cap, two
 * money lines past it at one hour, and two lines past it at one value).
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import { buildExpr12Document } from './expr12-support'
import type { Expr12Document } from './expr12-support'
import { charts, meet } from './expr13-support'
import type { Chart } from './expr13-support'
import { CLOSE_BUDGET_MS, PHONE, closeLayoutSuite, initLayoutSuite, openFixture } from './harness'
import type { Viewport } from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const EMPTY_SPEC = { sections: [] } as FixtureSpec
const WIDE: Viewport = { name: 'wide 1800', width: 1800, height: 1200 }
const IDS = ['x13-spike', 'x13-src', 'x13-same'] as const
/** The true value each chart writes past its cap: one per clamped point, and one for two equal ones. */
const TRUE_VALUES: Record<string, readonly string[]> = {
  'x13-spike': ['58'],
  'x13-src': ['US$120.00', 'US$60.00'],
  'x13-same': ['US$120.00'],
}

let doc: Expr12Document | undefined
beforeAll(async () => {
  doc = await buildExpr12Document('carets', 'expr13')
})
afterAll(() => doc?.cleanup())

const measured = new Map<number, Promise<Chart[]>>()

function measure(viewport: Viewport): Promise<Chart[]> {
  const known = measured.get(viewport.width)
  if (known !== undefined) return known
  const found = (async () => {
    const page = await openFixture(EMPTY_SPEC, viewport, doc!.path, 'reduce', 'fine')
    await page.raw.waitForSelector('[data-testid="x13-spike"] svg.ts-chart')
    await page.settle()
    return charts(page, IDS)
  })()
  measured.set(viewport.width, found)
  return found
}

/** The written values of a chart: the text marks a clamped point's caret carries. */
const valuesOf = (c: Chart) =>
  c.marks.filter((m) => /^off-scale-[a-z]+-value:/.test(m.key) && m.tag === 'text')

layout('a clamped value writes its true value once, and no value overprints another', () => {
  for (const viewport of [WIDE, PHONE]) {
    test(`each clamped point writes its true value once at ${viewport.width}`, async () => {
      const found = await measure(viewport)
      const wrong = found.flatMap((c) => {
        const written = valuesOf(c)
          .map((m) => m.text)
          .sort()
        const want = [...(TRUE_VALUES[c.id] ?? [])].sort()
        return JSON.stringify(written) === JSON.stringify(want)
          ? []
          : [`${c.id}: wrote ${JSON.stringify(written)}, want ${JSON.stringify(want)}`]
      })
      expect(wrong).toEqual([])
    })

    test(`no written value overprints another at ${viewport.width}`, async () => {
      const found = await measure(viewport)
      const overprint = found.flatMap((c) => {
        const values = valuesOf(c)
        return values.flatMap((a, i) =>
          values
            .slice(i + 1)
            .filter((b) => meet(a.box, b.box))
            .map((b) => `${c.id}: ${a.text} over ${b.text}`),
        )
      })
      expect(overprint).toEqual([])
    })
  }
})
