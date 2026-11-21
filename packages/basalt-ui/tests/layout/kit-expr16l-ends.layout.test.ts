/**
 * Expression cycle 16 kit fixes, end labels (`v3-expr-16-kit-fixes` 3, n79 `?fixture=surge`), in real Chrome at
 * 1800 and 390: eight lines converge on the plot's right edge and every series keeps its end label (the chart
 * names its series by `endLabels` and draws no legend, so a dropped label would leave one unnamed). Fixture:
 * `fixture/kit-expr16l-ends-fixture.tsx`.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { FixtureSpec } from './fixture/spec'
import { buildExpr12Document } from './expr12-support'
import type { Expr12Document } from './expr12-support'
import { charts, paths } from './expr13-support'
import type { Chart, Path } from './expr13-support'
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

const KEYS = ['lint', 'types', 'build', 'deps', 'deploy', 'docs', 'migration', 'flaky']

layout('end labels among converging lines (n79 surge)', () => {
  for (const viewport of [WIDE, PHONE]) {
    test(`every series keeps its end label at ${viewport.width}`, async () => {
      const { chart } = await measure(viewport)
      const labels = chart.marks.filter((m) => m.tag === 'text' && m.key.includes('-end-label'))
      const named = KEYS.filter((k) => labels.some((m) => m.key.startsWith(`${k}-end-label`)))
      expect(named).toEqual(KEYS)
      expect(labels.every((m) => m.text.trim() !== '')).toBe(true)
    })
  }
})
