/**
 * Expression cycle 16 kit fixes, end labels (`v3-expr-16-kit-fixes` 3, n79 `?fixture=surge`), in real Chrome at
 * 1800 and 390: eight lines converge on the plot's right edge, and no end label is struck by another line;
 * a label that finds no free spot is dropped (the legend names the series). Fixture:
 * `fixture/kit-expr16l-ends-fixture.tsx`.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import { buildExpr12Document } from './expr12-support'
import type { Expr12Document } from './expr12-support'
import { charts, paths, strikes } from './expr13-support'
import type { Box, Chart, Path } from './expr13-support'
import { CLOSE_BUDGET_MS, PHONE, closeLayoutSuite, initLayoutSuite, openFixture } from './harness'
import type { Viewport } from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const EMPTY_SPEC = { sections: [] } as FixtureSpec
const WIDE: Viewport = { name: 'wide 1800', width: 1800, height: 1200 }

let doc: Expr12Document | undefined
beforeAll(async () => {
  doc = await buildExpr12Document('ends', 'expr16l')
})
afterAll(() => doc?.cleanup())

const measured = new Map<number, Promise<{ chart: Chart; lines: Path[] }>>()
function measure(viewport: Viewport) {
  const known = measured.get(viewport.width)
  if (known !== undefined) return known
  const found = (async () => {
    const page = await openFixture(EMPTY_SPEC, viewport, doc!.path, 'reduce', 'fine')
    await page.raw.waitForSelector('[data-testid="x16-ends"] svg.ts-chart')
    await page.settle()
    const [chart] = await charts(page, ['x16-ends'])
    return { chart: chart!, lines: await paths(page, 'x16-ends') }
  })()
  measured.set(viewport.width, found)
  return found
}

/** Half of a label's ink, px: its text box is taller (ascender and descender room) than the glyphs. */
const INK_HALF_PX = 4
const KEYS = ['lint', 'types', 'build', 'deps', 'deploy', 'docs', 'migration', 'flaky']

/** The box a line has to pass through to strike the label's glyphs. */
const inkOf = (box: Box): Box => {
  const middle = (box.t + box.b) / 2
  return { ...box, t: middle - INK_HALF_PX, b: middle + INK_HALF_PX }
}

layout('end labels among converging lines (n79 surge)', () => {
  for (const viewport of [WIDE, PHONE]) {
    test(`no end label is struck by another line at ${viewport.width}`, async () => {
      const { chart, lines } = await measure(viewport)
      const labels = chart.marks.filter((m) => m.tag === 'text' && m.key.includes('-end-label'))
      const struck = labels.flatMap((label) =>
        lines
          .filter((p) => !label.key.startsWith(`${p.key.split(':')[0]}-end-label`))
          .filter((p) => KEYS.some((k) => p.key.startsWith(`${k}:`) || p.key === k))
          .filter((p) => strikes(p, inkOf(label.box)))
          .map((p) => `${label.text} struck by ${p.key}`),
      )
      expect(struck).toEqual([])
    })
  }
})
